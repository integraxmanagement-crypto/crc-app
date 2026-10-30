// Prueba del seguimiento por mes del programa anual (revisión de diseño, 29/10/2026). Sin base de datos: datos FICTICIOS.
// Uso: node pruebas/passt-mes.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { semanasConMes } from '../src/inspecciones/periodos.ts'
import { estadosPorActividad, promedioDe, totalesActividad, totalesPorMes } from '../src/passt/calculo.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const ANIO = 2026
const HOY = '2026-10-29' // semana 44
const primera = (mes) => semanasConMes(ANIO).find((s) => s.mes === mes).semana
const delMes = (mes) => semanasConMes(ANIO).filter((s) => s.mes === mes).map((s) => s.semana)
const semanas = [
  { actividad_id: 'a', semana: primera(9), programada: true, manual: false }, // septiembre: programado, sin ejecutar → vencido
  { actividad_id: 'a', semana: primera(10), programada: true, manual: false }, // octubre: programado
  { actividad_id: 'a', semana: primera(11), programada: true, manual: false }, // noviembre: por venir
]
// Una inspección en la tercera semana de octubre (no en la primera): cuenta para el mes.
const ejecucion = [{ actividad_id: 'a', semana: delMes(10)[2], inspecciones: 1 }]

const porSemana = estadosPorActividad(semanas, ejecucion, ANIO, HOY)
const porMes = estadosPorActividad(semanas, ejecucion, ANIO, HOY, 'mes')
const a = porMes.get('a')
comprobar('Por semana, una inspección en otra semana del mes no cierra la casilla programada', porSemana.get('a').get(primera(10)).ejecutada === false)
comprobar('Por mes, la casilla queda en la primera semana de cada mes', [...a.keys()].every((w) => [primera(9), primera(10), primera(11)].includes(w)) && a.size === 3)
comprobar('Por mes, una inspección en cualquier semana del mes ejecuta el mes', a.get(primera(10)).programada && a.get(primera(10)).ejecutada && a.get(primera(10)).inspecciones === 1)
comprobar('Por mes, un mes terminado sin ejecutar queda vencido', a.get(primera(9)).vencida === true)
comprobar('Por mes, el mes en curso o por venir no está vencido', a.get(primera(10)).vencida === false && a.get(primera(11)).vencida === false)
const t = totalesActividad(a)
comprobar('Totales de la actividad: 3 meses programados, 1 ejecutado', t.programadas === 3 && t.ejecutadas === 1 && t.pct === 33.3, JSON.stringify(t))
const tm = totalesPorMes(porMes, ['a'], ANIO)
comprobar('Totales por mes: septiembre 1 programada, octubre 1 de 1', tm[8].programadas === 1 && tm[8].ejecutadas === 0 && tm[9].programadas === 1 && tm[9].ejecutadas === 1 && tm[9].pct === 100)
const sinProgramar = estadosPorActividad([], [{ actividad_id: 'b', semana: primera(3), inspecciones: 2 }], ANIO, HOY, 'mes').get('b')
comprobar('Un mes con inspección sin programar queda como ejecutado fuera de programa', sinProgramar.get(primera(3)).ejecutada && !sinProgramar.get(primera(3)).programada)

// % y meta de un objetivo y de una estrategia: promedio de sus actividades (pedido del dueño, 29/10/2026).
const arbolP = [
  { id: 'o1', tipo: 'objetivo_especifico', nivel: 1 },
  { id: 's1', tipo: 'seccion', nivel: 2 },
  { id: 'a', tipo: 'actividad', nivel: 3, meta_pct: 90 }, // 33.3 %
  { id: 'b', tipo: 'actividad', nivel: 3, meta_pct: 100 }, // sin nada programado: no entra al promedio del %
  { id: 's2', tipo: 'seccion', nivel: 2 },
  { id: 'c', tipo: 'actividad', nivel: 3, meta_pct: 80 }, // 100 %
]
const estP = new Map([['a', a], ['c', new Map([[primera(1), { programada: true, ejecutada: true, manual: false, inspecciones: 1, vencida: false }]])]])
const s1 = promedioDe(arbolP, 1, estP), o1 = promedioDe(arbolP, 0, estP), s2 = promedioDe(arbolP, 4, estP)
comprobar('Estrategia: % promedio de las actividades con algo programado y meta de todas', s1.pct === 33.3 && s1.meta === 95, JSON.stringify(s1))
comprobar('Otra estrategia con una actividad al 100 %: 100 % y meta 80 %', s2.pct === 100 && s2.meta === 80, JSON.stringify(s2))
comprobar('Objetivo: promedio de todas sus actividades (33.3 y 100 → 66.7; metas 90, 100 y 80 → 90)', o1.pct === 66.7 && o1.meta === 90, JSON.stringify(o1))
comprobar('Sin actividades: sin % ni meta', promedioDe([{ id: 'x', tipo: 'seccion', nivel: 1 }], 0, estP).pct === null)

const fallas = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/passt-mes.md', ['# Pruebas del seguimiento por mes del PASST', '', `Fecha: ${new Date().toISOString()} · Datos FICTICIOS · **${resultados.length - fallas} de ${resultados.length} correctas**`, '',
  ...resultados.map((x) => `- ${x.paso ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.paso ? ` — ${x.detalle}` : ''}`)].join('\n') + '\n')
process.exit(fallas ? 1 : 0)
