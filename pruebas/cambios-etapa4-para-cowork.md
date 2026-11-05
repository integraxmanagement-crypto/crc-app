# Etapa 4 del punto 2: «Conoce al equipo de SST» y roles adicionales como etiquetas — cambios para que Cowork los verifique en Supabase

Fecha: 04/11/2026 · Proyecto de desarrollo `kezolcttaanfeunafvms` (crc-dev) · **Nada publicado** (la app publicada sigue en la v0.9.4; la etapa 3 tampoco está publicada).
Decisiones previas del dueño: los roles adicionales (miembro del comité, brigadista, monitor de seguridad, otro) son **solo etiquetas, sin permisos**; el WhatsApp es un dato personal.
Decisión que tomé por defecto y el dueño puede cambiar: **el WhatsApp lo escribe cada gestor, el suyo, y es opcional** (pregunta 5 pendiente del alcance del 30/10).

> **Aviso de módulos: esta tarea NO cambió tablas que usen los módulos de contratistas y medio ambiente** (`empresas`, `sedes`, `unidades`, `puestos`, `personas`, `vinculos`, `roles`, `permisos`). Solo agregó **dos tablas nuevas** que apuntan a `vinculos` y `empresas` por llave foránea (no modifican esas tablas). No cambió roles ni permisos. No se leyeron ni se actualizaron las carpetas 14 y 15.

## 1. Qué hay que verificar en Supabase
Migración aplicada en crc-dev: `20261104140000_etapa4_equipo_sst_y_etiquetas` (archivo en `supabase/migrations/`).

- `public.contacto_sst` (`vinculo_id` PK → `vinculos` on delete cascade, `empresa_id`, `whatsapp` con formato `+` y 8 a 15 cifras, `actualizado_en`). RLS: cada cuenta solo lee **su propia** fila. Nadie escribe directo (solo `select` para `authenticated`).
- `public.etiquetas_persona` (`vinculo_id`, `etiqueta` ∈ miembro_comite / brigadista / monitor_seguridad / otro, `detalle` obligatorio solo en «otro», `asignado_por`, `asignado_en`; PK `(vinculo_id, etiqueta)`). RLS: la propia cuenta y quien puede gestionarla. Sin escritura directa.
- `public.guardar_mi_whatsapp(text)`: solo el rol `gestor` y solo el suyo; normaliza (quita espacios y signos; 9 cifras que empiezan en 9 → `+51…`); texto vacío lo borra.
- `public.equipo_sst()`: devuelve los gestores **activos** de las sedes de quien consulta (administrador general: toda la empresa; dueño sin empresa: nada). Solo `vinculo_id, nombre, puesto, whatsapp, sedes`: no devuelve documento ni correo.
- `public.dar_etiqueta(vinculo, etiqueta, detalle)` / `quitar_etiqueta(vinculo, etiqueta)`: usan `app.puedo_gestionar_vinculo(…, 'personas.editar')` (las mismas reglas de sede y de roles asignables que ya valen para crear, corregir y cesar cuentas): el gestor marca a usuarios y usuarios gestores de sus sedes; el administrador de sede, a gestores, usuarios y usuarios gestores de su sede; el general, a cualquiera de la empresa; nadie a sí mismo. Las etiquetas **no** cambian `mis_permisos()`.
- Todas las funciones nuevas: sin permiso de ejecución para `anon`.

```sql
select tablename, rowsecurity from pg_tables where tablename in ('contacto_sst','etiquetas_persona');   -- true, true
select grantee, privilege_type from information_schema.role_table_grants where table_name in ('contacto_sst','etiquetas_persona') and grantee in ('anon','authenticated');  -- solo SELECT a authenticated
select proname, has_function_privilege('anon', oid, 'execute') from pg_proc where proname in ('guardar_mi_whatsapp','equipo_sst','dar_etiqueta','quitar_etiqueta');  -- todas false
```

## 2. Pruebas (crc-dev, 04/11/2026)
| Prueba | Resultado |
|---|---|
| **equipo-sst** (nueva) | **63 de 63** |
| facultades · separación de sedes · separación entre empresas · permisos de tablas | 147 de 147 · 172 de 172 · 106 de 106 · 2 de 2 |

La prueba nueva usa la empresa D (ficticia) y deja todo limpio (borra los números y las etiquetas que crea). Se puede repetir.

## 3. Lo que no está o no se verificó
- **Pantallas no probadas con una sesión real.** Hecho (solo local): «Equipo de SST» en el menú lateral de todas las cuentas con empresa; en el inicio de quien no es del equipo SSO aparece la tarjeta «Conoce al equipo de SST»; el gestor escribe su WhatsApp en la pantalla del equipo; en Usuarios, «Roles adicionales» por cuenta (casillas). Compila y pasa el linter.
- El administrador (general o de sede) no ve el WhatsApp de un gestor por ninguna vía distinta de la pantalla del equipo, y no puede escribirlo ni borrarlo.
- Un gestor cesado sale del equipo (solo se listan vínculos activos); su número queda guardado en la tabla hasta que se borre la cuenta. Lo dejé así a propósito; se puede cambiar si el dueño prefiere borrarlo al cesar.
- Quedan para después: «novedades» en el inicio y el tablero del usuario gestor.

## 4. Ajuste del 04/11/2026 (después de la v0.9.5): organigrama e interruptor por empresa — SIN PUBLICAR
Migración aplicada en crc-dev: `20261104180000_etapa4b_organigrama_equipo_sst` (archivo en `supabase/migrations/`).
- `public.equipo_sst_config` (`empresa_id` PK, `habilitado`, `actualizado_en`): tabla **nueva**, RLS de solo lectura (el dueño lee todas; cada empresa, la suya). Sin fila = habilitado.
- `public.fijar_equipo_sst(empresa, habilitado)`: **solo el dueño de la plataforma** (`app.exigir_dueno()`); rechaza una empresa que no existe. `public.equipo_sst_habilitado()`: lo que ve cada empresa.
- `public.equipo_sst()` ahora trae también al administrador general, a los de sede y a los usuarios gestores (con su `rol`); el WhatsApp sigue saliendo solo en los gestores; devuelve vacío si el dueño la deshabilitó. Se vuelve a crear la función (cambió su forma de salida).
- Pantalla: organigrama (administrador general arriba, una rama por sede: administrador de sede → gestores → usuarios gestores). El dueño tiene el interruptor en la ficha de cada empresa.
- Prueba `equipo-sst`: **84 de 84** (63 anteriores ajustadas + 21 nuevas); permisos de tablas 2 de 2.
- **No cambia tablas compartidas** (`empresas`, `sedes`, `unidades`, `puestos`, `personas`, `vinculos`, `roles`, `permisos`): sin aviso de módulos. No se tocaron las carpetas 14 y 15.
- Sin verificar: el aspecto del organigrama en pantalla con una sesión real.

## 5. Organigrama propio y editable (04/11/2026, tras el ajuste 4) — SIN PUBLICAR
Pedido del dueño: «Equipo de SST» muestra solo el equipo de SST, con puestos y nombres, sin decir si es gestor o administrador; administradores y gestores pueden cambiar nombres, agregar ramas, etc. Migración aplicada en crc-dev: `20261104200000_etapa4c_organigrama_editable`.
- `public.equipo_sst_nodos` (tabla **nueva**: `empresa_id`, `sede_id` nulo = «de toda la empresa», `padre_id` con borrado en cascada, `puesto` 2–60, `nombre` nulo o 2–80 = por cubrir). RLS: solo lectura, según `app.veo_nodo_equipo` (empresa propia, sección habilitada por el dueño, y sede propia o puesto de toda la empresa). Sin escritura directa.
- Escritura solo por `agregar_nodo_equipo`, `editar_nodo_equipo`, `quitar_nodo_equipo` y `armar_equipo_sst_actual`, con `app.puedo_editar_equipo(sede)`: administradores general y de sede y gestores (no usuarios gestores, ni el dueño). Puestos «de toda la empresa» y armar el organigrama: solo el administrador general. Quitar un puesto quita sus ramas y exige manejar todas las sedes de esas ramas.
- El organigrama ya **no** se deriva de roles ni muestra WhatsApp; `equipo_sst()` y `contacto_sst` quedan sin uso en la pantalla (siguen en la base).
- Prueba `equipo-sst`: **128 de 128** (la sección 5 es nueva); permisos de tablas 2 de 2.
- No cambia tablas compartidas (`empresas`, `sedes`, `unidades`, `puestos`, `personas`, `vinculos`, `roles`, `permisos`): sin aviso de módulos. Carpetas 14 y 15 sin tocar.
- Sin verificar: la pantalla con una sesión real.

## 6. El WhatsApp vuelve al organigrama, solo si el gestor lo publica (04/11/2026) — SIN PUBLICAR
Corrige el punto 5 («ya no muestra WhatsApp»). Migración aplicada en crc-dev: `20261104220000_etapa4d_whatsapp_en_el_organigrama`.
- `public.equipo_sst_enlaces` (`nodo_id` PK → puesto, `vinculo_id` → cuenta; borrado en cascada): tabla **nueva**, con RLS y **sin permisos ni políticas** (nadie la lee ni escribe directo; solo las funciones).
- `vincular_nodo_equipo(puesto, cuenta)`: lo hacen quienes editan ese puesto; solo a un gestor activo de la empresa que atienda la sede del puesto (nulo desvincula). `gestores_para_vincular(sede)`: candidatos con nombre, solo para quienes editan esa sede.
- `contactos_equipo_sst()`: devuelve el WhatsApp de los puestos visibles cuyo gestor vinculado está activo **y publicó su número**; quien edita el puesto ve además la cuenta vinculada (los demás reciben `vinculo_id` nulo).
- `guardar_mi_whatsapp` no cambia: el gestor publica o borra su número (vacío = deja de verse). `armar_equipo_sst_actual()` ahora vincula a los gestores con su puesto.
- Prueba `equipo-sst`: **159 de 159** (la sección 6 es nueva). No cambia tablas compartidas: sin aviso de módulos; carpetas 14 y 15 sin tocar. Pantalla sin ver con sesión real.
