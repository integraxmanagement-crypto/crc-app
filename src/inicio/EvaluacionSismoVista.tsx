import { TriangleAlert } from 'lucide-react'
import { type Alcance, CONFIG_INICIAL, type ConfigEvaluacion, type Evaluacion, type Nivel, descripcionMmi, romano } from './evaluacionSismo'
import { type Sismo, formatearFechaHora, formatearLugar } from './sismos'

export const NOMBRE_NIVEL: Record<Nivel, string> = { INFORMAR: 'Informar', ALERTA: 'Alerta', EVACUAR: 'Evacuar' }

/** Pastilla «MMI VI · Alerta» de un sismo en la ubicación elegida. */
export function InsigniaNivel({ ev }: { ev: Evaluacion }) {
  return (
    <span className="sismo-nivel" data-nivel={ev.nivel} title={descripcionMmi(ev.mmiUbicacion)}>
      MMI {romano(ev.mmiUbicacion)} · {NOMBRE_NIVEL[ev.nivel]}
    </span>
  )
}

/**
 * Corte lateral del sismo: la superficie, el epicentro, el hipocentro (profundidad) y la ubicación, con la línea por la que viaja la
 * sacudida. La distancia va a escala; la profundidad se dibuja más grande de lo real para que se vea (así se avisa en el dibujo).
 */
function Corte({ distancia, profundidad, hipocentral }: { distancia: number; profundidad: number; hipocentral: number }) {
  const ancho = 560
  const x0 = 36
  const x1 = ancho - 36
  const suelo = 34
  const baja = Math.min(110, 30 + Math.sqrt(profundidad) * 9)
  return (
    <svg className="sismo-corte" viewBox={`0 0 ${ancho} ${suelo + baja + 40}`} role="img"
      aria-label={`Corte del sismo: epicentro a ${distancia} km de la ubicación y hipocentro a ${Math.round(profundidad)} km de profundidad`}>
      <rect x="0" y={suelo} width={ancho} height={baja + 40} className="corte-tierra" />
      <line x1="0" y1={suelo} x2={ancho} y2={suelo} className="corte-superficie" />
      <line x1={x0} y1={suelo} x2={x0} y2={suelo + baja} className="corte-profundidad" />
      <line x1={x0} y1={suelo + baja} x2={x1} y2={suelo} className="corte-onda" />
      <circle cx={x0} cy={suelo + baja} r="7" className="corte-hipo" />
      <circle cx={x0} cy={suelo} r="5" className="corte-epi" />
      <path d={`M ${x1} ${suelo} l -7 -14 h 14 z`} className="corte-ubic" />
      <text x={x0 + 10} y={suelo + baja / 2 + 4} className="corte-texto">Profundidad {Math.round(profundidad)} km</text>
      <text x={x0} y={suelo - 10} className="corte-texto" textAnchor="start">Epicentro</text>
      <text x={x1} y={suelo - 20} className="corte-texto" textAnchor="end">Tu ubicación</text>
      <text x={(x0 + x1) / 2} y={suelo + baja + 28} className="corte-texto" textAnchor="middle">
        Epicentro a {distancia} km de tu ubicación · de la sacudida al hipocentro: {hipocentral} km
      </text>
    </svg>
  )
}

/** Detalle del sismo elegido: intensidad en la ubicación, nivel de acción, distancias y hasta dónde llega (alcance). */
export function DetalleEvaluacion({ sismo, ev, alcance, cfg = CONFIG_INICIAL, manual = false }: { sismo: Sismo; ev: Evaluacion; alcance: Alcance; cfg?: ConfigEvaluacion; manual?: boolean }) {
  const d = ev.distanciaEpicentralKm
  const dentro = (km: number) => (d <= km ? 'dentro' : 'fuera')
  return (
    <section className="sismo-detalle" aria-label="Evaluación del sismo en tu ubicación" data-nivel={ev.nivel}>
      <header>
        <div>
          <h3>M {sismo.mag.toFixed(1)} — {manual ? `epicentro ${sismo.lat.toFixed(2)}, ${sismo.lon.toFixed(2)}` : formatearLugar(sismo.place)}</h3>
          <small>{manual ? 'Cálculo manual con los datos que escribiste' : formatearFechaHora(sismo.time)}</small>
        </div>
        <InsigniaNivel ev={ev} />
      </header>
      <p className="sismo-detalle-desc">
        En tu ubicación se estima una intensidad <b>{romano(ev.mmiUbicacion)}</b> (MMI {ev.mmiUbicacion.toFixed(1)}): {descripcionMmi(ev.mmiUbicacion)}
        {' '}Acción sugerida: <b>{NOMBRE_NIVEL[ev.nivel]}</b>
        {ev.nivel === 'EVACUAR' ? ' (evacuar según el protocolo).' : ev.nivel === 'ALERTA' ? ' (alerta y preparación).' : '.'}
      </p>
      {ev.revisarTsunami && (
        <p className="sismos-alerta" role="alert">
          <TriangleAlert size={18} aria-hidden="true" /> Magnitud y profundidad compatibles con un posible tsunami: revisa la alerta oficial de la DHN (SINAMOT).
        </p>
      )}
      <dl className="sismo-datos">
        <div><dt>Distancia al epicentro</dt><dd>{ev.distanciaEpicentralKm} km</dd></div>
        <div><dt>Profundidad del sismo</dt><dd>{Math.round(sismo.depth)} km</dd></div>
        <div><dt>Distancia al hipocentro</dt><dd>{ev.distanciaHipocentralKm} km</dd></div>
        <div><dt>Distancia a la ruptura</dt><dd>{ev.distanciaRupturaKm} km</dd></div>
        <div><dt>Aceleración estimada (PGA)</dt><dd>{ev.pgaG.toFixed(4)} g</dd></div>
        <div><dt>Intensidad en roca</dt><dd>MMI {ev.mmiRoca.toFixed(1)}</dd></div>
      </dl>
      <h4>Hasta dónde llega este sismo</h4>
      <ul className="sismo-alcance">
        <li data-nivel="sentido"><b>{alcance.sentido ? `${alcance.sentido} km` : 'No llega'}</b> se siente (MMI 3 o más) · tu ubicación está {alcance.sentido ? dentro(alcance.sentido) : 'fuera'}</li>
        <li data-nivel="ALERTA"><b>{alcance.alerta ? `${alcance.alerta} km` : 'No llega'}</b> alerta (MMI {cfg.umbralAlerta} o más) · tu ubicación está {alcance.alerta ? dentro(alcance.alerta) : 'fuera'}</li>
        <li data-nivel="EVACUAR"><b>{alcance.evacuar ? `${alcance.evacuar} km` : 'No llega'}</b> evacuación (MMI {cfg.umbralEvacuar} o más) · tu ubicación está {alcance.evacuar ? dentro(alcance.evacuar) : 'fuera'}</li>
      </ul>
      <p className="nota">Las distancias se miden desde el epicentro; los círculos del mapa muestran estos alcances con el suelo elegido. En el corte, la profundidad se dibuja más grande de lo real para que se vea.</p>
      <Corte distancia={ev.distanciaEpicentralKm} profundidad={sismo.depth} hipocentral={ev.distanciaHipocentralKm} />
    </section>
  )
}
