# Etapa 2 del punto 2: usuario gestor, facultades y solicitudes del gestor — cambios para que Cowork los verifique en Supabase

Fecha: 03/11/2026 · Proyecto de desarrollo `kezolcttaanfeunafvms` (crc-dev) · **Nada publicado** (la app publicada sigue en la v0.9.3).
Diseño aprobado por el dueño: `pruebas/diseno-etapa2-usuario-gestor.md` (sección 9 manda si contradice algo anterior).

> Esta tarea cambió tablas que usan los módulos de contratistas y medio ambiente: `roles`, `permisos`, `roles_permisos`, `roles_asignables`, y agrega tablas que cuelgan de `vinculos`.
> No se tocaron las carpetas `14_Contratistas` ni `15_MedioAmbiente`. El dueño decide si hay que actualizar el esquema de esos módulos.

## 1. Qué hay que verificar en Supabase

### Rol y permisos
- Rol nuevo **`usuario_gestor`** («Usuario gestor», orden 4; `usuario` pasa a orden 5). Empieza con los mismos permisos que `usuario` (solo `hallazgos.cerrar_propios`).
- Permisos nuevos: `facultades.dar` y `solicitudes.resolver` (`admin_empresa`, `admin_sede`); `solicitudes.pedir` (`gestor`).
- El **gestor suma** `cuentas.crear`, `cuentas.cesar`, `personas.editar`, `personas.ver_empresa`. **No** tiene `cuentas.contrasena`.
- `roles_asignables` nuevos: `admin_empresa → usuario_gestor`, `admin_sede → usuario_gestor`, `gestor → usuario`, `gestor → usuario_gestor`.

### Facultades por persona
- Tabla `facultades_persona(vinculo_id, permiso, empresa_id, otorgado_por, otorgado_en)` y `facultades_historial`. Solo se escriben con `dar_facultad` / `quitar_facultad` (nadie escribe directo: la prueba de permisos de tablas las incluye).
- Qué se puede marcar (`app.facultad_valida`): a un **usuario gestor**: `inspecciones.ver`, `inspecciones.registrar`, `hallazgos.gestionar`, `passt.ver`, `personas.ver_nombres`. A un **gestor**: `inspecciones.anular`, `inspecciones.editar_cerrada`, `passt.reprogramar` (= hacerlo sin aprobación). A nadie más.
- Quién marca: `app.puedo_gestionar_vinculo(…, 'facultades.dar')` (administrador general; administrador de sede si todas las sedes de la cuenta son suyas; nunca a sí mismo).
- `app.tengo_permiso` ahora es: permisos del rol **o** facultades de su vínculo activo. Todas las reglas que ya preguntaban por un permiso siguen igual y respetan las sedes de la etapa 1.
- Triggers: `facultades_validar` (solo a quien corresponde por rol) y `vinculos_limpiar_facultades` (al cesar o cambiar de rol se borran las que ya no corresponden y queda en el historial).
- Función `mis_permisos()` (la app la usa para ordenar las pantallas; la base decide igual).

### Solicitudes de cambio (el gestor pide, el administrador decide)
- Tabla `solicitudes_cambio` (tipo: anular_inspeccion, corregir_inspeccion, cambio_programa; estado: pendiente, aprobada, denegada, comunicada). Solo por funciones.
- `solicitar_cambio` (solo `gestor`, solo en sus sedes, solo programas **aprobados**, no si ya tiene permiso directo), `resolver_solicitud` (administrador de la sede o general; no el propio solicitante), `marcar_solicitud_vista`, `puedo_resolver_solicitud`.
- Aprobar **anular** ejecuta `anular_inspeccion` como el administrador que aprueba. Aprobar un **cambio del programa** ejecuta la operación pedida (lista fija: programar_semana, guardar_nodo, baja_nodo, mover_nodo, guardar_metas), revisando que sea del mismo programa. Aprobar una **corrección** exige que el administrador ya la haya aplicado por la ruta de siempre (`registrar-inspeccion`, modo corregir, que valida con el motor): la base comprueba que exista esa edición hecha por él.
- **Comunicaciones** (estado `comunicada`): triggers `comunicar_anulacion`, `comunicar_correccion`, `comunicar_cambio_programa` crean el aviso cuando un **gestor** hace directo, con su facultad, una anulación, una corrección o un cambio de un programa aprobado.
- Quién las ve: quien las pidió, el administrador general, el administrador de la sede de la solicitud y el dueño.

### Migraciones aplicadas en crc-dev
`20261103180000_etapa2_usuario_gestor_facultades_solicitudes` · `20261103181000_etapa2_aprobar_correccion_sin_redeploy` · `20261103190000_etapa2_carga_acepta_usuario_gestor`.
Función del servidor desplegada en esta etapa: solo `carga-personal` (versión 7).

### Consultas para comprobar
```sql
select codigo, orden from roles order by orden;
select rol, permiso from roles_permisos where permiso in ('facultades.dar','solicitudes.resolver','solicitudes.pedir','cuentas.crear','cuentas.cesar','personas.editar','personas.ver_empresa') order by 1,2;
select rol, rol_asignable from roles_asignables order by 1,2;
select relname, relrowsecurity from pg_class where relname in ('facultades_persona','facultades_historial','solicitudes_cambio');
select grantee, privilege_type from information_schema.role_table_grants where table_name in ('facultades_persona','facultades_historial','solicitudes_cambio') and grantee in ('anon','authenticated');  -- solo SELECT a authenticated
```

## 2. Pruebas (crc-dev, 03/11/2026)
| Prueba | Resultado |
|---|---|
| **facultades** (nueva) | **147 de 147** |
| separacion-sedes | 172 de 172 |
| separacion (entre empresas) · usuarios · cese · carga | 106 · 81 · 13 · 45, todas pasan |
| empresas · passt · hallazgos · inspecciones · formatos · motor · permisos de tablas | todas pasan |

Se **ajustaron** pruebas que decían «el gestor no puede crear/cesar/cargar personal» (`separacion`, `usuarios`, `cese`, `carga`): ahora comprueban lo que el gestor **sigue sin poder** (otro gestor, administradores, otra sede, contraseñas). Antes de ajustarlas, esas pruebas ejecutaron esas acciones con el gestor ficticio y se repararon a mano: se reactivó a USUARIO_A3 y se cesaron las cuentas ficticias de prueba que se habían creado.

## 3. Lo que no está o no se verificó
- **Pantallas no probadas con una sesión real**: compilan (`tsc`) y pasan el linter, pero no se abrieron en el navegador con un usuario gestor, un gestor ni un administrador. Hecho (solo local): facultades en Usuarios, «Solicitudes de cambio» (Perfil y campana), pedir anulación o corrección desde la inspección y cambios del programa aprobado como solicitud.
- **Carga por Excel con «usuario gestor»** (resuelto el 03/11): migración `20261103190000_etapa2_carga_acepta_usuario_gestor` (la función `grabar_carga` acepta `usuario_gestor`; quien carga solo asigna roles que `roles_asignables` le permite) y función `carga-personal` desplegada en crc-dev (versión 7; ojo: es la misma que usa el sitio publicado). Prueba `carga.mjs`: 53 de 53.
- La plantilla de Excel de personal ya menciona «usuario_gestor» (cambio solo local, sale con la próxima publicación).
- En una empresa de **una sola sede**, el programa aprobado solo lo cambia el administrador general: la marca «sin aprobación» del gestor no sirve ahí y sus solicitudes las resuelve el general.
- Etapa 3 (solicitudes de cambio de **formatos**, y mensajes) y etapa 4 («Conoce al equipo de SST», roles adicionales como etiquetas): no empezadas.
- Demo: `node pruebas/demo-dos-sedes-etapa2.mjs` deja un usuario gestor (DEMO_USUGES_NORTE) con 2 facultades y 2 solicitudes del gestor Norte por resolver.
