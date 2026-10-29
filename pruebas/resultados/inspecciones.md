# Inspecciones, fotos y firmas (tarea 3.4-C)

Fecha: 2026-10-29 · Resultado: **59 de 59** · Cuentas y datos ficticios de crc-dev.

## 1. Registrar una inspección con foto y firma, una sola vez

| Prueba | Resultado |
|---|---|
| Si la foto todavía no llegó al almacén, el servidor pide reintentar (no graba a medias) | ✅ |
| Gestor A sube la foto a la carpeta de la inspección | ✅ |
| Gestor A sube su firma | ✅ |
| Una foto subida no se puede reemplazar | ✅ |
| El servidor graba la inspección | ✅ |
| Si el equipo la reenvía, responde «ya recibida» y no la duplica | ✅ |
| Queda una sola inspección con ese identificador | ✅ |
| El resultado lo calcula el servidor: X en un crítico → «No conforme» | ✅ |
| …y nace el hallazgo de EXT-07 | ✅ |
| Las fotos se cuentan con lo que llegó, no con lo que dice el equipo | ✅ |
| Guarda quién, cuándo (equipo y servidor) y la huella | ✅ |
| La firma del inspector queda firmada, con su cuenta y la huella de lo firmado | ✅ |
| La foto queda registrada con su huella | ✅ |
| Después de grabada, ya no se pueden agregar fotos a esa inspección | ✅ |

## 2. Lo que el servidor no acepta

| Prueba | Resultado |
|---|---|
| Una inspección incompleta se rechaza y dice qué falta | ✅ |
| Sin el firmante obligatorio se rechaza | ✅ |
| Un firmante externo donde el formato no lo permite se rechaza | ✅ |
| Admin B no puede registrar con un formato de A | ✅ |
| Usuario A2 no puede registrar inspecciones | ✅ |
| Sin sesión: 401 | ✅ |
| Otra cuenta no puede «reenviar» una inspección ajena | ✅ |
| Nadie llama directo a grabar_inspeccion (solo la función del servidor) | ✅ |
| Nadie escribe directo en inspecciones | ✅ |
| Ni el dueño cambia directo una firma | ✅ |
| Gestor A no puede subir fotos en la carpeta de la empresa B | ✅ |
| Usuario A2 no puede subir fotos (no registra inspecciones) | ✅ |

## 3. Quién ve las inspecciones, las fotos y las firmas

| Prueba | Resultado |
|---|---|
| ADMIN_B no ve la inspección de A | ✅ |
| ADMIN_B no ve la ficha de la foto de A | ✅ |
| ADMIN_B no puede descargar la foto de A | ✅ |
| GESTOR_B no ve la inspección de A | ✅ |
| GESTOR_B no ve la ficha de la foto de A | ✅ |
| GESTOR_B no puede descargar la foto de A | ✅ |
| Usuario A2 no ve una inspección donde no es firmante | ✅ |
| Gestor A sí descarga la foto de su inspección | ✅ |
| Sin sesión no se descarga ninguna foto | ✅ |
| Sin sesión no se ve ninguna inspección | ✅ |

## 4. Firma desde la propia cuenta (LOTO, en un área)

| Prueba | Resultado |
|---|---|
| Un firmante externo sin documento se rechaza (se guardan nombre y documento) | ✅ |
| Admin A registra la LOTO con 3 firmantes | ✅ |
| LOTO con una X: No conforme y 92 % calculado en el servidor | ✅ |
| Del externo quedan su nombre y documento, sin cuenta de CRC | ✅ |
| El externo queda «en papel», el de Admin A firmado y el del área pendiente | ✅ |
| Usuario A2 (firmante) sí ve la inspección que debe firmar | ✅ |
| Nadie puede firmar por otra persona | ✅ |
| Usuario A2 sube la imagen de su firma pendiente | ✅ |
| …pero no una firma que no es suya | ✅ |
| Usuario A2 firma desde su cuenta | ✅ |
| No se puede firmar dos veces | ✅ |

## 5. Corregir (con historial) y anular

| Prueba | Resultado |
|---|---|
| Gestor A no puede corregir una inspección cerrada (solo el administrador) | ✅ |
| Admin A corrige con motivo | ✅ |
| El servidor recalcula (ahora «Conforme») y sube la edición | ✅ |
| La versión anterior queda guardada con su motivo | ✅ |
| La firma anterior queda sobre la versión anterior (su huella ya no coincide) | ✅ |
| Si alguien la cambió antes, la corrección se rechaza («vuelve a abrirla») | ✅ |
| Gestor A no puede anular | ✅ |
| Admin B no puede anular una inspección de A | ✅ |
| Admin A anula con motivo | ✅ |
| La inspección anulada no se borra | ✅ |

## 6. Espacio usado según el plan

| Prueba | Resultado |
|---|---|
| Admin A ve el espacio usado y el tope de su plan (250 MB en el gratuito) | ✅ |
| Admin B no ve el espacio de A | ✅ |
