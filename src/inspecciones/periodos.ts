// Períodos de las inspecciones programadas (tarea 3.4-D, decisión del dueño 27/10/2026, D-37).
// La semana es ISO (lunes a domingo). Mensual, bimestral, trimestral, semestral y anual son del calendario: un mes va del 1 al
// último día (revisión del 29/10/2026). El programa anual (PASST) sí cuenta cada semana en el mes de su jueves (mesDeLaSemana).
// Las fechas van como texto AAAA-MM-DD y se calculan en UTC para que la zona horaria no mueva el día.
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

/** Primer y último día de los meses [mesDesde, mesHasta] de un año: meses del calendario (del 1 al 30 o 31), no semanas completas. */
function tramo(anio: number, mesDesde: number, mesHasta: number) {
  const mm = String(mesDesde).padStart(2, '0')
  return { desde: `${anio}-${mm}-01`, hasta: aTexto(Date.UTC(anio, mesHasta, 0)) }
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
  // Mensual y más: meses del calendario (pedido del dueño, 29/10/2026: octubre va del 1 al 31). Solo la semana usa semanas ISO.
  const anio = Number(fecha.slice(0, 4))
  const mes = Number(fecha.slice(5, 7))
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

// ───── Semanas de un año ISO (para el programa anual, 3.4-E) ─────

/** Semanas del año ISO: 52 o 53 (el 28 de diciembre siempre cae en la última). */
export const semanasDelAnio = (anio: number) => semanaIso(`${anio}-12-28`).semana

/** Lunes de la semana `semana` del año ISO `anio`. */
export function lunesDeSemana(anio: number, semana: number): string {
  const cuatroEnero = Date.UTC(anio, 0, 4) // siempre en la semana 1
  const lunes1 = cuatroEnero - diaSemana(cuatroEnero) * DIA
  return aTexto(lunes1 + (semana - 1) * 7 * DIA)
}

/** Las semanas del año con el mes en que cuentan (el de su jueves): para armar la grilla de 12 meses. */
export function semanasConMes(anio: number): { semana: number; mes: number; lunes: string }[] {
  return Array.from({ length: semanasDelAnio(anio) }, (_, k) => {
    const lunes = lunesDeSemana(anio, k + 1)
    return { semana: k + 1, mes: mesDeLaSemana(lunes).mes, lunes }
  })
}
