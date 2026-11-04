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
