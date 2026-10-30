# Pruebas de la programación (tarea 3.4-D, parte 1)

Fecha: 2026-10-30T14:10:09.402Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Frecuencias de las plantillas base

- ❌ Valores iniciales aprobados: caseta, DACI e IPF mensual; extintores y bombas semanal; LOTO trimestral — {"extintores":"semanal","car":"mensual","bombas":"semanal","daci":"mensual","ipf":"mensual","motobomba":"semanal","loto":"trimestral","electrobomba":"semanal"}

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

- ❌ Se inspecciona el equipo 1 con una X: «Inoperativo» — {"id":"9a1c95fb-2605-4316-a33b-f0ad1f515647","estado":"grabada","huella":"dcdc0fd7e4974ba24189aa06c4a4975679ab6877345bb483b0f4cd1de9e64eb7","numero":138}
- ❌ El equipo 3 se da de baja hoy
- ❌ Mes actual (Octubre 2026 · 01/10/2026 al 31/10/2026): total 2 (el dado de baja no cuenta) — ["LUZ-97716-1","LUZ-97716-2"]
- ❌ 1 de 2 inspeccionados: el «Inoperativo» cuenta como inspeccionado — [{"activo_id":"80594280-5a8b-4ff6-ad66-1d948fd38703","codigo":"LUZ-97716-1","numero":1,"subtipo":null,"ubicacion_id":null,"unidad_id":null,"inspeccion_id":"9a1c95fb-2605-4316-a33b-f0ad1f515647","inspeccion_numero":138,"fecha":"2026-10-30","resultado":"Inoperativo","hallazgos":1}]
- ❌ Falta el equipo 2
- ❌ El equipo inspeccionado trae su hallazgo
- ❌ Mes anterior: los equipos todavía no existían, total 0 — []
- ❌ Semana actual: mismo conteo (1 de 2)

## 4. Quién ve el avance

- ❌ Un usuario sin permiso de ver inspecciones no ve el avance — No autorizado
- ❌ Otra empresa no ve el avance de A — No autorizado
- ❌ No se puede pedir con una sede de otra empresa — La sede no es de la empresa
- ❌ Un período de más de un año se rechaza — Período no válido
- ❌ El dueño de la plataforma ve el avance
- ❌ Formato de área: devuelve las inspecciones del período (sin equipos)
