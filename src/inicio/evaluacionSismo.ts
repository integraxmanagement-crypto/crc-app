// Evaluación de un sismo en una ubicación (pedido del dueño, 13/11/2026), a partir del código de protocolo de sismos para la planta (Callao).
// Entrada: epicentro, profundidad (km) y magnitud del sismo (feed de USGS; el IGP es la fuente oficial) y la ubicación a evaluar.
// Salida: intensidad estimada (MMI) en esa ubicación, nivel de acción, distancias y alcance del sismo (distancia y profundidad).
// Método: distancia hipocentral → PGA (Youngs et al. 1997, subducción, roca) → MMI (Worden et al. 2012) → + ajuste por suelo local.
// VALIDAR los coeficientes con los papers y los umbrales con el Comité SST antes de usarlo de forma oficial.
// Sin nada propio del navegador, así que se prueba en la computadora (pruebas/evaluacion-sismo.mjs).

export type Ubicacion = { lat: number; lon: number }
export type SismoEntrada = { lat: number; lon: number; profundidad: number; magnitud: number }
export type ConfigEvaluacion = {
  /** Suma por suelo local: 0 = roca; 0,5 = suelo firme; 1 = suelo blando o relleno. */
  ajusteSueloMmi: number
  /** MMI desde el cual se avisa: alerta / preparación. */
  umbralAlerta: number
  /** MMI desde el cual se evacúa. */
  umbralEvacuar: number
}
export type Nivel = 'INFORMAR' | 'ALERTA' | 'EVACUAR'

export const CONFIG_INICIAL: ConfigEvaluacion = { ajusteSueloMmi: 1.0, umbralAlerta: 4.5, umbralEvacuar: 6.0 }
/** Tipos de suelo para elegir (el ajuste se suma al MMI de roca). */
export const SUELOS: { ajuste: number; nombre: string }[] = [
  { ajuste: 0, nombre: 'Roca' },
  { ajuste: 0.5, nombre: 'Suelo firme' },
  { ajuste: 1, nombre: 'Suelo blando o relleno' },
]
/** Planta del protocolo original (Callao). Coordenadas APROXIMADAS: reemplazar por las exactas. */
export const CALLAO = { lat: -12.0566, lon: -77.1181 }

const R_TIERRA = 6371 // km

/** Distancia epicentral en km (Haversine). */
export function distanciaEpicentral(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_TIERRA * Math.asin(Math.sqrt(a))
}

/** Longitud de ruptura aproximada en km (Wells & Coppersmith 1994, todos los tipos). */
export const longitudRuptura = (M: number) => Math.pow(10, -2.44 + 0.59 * M)

/** PGA en g (Youngs et al. 1997, roca, subducción). zt: 0 interfase, 1 intraplaca. */
export function pgaYoungs(M: number, rrup: number, H: number, zt: number) {
  return Math.exp(0.2418 + 1.414 * M - 2.552 * Math.log(rrup + 1.7818 * Math.exp(0.554 * M)) + 0.00607 * H + 0.3846 * zt)
}

/** PGA (g) → MMI (Worden et al. 2012). */
export function pgaAMMI(pgaG: number) {
  const l = Math.log10(pgaG * 981) // cm/s²
  return l <= 1.57 ? 1.78 + 1.55 * l : -1.6 + 3.7 * l
}

/** Lo que pasa a una distancia epicentral dada: distancias, PGA e intensidad (con el ajuste de suelo). */
function enDistancia(magnitud: number, profundidad: number, dEpi: number, ajuste: number) {
  const rHipo = Math.sqrt(dEpi ** 2 + profundidad ** 2)
  // Sismos grandes: la ruptura se extiende; se acerca la distancia (conservador).
  const rrup = Math.max(rHipo - 0.5 * longitudRuptura(magnitud), Math.min(profundidad, 10), 10)
  const zt = profundidad > 60 ? 1 : 0 // aprox.: más de 60 km = intraplaca
  const pga = pgaYoungs(magnitud, rrup, profundidad, zt)
  const mmiRoca = pgaAMMI(pga)
  return { rHipo, rrup, pga, mmiRoca, mmi: Math.max(1, mmiRoca + ajuste) }
}

export type Evaluacion = {
  distanciaEpicentralKm: number
  distanciaHipocentralKm: number
  distanciaRupturaKm: number
  pgaG: number
  mmiRoca: number
  mmiUbicacion: number
  nivel: Nivel
  /** Tsunami: criterio independiente; revisar la alerta oficial (DHN / SINAMOT). */
  revisarTsunami: boolean
}

export function evaluarSismo(s: SismoEntrada, u: Ubicacion, cfg: ConfigEvaluacion = CONFIG_INICIAL): Evaluacion {
  const dEpi = distanciaEpicentral(u.lat, u.lon, s.lat, s.lon)
  const x = enDistancia(s.magnitud, s.profundidad, dEpi, cfg.ajusteSueloMmi)
  const nivel: Nivel = x.mmi >= cfg.umbralEvacuar ? 'EVACUAR' : x.mmi >= cfg.umbralAlerta ? 'ALERTA' : 'INFORMAR'
  return {
    distanciaEpicentralKm: Math.round(dEpi),
    distanciaHipocentralKm: Math.round(x.rHipo),
    distanciaRupturaKm: Math.round(x.rrup),
    pgaG: +x.pga.toFixed(4),
    mmiRoca: +x.mmiRoca.toFixed(1),
    mmiUbicacion: +x.mmi.toFixed(1),
    nivel,
    revisarTsunami: s.magnitud >= 7.0 && s.profundidad <= 60 && dEpi <= 1500,
  }
}

export type Alcance = { sentido: number; alerta: number; evacuar: number }

/** MMI desde el cual un sismo se siente en general (se usa para el «alcance»: hasta dónde llegó). */
export const MMI_SENTIDO = 3

/**
 * Alcance del sismo: hasta qué distancia epicentral (km) la intensidad estimada sigue siendo al menos la de «se siente», la de alerta
 * y la de evacuación. 0 = ni en el propio epicentro llega a ese nivel. Se calcula con la misma fórmula, con el suelo elegido.
 */
export function alcanceDelSismo(s: Pick<SismoEntrada, 'profundidad' | 'magnitud'>, cfg: ConfigEvaluacion = CONFIG_INICIAL): Alcance {
  const hasta = (umbral: number) => {
    let ultimo = 0
    for (let d = 0; d <= 3000; d += 1) if (enDistancia(s.magnitud, s.profundidad, d, cfg.ajusteSueloMmi).mmi >= umbral) ultimo = d + 1
    return ultimo
  }
  return { sentido: hasta(MMI_SENTIDO), alerta: hasta(cfg.umbralAlerta), evacuar: hasta(cfg.umbralEvacuar) }
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
/** MMI en números romanos («VI»). */
export const romano = (mmi: number) => ROMANOS[Math.min(11, Math.max(0, Math.round(mmi) - 1))]

/** Lo que se siente y lo que puede pasar con esa intensidad (escala de Mercalli modificada, resumida). */
export function descripcionMmi(mmi: number) {
  const n = Math.round(mmi)
  if (n <= 2) return 'Casi no se siente: solo algunas personas en reposo.'
  if (n === 3) return 'Se siente dentro de edificios; cuelgan y se mecen los objetos.'
  if (n === 4) return 'Se siente claramente adentro; vibran ventanas y vajilla.'
  if (n === 5) return 'Lo sienten casi todos; se despiertan los que duermen y caen objetos pequeños.'
  if (n === 6) return 'Lo sienten todos; se mueven muebles y puede haber daños leves en construcciones.'
  if (n === 7) return 'Difícil mantenerse de pie; daños moderados en construcciones comunes.'
  return 'Daños considerables o severos; riesgo alto para las personas.'
}
