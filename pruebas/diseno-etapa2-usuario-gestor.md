# CRC · Etapa 2 del punto 2: usuario gestor y facultades por persona — DISEÑO (sin código)

Fecha: 03/11/2026 · Estado: **para aprobación del dueño. No se ha construido nada ni publicado nada.**

## 0. Aviso (regla permanente del CLAUDE.md)
Esta etapa cambiaría tablas que usan también los módulos de contratistas y medio ambiente: **`roles`, `roles_permisos`, `permisos`** (un rol y permisos nuevos) y una **tabla nueva que cuelga de `vinculos`**. Se avisa antes de construir. El dueño decide si hay que actualizar el esquema de esos módulos. No se tocan sus carpetas.

## 1. Idea en una frase
**Usuario gestor = un trabajador al que el administrador le marca, persona por persona, qué facultades extra tiene, de una lista fija.** Sin facultades marcadas se comporta como un usuario.

## 2. Cómo queda cada rol (de arriba abajo)
| Rol | Qué es |
|---|---|
| Dueño de la plataforma | Crea empresas y administradores |
| Administrador general | Toda la empresa |
| Administrador de sede | Solo sus sedes |
| Gestor | Equipo de SST de sus sedes |
| **Usuario gestor (nuevo)** | Trabajador con facultades marcadas por el administrador |
| Usuario | Trabajador: firma, ve sus planes de acción |

## 3. La lista de facultades (la única que se puede marcar)
1. Ver las inspecciones de sus sedes (con fotos y firmas).
2. Registrar inspecciones.
3. Ver y gestionar planes de acción (asignar responsable, plazo, cerrar).
4. Ver el programa anual de SST (solo lectura).
5. Ver los nombres del personal (para asignar responsables).

**No se pueden marcar** (siguen siendo solo del administrador o del gestor): crear o cesar cuentas, cambiar contraseñas, editar o publicar formatos, editar o aprobar el programa anual, anular o corregir inspecciones, datos de la empresa.

## 4. Cómo funciona por dentro
- **Tabla nueva `facultades_persona`**: una fila por (cuenta, facultad), con quién la dio y cuándo. Solo se escribe por funciones del servidor, nunca directo (la prueba automática de permisos de tablas la revisa).
- **Rol nuevo `usuario_gestor`**. `usuario` pasa de orden 4 a 5.
- **El permiso final de una persona = permisos de su rol + sus facultades.** Todas las reglas que hoy preguntan «¿tiene este permiso?» siguen funcionando igual y respetan las sedes de la cuenta (etapa 1). No hay lógica de sedes nueva.
- **Quién da y quita facultades:** el administrador general (en todas las sedes) y el administrador de sede (solo a cuentas que comparten una sede con él). Cada cambio queda en el historial.
- **Si cesan a la persona o la pasan a otro rol**, sus facultades dejan de valer solas.
- **Pantallas:** en «Usuarios», rol «Usuario gestor» al crear la cuenta; en su ficha, casillas con las 5 facultades y quién las dio. El menú del usuario gestor muestra Inspecciones, Planes de acción o el programa anual solo si tiene esa facultad. Hoy la app decide por el nombre del rol; pasará a decidir por las facultades reales que baja del servidor.

## 5. Gestores y la lista de personal (pedido del 30/10)
Hoy solo el administrador crea cuentas, cesa y carga el Excel de personal. Propuesta: el **gestor** puede **crear, cesar, corregir y cargar por Excel** a **usuarios y usuarios gestores de sus sedes**, y nada más (no administradores ni gestores, **no cambia contraseñas**). Es la misma regla de «roles que puede asignar» que ya existe, ahora con el gestor dentro.

## 6. Lo que NO entra en esta etapa
- Solicitudes de cambio de formatos o del programa anual, con aprobación (etapa 3).
- «Conoce al equipo de SST» con WhatsApp de cada gestor (etapa 4, por privacidad).
- Roles adicionales (miembro del comité, brigadista, monitor): quedan como **etiquetas sin permisos**, en la etapa 4.
- El tablero del usuario gestor.
- Hoy ya existen «Mis planes de acción» y «Mis firmas» para quien tiene algo asignado o por firmar.

## 7. Cómo se probará (primero la prueba, después el código)
Prueba nueva `pruebas/facultades.mjs`, con la empresa D (dos sedes) y cuentas ficticias nuevas:
- Un usuario gestor sin facultades no ve inspecciones ni planes de acción ajenos.
- Con cada facultad marcada, hace exactamente eso y solo en sus sedes; con la facultad quitada, deja de poder.
- Nadie se da facultades a sí mismo; el gestor y el usuario no las dan; el administrador de la sede 1 no se las da a una cuenta de la sede 2; otra empresa no ve nada.
- Las facultades no sirven para crear cuentas, cambiar formatos ni aprobar el programa.
- Cesar a la persona o cambiarle el rol anula sus facultades.
- El gestor crea, cesa y corrige usuarios de sus sedes y no puede con administradores, otros gestores, otra sede ni contraseñas.
- Nadie escribe directo en `facultades_persona` (se suma a la prueba de permisos de tablas); anon no ejecuta nada.
- Se repiten las pruebas de separación entre sedes y entre empresas.

## 9. Respuestas del dueño (03/11/2026) y lo que cambia en el diseño — **VALE ESTA SECCIÓN SI CONTRADICE ALGO ANTERIOR**
Decisiones 1 a 6: **sí a todas**, con estos agregados.

### 9.1 El gestor también anula, corrige y cambia el programa, pero con aprobación
- **Anular o corregir una inspección** y **cambiar un programa anual ya aprobado**: el gestor **no lo hace directo, lo solicita**. La solicitud le llega como aviso (campana) al **administrador de su sede** y al **administrador general**. Si **aprueba**, el cambio se hace en ese momento (queda como hecho por el administrador que aprobó, con el nombre del gestor que lo pidió). Si **deniega**, todo queda como estaba. En los dos casos el gestor recibe un aviso con la respuesta y el comentario.
- **Edición de un programa en borrador:** el gestor sigue editándolo directo (todavía no rige nada; aprobarlo ya es del administrador). *Si lo quieres con aprobación también, dímelo.*
- **Una sola sede:** el programa aprobado lo reprograma solo el administrador general (regla de la etapa 1), así que ahí las solicitudes del gestor las resuelve el general.

### 9.2 Facultad «sin aprobación» para el gestor (la marca el administrador)
Para un **gestor**, el administrador puede marcar una o varias de estas tres: **anular inspecciones**, **corregir inspecciones**, **cambiar el programa anual aprobado**. Con la marca, el gestor lo hace **directo** y el sistema solo **avisa al administrador a modo de comunicación** (queda «comunicada», sin botones de aprobar). Es la misma tabla de facultades de la sección 4; solo cambian las facultades disponibles según el rol:
| Rol de la cuenta | Facultades que se pueden marcar |
|---|---|
| Usuario gestor | Las 5 de la sección 3 |
| Gestor | Anular inspecciones · Corregir inspecciones · Cambiar el programa aprobado (sin aprobación) |
Solo el administrador (general o de la sede de esa cuenta) las marca.

### 9.3 Piezas nuevas
- **Tabla `solicitudes_cambio`**: tipo (anular, corregir, cambio del programa), estado (pendiente, aprobada, denegada, comunicada), qué se pide, el motivo, quién pidió, quién resolvió, el comentario y si ya se vio. Nadie escribe directo: solo funciones del servidor.
- **Permisos nuevos:** `facultades.dar` y `solicitudes.resolver` (administradores). El gestor suma `cuentas.crear`, `cuentas.cesar`, `personas.editar` y `personas.ver_empresa` (sección 5), no `cuentas.contrasena`.
- **Campana:** al administrador le muestra «N solicitud(es) por resolver» y las comunicaciones nuevas; al gestor, «tu solicitud fue aprobada / denegada». Se abre una lista corta con botón para aprobar o denegar y ver el detalle.
- **Corregir con aprobación:** el administrador aprueba y el servidor aplica la corrección guardada (la misma validación de siempre, hecha por el administrador); si no pasa la validación, la solicitud queda pendiente con el aviso del error.
- **Programa:** al aprobar se aplica el cambio pedido (agregar o editar una actividad, programar una semana, dar de baja, mover o editar metas), con el motivo del gestor.

### 9.4 Más pruebas (se suman a las de la sección 7)
- Un gestor sin la marca **no** anula, corrige ni cambia el programa aprobado directo; con la marca sí, y el administrador recibe la comunicación.
- La solicitud llega solo a los administradores de esa sede y al general; el de otra sede o de otra empresa no la ve ni la resuelve.
- Aprobar aplica el cambio; denegar no cambia nada; no se resuelve dos veces; el gestor no resuelve su propia solicitud.
- Una solicitud de una inspección de otra sede no se puede crear.
- Cesar al gestor o cambiarle el rol anula sus marcas; las solicitudes pendientes de un gestor cesado se pueden denegar.

## 8. Decisiones que necesito de ti (con valor por defecto) — RESPONDIDAS el 03/11/2026: 1 sí, 2 sí (+9.2), 3 solo el administrador, 4 sí, 5 sí, 6 sí
1. ¿Usuario gestor como **rol aparte con facultades marcadas por persona**? (por defecto: sí)
2. ¿La **lista de 5 facultades** de arriba, o quitas/agregas alguna? (por defecto: las 5)
3. ¿Quién marca las facultades: **administrador general y de sede, no los gestores**? (por defecto: sí. Tu pedido original dice que el gestor da «accesos adicionales a usuarios especiales»: si lo quieres, el gestor solo podría dar las que él mismo tiene, y se agrega a la prueba.)
4. ¿Los **gestores crean, cesan y cargan personal de sus sedes** con ese límite? (por defecto: sí)
5. ¿Los **roles adicionales como etiquetas** quedan para la etapa 4? (por defecto: sí)
6. ¿Apruebas el aviso de módulos (§0) como en la etapa 1: avisar, que Cowork verifique en Supabase y no tocar las carpetas 14 y 15?
