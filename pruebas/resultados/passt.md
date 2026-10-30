# Pruebas del Programa Anual de SST (tarea 3.4-E)

Fecha: 2026-10-30T14:11:26.830Z · Base: crc-dev · Datos FICTICIOS · Semana de la prueba: 44 de 2026 · **undefined de undefined correctas**

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
- ❌ El administrador (no el responsable) inspecciona con resultado «Inoperativo» — {"id":"90c2b481-d878-4063-9b96-08b496b685d5","estado":"grabada","huella":"80852bbb2a0064aea7d2fd270f4c655a19ac84e5bacc36a200c45a09f5731637","numero":140}
- ❌ La semana queda ejecutada sola, con cualquier inspector y resultado — [{"actividad_id":"d20883f3-cd22-4f18-8feb-18f0614e1913","semana":44,"inspecciones":1,"ultima":"90c2b481-d878-4063-9b96-08b496b685d5"}]
- ❌ La actividad muestra el hallazgo abierto de su inspección — [{"actividad_id":"d20883f3-cd22-4f18-8feb-18f0614e1913","abiertos":1,"vencidos":0}]
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

- ❌ En modo automático se cuenta el personal activo de la empresa — 19 / 19
- ❌ El gestor no cambia el modo ni el número — No autorizado
- ❌ En modo manual hay que escribir la cantidad — Escribe la cantidad de trabajadores
- ❌ El administrador pone el modo manual con su número
- ❌ El PASST usa el mismo número
- ❌ Otra empresa no ve el número
- ❌ Otra empresa no cambia el de A — No autorizado
- ❌ Al volver a automático se vuelve a contar y se olvida el número manual
