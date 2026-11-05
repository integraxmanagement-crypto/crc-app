# Pruebas del Programa Anual de SST (tarea 3.4-E)

Fecha: 2026-11-04T21:59:37.099Z · Base: crc-dev · Datos FICTICIOS · Semana de la prueba: 45 de 2026 · **undefined de undefined correctas**

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

- ❌ El gestor no programa semanas: solo el administrador (pedido del dueño, 29/10/2026) — Solo el administrador programa las semanas
- ❌ El administrador programa semanas en borrador — 5
- ❌ El gestor no define la frecuencia de una actividad — Solo el administrador define la frecuencia de una actividad
- ❌ El administrador crea una actividad mensual
- ❌ Mensual: una semana programada por mes (12) — 12
- ❌ Semanal: todas las semanas del año programadas —  53
- ❌ Trimestral: 4 semanas programadas — 4
- ❌ Programar una semana a mano la vuelve manual (sin frecuencia periódica)
- ❌ Una frecuencia que no existe se rechaza — Frecuencia no válida
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
- ❌ El administrador (no el responsable) inspecciona con resultado «Inoperativo» — {"id":"4783cb08-ce7d-415c-ac44-77c9b22bb58b","estado":"grabada","huella":"799c671e69e138bae44ce9f6f0c8446e48163906dc84cac7ca8fa750be2b6ad5","numero":178}
- ❌ La semana queda ejecutada sola, con cualquier inspector y resultado — [{"actividad_id":"56d01652-e301-4a60-9609-a2dcc583e5ab","semana":45,"inspecciones":1,"ultima":"4783cb08-ce7d-415c-ac44-77c9b22bb58b"}]
- ❌ La actividad muestra el hallazgo abierto de su inspección — [{"actividad_id":"56d01652-e301-4a60-9609-a2dcc583e5ab","abiertos":1,"vencidos":0}]
- ❌ El gestor no marca una actividad que no es suya — No autorizado
- ❌ El responsable no marca a mano una actividad vinculada a un formato — No autorizado
- ❌ Sin explicar qué se hizo no se marca
- ❌ El responsable sube la foto de evidencia
- ❌ Otra empresa no sube fotos al programa
- ❌ El responsable marca su actividad sin formato, aunque el programa esté aprobado
- ❌ El administrador ve la foto
- ❌ El administrador marca cualquier actividad
- ❌ La marca guarda quién la hizo
- ❌ El responsable sube un PDF a la carpeta de su actividad
- ❌ Otra empresa no sube PDF al programa de A
- ❌ Un usuario sin permiso de marcar no sube PDF
- ❌ El almacén de PDF rechaza archivos que no son PDF — mime type text/plain is not supported
- ❌ El almacén de PDF rechaza imágenes
- ❌ Solo se aceptan los nombres passt-<semana>-<código>.pdf
- ❌ No se sube un PDF a una actividad que no existe
- ❌ Las fotos de evidencias siguen sin aceptar PDF
- ❌ Un PDF subido pero todavía no marcado no se puede leer
- ❌ La marca rechaza una ruta de PDF que no es de la actividad y la semana — El PDF no está en la carpeta de la actividad
- ❌ La marca rechaza un PDF de más de 10 MB — El PDF no está en la carpeta de la actividad
- ❌ La marca rechaza un PDF vacío — El PDF no está en la carpeta de la actividad
- ❌ Otra empresa no marca con PDF — No autorizado
- ❌ El responsable marca la semana con su PDF
- ❌ Queda guardado el PDF de la marca
- ❌ El administrador de la empresa abre el PDF
- ❌ Quien lo marcó también lo abre
- ❌ Otra empresa no abre el PDF
- ❌ Un usuario sin permiso de ver el PASST no abre el PDF
- ❌ Sin sesión no se abre ningún PDF
- ❌ Otra empresa no lista los PDF de A
- ❌ Nadie borra un PDF directamente (queda como evidencia)
- ❌ Al quitar la marca se suelta el PDF de la semana
- ❌ Marcar sin PDF sigue funcionando como antes
- ❌ Sin sesión no se puede marcar
- ❌ Si se anula la inspección, la semana vuelve a quedar pendiente (se calcula al consultar)

## 5. Baja y duplicar

- ❌ Aprobado: el gestor no da de baja
- ❌ El administrador da de baja con motivo (no se borra)
- ❌ El gestor duplica el programa para el año siguiente
- ❌ Copia el árbol vigente (sin lo dado de baja) — ["objetivo_general","objetivo_especifico","seccion","actividad","actividad","actividad","actividad"]
- ❌ Al duplicar, la actividad con frecuencia semanal se programa sola en el año nuevo — 1 52
- ❌ La copia queda en borrador, con el año nuevo
- ❌ Copia las semanas programadas, no lo ejecutado — 62
- ❌ Copia las 5 metas
- ❌ Otra empresa no duplica

## Seguimiento por mes o por semana

- ❌ No acepta un seguimiento que no sea por semana ni por mes — El seguimiento es por semana o por mes
- ❌ Crea un programa con seguimiento por mes
- ❌ Queda guardado el seguimiento por mes y, por defecto, el programa es por semana
- ❌ Al duplicar se conserva el seguimiento

## N.º de trabajadores de la empresa (automático o manual)

- ❌ En modo automático se cuenta el personal activo de la empresa — 51 / 51
- ❌ El gestor no cambia el modo ni el número — No autorizado
- ❌ En modo manual hay que escribir la cantidad — Escribe la cantidad de trabajadores
- ❌ El administrador pone el modo manual con su número
- ❌ El PASST usa el mismo número
- ❌ Otra empresa no ve el número
- ❌ Otra empresa no cambia el de A — No autorizado
- ❌ Al volver a automático se vuelve a contar y se olvida el número manual
