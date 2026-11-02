# Etapa 1 del punto 2: sedes y administrador de sede — cambios para que Cowork los verifique en Supabase

Fecha: 02/11/2026 · Proyecto de desarrollo `kezolcttaanfeunafvms` (crc-dev) · **Nada publicado** (ni la app ni nada en producción).
Diseño aprobado: `pruebas/diseno-etapa1-sedes.md` (incluye el anexo con los cuatro puntos del dueño).

> Esta tarea cambió tablas que usan los módulos de contratistas y medio ambiente (`vinculos`, `roles`, `permisos`/`roles_permisos`, `sedes` y las reglas de lectura de `personas`).
> No se tocaron las carpetas `14_Contratistas` ni `15_MedioAmbiente`. Falta la respuesta del dueño sobre si hay que actualizar el esquema.

## 1. Qué hay que verificar en Supabase (roles, permisos, vínculos, sedes)

### Roles
- Rol nuevo **`admin_sede`** («Administrador de sede», orden 2). `gestor` pasó al orden 3 y `usuario` al 4.
- `admin_empresa` sigue siendo el **administrador general**: no tiene filas de sedes y ve todas las de su empresa.
- Solo el dueño de la plataforma crea y cesa administradores (general y de sede).

### Permisos del rol `admin_sede` (18)
`activos.editar, cuentas.cesar, cuentas.contrasena, cuentas.crear, hallazgos.cerrar_propios, hallazgos.gestionar, inspecciones.anular, inspecciones.editar_cerrada, inspecciones.registrar, inspecciones.ver, passt.aprobar, passt.editar, passt.marcar_manual, passt.reprogramar, passt.ver, personas.editar, personas.ver_empresa, personas.ver_nombres`

Los permisos que tiene `admin_empresa` y **no** `admin_sede` (6): `empresa.editar_contactos, empresa.editar_logos, empresa.ver_contactos, listas.editar, plantillas.editar, plantillas.publicar`.

`roles_asignables`: `admin_empresa → gestor, usuario` y `admin_sede → gestor, usuario`. Nadie asigna administradores desde la app.

### Vínculos y sedes
- Tabla nueva **`vinculos_sedes(vinculo_id, sede_id, empresa_id)`**: las sedes de cada cuenta. Trigger `vinculos_sedes_validar` (la sede debe ser de la misma empresa y estar activa).
- Regla: todo vínculo **activo** que no sea `admin_empresa` tiene al menos una sede (triggers diferidos `vinculos_exigir_sedes` y `vinculos_sedes_exigir`).
- Relleno inicial: a todos los gestores y usuarios que ya existían se les dieron **todas** las sedes de su empresa (no cambia lo que veían). Hoy: 92 filas; 0 vínculos activos no generales sin sede.
- Funciones nuevas (`app.`): `soy_general`, `puedo_sede`, `sede_efectiva`, `empresa_con_una_sede`, `puedo_programa`, `puedo_ver_programa`, `puedo_ver_vinculo`, `puedo_gestionar_vinculo`, `exigir_sedes`, `revisar_sedes_vinculo`, `validar_vinculo_sede`, `guardia_sede`.
- Funciones nuevas (`public.`): `puedo_crear_cuenta(empresa, rol, sedes[])` (reemplaza a la de 2 parámetros, que se borró), `alta_vinculo(jsonb)` (solo `service_role`), `asignar_sedes(vinculo, sedes[])`.
- Trigger `guardia_sede` (antes de escribir) en `activos`, `ubicaciones`, `hallazgos`, `inspecciones`, `passt_programas`: quien no es administrador general ni dueño solo toca filas de sus sedes. Una inspección que llega de una sede que la persona ya no tiene se rechaza con 403 «Ya no tienes acceso a esa sede: la inspección no se puede recibir» (queda en el equipo, como una persona cesada).
- Políticas RLS reescritas por sede: `vinculos_sedes`, `vinculos`, `personas`, `vinculos_historial`, `contrasenas_dadas`, `cargas_personal`, `activos`, `ubicaciones`, `activos_historial`, `hallazgos`, `inspecciones`, `inspecciones_ediciones`, `passt_programas`, `passt_nodos`, `passt_historial`, `passt_semanas`, `passt_metas`. La tabla `sedes` sigue legible para toda la empresa (hace falta para elegir sedes).
- Funciones de lectura que se saltaban las reglas de tablas y ahora filtran por sede: `avance_periodo`, `passt_ejecucion`, `passt_hallazgos`, `passt_responsables`, `passt_trabajadores`, `numero_trabajadores`, `personas_de_mi_empresa`, `uso_almacenamiento`, `puedo_ver_evidencia`, `puedo_subir_evidencia` (fotos y firmas).
- Funciones de escritura con revisión de sede: `passt_para_cambiar`, `guardar_nodo`, `programar_semana`, `aprobar_programa`, `cambiar_vigencia_programa`, `crear_programa`, `duplicar_programa`, `marcar_semana`, `cesar_vinculo`, `reactivar_vinculo`, `confirmar_sigue`, `actualizar_persona`, `grabar_carga`.
- Programa anual del PASST: el programa **general** (todas las sedes) de una empresa con varias sedes solo lo edita y aprueba el administrador general; el de una sede, el administrador de esa sede. En una empresa de una sola sede, el general aprueba y los gestores siguen editando.

### Migraciones aplicadas (en este orden)
`20261102141507_sedes_cuentas`, `20261102141617_sedes_lectura_y_guardia`, `20261102150440_alta_vinculo_solo_por_permisos`, `20261102150658_sedes_arreglo_trigger_revisar`, `20261102151316_sedes_asignar_exige_sede_en_comun`, `20261102160000_numero_trabajadores_cubre_todas_las_sedes`, `20261102163000_quitar_puedo_crear_cuenta_sin_sedes`, `20261102163500_revocar_anon_funciones_sedes`.

### Funciones del servidor (edge) desplegadas en crc-dev
- `crear-cuenta` (v10): recibe `sedes`; si falta y la empresa tiene una sola sede (o quien crea tiene una sola), la pone sola; si no, 400 «Elige las sedes de la cuenta». Crea el vínculo con `alta_vinculo`.
- `carga-personal` (v6): recibe `sedes`; la carga solo revisa y deja «por revisar» a las personas de esas sedes.
- Sin cambios: `dar-contrasena`, `cambiar-contrasena`, `ingresar`, `registrar-inspeccion`.

### Consultas para comprobar
```sql
select codigo, orden, nombre from roles order by orden;
select permiso from roles_permisos where rol = 'admin_sede' order by 1;
select rol, rol_asignable from roles_asignables order by 1, 2;
select count(*) from vinculos v where estado = 'activo' and rol <> 'admin_empresa'
  and not exists (select 1 from vinculos_sedes s where s.vinculo_id = v.id);   -- debe dar 0
select polname, polrelid::regclass from pg_policy where polrelid::regclass::text in
  ('vinculos_sedes','vinculos','personas','activos','inspecciones','hallazgos','passt_programas') order by 2, 1;
```

## 2. Resultados de las pruebas (crc-dev, 02/11/2026)

| Prueba | Resultado |
|---|---|
| **separacion-sedes** (nueva: dos sedes de la misma empresa) | **161 de 161** |
| separacion (entre empresas) | 105 de 105 |
| usuarios | 81 de 81 |
| cese | 13 de 13 |
| carga / carga-excel / carga-activos | 44 / 48 / 24, todas pasan |
| formatos | 103 de 103 |
| inspecciones | 60 de 60 |
| hallazgos | 44 de 44 |
| programacion / periodos | 25 / 25 |
| passt / passt-area / passt-mes / passt-numeracion | 69 / 11 / 12 / 14, todas pasan |
| motor / excel-inspeccion | 71 / 79 |
| candado / reglas-contrasena / sismos | 17 / 7 / 15 |
| empresas | 69 de 71 (ver nota) |

Nota sobre `empresas`: fallan 2 comprobaciones («GESTOR_A y USUARIO_A2 SÍ pueden ver el logo de su empresa»). No tienen que ver con las sedes: el logo de la empresa A hoy es `positivo.webp` (se cambió al probar los logos) y la prueba busca `positivo.png`.
No se corrieron `bloqueo` y `primer-ingreso` (cambian cuentas: bloquean a USUARIO_B 15 minutos y rotan la clave del dueño ficticio).

La prueba nueva usa la **empresa D** (RUC 20000000052, ficticia, dos sedes) y cuentas ficticias nuevas (documentos 41000001–41000006). El RUC 20000000044 queda libre porque `empresas.mjs` lo reserva.

Cubre, entre otras cosas: activos y ubicaciones por sede; inspecciones registradas desde la sede propia y rechazadas desde la ajena; planes de acción; **fotos y firmas** (admin de la sede 1 no abre, no lista ni sube la foto de una inspección de la sede 2; el firmante sí abre la suya); las funciones de lectura; programa general vs. de sede y quién aprueba; crear/cesar/dar contraseña/asignar sedes con el límite del administrador de sede; **quitar una sede a quien tiene un envío pendiente** (403 y no se graba nada); y que ninguna cuenta de las empresas A o B ve nada de la empresa D.

## 3. Errores que se encontraron y corrigieron al probar
1. `alta_vinculo` comprobaba `auth.role()`, que falla con las claves nuevas: ahora se limita solo por permiso de ejecución (`service_role`).
2. Trigger diferido `revisar_sedes_vinculo` leía `old.vinculo_id` también al insertar un vínculo: ahora distingue la tabla.
3. `asignar_sedes` dejaba que el administrador de la sede 1 le pusiera su sede a un gestor de la sede 2: ahora exige compartir al menos una sede con la cuenta.
4. `numero_trabajadores` no contaba a los administradores generales para quien tiene todas las sedes (21 en vez de 23).
5. Quedaba la versión vieja de `puedo_crear_cuenta` sin sedes: se borró.

## 4. Lo que falta / no verificado
- **No se probó la pantalla con una sesión real**: la app compila (`tsc` sin errores) y pasa el linter, pero no se abrió en el navegador con una cuenta de administrador de sede.
- Pantallas hechas (solo local, sin publicar): selector de sede en la barra (solo sale con más de una sede; filtra inspecciones, planes de acción, activos, programas del PASST y personas), sede automática al registrar (la única de la cuenta, o la elegida en el selector), alta y corrección de cuentas con sedes, carga desde Excel por sede, el dueño crea administradores generales y de sede (con sus sedes), ficha de empresa recortada para el administrador de sede y programa general del PASST solo para el administrador general. Falta verlas con una sesión real.
- El filtro del selector se hace en la pantalla; lo que de verdad se puede ver lo decide siempre la base de datos.
- El nombre del rol en la base sigue como «Administrador de empresa»; en las pantallas se muestra «Administrador general».
- Etapa 2 (usuario gestor) y etapas 3 y 4: no empezadas, como se acordó.
