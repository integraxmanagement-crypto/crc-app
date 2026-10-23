# Borrado automático de intentos de ingreso (90 días) · CRC tarea 3.3

Ejecutada: 22/10/2026 (hora de Lima) · Proyecto Supabase `crc-dev` · Solo datos ficticios.

**Resultado: 7 de 7 comprobaciones correctas.**

La app no puede escribir ni borrar en el registro de intentos, así que esta prueba se hizo directamente en la base de datos,
dentro de una transacción que se deshace al final (no deja ningún rastro). Se usaron números de documento inventados.

| Resultado | Comprobación | Detalle |
|---|---|---|
| ✅ Pasa | Antes de la prueba no había intentos con esos documentos | 0 |
| ✅ Pasa | Se agregaron 4 intentos ficticios de hace 120, 91, 89 y 1 días | 4 |
| ✅ Pasa | La tarea de limpieza borra los de más de 90 días | 2 borrados (120 y 91 días) |
| ✅ Pasa | Quedan los de menos de 90 días | 89 días y 1 día |
| ✅ Pasa | No queda ningún intento de más de 90 días en toda la tabla | 0 |
| ✅ Pasa | La tarea está programada y activa | `borrar-intentos-90-dias`, todos los días 08:15 UTC (03:15 de Lima) |
| ✅ Pasa | La app no puede ejecutar la limpieza por su cuenta | sin permiso |

El plazo de 90 días es provisional: debe validarlo el abogado (tareas 5.3 y 5.8).
