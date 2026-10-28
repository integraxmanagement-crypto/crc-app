// Cálculos del programa anual (tarea 3.4-E, D-41): qué semanas están programadas (P) y ejecutadas (E), y los totales
// por mes y por actividad. % de cumplimiento = ejecutadas ÷ programadas. Una semana ejecutada sin estar programada se
// muestra, pero no suma al %: así nunca pasa del 100 %. Sin programadas no hay % («—»), en vez del #DIV/0! del Excel.
import { semanaIso, semanasConMes } from '../inspecciones/periodos.ts'

export type EstadoSemana = { programada: boolean; ejecutada: boolean; manual: boolean; inspecciones: number; vencida: boolean }
type SemanaGuardada = { actividad_id: string; semana: number; programada: boolean; manual: boolean }
type Ejecutada = { actividad_id: string; semana: number; inspecciones: number }

/** Semana «actual» del programa: la de hoy si es su año; la última si el año ya pasó; 0 si todavía no empieza. */
export function semanaActual(anio: number, hoy: string) {
  const s = semanaIso(hoy)
  if (s.anio === anio) return s.semana
  return s.anio > anio ? 99 : 0
}

/** Estado de cada semana de cada actividad. Vencida = programada, ya pasó y no se ejecutó. */
export function estadosPorActividad(semanas: SemanaGuardada[], ejecucion: Ejecutada[], anio: number, hoy: string) {
  const actual = semanaActual(anio, hoy)
  const mapa = new Map<string, Map<number, EstadoSemana>>()
  const de = (a: string, w: number) => {
    let m = mapa.get(a)
    if (!m) mapa.set(a, (m = new Map()))
    let e = m.get(w)
    if (!e) m.set(w, (e = { programada: false, ejecutada: false, manual: false, inspecciones: 0, vencida: false }))
    return e
  }
  for (const s of semanas) {
    const e = de(s.actividad_id, s.semana)
    e.programada = s.programada
    e.manual = s.manual
    if (s.manual) e.ejecutada = true
  }
  for (const x of ejecucion) {
    const e = de(x.actividad_id, x.semana)
    e.inspecciones = x.inspecciones
    if (x.inspecciones > 0) e.ejecutada = true
  }
  for (const m of mapa.values()) for (const [w, e] of m) e.vencida = e.programada && !e.ejecutada && w < actual
  return mapa
}

export type Totales = { programadas: number; ejecutadas: number; fuera: number; pct: number | null }
const sumar = (estados: EstadoSemana[]): Totales => {
  const programadas = estados.filter((e) => e.programada).length
  const ejecutadas = estados.filter((e) => e.programada && e.ejecutada).length
  const fuera = estados.filter((e) => !e.programada && e.ejecutada).length
  return { programadas, ejecutadas, fuera, pct: programadas ? Math.round((1000 * ejecutadas) / programadas) / 10 : null }
}

/** Totales de una actividad en el año (o hasta la semana dada). */
export function totalesActividad(estados: Map<number, EstadoSemana> | undefined, hasta = 99): Totales {
  return sumar([...(estados ?? new Map<number, EstadoSemana>()).entries()].filter(([w]) => w <= hasta).map(([, e]) => e))
}

/** Totales de todas las actividades por mes (1 a 12), según el mes en que cuenta cada semana (el de su jueves). */
export function totalesPorMes(mapa: Map<string, Map<number, EstadoSemana>>, actividades: string[], anio: number): Totales[] {
  const mesDe = new Map(semanasConMes(anio).map((s) => [s.semana, s.mes]))
  return Array.from({ length: 12 }, (_, k) =>
    sumar(actividades.flatMap((a) => [...(mapa.get(a) ?? new Map<number, EstadoSemana>()).entries()].filter(([w]) => mesDe.get(w) === k + 1).map(([, e]) => e))),
  )
}

export const textoPct = (t: Totales) => (t.pct == null ? '—' : `${t.pct} %`)
