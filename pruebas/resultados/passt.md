# Pruebas del Programa Anual de SST (tarea 3.4-E)

Fecha: 2026-10-28T17:06:21.224Z · Base: crc-dev · Datos FICTICIOS · Semana de la prueba: 44 de 2026 · **undefined de undefined correctas**

## 1. Quién ve y quién crea

- ❌ Un usuario (trabajador) no crea programas — No autorizado
- ❌ Otra empresa no crea programas en A — No autorizado
- ❌ El gestor crea un programa general del año
- ❌ Nace con su objetivo general
- ❌ El usuario no ve el programa
- ❌ Otra empresa no ve el programa
- ❌ Sin sesión no se ve nada
- ❌ El dueño de la plataforma lo ve

## 2. Árbol: objetivos, metas, secciones y actividades

- ❌ Agrega un objetivo específico con recursos
- ❌ Guarda 5 metas con su indicador
- ❌ No acepta una sexta meta — Hasta 5 metas por objetivo
- ❌ Una actividad no puede ir directo en un objetivo (va en una sección) — Un objetivo específico va en el objetivo general, una sección en un objetivo y una actividad en una sección
- ❌ Un usuario no puede ser responsable (decisión del dueño) — El responsable debe ser un administrador o gestor activo de la empresa
- ❌ Agrega 3 actividades (una vinculada a un formato)
- ❌ Sube una actividad un lugar
- ❌ La lista de responsables trae solo administradores y gestores
- ❌ Nadie cambia las tablas directo

## 3. Programar semanas, aprobar y reprogramar

- ❌ El gestor programa semanas en borrador — 5
- ❌ No existe la semana 54
- ❌ El gestor no aprueba — No autorizado
- ❌ El administrador aprueba
- ❌ Aprobado: el gestor ya no reprograma (decisión del dueño) — El programa está aprobado: solo el administrador lo cambia
- ❌ Aprobado: el administrador necesita un motivo — El programa está aprobado: escribe el motivo del cambio
- ❌ El administrador reprograma con motivo
- ❌ Aprobado: el gestor no cambia la estructura — El programa está aprobado: solo el administrador lo cambia
- ❌ El historial guarda la aprobación y la reprogramación con su motivo — ["creado","aprobado","reprogramado"]

## 4. Lo ejecutado: por inspección y a mano

- ❌ Sin inspecciones, nada ejecutado por inspección
- ❌ El administrador (no el responsable) inspecciona con resultado «Inoperativo» — {"id":"0a74f356-42f2-4e41-aee6-4101b1967532","estado":"grabada","huella":"2ea18edb1a239275181e274e3aa872c16b5a2da437c8683fdbfd003350f800ff","numero":26}
- ❌ La semana queda ejecutada sola, con cualquier inspector y resultado — [{"actividad_id":"aef82c06-38fd-4dec-ab44-07fa2b0dfcfe","semana":44,"inspecciones":1,"ultima":"0a74f356-42f2-4e41-aee6-4101b1967532"}]
- ❌ La actividad muestra el hallazgo abierto de su inspección — [{"actividad_id":"aef82c06-38fd-4dec-ab44-07fa2b0dfcfe","abiertos":1,"vencidos":0}]
- ❌ El gestor no marca una actividad que no es suya — No autorizado
- ❌ El responsable no marca a mano una actividad vinculada a un formato — No autorizado
- ❌ Sin explicar qué se hizo no se marca
- ❌ El responsable sube la foto de evidencia
- ❌ Otra empresa no sube fotos al programa
- ❌ El responsable marca su actividad sin formato, aunque el programa esté aprobado
- ❌ El administrador ve la foto
- ❌ El administrador marca cualquier actividad
- ❌ La marca guarda quién la hizo
- ❌ Si se anula la inspección, la semana vuelve a quedar pendiente (se calcula al consultar)

## 5. Baja y duplicar

- ❌ Aprobado: el gestor no da de baja
- ❌ El administrador da de baja con motivo (no se borra)
- ❌ El gestor duplica el programa para el año siguiente
- ❌ Copia el árbol vigente (sin lo dado de baja) — ["objetivo_general","objetivo_especifico","seccion","actividad","actividad"]
- ❌ La copia queda en borrador, con el año nuevo
- ❌ Copia las semanas programadas, no lo ejecutado — 5
- ❌ Copia las 5 metas
- ❌ Otra empresa no duplica
