// Comparación con USGS ShakeMap (pedido del dueño, 13/11/2026). El ShakeMap es el mapa de sacudida que USGS calcula para cada sismo
// importante, ajustado con registros y reportes reales. De cada sismo se lee su ficha (intensidad máxima, intensidad reportada por las personas,
// alerta PAGER) y la cuadrícula de intensidad (MMI), de la que se toma el valor en la ubicación elegida.
// El navegador consulta directo a USGS (tiene permiso para hacerlo); nada pasa por CRC ni se guarda.
// Sin nada propio del navegador salvo fetch, así que se prueba en la computadora (pruebas/shakemap.mjs).

export const DETALLE_USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail'

/** Lo que USGS dice de un sismo: máxima intensidad estimada, máxima reportada por personas, cuántos reportes, alerta PAGER y la cuadrícula. */
export type FichaShakeMap = {
  /** false: USGS todavía no publicó ShakeMap de este sismo (suele hacerlo con los de magnitud 4,5 o más). */
  disponible: boolean
  mmiMaximo: number | null
  cdiMaximo: number | null
  reportes: number | null
  pager: 'green' | 'yellow' | 'orange' | 'red' | null
  /** Dirección de la cuadrícula de intensidad (archivo de baja resolución, unos 80 KB). */
  urlMmi: string | null
}

type Contenido = { url?: string }
type Detalle = {
  properties?: {
    mmi?: number | null; cdi?: number | null; felt?: number | null; alert?: string | null
    products?: { shakemap?: { contents?: Record<string, Contenido> }[] }
  }
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Lee la ficha de un sismo (respuesta de USGS en GeoJSON). */
export function leerFichaShakeMap(d: Detalle): FichaShakeMap {
  const p = d.properties ?? {}
  const sm = p.products?.shakemap?.[0]
  const c = sm?.contents ?? {}
  const urlMmi = c['download/coverage_mmi_low_res.covjson']?.url ?? c['download/coverage_mmi_medium_res.covjson']?.url ?? null
  const alerta = p.alert === 'green' || p.alert === 'yellow' || p.alert === 'orange' || p.alert === 'red' ? p.alert : null
  return { disponible: Boolean(sm), mmiMaximo: numero(p.mmi), cdiMaximo: numero(p.cdi), reportes: numero(p.felt), pager: alerta, urlMmi }
}

export async function consultarFichaShakeMap(id: string): Promise<FichaShakeMap> {
  const r = await fetch(`${DETALLE_USGS}/${encodeURIComponent(id)}.geojson`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`USGS respondió ${r.status}`)
  return leerFichaShakeMap(await r.json())
}

/** Cuadrícula de intensidad en formato CoverageJSON: filas de sur a norte (y ascendente) y columnas de oeste a este. */
export type CuadriculaMmi = {
  domain: { axes: { x: { start: number; stop: number; num: number }; y: { start: number; stop: number; num: number } } }
  ranges: { MMI: { values: (number | null)[] } }
}

/**
 * Intensidad del ShakeMap en un punto: la celda más cercana. null si el punto cae fuera de la cuadrícula (la sacudida allí es leve y USGS
 * no la dibuja) o si la celda no tiene dato.
 */
export function intensidadEnPunto(g: CuadriculaMmi, lat: number, lon: number): number | null {
  const { x, y } = g.domain.axes
  const paso = (a: { start: number; stop: number; num: number }) => (a.num > 1 ? (a.stop - a.start) / (a.num - 1) : 0)
  const px = paso(x), py = paso(y)
  if (!px || !py) return null
  // Un poco de holgura (media celda) en el borde.
  if (lon < x.start - px / 2 || lon > x.stop + px / 2 || lat < y.start - py / 2 || lat > y.stop + py / 2) return null
  const xi = Math.min(x.num - 1, Math.max(0, Math.round((lon - x.start) / px)))
  const yi = Math.min(y.num - 1, Math.max(0, Math.round((lat - y.start) / py)))
  const v = g.ranges.MMI.values[yi * x.num + xi]
  return numero(v) ?? null
}

export async function consultarCuadricula(url: string): Promise<CuadriculaMmi> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`USGS respondió ${r.status}`)
  return (await r.json()) as CuadriculaMmi
}

export type Veredicto = { texto: string; cercano: boolean }

/** Qué tan parecidos son el cálculo propio y el ShakeMap (en grados de intensidad). */
export function compararIntensidades(propia: number, usgs: number): Veredicto {
  const dif = propia - usgs
  const a = Math.abs(dif)
  const sentido = dif > 0 ? 'Tu cálculo es mayor' : 'Tu cálculo es menor'
  if (a <= 0.5) return { cercano: true, texto: 'Muy parecidos (diferencia de menos de medio grado).' }
  if (a <= 1) return { cercano: true, texto: `Parecidos. ${sentido} por ${a.toFixed(1)} grados.` }
  return { cercano: false, texto: `Difieren por ${a.toFixed(1)} grados. ${sentido}; conviene revisar el reporte oficial del IGP y tomar la lectura más alta para decidir.` }
}
