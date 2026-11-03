# Pruebas del seguimiento de hallazgos (tarea 3.4-D, parte 2)

Fecha: 2026-11-02T22:49:59.555Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Nacen solos al recibir la inspección

- ❌ Se registra una inspección con 2 X — {"id":"69ca87d4-e76a-408e-8287-60f97bea0e44","estado":"grabada","huella":"94c9cb6ea5aa9940856f6ecd1fb85c70413fd14f111ee562e0303723d0b3563e","numero":159}
- ❌ Nacen 2 hallazgos, uno por cada X — ["HAL-01","HAL-02"]
- ❌ El que traía acción nace con responsable, plazo y acción — {"id":"a840d15b-be13-4f1f-a98d-b416f10c5242","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"69ca87d4-e76a-408e-8287-60f97bea0e44","plantilla_id":"612c4023-856f-4f38-8e2d-81d311112a72","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"db137599-cbd8-4bb5-ad16-29a9a95f4146","origen":"no_cumple","clave":"HAL-01","fila":null,"texto":"Señal visible (ficticio)","accion":"Reponer la señal (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-11-15","estado":"abierto","severidad":null,"creado_en":"2026-11-02T22:49:53.77977+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":null,"inspeccion_numero":159,"activo_codigo":"HAL-29629"}
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
- ❌ Queda cerrado, con quién y la foto — {"estado":"cerrado","cerrado_por":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","cierre_foto_ruta":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50/69ca87d4-e76a-408e-8287-60f97bea0e44/cierre-a840d15b-be13-4f1f-a98d-b416f10c5242-07a28908.png"}
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

- ❌ El administrador corrige la inspección — {"estado":"corregida","huella":"235c01b63fb0cd76ddc625f53d22bc28bb557afa50080fb447533c48c87cbcf9","edicion":2}
- ❌ El hallazgo que desapareció queda «anulado por corrección» — {"id":"ebf55dc0-2697-4c8c-8fb5-564c76d941fd","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"69ca87d4-e76a-408e-8287-60f97bea0e44","plantilla_id":"612c4023-856f-4f38-8e2d-81d311112a72","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"db137599-cbd8-4bb5-ad16-29a9a95f4146","origen":"no_cumple","clave":"HAL-02","fila":null,"texto":"Acceso libre (ficticio)","accion":"Despejar el acceso (ficticio)","responsable_id":"ba30ec35-3d0a-4606-985f-08c3353c6fb4","plazo":"2026-10-01","estado":"anulado","severidad":null,"creado_en":"2026-11-02T22:49:53.77977+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Anulado por corrección de la inspección","inspeccion_numero":159,"activo_codigo":"HAL-29629"}
- ❌ Nace el hallazgo nuevo (HAL-03)
- ❌ El cerrado sigue cerrado
- ❌ No se duplica el que ya existía
- ❌ Al anular la inspección, sus hallazgos abiertos se anulan — {"id":"4c8e0837-0b9d-4be6-9454-c2b6e1e636c6","empresa_id":"a6cdbf53-a50f-4da9-9c3d-bbf837259d50","inspeccion_id":"69ca87d4-e76a-408e-8287-60f97bea0e44","plantilla_id":"612c4023-856f-4f38-8e2d-81d311112a72","sede_id":"5bfa9266-f5d4-4ab3-9986-97413d41194c","activo_id":"db137599-cbd8-4bb5-ad16-29a9a95f4146","origen":"no_cumple","clave":"HAL-03","fila":null,"texto":"Batería cargada (ficticio)","accion":null,"responsable_id":null,"plazo":null,"estado":"anulado","severidad":null,"creado_en":"2026-11-02T22:49:58.951685+00:00","cerrado_en":null,"cerrado_por":null,"cierre_comentario":null,"cierre_foto_ruta":null,"cierre_foto_bytes":null,"anulado_motivo":"Inspección anulada","inspeccion_numero":159,"activo_codigo":"HAL-29629"}
- ❌ El que ya estaba cerrado no cambia
- ❌ Un hallazgo anulado ya no se asigna
