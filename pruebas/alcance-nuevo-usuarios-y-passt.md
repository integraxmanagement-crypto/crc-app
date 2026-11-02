# CRC · Alcance nuevo pedido el 30/10/2026 (para decidir con Cowork)

Dos de los cinco pedidos de hoy cambian roles, permisos, sedes y tablas. Por la regla de la ronda (alcance nuevo = lo decide el dueño con Cowork) **no se construyeron**. Aquí queda lo que implican.

## Hecho hoy (sin tablas ni permisos; sin publicar)
1. Se quitó «Configuración de usuarios» del menú Perfil. Las pantallas siguen existiendo en `/mi-empresa/usuarios`, pero ya no hay acceso desde el menú.
2. Teléfono rojo junto a la campana con 116 Bomberos, 106 SAMU, 105 Policía Nacional y 119 Mensaje de voz; cada número llama con `tel:`.
3. En todo el texto visible, «hallazgo» pasó a «plan de acción» (nombres internos, rutas y base de datos no cambian).

## Punto 2 — Reformulación de usuarios (alcance nuevo)

### Cómo está hoy
- Roles en la base: `admin_empresa`, `gestor`, `usuario` (el dueño está fuera de `roles`). Permisos por rol en `roles_permisos`.
- Un administrador ve toda la empresa; no hay administrador de sede. Las sedes no limitan lo que ve cada rol.
- Solo el administrador define la frecuencia y programa semanas del PASST (`passt.reprogramar`); el gestor edita el PASST pero no la frecuencia.
- Restablecer contraseña de un usuario: ya existe (`dar-contrasena`, permiso `cuentas.contrasena`, solo administrador).
- Carga masiva de personal: ya existe (administrador).

### Lo pedido y lo que implica
| Pedido | Implica | Tablas o permisos que se tocarían |
|---|---|---|
| 5 niveles: dueño, administrador, gestor, usuario, usuario gestor | Dos roles nuevos o variantes: «administrador de sede» (dentro de administrador) y «usuario gestor» | `roles`, `roles_permisos`, `vinculos` |
| Administrador general vs. administrador de sede | Cada cuenta ligada a una o varias sedes; todo filtrado por sede (PASST, inspecciones, personas, hallazgos) | `vinculos` o tabla nueva de ámbito por sede; reglas RLS de casi todas las tablas |
| El dueño define los administradores de cada empresa | Pantalla del dueño para designarlos | `vinculos`, `personas` |
| Administrador de sede: administra usuarios y gestores de su sede, aprueba cambios del PASST de su sede | Aprobaciones por sede | `passt_*`, permisos nuevos |
| Administrador general: filtro para ver el programa anual de cualquier sede y seguir lo que hacen todos | Selector de sede en PASST y tableros | solo pantallas y consultas |
| «No pedir elegir sede en cada registro: se vincula sola» | La sede sale de la cuenta (hoy se elige en cada inspección) | `inspecciones` (sede automática) |
| Administradores: definir el programa, sin crear uno nuevo cada año | Programa vigente que se renueva o continúa | `passt_programas` |
| Usuario gestor: el administrador indica a qué facultades o nivel de información accede | Permisos finos por persona, no solo por rol | tabla nueva de permisos por persona |
| Administradores: formatear o resetear contraseña | Ya existe; habría que abrirlo al administrador de sede | permiso `cuentas.contrasena` por sede |
| Gestores: solicitar cambios de formatos o del PASST; el administrador de sede los confirma y el general los puede aprobar | Flujo de solicitudes con estados y avisos | tablas nuevas (solicitudes), campana |
| Gestores: actualizar la lista de personal (ingresos, ceses, carga masiva) | Hoy es solo administrador | permisos `personas.editar`, `cuentas.crear` y `cuentas.cesar` para gestor |
| Gestores: dar accesos adicionales a usuarios especiales | Permisos finos por persona | tabla nueva |
| Gestores: asignar roles adicionales (miembro de comité, brigadista, monitor de seguridad, otro) | Catálogo de roles adicionales por persona | tabla nueva (`personas` o `vinculos`) |
| Usuarios: inicio con «Conoce al equipo de SST» (puestos de los gestores y WhatsApp); luego, «novedades» | Pantalla nueva; número de WhatsApp de cada gestor | dato nuevo en `personas` |
| Usuario gestor: mis planes de acción, PDF de lo firmado, archivos por firmar, tablero (después) | Pantallas de consulta; el tablero queda para otra etapa | permisos nuevos |

### Decisiones que faltan (con Cowork)
1. ¿«Usuario gestor» es un rol aparte o un usuario con permisos marcados por el administrador?
2. ¿Una persona puede ser administradora de varias sedes? ¿Y gestora de varias?
3. ¿Quién aprueba un cambio del PASST cuando la empresa tiene una sola sede?
4. ¿Los gestores nuevos del PASST pierden hoy la edición directa y pasan a solicitar siempre?
5. ¿El número de WhatsApp lo escribe el gestor o el administrador? (dato personal: privacidad)
6. ¿Los roles adicionales (comité, brigadista, monitor, otro) dan permisos o solo son etiquetas?

Es un cambio grande (varias semanas de trabajo, con revisión de seguridad por sede en todas las tablas). Se recomienda hacerlo por etapas: (1) sedes y administrador de sede, (2) permisos finos y usuario gestor, (3) solicitudes de cambio, (4) pantalla «Conoce al equipo de SST».

## Punto 3 — Programa anual y registros (alcance nuevo)

### Cómo está hoy
- Una actividad del PASST vinculada a un formato queda ejecutada sola cuando se cierra una inspección de ese formato en la semana (y en el área, si la actividad tiene área).
- Las actividades sin formato se marcan a mano en el calendario.
- «Mis pendientes» ya lleva con «Realizar» a la inspección con el formato y el área elegidos.

### Lo pedido
| Pedido | Qué falta |
|---|---|
| Al marcar una actividad como realizada, adjuntar imagen o PDF | Evidencia de la ejecución: tabla nueva y almacenamiento de archivos (con RLS por empresa) |
| Al presionar la actividad del mes (con formato), ir al registro correspondiente | Pantalla: abrir la inspección o crear una nueva con el formato ya elegido |
| Al cerrar el registro, el PASST se actualiza solo | Ya existe para actividades con formato y semana programada |
| Al final de una inspección hecha por el flujo normal, vincularla a una actividad del PASST | Vínculo inspección ↔ actividad hecho a mano: columna o tabla nueva |
| Dentro de la actividad: «anexar a un registro existente» (de los registros del mes) | Selector de registros del mes y el mismo vínculo |

Lo que sí toca tablas: evidencias (`passt_ejecucion` o tabla nueva y bucket) y el vínculo manual (`inspecciones` o tabla nueva). No toca personas, empresas, sedes, unidades, roles ni permisos, salvo que se decida limitar quién anexa.

### Decisiones que faltan
1. ¿Se permite un archivo o varios por actividad y semana? ¿Tamaño máximo?
2. ¿Una inspección puede cerrar más de una actividad?
3. ¿Qué pasa si se anexa un registro de otra área o de otra semana distinta a la programada?
