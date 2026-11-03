# Pruebas de la programación (tarea 3.4-D, parte 1)

Fecha: 2026-11-03T13:54:45.347Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Frecuencias de las plantillas base

- ❌ Valores iniciales aprobados: caseta, DACI e IPF mensual; extintores y bombas semanal; LOTO trimestral — {"extintores":"semanal","car":"mensual","daci":"mensual","ipf":"mensual","motobomba":"semanal","loto":"trimestral","electrobomba":"semanal","bombas":"semanal"}

## 2. Formato propio y quién cambia la frecuencia

- ❌ Admin A crea un tipo de activo propio
- ❌ Gestor A crea un formato con frecuencia bimestral (al crearlo la define)
- ❌ Queda bimestral
- ❌ El gestor NO puede cambiar la frecuencia — Solo el administrador cambia la frecuencia
- ❌ El gestor sí cambia el nombre (la frecuencia se mantiene)
- ❌ El administrador cambia la frecuencia a mensual
- ❌ Acepta las 7 frecuencias
- ❌ Rechaza una frecuencia que no existe — Frecuencia no válida
- ❌ Otra empresa no toca el formato — No autorizado
- ❌ El formato ficticio se publica

## 3. Avance por período

- ❌ Se inspecciona el equipo 1 con una X: «Inoperativo» — {"id":"d24cd30f-de69-465c-ab43-dcd20fc6656e","estado":"grabada","huella":"851c146fb15526d312eaf8935b7e31077fd0959cc30afa0d126b21f868988d73","numero":171}
- ❌ El equipo 3 se da de baja hoy
- ❌ Mes actual (Noviembre 2026 · 01/11/2026 al 30/11/2026): total 2 (el dado de baja no cuenta) — ["LUZ-66984-1","LUZ-66984-2"]
- ❌ 1 de 2 inspeccionados: el «Inoperativo» cuenta como inspeccionado — [{"activo_id":"5db23d0f-4f59-457d-b91a-139e3421a449","codigo":"LUZ-66984-1","numero":1,"subtipo":null,"ubicacion_id":null,"unidad_id":null,"inspeccion_id":"d24cd30f-de69-465c-ab43-dcd20fc6656e","inspeccion_numero":171,"fecha":"2026-11-03","resultado":"Inoperativo","hallazgos":1}]
- ❌ Falta el equipo 2
- ❌ El equipo inspeccionado trae su hallazgo
- ❌ Mes anterior: los equipos todavía no existían, total 0 — []
- ❌ Semana actual: mismo conteo (1 de 2)

## 4. Quién ve el avance

- ❌ Un usuario sin permiso de ver inspecciones no ve el avance — No autorizado
- ❌ Otra empresa no ve el avance de A — No autorizado
- ❌ No se puede pedir con una sede de otra empresa — No autorizado
- ❌ Un período de más de un año se rechaza — Período no válido
- ❌ El dueño de la plataforma ve el avance
- ❌ Formato de área: devuelve las inspecciones del período (sin equipos)
