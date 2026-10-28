# Pruebas de la programación (tarea 3.4-D, parte 1)

Fecha: 2026-10-28T17:05:53.252Z · Base: crc-dev · Datos FICTICIOS · **undefined de undefined correctas**

## 1. Frecuencias de las plantillas base

- ❌ Valores iniciales aprobados: extintores, caseta, DACI e IPF mensual; bombas semanal; LOTO trimestral — {"extintores":"mensual","car":"mensual","bombas":"semanal","daci":"mensual","loto":"trimestral","ipf":"mensual"}

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

- ❌ Se inspecciona el equipo 1 con una X: «Inoperativo» — {"id":"eaf71084-9687-4cd1-8e4f-74182a7b8740","estado":"grabada","huella":"6414e9a1f60e88808c6f14366e26d502ac465d29813e9bbc6b875005cc27f8cc","numero":24}
- ❌ El equipo 3 se da de baja hoy
- ❌ Mes actual (Octubre 2026 · 28/09/2026 al 01/11/2026): total 2 (el dado de baja no cuenta) — ["LUZ-36686-1","LUZ-36686-2"]
- ❌ 1 de 2 inspeccionados: el «Inoperativo» cuenta como inspeccionado — [{"activo_id":"599c92a0-17f9-4700-ae7c-b414ecdb83ab","codigo":"LUZ-36686-1","numero":1,"subtipo":null,"ubicacion_id":null,"unidad_id":null,"inspeccion_id":"eaf71084-9687-4cd1-8e4f-74182a7b8740","inspeccion_numero":24,"fecha":"2026-10-28","resultado":"Inoperativo","hallazgos":1}]
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
