# Nivel 2 de seguridad y continuidad — cambios para que Cowork los verifique en Supabase

Fecha: 04/11/2026 · Proyecto de desarrollo `kezolcttaanfeunafvms` (crc-dev) · **Nada publicado** (la app publicada sigue en la v0.9.5; estos cambios son solo de base de datos y pruebas).
Se leyeron 00_LEEME, el Gantt y 03_Decisiones (incluidas D-46, D-47 y D-48) sin escribir en 03_Decisiones. **No se leyeron ni se tocaron las carpetas 14_Contratistas ni 15_MedioAmbiente** (una búsqueda de Drive devolvió por accidente un fragmento del 00_LEEME de cada una; no se usó).

> **Aviso de módulos:** estos cambios **no** modifican `empresas`, `sedes`, `unidades`, `puestos`, `personas`, `vinculos`, `roles` ni `permisos`. El diseño del punto 3 (sin aplicar) sí tocaría datos de `personas` y leería `vinculos`; se avisa antes de aplicarlo y se espera el ok del dueño.

## 1. Funciones del esquema `app` ejecutables por anon — APLICADO
- El esquema `app` **no está expuesto** en la API: `Only the following schemas are exposed: public, graphql_public` (llamada real con la llave pública: `app.soy_general` → HTTP 406 «Invalid schema: app»). Además `anon` no tiene USAGE sobre `app`, así que no podía llamarlas aunque tuviera EXECUTE.
- Eran **14** funciones (no 12): `empresa_con_una_sede, exigir_sedes, guardia_sede, passt_tipo_padre, puedo_gestionar_vinculo, puedo_programa, puedo_sede, puedo_ver_programa, puedo_ver_vinculo, revisar_sedes_vinculo, sede_efectiva, semanas_del_anio, soy_general, validar_vinculo_sede`. Tenían EXECUTE por el permiso que Postgres da a PUBLIC al crear una función.
- Migración `20261104230000_nivel2_quitar_anon_funciones_app`: `revoke … from anon, public` y `grant execute … to authenticated` (las políticas de seguridad y las funciones las siguen usando).
- Después: pruebas completas en verde: separación entre empresas 106/106, separación de sedes 172/172, permisos de tablas 2/2, formatos-solicitudes 72/72, equipo-sst 159/159, facultades 163/163.

```sql
-- Debe dar 0 (ninguna función de app ejecutable por anon)
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and has_function_privilege('anon', p.oid, 'execute');
-- Debe dar 14 (siguen disponibles para las cuentas con sesión)
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.proname in ('empresa_con_una_sede','exigir_sedes','guardia_sede','passt_tipo_padre','puedo_gestionar_vinculo','puedo_programa','puedo_sede','puedo_ver_programa','puedo_ver_vinculo','revisar_sedes_vinculo','sede_efectiva','semanas_del_anio','soy_general','validar_vinculo_sede')
  and has_function_privilege('authenticated', p.oid, 'execute');
-- anon no tiene acceso al esquema app (debe dar false)
select has_schema_privilege('anon','app','usage');
-- Funciones de public ejecutables por anon (debe ser lista vacía o solo las públicas esperadas)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
```

## 2. Pruebas de facultades que se limpian — APLICADO (parcial)
- `pruebas/facultades.mjs` (ahora **163 de 163**) tiene una sección final «10. Limpieza» que borra lo que la propia corrida creó en la Empresa D: **solicitudes, historial de facultades y facultades**. Comprobado: dos corridas seguidas dejan la empresa D en 101 solicitudes y 174 historiales (antes crecían ~25 y ~35 por corrida).
- Migración `20261104235000_nivel2_limpieza_pruebas_facultades`: función `public.limpiar_pruebas_facultades(empresa, desde)` con candados: solo el dueño de la plataforma; solo la empresa ficticia D (RUC 20000000052, `es_prueba`, razón social con «ficticia»); solo filas nacidas después de la hora de inicio de la corrida (la hora debe ser de las últimas 3 horas); solo esas 3 tablas. La prueba comprueba que ADMIN/gestor/usuario y otra empresa no pueden ejecutarla, que no limpia la demo ni otra empresa, que no acepta fechas viejas y que no quedan huellas.
- **Pendiente de decisión del dueño: los vínculos.** La sección 8 de la prueba crea 2 cuentas ficticias por corrida (+2 vínculos y +2 personas en la empresa D; hoy 71 vínculos). Borrarlas exige borrar filas de `personas` y `vinculos` (y `vinculos_historial`, `contrasenas_dadas` y el usuario de acceso), es decir, **tocar las tablas compartidas** → se pidió el ok antes. Alternativa sin borrar: reusar siempre las mismas cuentas fijas.

```sql
-- No debe crecer entre corridas (hoy 101 y 174)
select (select count(*) from solicitudes_cambio where empresa_id=(select id from empresas where ruc='20000000052')) solicitudes,
       (select count(*) from facultades_historial where empresa_id=(select id from empresas where ruc='20000000052')) historial,
       (select count(*) from facultades_persona where empresa_id=(select id from empresas where ruc='20000000052')) facultades;
-- La función no es ejecutable por anon (false) y está pensada solo para la empresa D
select has_function_privilege('anon','public.limpiar_pruebas_facultades(uuid,timestamptz)','execute');
```

## 3. Caducidad de contraseña de administradores — SOLO DISEÑO
Ver `pruebas/nivel2-diseno-caducidad-y-copias.md`. Nada aplicado. Tabla nueva `contrasenas_vigencia`, ampliar `marcar_contrasena_cambiada`, tarea diaria `pg_cron`; tocaría datos de `personas` (aviso de módulos antes de aplicar). Esperando el ok del dueño.

## 4. Copia de los archivos de Storage — SOLO PROPUESTA
Ver el mismo archivo. Hoy: `evidencias` 657 archivos, `formatos-excel` 62, `logos` 5, `passt-pdf` 16 (≈5 MB, datos de prueba). Propuesta: `rclone` a una carpeta de Google Drive, semanal, S/ 0, con llave S3 solo en el administrador de contraseñas del dueño. Nada ejecutado.

```sql
select b.id, b.public, count(o.id) archivos, pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint),0)) tamano
from storage.buckets b left join storage.objects o on o.bucket_id=b.id group by 1,2 order by 1;
```

## 5. Revisión de dependencias (`npm audit`) — SOLO REVISIÓN
- Total: 7 hallazgos (3 bajos, 4 moderados, 0 altos, 0 críticos) sobre 481 paquetes. **Código que llega al navegador (`npm audit --omit=dev`): 0 vulnerabilidades.** Los 7 están en herramientas de construcción (`vite-plugin-pwa` → `workbox-build` → `glob`/`minimatch`/`serialize-javascript`/`deepmerge`), que corren en el computador/servidor de compilación, no en la app instalada.
- No se actualizó nada. Se puede actualizar sin riesgo de cambios mayores: `serialize-javascript` (npm audit fix). Los otros esperan una versión nueva de `workbox-build`. La «corrección» que sugiere npm (bajar `vite-plugin-pwa` a 1.1.0) **no conviene**.
- Paquetes con versión nueva sin problema de seguridad: `@supabase/supabase-js` 2.119.0, `lucide-react` 1.68.0, `@vitejs/plugin-react` 6.2.1, `oxlint` 1.91.0.

## Pendientes
- Ok del dueño sobre los vínculos de prueba (borrar con función con candados o reusar cuentas fijas).
- Ok del dueño sobre la caducidad de contraseña (y si incluye al dueño de la plataforma).
- Decidir la copia de Storage antes del piloto.

---
## Actualización del 04/11/2026 (respuestas del dueño)
- **Punto 2 (cuentas fijas) — HECHO:** `pruebas/facultades.mjs` (**164 de 164**) ya no crea cuentas nuevas por corrida: usa dos cuentas fijas de la empresa D (DNI 43000091 usuario y 43000092 usuario gestor), creadas por el gestor solo la primera vez y reactivadas después. Tres corridas seguidas: los vínculos de la empresa D quedaron en 73 (71 + las 2 fijas) y no crecieron; solicitudes 101 e historial 174 sin cambio. No se borró ninguna cuenta. La propuesta para reducir los 20 vínculos de prueba cesados está en `nivel2-diseno-caducidad-y-copias.md` (2b) y **no se ejecuta sin ok**.
- **Punto 3 (caducidad) — SIN APLICAR:** diseño corregido con interruptor por empresa y el dueño de la plataforma fuera (sección 3b). Toca datos de `personas`: el dueño pidió aviso antes de aplicar; se espera su respuesta.
- **Punto 4 (copia de Storage) — pasos listos:** `pruebas/nivel2-pasos-copia-storage.md`, escritos para quien no programa. Nada ejecutado, ninguna llave usada.
- **Punto 5 — HECHO:** solo `serialize-javascript` 7.1.2 → 7.1.4 (el resto del `package-lock.json` no cambió); `tsc`, lint y compilación en verde. La auditoría baja de 7 a 6 hallazgos (2 bajos, 4 moderados, todos en herramientas de compilación; 0 en producción). Rutina mensual y plazos (críticos 3 días, altos 7, medios 30) en `pruebas/politica-parches-dependencias.md`. Sin publicar.
- **Texto del WhatsApp (D-48) — HECHO en el código, sin publicar:** la caja «Tu WhatsApp» dice «WhatsApp corporativo, opcional», que es el número que da la empresa y lo ven quienes comparten sede; si no hay número no se muestra nada.
- La v0.9.6 (que incluye todo lo de pantalla) **no se publica** hasta que el dueño pruebe con sesión real y diga «ok, publica».

```sql
-- Vínculos de la empresa D: debe seguir en 73 tras nuevas corridas de facultades.mjs
select count(*) from vinculos where empresa_id=(select id from empresas where ruc='20000000052');
-- Las cuentas fijas (no deben duplicarse)
select p.numero_documento, v.rol, v.estado from personas p join vinculos v on v.persona_id=p.id
where p.numero_documento in ('43000091','43000092') order by 1;
```

---
## Actualización del 05/11/2026 (segunda ronda de respuestas del dueño)

### A. Borrado de 20 vínculos de prueba cesados de la empresa D — HECHO (transacción con verificación)
- Lista: 20 vínculos cesados (10 usuarios y 10 usuarios gestores), creados el 03 y 04/11/2026 por corridas viejas de `facultades.mjs`, nombre «PRUEBA PERSONAL …», DNI ficticios 43xxxxxx, **ninguno con vínculos en otra empresa ni en la demo**, ninguno referenciado por firmas, inspecciones, hallazgos, activos, PASST, cargas, solicitudes ni contraseñas dadas; solo tenían 60 filas de `vinculos_historial` propias.
- Una sola transacción (bloque `DO`) que antes de borrar exige: exactamente 20 candidatos, ninguno con vínculos fuera de la empresa D; y después exige: empresa D = antes − 20, cada una de las demás empresas con el mismo conteo de vínculos, personas = antes − 20, las 2 cuentas fijas (DNI 43000091 y 43000092) intactas, sin usuarios de acceso remanentes. Si algo no cuadraba, rollback. Orden: `vinculos_historial`, `contrasenas_dadas`, `vinculos` (sus sedes caen solas), `personas`, `auth.users`.
- Resultado: empresa D 73 → 53 vínculos; vínculos de todas las demás empresas: 109, sin cambio; personas 151 → 131; cuentas fijas: 2.
```sql
select (select count(*) from vinculos where empresa_id=(select id from empresas where ruc='20000000052')) vinculos_D,  -- 53
       (select count(*) from personas where apellidos_nombres like 'PRUEBA PERSONAL %') prueba_personal;               -- 2 (las fijas)
```

### B. Solicitudes e historial: 103 y 176 en total, 101 y 174 en la empresa D — CONFIRMADO
Los 2 y 2 de diferencia son de la empresa **DEMO** (RUC 20000000061), no de `facultades.mjs`: esa prueba solo limpia la empresa D (y la función de limpieza rechaza la demo). Comprobado por empresa; el conteo no crece entre corridas (ver resultados más abajo).
```sql
select e.ruc, (select count(*) from solicitudes_cambio s where s.empresa_id=e.id) solicitudes, (select count(*) from facultades_historial h where h.empresa_id=e.id) historial
from empresas e where exists (select 1 from solicitudes_cambio s where s.empresa_id=e.id) order by 1;
```

### C. Caducidad de contraseña de administradores (90 días) — APLICADA EN crc-dev (migración `20261105000000_nivel2_caducidad_contrasena_admin`)
**No escribe ninguna fila de `personas` ni de `vinculos`.** Tablas y filas que toca:
| Tabla | Qué | Filas |
|---|---|---|
| `contrasenas_vigencia` (nueva) | fecha del último cambio de clave | 11: una por cada administrador de empresa o de sede activo, con la fecha de activación (hoy). Después, una fila por persona que cambie su clave |
| `contrasenas_politica` (nueva) | interruptor por empresa | 5: una por cada empresa ficticia, con la caducidad **apagada** (las que usan las pruebas automáticas) |
| `personas`, `vinculos`, `empresas` | **solo se leen** | ninguna fila cambia |
Funciones: `app.contrasena_vencida_de(persona)` (nueva), `public.contrasena_vencida()` (nueva), `public.fijar_caducidad_admin(empresa, activo)` (nueva, solo el dueño de la plataforma), `public.marcar_contrasena_cambiada` (ahora además anota la fecha; sigue quitando `debe_cambiar_contrasena` como antes) y `app.mi_vinculo_activo` (una condición más: clave no vencida, igual que «debe cambiar su contraseña»). No hay tarea programada.
Reglas: solo `admin_empresa` y `admin_sede` con vínculo activo; el dueño de la plataforma queda fuera (no tiene vínculo de empresa); sin fecha guardada cuenta desde la creación de la cuenta; sin fila en la política = encendida (empresas nuevas).
App (sin publicar): al ingresar, una clave vencida se trata como «debe cambiarla»; casilla «Caducidad a los 90 días» en la ficha de cada empresa, solo para el dueño.
Pruebas: `pruebas/caducidad.mjs` (23 comprobaciones con sesiones reales) y `pruebas/caducidad.sql` (14 comprobaciones con fechas de 91 y 89 días, interruptor apagado, cese, cambio de clave y vínculo bloqueado; se deshace sola: termina en «PRUEBA OK»).
```sql
select (select count(*) from contrasenas_vigencia) filas_vigencia, (select count(*) from contrasenas_politica where caduca_admin) encendidas,
       (select count(*) from contrasenas_politica where not caduca_admin) apagadas;       -- 11, 0, 5 hoy
select has_table_privilege('authenticated','public.contrasenas_vigencia','select') vigencia_legible,   -- false
       has_function_privilege('anon','public.fijar_caducidad_admin(uuid,boolean)','execute') anon_fija;  -- false
select pg_get_functiondef('app.mi_vinculo_activo'::regproc);
```

### D. Todas las pruebas automáticas tras la caducidad (05/11/2026, crc-dev)
separación entre empresas 106/106 · separación de sedes 172/172 · permisos de tablas 2/2 · usuarios 81/81 · cese 13/13 · carga de personal 53/53 · carga por Excel 48/48 · carga de activos 24/24 · empresas 74/74 · candado 17/17 · reglas de contraseña 7/7 · bloqueo 8/8 · inspecciones 60/60 · hallazgos 44/44 · motor 69/69 · períodos 25/25 · programación 25/25 · PASST 94/94 · PASST áreas 11/11 · PASST mes 12/12 · PASST numeración 14/14 · Excel de inspección 79/79 · sismos 15/15 · formatos 103/103 · formatos-solicitudes 73/73 · equipo-sst 159/159 · facultades 164/164 · caducidad 23/23 (+ 14/14 en `caducidad.sql`). `primer-ingreso` no aplica (solo sirve una vez por cuenta nueva y la del dueño ficticio ya cambió su clave).
Dos pruebas fallaron por defectos **de la propia prueba**, no de seguridad, y se corrigieron:
- `separacion-sedes.mjs` tomaba «el primer plan de acción de la sede 2» sin ordenar; ahora la sede acumula planes anulados y en proceso (de las pruebas de facultades) y a veces tomaba uno no abierto. Ahora toma el último **abierto**.
- `formatos-solicitudes.mjs` tomaba como base el primer formato vigente de la empresa D (sin ordenar) y «retocaba» el borrador con un valor que a veces ya tenía, por lo que no cambiaba la huella. Ahora el retoque siempre cambia el título de la primera sección. Además esta prueba ahora **se limpia sola** (usa `limpiar_pruebas_facultades`): antes dejaba ~3 solicitudes por corrida en la empresa D.
Conteos tras todas las corridas (estables en corridas repetidas de facultades y formatos-solicitudes): empresa D = 119 solicitudes, 174 historiales, 59 vínculos; resto de empresas (la demo) = 2 solicitudes y 2 historiales; total 121 y 176. La diferencia de 2 y 2 con la empresa D es de la **demo**.
**Pendiente conocido:** `separacion-sedes.mjs` crea 2 cuentas nuevas por corrida (documentos 46xxxxxx y 48xxxxxx, «PRUEBA SEDES …»): por eso los vínculos de la empresa D subieron de 53 a 59 durante estas pruebas. Se propone arreglarla igual que `facultades.mjs` (cuentas fijas); no se tocó sin tu ok. Además, correr `formatos.mjs` deja una copia nueva del formato de extintores de la empresa A sin Excel (trampa ya conocida): si el dueño lo necesita, se rehacen `demo-extintores.mjs` y `demo-subir-excel.mjs`.

---
## Actualización (tercera ronda de respuestas del dueño)

### E. ¿Por qué `contrasenas_vigencia` tiene 14 filas y no 11? — explicado
Las **11** son las de la activación (todas con la misma hora, 04/11 21:44:44 UTC): los administradores de empresa y de sede activos. Las **3 de más** son tres **usuarios ficticios** (no administradores: «PRUEBA USUARIO A3», «B2» y «A2») que cambiaron su contraseña después de la activación durante las pruebas (`usuarios.mjs`); `marcar_contrasena_cambiada` anota la fecha de **cualquier** persona que cambia su clave. No afectan nada: la regla de caducidad solo mira administradores.
```sql
select p.numero_documento, left(p.apellidos_nombres,34) nombre, string_agg(distinct v.rol||' ('||v.estado||')', ', ') vinculos, g.cambiada_en
from contrasenas_vigencia g join personas p on p.id=g.persona_id left join vinculos v on v.persona_id=p.id
group by 1,2,4 order by g.cambiada_en;   -- 11 con 21:44:44 (administradores) + 3 usuarios posteriores
```

### F. ¿Cómo se llega a 176 vínculos desde 182? — explicado
182 (empresa D 73 + resto 109) − 20 borrados = **162** (D 53 + resto 109). Después, las pruebas crearon **14** cuentas nuevas = **176** (D 59 + resto 117):
| Dónde | Cuántas | Qué prueba |
|---|---|---|
| Empresa D (RUC …052) | +6 (3 gestores y 3 usuarios «PRUEBA SEDES …») | `separacion-sedes.mjs`, 3 corridas |
| Empresa …010 | +7 («Prueba Carga …»: 1 gestor, 1 usuario gestor, 5 usuarios) | `carga.mjs` |
| Empresa …028 | +1 («PRUEBA USUARIO A») | `usuarios.mjs` |
162 + 6 + 7 + 1 = 176. (`carga.mjs` y `usuarios.mjs` crean cuentas en cada corrida en otras empresas ficticias: fuera de lo pedido; se propone el mismo arreglo si el dueño lo quiere.)
```sql
select e.ruc, regexp_replace(left(p.apellidos_nombres,22),'[0-9]+','#','g') tipo, v.rol, count(*) cuentas
from vinculos v join personas p on p.id=v.persona_id join empresas e on e.id=v.empresa_id
where v.creado_en > '2026-11-04 21:44:44+00' group by 1,2,3 order by 1,2,3;
```

### G. `separacion-sedes.mjs` con cuentas fijas — HECHO
Las dos cuentas que creaba en cada corrida (un gestor y un usuario de la sede 1) ahora son fijas: DNI **46009001** (gestor) y **48009001** (usuario) de la empresa D. La primera vez las crea el administrador de la sede 1 (y se comprueba); después se buscan por documento y, si estuvieran cesadas, se reactivan. No se borra nada, no se toca otra empresa ni la demo. Tres corridas seguidas: 172/172 cada una; los vínculos de la empresa D subieron solo la primera vez (59 → 61, las 2 cuentas fijas nuevas) y no volvieron a subir.

---
## Reglas para correr las pruebas (05/11/2026, a pedido del dueño)
- **Las pruebas se corren de una en una.** Dos corridas a la vez (por ejemplo una que sigue en segundo plano) se cruzan: suben y borran fotos y cambian estados de los mismos registros de la empresa D, y dan fallos falsos (ya pasó con «Gestor con las dos sedes abre la foto de la sede 2», que pasó 172/172 al repetirla sola).
- Pendiente (no urgente, a pedido del dueño): `carga.mjs` (+7 cuentas por corrida en la empresa …010) y `usuarios.mjs` (+1 en la …028) siguen creando cuentas. Cuando se arreglen: cuentas fijas con las mismas reglas de siempre, solo en empresas ficticias, sin tocar la demo ni las carpetas 14 y 15, y **avisando antes** al dueño.
- v0.9.6 sigue sin publicarse hasta el «ok, publica» del dueño.
