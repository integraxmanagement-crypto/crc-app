# Usuarios y roles por empresa · CRC tarea 3.3

Ejecutada: 22/10/2026, 7:27:54 p. m. (hora de Lima) · Proyecto Supabase `crc-dev` · Solo datos ficticios.

**Resultado: 80 de 80 pruebas pasaron.**

Cada prueba ingresa con una persona de prueba por la misma puerta que usa la app e intenta ver o hacer lo que no le corresponde. Las contraseñas nunca se imprimen.

El borrado automático de los intentos de más de 90 días se comprueba aparte, en la base de datos: ver `borrado-de-intentos-90-dias.md`.

## 1. Un administrador de A no ve, crea, cesa, corrige ni da contraseña a nadie de B

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A no ve a ninguna persona de B | 6 personas visibles |
| ✅ Pasa | ADMIN_A ve 0 cuentas de B |  |
| ✅ Pasa | ADMIN_A no puede crear una cuenta en B | 403 No autorizado |
| ✅ Pasa | ADMIN_A no puede cesar a USUARIO_B | No autorizado |
| ✅ Pasa | ADMIN_A no puede reactivar cuentas de B | No autorizado |
| ✅ Pasa | ADMIN_A no puede corregir datos de GESTOR_B | No autorizado |
| ✅ Pasa | ADMIN_A no puede dar contraseña nueva a USUARIO_B | 403 |
| ✅ Pasa | ADMIN_A no puede dar contraseña nueva a GESTOR_B | 403 |
| ✅ Pasa | La base de datos responde «no» a ADMIN_A para USUARIO_B |  |

## 2. Reglas de administradores

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A no puede dar contraseña nueva a otro administrador (ADMIN_A2) | 403 |
| ✅ Pasa | ADMIN_A no puede cesar a otro administrador | No autorizado |
| ✅ Pasa | ADMIN_A no puede quitarle el rol a otro administrador | No autorizado |
| ✅ Pasa | ADMIN_A no puede cesarse a sí mismo | No autorizado |
| ✅ Pasa | ADMIN_A no puede darse contraseña nueva a sí mismo (usa «cambiar contraseña») | 403 |
| ✅ Pasa | ADMIN_A no puede convertir a alguien en administrador | No autorizado |
| ✅ Pasa | Nadie puede cesar al único administrador activo de B (ni el dueño) | No se puede cesar al único administrador activo de la empresa. Crea primero otro administrador. |
| ✅ Pasa | Nadie puede quitar el rol al único administrador activo de B | No se puede quitar el rol al único administrador activo de la empresa |
| ✅ Pasa | Con dos administradores, el dueño puede cesar a uno |  |
| ✅ Pasa | …y reactivarlo |  |

## 3. El gestor y el usuario no crean cuentas ni dan contraseñas

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | GESTOR_A no puede crear cuentas | 403 |
| ✅ Pasa | GESTOR_A no puede dar contraseñas nuevas | 403 |
| ✅ Pasa | GESTOR_A no puede cesar cuentas | No autorizado |
| ✅ Pasa | GESTOR_A no puede corregir datos de otras personas | No autorizado |
| ✅ Pasa | GESTOR_A no puede editar las listas de áreas y puestos | No autorizado |
| ✅ Pasa | GESTOR_A no puede restablecer en bloque | 403 |
| ✅ Pasa | USUARIO_A2 no puede crear cuentas | 403 |
| ✅ Pasa | USUARIO_A2 no puede dar contraseñas nuevas | 403 |
| ✅ Pasa | USUARIO_A2 no puede cesar cuentas | No autorizado |
| ✅ Pasa | USUARIO_A2 no puede corregir datos de otras personas | No autorizado |
| ✅ Pasa | USUARIO_A2 no puede editar las listas de áreas y puestos | No autorizado |
| ✅ Pasa | USUARIO_A2 no puede restablecer en bloque | 403 |
| ✅ Pasa | Tampoco el administrador puede restablecer en bloque (solo el dueño) | 403 |
| ✅ Pasa | Sin iniciar sesión no se puede dar contraseñas | 401 |
| ✅ Pasa | El rescate no funciona con la clave pública de la app | 401 |

## 4. La contraseña nueva se muestra una sola vez, obliga a cambiarla y cierra las sesiones

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | USUARIO_A3 tiene una sesión abierta antes |  |
| ✅ Pasa | ADMIN_A da una contraseña nueva a un usuario de su empresa | 200 |
| ✅ Pasa | La contraseña nueva tiene 12 caracteres |  |
| ✅ Pasa | La sesión que tenía abierta queda cerrada | Invalid Refresh Token: Refresh Token Not Found |
| ✅ Pasa | La contraseña anterior deja de funcionar | Documento o contraseña incorrectos. |
| ✅ Pasa | Con la contraseña nueva puede ingresar |  |
| ✅ Pasa | Queda obligado a cambiarla en este ingreso |  |
| ✅ Pasa | Mientras no la cambie, no ve los datos de su empresa |  |
| ✅ Pasa | Queda anotado quién la dio y cuándo |  |
| ✅ Pasa | El registro no guarda la contraseña (ningún campo la contiene) | id, persona_id, empresa_id, vinculo_id, modo, dado_por, dado_en |
| ✅ Pasa | No hay forma de volver a verla: pedirla otra vez genera una distinta |  |
| ✅ Pasa | Al cambiarla, vuelve a ver los datos de su empresa |  |
| ✅ Pasa | ADMIN_B no ve el registro de contraseñas dadas en A |  |
| ✅ Pasa | El gestor no ve el registro de contraseñas dadas |  |
| ✅ Pasa | El dueño restablece en bloque los gestores de C | 1 cuentas |
| ✅ Pasa | El restablecimiento en bloque respeta los roles elegidos |  |

## 5. Solo el dueño de la plataforma ve el registro de intentos de ingreso

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | El dueño ve los intentos | 211 intentos |
| ✅ Pasa | ADMIN_A ve 0 intentos |  |
| ✅ Pasa | GESTOR_A ve 0 intentos |  |
| ✅ Pasa | USUARIO_A2 ve 0 intentos |  |
| ✅ Pasa | ADMIN_B ve 0 intentos |  |
| ✅ Pasa | Sin iniciar sesión no se ve ningún intento | permission denied for table intentos_ingreso |
| ✅ Pasa | Nadie puede borrar intentos desde la app (ni el dueño) | permission denied for table intentos_ingreso |

## 6. Áreas y puestos: cada empresa tiene los suyos

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_B: las áreas y puestos de A no aparecen | 2 áreas, 4 puestos |
| ✅ Pasa | GESTOR_B: las áreas y puestos de A no aparecen | 2 áreas, 4 puestos |
| ✅ Pasa | USUARIO_B: las áreas y puestos de A no aparecen | 2 áreas, 4 puestos |
| ✅ Pasa | ADMIN_A ve las áreas de su empresa | 4 |
| ✅ Pasa | ADMIN_B no puede agregar áreas en A | No autorizado |
| ✅ Pasa | ADMIN_B no puede renombrar un área de A | No autorizado |
| ✅ Pasa | ADMIN_B no puede desactivar un área de A | No autorizado |
| ✅ Pasa | ADMIN_B no puede borrar un puesto de A | No autorizado |
| ✅ Pasa | ADMIN_A agrega un área en su empresa |  |
| ✅ Pasa | No acepta un nombre repetido (aunque cambien mayúsculas o espacios) | Ya existe un área con ese nombre |
| ✅ Pasa | ADMIN_A renombra el área |  |
| ✅ Pasa | ADMIN_A desactiva el área |  |
| ✅ Pasa | No se puede asignar un área desactivada | El área está desactivada |
| ✅ Pasa | No se puede asignar un área de otra empresa | El área no está en la lista de la empresa |
| ✅ Pasa | No se crea una cuenta con un puesto que no está en la lista | 400 |
| ✅ Pasa | ADMIN_A borra el área que nunca se usó |  |
| ✅ Pasa | Un área en uso no se borra: hay que desactivarla | Está en uso: desactívalo en vez de borrarlo |

## 7. El administrador corrige datos de su gente y el historial lo anota

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A cambia el rol (usuario → gestor) y el puesto |  |
| ✅ Pasa | Se guardó el cambio y el nombre del puesto | {"rol":"gestor","puesto":"Operaria"} |
| ✅ Pasa | El historial anota la corrección | {"accion":"cambio","rol":"gestor","puesto":"Operaria"} |
| ✅ Pasa | …y lo devuelve a usuario |  |
| ✅ Pasa | Rechaza una fecha de ingreso no válida | Fecha de ingreso no válida |
| ✅ Pasa | Nadie escribe directo en la tabla de cuentas | permission denied for table vinculos |
