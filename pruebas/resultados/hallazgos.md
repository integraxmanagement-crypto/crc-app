# Pruebas del seguimiento de hallazgos (tarea 3.4-D, parte 2)

Fecha: 2026-10-29T14:39:46.716Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Nacen solos al recibir la inspección

- ❌ Se registra una inspección con 2 X — {"id":"25f7c587-ea41-4946-9903-ccf057fa68db","estado":"grabada","huella":"d3ba23ef3c453162d88be63ea710a95a6756469b2c67ca0809ea504eaa35e604","numero":42}
- ❌ Nacen 2 hallazgos, uno por cada X — ["HAL-01","HAL-02"]
- ❌ El que traía acción nace con responsable, plazo y acción — {"id":"8fc1047f-2a9b-4b6f-94de-9654fc996e67","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"25f7c587-ea41-4946-9903-ccf057fa68db","plantilla_id":"fd7eece3-d283-4b55-a8aa-fe7a7c48dc6b","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"d8be5e7a-14b2-4607-a559-6d8b17736e38","origen":"no_cumple","clave":"HAL-01","fila":null,"texto":"Señal visible (ficticio)","accion":"Reponer la señal (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-11-15","estado":"abierto","severidad":null,"creado_en":"2026-10-29T14:39:40.865043+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":null,"inspeccion_numero":42,"activo_codigo":"HAL-80653"}
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
- ❌ Queda cerrado, con quién y la foto — {"estado":"cerrado","cerrado_por":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","cierre_foto_ruta":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50/25f7c587-ea41-4946-9903-ccf057fa68db/cierre-8fc1047f-2a9b-4b6f-94de-9654fc996e67-a1ed514a.png"}
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

- ❌ El administrador corrige la inspección — {"estado":"corregida","huella":"beb6d713403ac142278480f473df9a987696a51eec73596074c6314849c34c50","edicion":2}
- ❌ El hallazgo que desapareció queda «anulado por corrección» — {"id":"a67f2f77-95d3-456a-acd7-59ef8e305af9","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"25f7c587-ea41-4946-9903-ccf057fa68db","plantilla_id":"fd7eece3-d283-4b55-a8aa-fe7a7c48dc6b","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"d8be5e7a-14b2-4607-a559-6d8b17736e38","origen":"no_cumple","clave":"HAL-02","fila":null,"texto":"Acceso libre (ficticio)","accion":"Despejar el acceso (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-10-01","estado":"anulado","severidad":null,"creado_en":"2026-10-29T14:39:40.865043+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Anulado por corrección de la inspección","inspeccion_numero":42,"activo_codigo":"HAL-80653"}
- ❌ Nace el hallazgo nuevo (HAL-03)
- ❌ El cerrado sigue cerrado
- ❌ No se duplica el que ya existía
- ❌ Al anular la inspección, sus hallazgos abiertos se anulan — {"id":"dd3b1878-6ca6-42e1-b447-5292eab5254b","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"25f7c587-ea41-4946-9903-ccf057fa68db","plantilla_id":"fd7eece3-d283-4b55-a8aa-fe7a7c48dc6b","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"d8be5e7a-14b2-4607-a559-6d8b17736e38","origen":"no_cumple","clave":"HAL-03","fila":null,"texto":"Batería cargada (ficticio)","accion":null,"responsable_id":null,"plazo":null,"estado":"anulado","severidad":null,"creado_en":"2026-10-29T14:39:46.125104+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Inspección anulada","inspeccion_numero":42,"activo_codigo":"HAL-80653"}
- ❌ El que ya estaba cerrado no cambia
- ❌ Un hallazgo anulado ya no se asigna
