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
export function estadosPorActividad(semanas: SemanaGuardada[], ejecucion: Ejecutada[], anio: number, hoy: string, seguimiento: 'semana' | 'mes' = 'semana') {
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
  return seguimiento === 'mes' ? agruparPorMes(mapa, anio, actual) : mapa
}

/**
 * Seguimiento por mes (pedido del dueño, 29/10/2026): una casilla por mes, guardada en la primera semana de ese mes.
 * El mes queda programado si lo está su casilla; ejecutado si hubo una inspección (o marca a mano) en cualquiera de sus
 * semanas; vencido cuando ya terminó el mes y no se ejecutó. Cada semana cuenta en el mes de su jueves.
 */
function agruparPorMes(porSemana: Map<string, Map<number, EstadoSemana>>, anio: number, actual: number) {
  const meses = new Map<number, number[]>()
  for (const s of semanasConMes(anio)) meses.set(s.mes, [...(meses.get(s.mes) ?? []), s.semana])
  const salida = new Map<string, Map<number, EstadoSemana>>()
  for (const [actividad, m] of porSemana) {
    const nuevo = new Map<number, EstadoSemana>()
    for (const semanasDelMes of meses.values()) {
      const e: EstadoSemana = { programada: false, ejecutada: false, manual: false, inspecciones: 0, vencida: false }
      for (const w of semanasDelMes) {
        const x = m.get(w)
        if (!x) continue
        e.programada ||= x.programada
        e.ejecutada ||= x.ejecutada
        e.manual ||= x.manual
        e.inspecciones += x.inspecciones
      }
      if (!e.programada && !e.ejecutada) continue
      e.vencida = e.programada && !e.ejecutada && Math.max(...semanasDelMes) < actual
      nuevo.set(semanasDelMes[0], e)
    }
    salida.set(actividad, nuevo)
  }
  return salida
}

/** Mes en que cuenta la semana de hoy (el de su jueves); fuera del año del programa, enero o diciembre. */
export function mesDeHoy(anio: number, hoy: string) {
  const s = semanaIso(hoy)
  if (s.anio !== anio) return s.anio > anio ? 12 : 1
  return semanasConMes(anio).find((w) => w.semana === s.semana)?.mes ?? 1
}

export type Totales = { programadas: number; ejecutadas: number; fuera: number; pct: number | null }
const sumar = (estados: EstadoSemana[]): Totales => {
  const programadas = estados.filter((e) => e.programada).length
  const ejecutadas = estados.filter((e) => e.programada && e.ejecutada).length
  const fuera = estados.filter((e) => !e.programada && e.ejecutada).length
  return { programadas, ejecutadas, fuera, pct: programadas ? Math.round((1000 * ejecutadas) / programadas) / 10 : null }
}

/** Total general del programa: la suma de los meses. */
export function totalGeneral(meses: Totales[]): Totales {
  const programadas = meses.reduce((s, m) => s + m.programadas, 0)
  const ejecutadas = meses.reduce((s, m) => s + m.ejecutadas, 0)
  const fuera = meses.reduce((s, m) => s + m.fuera, 0)
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

/**
 * % y meta de un objetivo específico o de una estrategia (pedido del dueño, 29/10/2026): el promedio de sus actividades.
 * El % promedia las actividades que ya tienen algo programado; la meta, la de todas sus actividades.
 * `arbol` va en el orden del programa con el nivel de cada nodo; `i` es la posición del objetivo o la estrategia.
 */
export function promedioDe(
  arbol: { id: string; tipo: string; nivel: number; meta_pct?: number | string | null }[],
  i: number,
  estados: Map<string, Map<number, EstadoSemana>>,
): { pct: number | null; meta: number | null } {
  const hijas: typeof arbol = []
  for (let j = i + 1; j < arbol.length && arbol[j].nivel > arbol[i].nivel; j++) if (arbol[j].tipo === 'actividad') hijas.push(arbol[j])
  const pcts = hijas.map((a) => totalesActividad(estados.get(a.id)).pct).filter((x): x is number => x != null)
  const promedio = (xs: number[]) => (xs.length ? Math.round((10 * xs.reduce((s, x) => s + x, 0)) / xs.length) / 10 : null)
  return { pct: promedio(pcts), meta: promedio(hijas.map((a) => Number(a.meta_pct ?? 100))) }
}

export const textoPct = (t: Totales) => (t.pct == null ? '—' : `${t.pct} %`)
