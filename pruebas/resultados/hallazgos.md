# Pruebas del seguimiento de hallazgos (tarea 3.4-D, parte 2)

Fecha: 2026-10-28T14:31:55.117Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Nacen solos al recibir la inspección

- ❌ Se registra una inspección con 2 X — {"id":"3d5ccebc-0f84-4b7f-8c82-0f126ca24d0d","estado":"grabada","huella":"a9b9d16908cb4d67d46d7b915966021707bb2e5f33326853d1e7d5e12034a547","numero":20}
- ❌ Nacen 2 hallazgos, uno por cada X — ["HAL-01","HAL-02"]
- ❌ El que traía acción nace con responsable, plazo y acción — {"id":"0bbf36c8-5ca8-4c81-8fcb-4fdbb9b2de15","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"3d5ccebc-0f84-4b7f-8c82-0f126ca24d0d","plantilla_id":"68c3426e-d873-44c1-a2b0-bb27631eff86","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"dc210e4a-2362-4cd7-80bb-92508c560054","origen":"no_cumple","clave":"HAL-01","fila":null,"texto":"Señal visible (ficticio)","accion":"Reponer la señal (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-11-15","estado":"abierto","severidad":null,"creado_en":"2026-10-28T14:31:48.447443+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":null,"inspeccion_numero":20,"activo_codigo":"HAL-28347"}
- ❌ El otro nace sin asignar
- ❌ Llevan el formato, la sede y el equipo
- ❌ Si la inspección llega dos veces, no se duplican
- ❌ Su historial empieza con «creado»

## 2. Quién ve qué

- ❌ El usuario ve solo el que tiene asignado
- ❌ Otra empresa no ve ninguno
- ❌ Sin sesión no se ve ninguno
- ❌ El dueño de la plataforma los ve
- ❌ El usuario no ve el historial de un hallazgo ajeno

## 3. Asignar, «en proceso» y nadie escribe directo

- ❌ El usuario no puede asignar — No autorizado
- ❌ Otra empresa no puede asignar — No autorizado
- ❌ El responsable no puede ser de otra empresa — El responsable debe ser una persona activa de la empresa
- ❌ El gestor asigna responsable, plazo y acción
- ❌ Ahora el usuario ve los 2
- ❌ Nadie cambia la tabla directo (solo por las acciones)
- ❌ Nadie borra un hallazgo
- ❌ El responsable lo marca «en proceso»

## 4. Cerrar con comentario y foto

- ❌ Sin explicar qué se hizo no se cierra — Escribe qué se hizo para cerrarlo
- ❌ El responsable sube la foto de cierre
- ❌ Otra empresa no sube fotos de cierre
- ❌ No se sube una foto para un hallazgo que no existe
- ❌ Otra empresa no puede cerrar — No autorizado
- ❌ La foto debe estar en la carpeta del hallazgo — La foto no está en la carpeta del hallazgo
- ❌ El responsable lo cierra con comentario y foto
- ❌ Queda cerrado, con quién y la foto — {"estado":"cerrado","cerrado_por":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","cierre_foto_ruta":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50/3d5ccebc-0f84-4b7f-8c82-0f126ca24d0d/cierre-0bbf36c8-5ca8-4c81-8fcb-4fdbb9b2de15-3cfa9768.png"}
- ❌ El gestor ve la foto de cierre
- ❌ Otra empresa no ve la foto de cierre
- ❌ No se cierra dos veces

## 5. Reabrir

- ❌ El usuario no puede reabrir — No autorizado
- ❌ Sin motivo no se reabre
- ❌ El gestor lo reabre y el cierre se quita
- ❌ El historial guarda todo: creado, en proceso, cerrado, reabierto — ["creado","en_proceso","cerrado","reabierto"]
- ❌ El gestor lo vuelve a cerrar (sin foto)

## 6. Corrección y anulación de la inspección

- ❌ El administrador corrige la inspección — {"estado":"corregida","huella":"49045e4ca6af025f67e41993bb49b483fd05502d226e2a086dce8dac5fdf9d98","edicion":2}
- ❌ El hallazgo que desapareció queda «anulado por corrección» — {"id":"61c6a696-6a43-405e-878d-8e4d3c148158","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"3d5ccebc-0f84-4b7f-8c82-0f126ca24d0d","plantilla_id":"68c3426e-d873-44c1-a2b0-bb27631eff86","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"dc210e4a-2362-4cd7-80bb-92508c560054","origen":"no_cumple","clave":"HAL-02","fila":null,"texto":"Acceso libre (ficticio)","accion":"Despejar el acceso (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-10-01","estado":"anulado","severidad":null,"creado_en":"2026-10-28T14:31:48.447443+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Anulado por corrección de la inspección","inspeccion_numero":20,"activo_codigo":"HAL-28347"}
- ❌ Nace el hallazgo nuevo (HAL-03)
- ❌ El cerrado sigue cerrado
- ❌ No se duplica el que ya existía
- ❌ Al anular la inspección, sus hallazgos abiertos se anulan — {"id":"0132b82c-7b77-44a5-aa7c-e1767c529a86","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"3d5ccebc-0f84-4b7f-8c82-0f126ca24d0d","plantilla_id":"68c3426e-d873-44c1-a2b0-bb27631eff86","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"dc210e4a-2362-4cd7-80bb-92508c560054","origen":"no_cumple","clave":"HAL-03","fila":null,"texto":"Batería cargada (ficticio)","accion":null,"responsable_id":null,"plazo":null,"estado":"anulado","severidad":null,"creado_en":"2026-10-28T14:31:54.560577+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Inspección anulada","inspeccion_numero":20,"activo_codigo":"HAL-28347"}
- ❌ El que ya estaba cerrado no cambia
- ❌ Un hallazgo anulado ya no se asigna
