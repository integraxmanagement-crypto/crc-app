// Reglas de reintento de la cola de envío de inspecciones (05/11/2026). Son funciones puras, sin acceso a la base ni al navegador,
// para poder probarlas solas (pruebas/cola.mjs). Aprobado por el dueño tras la revisión de llamadas en cadena y reintentos.

/** Reintentos automáticos antes de pasar a «necesita atención»: con las esperas de abajo son unas 6 horas. */
export const TOPE_INTENTOS = 12
/** Segundos entre reintentos: 30 s, 1, 2, 5, 15 y 30 min (el último se repite). */
export const ESPERAS = [30, 60, 120, 300, 900, 1800]
/** Entre dos intentos de la misma inspección nunca pasan menos de 30 segundos, ni siquiera en un envío forzado. */
export const ESPERA_MINIMA_MS = 30_000

export type EstadoColaBase = 'pendiente' | 'enviando' | 'enviada' | 'rechazada' | 'atencion'
export type ItemColaBase = { estado: EstadoColaBase; proximo_intento: number; ultimo_intento?: number }

export const esperaSegundos = (intentos: number) => ESPERAS[Math.min(intentos, ESPERAS.length - 1)]

/**
 * ¿Hay que intentar enviar esta inspección ahora?
 * - Las enviadas, las rechazadas y las que necesitan atención no se reintentan solas.
 * - Un envío «manual» (el botón «Reintentar ahora») no espera.
 * - Un envío «forzado» (al abrir la app o al volver la señal) se salta la espera creciente, pero respeta los 30 segundos mínimos.
 * - Un envío normal respeta la espera creciente.
 */
export function toca(item: ItemColaBase, ahora: number, forzar: boolean, manual = false): boolean {
  if (item.estado === 'enviada' || item.estado === 'rechazada' || item.estado === 'atencion') return false
  if (manual) return true
  if (item.ultimo_intento != null && ahora - item.ultimo_intento < ESPERA_MINIMA_MS) return false
  return forzar || item.proximo_intento <= ahora
}

/** Cómo queda la inspección después de un intento fallido (que se puede reintentar). */
export function despuesDeFallar(intentos: number, ahora: number): { estado: 'pendiente' | 'atencion'; intentos: number; proximo_intento: number } {
  const hechos = intentos + 1
  if (hechos >= TOPE_INTENTOS) return { estado: 'atencion', intentos: hechos, proximo_intento: 0 }
  return { estado: 'pendiente', intentos: hechos, proximo_intento: ahora + esperaSegundos(intentos) * 1000 }
}
