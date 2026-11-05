# Tarea A · Revisión de llamadas en cadena y reintentos (riesgo de costo)

Fecha: 05/11/2026 · Solo crc-dev · Solo lectura: **no se cambió ningún comportamiento**. Los cambios propuestos esperan el ok del dueño.

## Qué se revisó
1. Las 6 funciones del servidor (`ingresar`, `crear-cuenta`, `cambiar-contrasena`, `dar-contrasena`, `carga-personal`, `registrar-inspeccion`) y su carpeta compartida: llamadas a sí mismas o a otras funciones, bucles y reintentos.
2. La base de datos: los 26 disparadores propios de CRC (triggers), las tareas programadas (pg_cron) y la presencia de llamadas web desde la base (pg_net, webhooks).
3. La aplicación: la cola de envío de inspecciones (`src/inspecciones/campo.ts`), las consultas repetidas con temporizador y los efectos de las pantallas.
4. Límites de tamaño y de frecuencia de las funciones que reciben datos.

## Qué se encontró
| # | Tema | Hallazgo | Riesgo |
|---|---|---|---|
| 1 | Funciones que se llaman entre sí | **Ninguna.** No hay `fetch`, `functions.invoke`, `setTimeout` ni reintentos en las 6 funciones; solo llamadas a funciones de la base (`rpc`). | Ninguno |
| 2 | Bucles en las funciones | Dos, ambos acotados: lotes de 5 cuentas a la vez (con máximo de 300) y la generación de contraseñas al azar (`for(;;)` en `_compartido/contrasenas.ts`), que repite hasta obtener una contraseña válida. Termina casi siempre en el primer intento, pero no tiene tope. | **Bajo** |
| 3 | Disparadores de la base | 26 disparadores propios de CRC (en 15 tablas; más 11 del almacenamiento de Supabase, 1 de la tarea programada y 1 de tiempo real, 39 en total), **ninguno forma un ciclo**: los que escriben en otras tablas lo hacen en tablas «hoja» sin disparadores propios (historiales, avisos de solicitudes, hallazgos). `app.al_cambiar_inspeccion` escribe en `hallazgos` y `hallazgos_historial`, pero no vuelve a escribir en `inspecciones`. | Ninguno |
| 4 | Tareas programadas | Una sola: `borrar-intentos-90-dias` (diaria, 08:15 UTC), que solo borra. | Ninguno |
| 5 | Llamadas web desde la base | No están instalados `pg_net` ni `http`; no hay webhooks. La base no puede llamar a las funciones del servidor. | Ninguno |
| 6 | Cola de envío: esperas | Confirmado: 30 s, 1, 2, 5, 15 y 30 min (el tope de espera es 30 min). Solo corre con señal, nunca dos envíos a la vez (`enCurso`) y se revisa cada 60 s. | Correcto |
| 7 | Cola de envío: rechazadas | Confirmado: las respuestas 403 y 422 pasan a «rechazada» y **no se reintentan**. | Correcto |
| 8 | Cola de envío: tope de intentos | **No hay tope de intentos.** Si el servidor responde 409, 5xx o 401, o no hay respuesta, la inspección se reintenta cada 30 min sin fin, mientras la app esté abierta con señal. | **Bajo a medio** |
| 9 | Cola de envío: envío forzado | Al abrir la app y cada vez que la señal vuelve (`online` cambia), `sincronizar(cuenta, true)` ignora la espera creciente y reintenta **todo lo pendiente** al instante. Una señal que se corta y vuelve muchas veces dispara un intento por cada pendiente cada vez. | **Medio** (solo cuesta con muchas inspecciones atascadas y una señal inestable) |
| 10 | Pantallas con consultas repetidas | Temporizadores acotados y bien limpiados: campana (cada 2 min, 2 consultas), firmas pendientes (2 min), sismos (1 min, solo con la pantalla a la vista), cola (1 min). Los efectos de carga dependen de valores estables (`useMemo`): **no se encontró ningún bucle** que se vuelva a ejecutar solo. | Ninguno |
| 11 | Límites de tamaño | `carga-personal`: cuerpo 400 KB, 300 filas, 5 cuentas a la vez. `dar-contrasena` en bloque: 300 cuentas. `registrar-inspeccion`: cuerpo 600 KB, 200 fotos; cada foto máximo 1 MB por el depósito (10 MB en PDF del PASST). | Correcto |
| 12 | Límite de frecuencia por usuario | **No existe** en `crear-cuenta`, `carga-personal`, `dar-contrasena` ni `registrar-inspeccion`: quien tiene sesión y permiso puede llamarlas muchas veces seguidas. Solo `ingresar` y `cambiar-contrasena` tienen bloqueo por intentos. | **Medio** |

**Resumen del costo posible.** El código no tiene ninguna cadena ni bucle que se multiplique solo. Lo que sí podría gastar de más es: (a) una persona con sesión que dispare las funciones en bucle a propósito o por un error de su equipo (nada lo frena); y (b) inspecciones atascadas con señal inestable (punto 9). Con el plan de pago de Supabase, 2 millones de invocaciones al mes van incluidas y cada millón extra cuesta unos US$ 2: el riesgo en dinero es pequeño, pero conviene el tope de gasto de Supabase Pro y la gestión de gasto de Vercel Pro (tarea 1.8).

## Cambios propuestos (NO aplicados; esperan el ok del dueño)
1. **Tope de intentos en la cola** (esfuerzo bajo, medio día): después de 12 intentos (unas 3,5 horas de espera en total) la inspección pasa a «necesita atención» con un botón «Reintentar»; no se reintenta sola más.
2. **Envío forzado con espera mínima** (esfuerzo bajo, 1 hora): el envío forzado al abrir o recuperar la señal respeta una espera de 30 s desde el último intento de cada inspección.
3. **Límite de frecuencia por usuario** (esfuerzo medio, 1 día): tabla nueva con el conteo por persona y por hora y revisión al entrar a cada función (por ejemplo, carga masiva: 10 por hora; inspecciones: 120 por hora). Es una decisión de producto: cuántas llamadas es «normal».
4. **Tope en la generación de contraseñas** (esfuerzo mínimo, 15 min): máximo 50 intentos y, si no se logra, error claro.

Tabla afectada por la propuesta 3: solo una tabla nueva; no toca `personas`, `vinculos`, `roles` ni `permisos`.
