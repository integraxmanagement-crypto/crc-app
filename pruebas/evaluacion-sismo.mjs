// Prueba de la evaluación de sismos (inicio, 13/11/2026). No usa la base de datos ni internet: sismos FICTICIOS del código de protocolo original.
// Compara el módulo de la app con el código original pegado por el dueño (copiado aquí tal cual, con la planta del Callao).
// Uso: node pruebas/evaluacion-sismo.mjs
import { CALLAO, CONFIG_INICIAL, alcanceDelSismo, descripcionMmi, evaluarSismo, romano } from '../src/inicio/evaluacionSismo.ts'
import { comprobar, resumen } from './comun.mjs'

// ── Código original (sin cambios en el cálculo) ──
const PLANTA = { lat: -12.0566, lon: -77.1181 }
const AJUSTE_SUELO_MMI = 1.0, UMBRAL_ALERTA = 4.5, UMBRAL_EVACUAR = 6.0
const R_TIERRA = 6371
function distanciaEpicentral(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a))
}
const longitudRuptura = (M) => Math.pow(10, -2.44 + 0.59 * M)
const pgaYoungs = (M, rrup, H, zt) => Math.exp(0.2418 + 1.414 * M - 2.552 * Math.log(rrup + 1.7818 * Math.exp(0.554 * M)) + 0.00607 * H + 0.3846 * zt)
const pgaAMMI = (pgaG) => { const l = Math.log10(pgaG * 981); return l <= 1.57 ? 1.78 + 1.55 * l : -1.6 + 3.7 * l }
function original({ lat, lon, profundidad, magnitud }) {
  const dEpi = distanciaEpicentral(PLANTA.lat, PLANTA.lon, lat, lon)
  const rHipo = Math.sqrt(dEpi ** 2 + profundidad ** 2)
  const L = longitudRuptura(magnitud)
  const rrup = Math.max(rHipo - 0.5 * L, Math.min(profundidad, 10), 10)
  const zt = profundidad > 60 ? 1 : 0
  const pga = pgaYoungs(magnitud, rrup, profundidad, zt)
  const mmiRoca = pgaAMMI(pga)
  const mmiPlanta = Math.max(1, mmiRoca + AJUSTE_SUELO_MMI)
  let nivel = 'INFORMAR'
  if (mmiPlanta >= UMBRAL_EVACUAR) nivel = 'EVACUAR'
  else if (mmiPlanta >= UMBRAL_ALERTA) nivel = 'ALERTA'
  return { distanciaEpicentralKm: Math.round(dEpi), distanciaHipocentralKm: Math.round(rHipo), distanciaRupturaKm: Math.round(rrup), pgaG: +pga.toFixed(4), mmiRoca: +mmiRoca.toFixed(1), mmiPlanta: +mmiPlanta.toFixed(1), nivel, revisarTsunami: magnitud >= 7.0 && profundidad <= 60 && dEpi <= 1500 }
}

const casos = [
  ['Ecuador M8.0 (Esmeraldas)', { lat: 0.8, lon: -79.8, profundidad: 20, magnitud: 8.0 }],
  ['Frente a Lima M6.0, 60 km', { lat: -12.3, lon: -77.7, profundidad: 40, magnitud: 6.0 }],
  ['Frente a Lima M7.0, 60 km', { lat: -12.3, lon: -77.7, profundidad: 40, magnitud: 7.0 }],
  ['Pisco M8.0 (2007)', { lat: -13.4, lon: -76.5, profundidad: 39, magnitud: 8.0 }],
  ['Arequipa M6.0, 700 km', { lat: -16.4, lon: -71.5, profundidad: 30, magnitud: 6.0 }],
  ['Chile norte M8.0', { lat: -20.5, lon: -70.5, profundidad: 25, magnitud: 8.0 }],
]
for (const [nombre, s] of casos) {
  const a = original(s)
  const b = evaluarSismo(s, CALLAO, CONFIG_INICIAL)
  comprobar(`${nombre}: el módulo da lo mismo que el código original (MMI ${b.mmiUbicacion}, ${b.nivel})`,
    a.distanciaEpicentralKm === b.distanciaEpicentralKm && a.distanciaHipocentralKm === b.distanciaHipocentralKm && a.distanciaRupturaKm === b.distanciaRupturaKm
    && a.pgaG === b.pgaG && a.mmiRoca === b.mmiRoca && a.mmiPlanta === b.mmiUbicacion && a.nivel === b.nivel && a.revisarTsunami === b.revisarTsunami)
}

const lima7 = evaluarSismo(casos[2][1], CALLAO)
const lima6 = evaluarSismo(casos[1][1], CALLAO)
const arequipa = evaluarSismo(casos[4][1], CALLAO)
comprobar('Más magnitud, más intensidad en el mismo lugar', lima7.mmiUbicacion > lima6.mmiUbicacion)
comprobar('Un sismo lejano se siente menos que uno cercano de la misma magnitud', arequipa.mmiUbicacion < lima6.mmiUbicacion)
comprobar('Un M7 poco profundo cerca de Lima pide revisar tsunami; un M6 no', lima7.revisarTsunami && !lima6.revisarTsunami)

// El suelo cambia la intensidad en la cantidad indicada (y no el nivel de un sismo lejano sin riesgo)
const roca = evaluarSismo(casos[1][1], CALLAO, { ...CONFIG_INICIAL, ajusteSueloMmi: 0 })
const blando = evaluarSismo(casos[1][1], CALLAO, { ...CONFIG_INICIAL, ajusteSueloMmi: 1 })
comprobar('Suelo blando suma 1 al MMI de roca', Math.abs(blando.mmiUbicacion - roca.mmiUbicacion - 1) < 0.11 && roca.mmiUbicacion === roca.mmiRoca)

// Alcance: hasta dónde llega cada nivel; mayor magnitud, mayor alcance; y es coherente con la evaluación
const a6 = alcanceDelSismo({ magnitud: 6, profundidad: 40 })
const a8 = alcanceDelSismo({ magnitud: 8, profundidad: 25 })
comprobar(`Alcance M6 (se siente ${a6.sentido} km, alerta ${a6.alerta} km, evacuar ${a6.evacuar} km) y M8 (${a8.sentido}, ${a8.alerta}, ${a8.evacuar})`,
  a8.sentido > a6.sentido && a8.alerta > a6.alerta && a6.sentido >= a6.alerta && a6.alerta >= a6.evacuar && a8.evacuar > 0)
// Un punto justo dentro del radio de alerta tiene al menos el MMI de alerta; uno fuera, menos
const epi = { lat: -12.3, lon: -77.7 }
const a8p = alcanceDelSismo({ magnitud: 8, profundidad: 40 })
const dentro = evaluarSismo({ ...epi, profundidad: 40, magnitud: 8 }, { lat: epi.lat + (a8p.alerta - 5) / 111.19, lon: epi.lon })
const fuera = evaluarSismo({ ...epi, profundidad: 40, magnitud: 8 }, { lat: epi.lat + (a8p.alerta + 5) / 111.19, lon: epi.lon })
comprobar('El radio de alerta calza con la evaluación (dentro: alerta o más; fuera: informar)', dentro.nivel !== 'INFORMAR' && fuera.nivel === 'INFORMAR')

comprobar('Números romanos y descripciones', romano(6.4) === 'VI' && romano(0) === 'I' && romano(20) === 'XII' && descripcionMmi(6).includes('daños leves') && descripcionMmi(9).includes('severos'))

process.exit(resumen() ? 0 : 1)
