# Pruebas de la programación (tarea 3.4-D, parte 1)

Fecha: 2026-11-05T15:28:15.301Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

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

- ❌ Se inspecciona el equipo 1 con una X: «Inoperativo» — {"id":"648ad628-5ba3-4c3f-82ab-17a4459266d0","estado":"grabada","huella":"c4314361f4560b2a27e1bff4c1cd29687a5f93bf17c7505c4112cd8529da6fbb","numero":185}
- ❌ El equipo 3 se da de baja hoy
- ❌ Mes actual (Noviembre 2026 · 01/11/2026 al 30/11/2026): total 2 (el dado de baja no cuenta) — ["LUZ-95003-1","LUZ-95003-2"]
- ❌ 1 de 2 inspeccionados: el «Inoperativo» cuenta como inspeccionado — [{"activo_id":"f467f623-cc23-415a-bfad-c74ad86c555c","codigo":"LUZ-95003-1","numero":1,"subtipo":null,"ubicacion_id":null,"unidad_id":null,"inspeccion_id":"648ad628-5ba3-4c3f-82ab-17a4459266d0","inspeccion_numero":185,"fecha":"2026-11-05","resultado":"Inoperativo","hallazgos":1}]
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
