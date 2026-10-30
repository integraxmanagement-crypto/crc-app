// Sismos en vivo para el inicio (pedido del dueño, 29/10/2026). Datos de USGS (servicio público de EE.UU., sin llave),
// que el navegador consulta directo: no pasan por CRC ni se guardan. El IGP es la fuente oficial para Perú; aquí solo se
// enlaza su reporte. La sección es informativa y no reemplaza las alertas oficiales de INDECI ni del IGP.
// No usa nada propio del navegador salvo fetch, así que se prueba en la computadora (pruebas/sismos.mjs).

export type Sismo = { id: string; mag: number; place: string; time: number; url: string; lat: number; lon: number; depth: number }

export const USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
export const IGP = 'https://ultimosismo.igp.gob.pe/'
export const LIMA = { lat: -12.046, lon: -77.043 }
export const ALERTA_MAG = 5.0
export const ALERTA_MINUTOS = 60
export const REFRESCO_MS = 60_000
// Caja que cubre Perú y alrededores (incluye zonas de países vecinos: por eso existe el filtro «Solo Perú»).
const CAJA = { minlatitude: -19, maxlatitude: 1, minlongitude: -83, maxlongitude: -67 }

/** Dirección de la consulta a USGS: últimos «dias» días y magnitud mínima (0 = todas). */
export function urlSismos(dias: number, magMin: number, ahora = Date.now()) {
  const p = new URLSearchParams({
    format: 'geojson', ...Object.fromEntries(Object.entries(CAJA).map(([k, v]) => [k, String(v)])),
    orderby: 'time', limit: '200', starttime: new Date(ahora - dias * 86_400_000).toISOString().slice(0, 19),
  })
  if (magMin > 0) p.set('minmagnitude', String(magMin))
  return `${USGS}?${p}`
}

type Respuesta = { features?: { id: string; properties: { mag: number | null; place: string | null; time: number; url: string }; geometry: { coordinates: number[] } }[] }

/** Lee la respuesta GeoJSON de USGS. */
export function leerSismos(r: Respuesta): Sismo[] {
  return (r.features ?? []).map((f) => ({
    id: f.id, mag: f.properties.mag ?? 0, place: f.properties.place ?? '', time: f.properties.time, url: f.properties.url,
    lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depth: f.geometry.coordinates[2],
  }))
}

export async function consultarSismos(dias: number, magMin: number): Promise<Sismo[]> {
  const res = await fetch(urlSismos(dias, magMin), { cache: 'no-store' })
  if (!res.ok) throw new Error(`USGS respondió ${res.status}`)
  return leerSismos(await res.json())
}

export const enPeru = (s: Sismo) => /peru/i.test(s.place)

/** Semáforo de magnitud (el mismo en la lista y en el mapa). */
export function colorPorMagnitud(m: number) {
  return m >= 6 ? '#b3261e' : m >= 5 ? '#d9641e' : m >= 4 ? '#c99a12' : '#3d7a5a'
}

/** Distancia en km entre dos puntos (fórmula de Haversine, diámetro de la Tierra 12 742 km). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (g: number) => (g * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2
  return Math.round(12_742 * Math.asin(Math.sqrt(a)))
}
export const distanciaDeLima = (lat: number, lon: number) => distanciaKm(lat, lon, LIMA.lat, LIMA.lon)

/** «hace instantes», «hace 12 min», «hace 3 h 5 min», «hace 2 día(s)». */
export function hace(ms: number, ahora = Date.now()) {
  const min = Math.floor((ahora - ms) / 60_000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  if (min < 1440) return `hace ${Math.floor(min / 60)} h ${min % 60} min`
  return `hace ${Math.floor(min / 1440)} día(s)`
}

const RUMBO: Record<string, string> = { N: 'N', S: 'S', E: 'E', W: 'O' }
/** «12 km NW of Lima, Peru» → «12 km al NO de Lima, Peru». */
export function formatearLugar(place: string) {
  if (!place.trim()) return 'Ubicación sin datos'
  const m = place.match(/^(\d+)\s*km\s+([NSEW]+)\s+of\s+(.+)$/)
  return m ? `${m[1]} km al ${[...m[2]].map((l) => RUMBO[l]).join('')} de ${m[3]}` : place
}

const FORMATO = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
export const formatearFechaHora = (ms: number) => FORMATO.format(ms)

/** El primer sismo de magnitud 5 o más de la última hora (para el aviso rojo), o null. */
export function sismoParaAlerta(lista: Sismo[], ahora = Date.now()) {
  return lista.find((s) => s.mag >= ALERTA_MAG && ahora - s.time <= ALERTA_MINUTOS * 60_000) ?? null
}
