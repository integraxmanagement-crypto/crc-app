# Etapa 3 del punto 2: el gestor pide publicar o retirar formatos — cambios para que Cowork los verifique en Supabase

Fecha: 03/11/2026 · Proyecto de desarrollo `kezolcttaanfeunafvms` (crc-dev) · **Nada publicado** (la app publicada sigue en la v0.9.4).
Decisiones del dueño (03/11/2026): solo el administrador general cambia formatos; el gestor pide (modificar uno existente, crear uno nuevo, retirar uno); los avisos van en la campana, como en la etapa 2.

> **Aviso de módulos: esta tarea NO cambió tablas que usen los módulos de contratistas y medio ambiente** (`empresas`, `sedes`, `unidades`, `puestos`, `personas`, `vinculos`, `roles`, `permisos`). No cambió roles ni permisos. Tocó `solicitudes_cambio` (tabla de la etapa 2) y dos funciones de formatos. No se leyeron ni se actualizaron las carpetas 14 y 15.

## 1. Qué hay que verificar en Supabase

Migración aplicada en crc-dev: `20261104100000_etapa3_solicitudes_formatos`.

- `solicitudes_cambio.tipo` acepta además `publicar_formato` y `retirar_formato` (constraint `solicitudes_cambio_tipo_check`).
- **Publicar** (formato nuevo o cambio de uno publicado): el gestor prepara el borrador como siempre (ya podía editar borradores) y pide la publicación con `solicitar_cambio('publicar_formato', <id de la versión borrador>, {}, motivo)`.
  - Solo `gestor` (con `solicitudes.pedir` y `plantillas.editar`) y solo sobre formatos de su empresa (no sobre los base de CRC). Un borrador por solicitud pendiente.
  - Se rechaza si el borrador no tiene código, versión y fecha de aprobación, o si no pasa la validación de publicación (`app.validar_receta(..., true)`).
  - La solicitud queda **sin sede** (`sede_id` nulo): como el formato es de toda la empresa, solo la ven y resuelven el administrador general y el dueño. El administrador de sede no.
  - Guarda en `datos` una **huella** del borrador (`app.huella_borrador`: receta, código, versión, fecha y logo).
- **Retirar**: `solicitar_cambio('retirar_formato', <id de la plantilla>, {}, motivo)`; solo si el formato está vigente.
- `resolver_solicitud`:
  - Aprobar `publicar_formato`: comprueba que el borrador siga igual que cuando se pidió (si no, rechaza con «El borrador cambió…») y ejecuta `publicar_version` **a nombre del administrador**.
  - Aprobar `retirar_formato`: ejecuta `cambiar_vigencia_plantilla(…, false)`.
  - Denegar exige un comentario (igual que antes).
- **Cambio de comportamiento a revisar:** `cambiar_vigencia_plantilla` ahora pide el permiso `plantillas.publicar` (antes `plantillas.editar`). Quien tiene `plantillas.publicar`: `admin_empresa` y el dueño. **El gestor ya no retira ni reactiva formatos directo**: lo pide.
- Lo demás de formatos no cambia: el gestor sigue copiando, creando y editando borradores; publicar sigue siendo solo del administrador general.
- `app.huella_borrador(uuid)`: función sin permiso de ejecución para `anon` ni `authenticated` (solo la usan las funciones anteriores).

### Consultas para comprobar
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'solicitudes_cambio_tipo_check';
select has_function_privilege('authenticated', 'app.huella_borrador(uuid)', 'execute');  -- debe ser false
select position('plantillas.publicar' in pg_get_functiondef('public.cambiar_vigencia_plantilla(uuid,boolean)'::regprocedure)) > 0;
select rol, permiso from roles_permisos where permiso in ('plantillas.editar','plantillas.publicar') order by 2,1;  -- sin cambios: editar = admin_empresa, gestor; publicar = admin_empresa
```

## 2. Pruebas (crc-dev, 03/11/2026)
| Prueba | Resultado |
|---|---|
| **formatos-solicitudes** (nueva) | **72 de 72** |
| facultades · separación de sedes · permisos de tablas | 147 de 147 · 172 de 172 · 2 de 2 |
| separación entre empresas | 106 de 106 (se ajustó una expectativa: `GESTOR_A` ve las cargas de personal que hizo él, desde la etapa 2) |

La prueba nueva usa la empresa D (ficticia), crea un formato propio con nombre al azar y lo retira al final: no toca los formatos de las inspecciones ni los de la empresa A. Se puede repetir.

## 3. Lo que no está o no se verificó
- **Pantallas no probadas con una sesión real.** Hecho (solo local): en el editor de formatos el gestor ve «Pedir publicar vN» con un cuadro de motivo y, en «Datos del formato», «Pedir retirar»; el administrador general ve las solicitudes en «Solicitudes de cambio» con un enlace «Ver el formato». Compila y pasa el linter.
- «Mensajes» se resolvió con los avisos de la campana (decisión del dueño); no hay mensajes entre personas ni anuncios por sede.
- Si el gestor cambia el borrador después de pedir, el administrador no puede aprobar esa solicitud (debe denegarla y el gestor la pide de nuevo). Está dicho en pantalla.
- Etapa 4 («Conoce al equipo de SST» y roles adicionales como etiquetas): no empezada.
