import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IGP, LIMA, REFRESCO_MS, type Sismo, colorPorMagnitud, consultarSismos, distanciaDeLima, enPeru, formatearFechaHora, formatearLugar, hace,
  sismoParaAlerta,
} from './sismos'

type Estado = { tipo: 'cargando' } | { tipo: 'vivo'; en: number } | { tipo: 'error'; mensaje: string }
const MAGNITUDES = [[0, 'Todos'], [3, '3.0+'], [4, '4.0+'], [5, '5.0+']] as const
const PERIODOS = [[1, 'Últimas 24 h'], [3, 'Últimos 3 días'], [7, 'Últimos 7 días'], [30, 'Últimos 30 días']] as const
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * «Alerta de sismos — Perú» al final del inicio (pedido del dueño, 29/10/2026). Datos en vivo de USGS con enlace al reporte
 * oficial del IGP; se actualiza cada minuto con la pantalla a la vista. Informativa: no guarda nada ni manda avisos.
 * Mapa con Leaflet y el mapa de calles de Esri, solo para las pruebas: antes del piloto el dueño decide con Cowork qué
 * servicio de mapas usar (Esri pide condiciones propias para uso comercial).
 */
export default function AlertaSismos({ online }: { online: boolean }) {
  const [sismos, setSismos] = useState<Sismo[]>([])
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [magMin, setMagMin] = useState(4)
  const [dias, setDias] = useState(7)
  const [soloPeru, setSoloPeru] = useState(true)
  const nodoMapa = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.LayerGroup | null>(null)

  const cargar = useCallback(async () => {
    try {
      setSismos(await consultarSismos(dias, magMin))
      setEstado({ tipo: 'vivo', en: Date.now() })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: (e as Error).message })
    }
  }, [dias, magMin])

  // Al abrir, al cambiar filtros, cada minuto con la pantalla a la vista y al volver a ella.
  useEffect(() => {
    if (!online) return
    const primera = setTimeout(() => void cargar(), 0)
    const cada = setInterval(() => !document.hidden && void cargar(), REFRESCO_MS)
    const alVolver = () => !document.hidden && void cargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearTimeout(primera)
      clearInterval(cada)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [online, cargar])

  const visibles = useMemo(() => (soloPeru ? sismos.filter(enPeru) : sismos), [sismos, soloPeru])
  const alerta = sismoParaAlerta(visibles)

  // El mapa se crea una vez y se quita al salir; los círculos se vuelven a dibujar cuando cambia la lista.
  useEffect(() => {
    if (mapa.current || !nodoMapa.current) return
    const m = L.map(nodoMapa.current, { scrollWheelZoom: false }).setView([-10, -75], 4.6)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: 'Mapa: Esri, HERE, Garmin, OpenStreetMap contributors',
    }).addTo(m)
    L.circleMarker([LIMA.lat, LIMA.lon], { radius: 5, color: '#14212b', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }).bindTooltip('Lima').addTo(m)
    capa.current = L.layerGroup().addTo(m)
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capa.current = null
    }
  }, [online])
  useEffect(() => {
    const c = capa.current
    if (!c) return
    c.clearLayers()
    for (const s of visibles)
      L.circleMarker([s.lat, s.lon], { radius: 4 + s.mag * 1.6, color: '#14212b', weight: 1, fillColor: colorPorMagnitud(s.mag), fillOpacity: 0.75 })
        .bindPopup(`<b>M ${s.mag.toFixed(1)}</b><br>${escapar(formatearLugar(s.place))}<br>${formatearFechaHora(s.time)}`)
        .addTo(c)
  }, [visibles])

  const enfocar = (s: Sismo) => mapa.current?.setView([s.lat, s.lon], Math.max(mapa.current.getZoom(), 7))

  return (
    <section className="sismos" aria-label="Alerta de sismos — Perú">
      <header className="sismos-cab">
        <div>
          <h2>Alerta de sismos — Perú</h2>
          <p>Datos en vivo de USGS, con referencia oficial del IGP</p>
        </div>
        <span className="sismos-estado" data-tipo={online ? estado.tipo : 'error'}>
          <span aria-hidden="true" />
          {!online ? 'Se ve con señal' : estado.tipo === 'cargando' ? 'Cargando…' : estado.tipo === 'vivo' ? `En vivo · actualizado ${formatearFechaHora(estado.en)}` : `Sin conexión con USGS (${estado.mensaje})`}
        </span>
      </header>

      {alerta && (
        <p className="sismos-alerta" role="alert">
          <TriangleAlert size={18} aria-hidden="true" /> Sismo reciente de magnitud {alerta.mag.toFixed(1)} — {formatearLugar(alerta.place)}, {hace(alerta.time)}. Verifica el
          reporte oficial del IGP y activa tu protocolo si corresponde.
        </p>
      )}

      <div className="sismos-controles">
        <label>
          Magnitud mínima
          <select value={magMin} onChange={(e) => setMagMin(Number(e.target.value))}>
            {MAGNITUDES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          Periodo
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {PERIODOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="sismos-casilla">
          <input type="checkbox" checked={soloPeru} onChange={(e) => setSoloPeru(e.target.checked)} /> Solo epicentros en Perú
        </label>
        <button className="btn" type="button" disabled={!online} onClick={() => void cargar()}>
          <RefreshCw size={16} aria-hidden="true" /> Actualizar ahora
        </button>
        <a className="btn-sec" href={IGP} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} aria-hidden="true" /> Reporte oficial del IGP
        </a>
      </div>

      <div className="sismos-cuerpo">
        <div className="sismos-mapa" ref={nodoMapa} role="region" aria-label="Mapa de sismos" />
        <ul className="sismos-lista">
          {visibles.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => enfocar(s)}>
                <span className="sismos-mag" style={{ background: colorPorMagnitud(s.mag) }}>{s.mag.toFixed(1)}</span>
                <span className="sismos-texto">
                  <b>{formatearLugar(s.place)}</b>
                  <small>{formatearFechaHora(s.time)} ({hace(s.time)})</small>
                  <small>
                    Profundidad {Math.round(s.depth)} km · a {distanciaDeLima(s.lat, s.lon)} km de Lima ·{' '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Detalle USGS</a>
                  </small>
                </span>
              </button>
            </li>
          ))}
          {online && estado.tipo !== 'cargando' && !visibles.length && (
            <li className="nota">No hay sismos con estos filtros. Prueba con una magnitud menor o un periodo más largo.</li>
          )}
        </ul>
      </div>

      <p className="sismos-legal">
        Datos: USGS (se actualizan cada minuto). Los valores son preliminares y pueden diferir de los del{' '}
        <a href={IGP} target="_blank" rel="noopener noreferrer">IGP</a>, que es la fuente oficial para Perú. Esta sección es informativa y no reemplaza las
        alertas oficiales de INDECI e IGP. Horas en horario de Lima.
      </p>
    </section>
  )
}
