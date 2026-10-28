// Períodos de las inspecciones programadas (tarea 3.4-D, decisión del dueño 27/10/2026, D-37).
// Todo se arma con semanas ISO (lunes a domingo). Cada semana cuenta en el mes de su jueves: así un mes, un bimestre
// o un trimestre siempre son semanas completas y ninguna semana queda en dos meses. El año es el año ISO (52 o 53
// semanas). Las fechas van como texto AAAA-MM-DD y se calculan en UTC para que la zona horaria no mueva el día.
import type { Frecuencia } from '../formatos/base.ts'

export type Periodo = { clave: string; etiqueta: string; desde: string; hasta: string }
export const CON_PERIODO: Frecuencia[] = ['semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual']

const DIA = 864e5
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_POR: Partial<Record<Frecuencia, number>> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }
const NOMBRE_TRAMO: Partial<Record<Frecuencia, string>> = { bimestral: 'Bimestre', trimestral: 'Trimestre', semestral: 'Semestre' }

const aFecha = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
const aTexto = (t: number) => new Date(t).toISOString().slice(0, 10)
const corta = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
/** Lunes = 0 … domingo = 6. */
const diaSemana = (t: number) => (new Date(t).getUTCDay() + 6) % 7

/** Jueves de la semana ISO de una fecha. */
const jueves = (t: number) => t + (3 - diaSemana(t)) * DIA

/** Semana ISO de una fecha: año ISO, número de semana y su lunes. */
export function semanaIso(fecha: string): { anio: number; semana: number; lunes: string } {
  const t = aFecha(fecha)
  const j = jueves(t)
  const anio = new Date(j).getUTCFullYear()
  const semana = Math.floor((j - Date.UTC(anio, 0, 1)) / (7 * DIA)) + 1
  return { anio, semana, lunes: aTexto(t - diaSemana(t) * DIA) }
}

/** Mes (1-12) y año en que cuenta la semana de una fecha: los de su jueves. */
export function mesDeLaSemana(fecha: string): { anio: number; mes: number } {
  const j = new Date(jueves(aFecha(fecha)))
  return { anio: j.getUTCFullYear(), mes: j.getUTCMonth() + 1 }
}

/** Primer día (lunes) y último (domingo) de los meses [mesDesde, mesHasta] de un año, en semanas completas. */
function tramo(anio: number, mesDesde: number, mesHasta: number) {
  const primerJueves = (a: number, m: number) => {
    const d1 = Date.UTC(a, m - 1, 1)
    return d1 + ((3 - diaSemana(d1) + 7) % 7) * DIA
  }
  const desde = primerJueves(anio, mesDesde) - 3 * DIA
  const sig = mesHasta === 12 ? primerJueves(anio + 1, 1) : primerJueves(anio, mesHasta + 1)
  return { desde: aTexto(desde), hasta: aTexto(sig - 4 * DIA) }
}

/** El período al que pertenece una fecha, según la frecuencia del formato. «Sin frecuencia» no tiene períodos. */
export function periodoDe(fecha: string, frecuencia: Frecuencia): Periodo | null {
  if (frecuencia === 'semanal') {
    const s = semanaIso(fecha)
    const hasta = aTexto(aFecha(s.lunes) + 6 * DIA)
    return { clave: `${s.anio}-S${String(s.semana).padStart(2, '0')}`, etiqueta: `Semana ${s.semana} de ${s.anio} (${corta(s.lunes)} al ${corta(hasta)})`, desde: s.lunes, hasta }
  }
  const n = MESES_POR[frecuencia]
  if (!n) return null
  const { anio, mes } = mesDeLaSemana(fecha)
  const inicio = Math.floor((mes - 1) / n) * n + 1
  const fin = inicio + n - 1
  const { desde, hasta } = tramo(anio, inicio, fin)
  const parte = (inicio - 1) / n + 1
  const etiqueta =
    frecuencia === 'mensual' ? `${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} ${anio}`
    : frecuencia === 'anual' ? `Año ${anio}`
    : `${NOMBRE_TRAMO[frecuencia]} ${parte} de ${anio} (${MESES[inicio - 1]} a ${MESES[fin - 1]})`
  const clave = frecuencia === 'mensual' ? `${anio}-${String(mes).padStart(2, '0')}` : frecuencia === 'anual' ? `${anio}` : `${anio}-${frecuencia[0].toUpperCase()}${parte}`
  return { clave, etiqueta: `${etiqueta} · ${corta(desde)}/${desde.slice(0, 4)} al ${corta(hasta)}/${hasta.slice(0, 4)}`, desde, hasta }
}

/** El período actual y los anteriores (el más reciente primero). */
export function periodosHasta(fecha: string, frecuencia: Frecuencia, cantidad: number): Periodo[] {
  const lista: Periodo[] = []
  let p = periodoDe(fecha, frecuencia)
  while (p && lista.length < cantidad) {
    lista.push(p)
    p = periodoDe(aTexto(aFecha(p.desde) - DIA), frecuencia)
  }
  return lista
}
