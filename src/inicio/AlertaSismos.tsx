import { Esqueleto } from '../Esqueleto'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ExternalLink, LocateFixed, MapPin, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CONFIG_INICIAL, type Ubicacion, alcanceDelSismo, evaluarSismo } from './evaluacionSismo'
import { DetalleEvaluacion, type EstadoComparacion, InsigniaNivel } from './EvaluacionSismoVista'
import { type CuadriculaMmi, type FichaShakeMap, consultarCuadricula, consultarFichaShakeMap, intensidadEnPunto } from './shakemap'
import {
  IGP, LIMA, REFRESCO_MS, type Sismo, colorPorMagnitud, consultarSismos, distanciaDeLima, enPeru, formatearFechaHora, formatearLugar, hace,
  sismoParaAlerta,
} from './sismos'

type Estado = { tipo: 'cargando' } | { tipo: 'vivo'; en: number } | { tipo: 'error'; mensaje: string }
const MAGNITUDES = [[0, 'Todos'], [3, '3.0+'], [4, '4.0+'], [5, '5.0+']] as const
const PERIODOS = [[1, 'Últimas 24 h'], [3, 'Últimos 3 días'], [7, 'Últimos 7 días'], [30, 'Últimos 30 días']] as const
/** Blanco u oscuro, el que dé contraste de 4,5:1 o más sobre el color de fondo. */
function textoSobre(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return 1.05 / (l + 0.05) >= 4.5 ? '#ffffff' : '#0b2233'
}
// La ubicación a evaluar se recuerda en este equipo (no se envía a ningún servidor). El suelo ya no se elige: se usa el criterio conservador del protocolo.
const CLAVE_UBIC = 'crc-ubicacion-sismos'
function leerUbicacion(): Ubicacion | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_UBIC) ?? 'null') as Ubicacion | null
    return g && Number.isFinite(g.lat) && Number.isFinite(g.lon) ? g : null
  } catch {
    return null
  }
}
const COLOR_ALCANCE = { sentido: '#c99a12', alerta: '#d9641e', evacuar: '#b3261e' }
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
  const capaUbic = useRef<L.LayerGroup | null>(null)
  const capaAlcance = useRef<L.LayerGroup | null>(null)
  // Evaluación en la ubicación del usuario (actual, o elegida en el mapa) con el cálculo del protocolo de sismos.
  const [ubic, setUbic] = useState<Ubicacion | null>(leerUbicacion)
  const [eligiendo, setEligiendo] = useState<'ubicacion' | 'epicentro' | null>(null)
  const eligiendoRef = useRef<'ubicacion' | 'epicentro' | null>(null)
  // Cálculo manual: se escribe (o se toca en el mapa) el epicentro, la profundidad y la magnitud, para cuando los sismos no cargan o para probar un caso.
  const [manualAbierto, setManualAbierto] = useState(false)
  const [manualCampos, setManualCampos] = useState({ lat: '', lon: '', prof: '', mag: '' })
  const [manualError, setManualError] = useState<string | null>(null)
  const [manual, setManual] = useState<Sismo | null>(null)
  // Lo que USGS ShakeMap dice de cada sismo elegido (se guarda para no volver a pedirlo).
  const fichas = useRef(new Map<string, FichaShakeMap>())
  const cuadriculas = useRef(new Map<string, CuadriculaMmi>())
  const [comparacion, setComparacion] = useState<{ id: string; estado: EstadoComparacion } | null>(null)
  const [gps, setGps] = useState<{ tipo: 'buscando' } | { tipo: 'error'; mensaje: string } | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const cfg = CONFIG_INICIAL
  const guardarUbic = useCallback((u: Ubicacion | null) => {
    setUbic(u)
    try {
      if (u) localStorage.setItem(CLAVE_UBIC, JSON.stringify(u))
      else localStorage.removeItem(CLAVE_UBIC)
    } catch { /* sin almacenamiento: se pierde al cerrar */ }
  }, [])
  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return setGps({ tipo: 'error', mensaje: 'Este equipo no puede darme su ubicación.' })
    setGps({ tipo: 'buscando' })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        guardarUbic({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5) })
        setGps(null)
        setEligiendo(null)
        mapa.current?.setView([p.coords.latitude, p.coords.longitude], Math.max(mapa.current.getZoom(), 7))
      },
      (e) => setGps({ tipo: 'error', mensaje: e.code === 1 ? 'No diste permiso para usar tu ubicación. Puedes elegirla en el mapa.' : 'No se pudo obtener tu ubicación. Puedes elegirla en el mapa.' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }

  const cargar = useCallback(async () => {
    try {
      setSismos(await consultarSismos(dias, magMin))
      setEstado({ tipo: 'vivo', en: Date.now() })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: (e as Error).message })
      setManualAbierto(true)
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
  // Intensidad estimada de cada sismo en la ubicación elegida.
  const evaluaciones = useMemo(
    () => new Map(ubic ? visibles.map((s) => [s.id, evaluarSismo({ lat: s.lat, lon: s.lon, profundidad: s.depth, magnitud: s.mag }, ubic, cfg)]) : []),
    [visibles, ubic, cfg],
  )
  const sismoElegido = elegido === 'manual' ? manual : (visibles.find((s) => s.id === elegido) ?? null)
  const evElegido = sismoElegido && ubic ? (evaluaciones.get(sismoElegido.id) ?? evaluarSismo({ lat: sismoElegido.lat, lon: sismoElegido.lon, profundidad: sismoElegido.depth, magnitud: sismoElegido.mag }, ubic, cfg)) : null
  const alcanceElegido = useMemo(() => (sismoElegido ? alcanceDelSismo({ profundidad: sismoElegido.depth, magnitud: sismoElegido.mag }, cfg) : null), [sismoElegido, cfg])
  // Comparación con USGS ShakeMap: la ficha del sismo y la intensidad que el ShakeMap da en la ubicación elegida.
  const idUsgs = elegido && elegido !== 'manual' ? elegido : null
  const urlUsgs = sismoElegido?.url ?? ''
  useEffect(() => {
    if (!idUsgs || !online) return
    let vivo = true
    void (async () => {
      try {
        let ficha = fichas.current.get(idUsgs)
        if (!ficha) {
          setComparacion({ id: idUsgs, estado: { tipo: 'cargando' } })
          ficha = await consultarFichaShakeMap(idUsgs)
          fichas.current.set(idUsgs, ficha)
        }
        let usgs: number | null = null
        if (ficha.disponible && ficha.urlMmi && ubic) {
          let g = cuadriculas.current.get(idUsgs)
          if (!g) {
            g = await consultarCuadricula(ficha.urlMmi)
            cuadriculas.current.set(idUsgs, g)
          }
          usgs = intensidadEnPunto(g, ubic.lat, ubic.lon)
        }
        if (vivo) setComparacion({ id: idUsgs, estado: { tipo: 'ok', ficha, usgs, urlPagina: urlUsgs } })
      } catch {
        if (vivo) setComparacion({ id: idUsgs, estado: { tipo: 'error' } })
      }
    })()
    return () => {
      vivo = false
    }
  }, [idUsgs, online, ubic, urlUsgs])
  // El alcance del sismo elegido: círculos desde el epicentro (se siente, alerta, evacuación) y la línea hasta la ubicación.
  useEffect(() => {
    const c = capaAlcance.current
    const m = mapa.current
    if (!c || !m) return
    c.clearLayers()
    if (!sismoElegido || !alcanceElegido) return
    const centro: L.LatLngTuple = [sismoElegido.lat, sismoElegido.lon]
    const grupos = [['sentido', alcanceElegido.sentido], ['alerta', alcanceElegido.alerta], ['evacuar', alcanceElegido.evacuar]] as const
    for (const [k, km] of grupos)
      if (km > 0) L.circle(centro, { radius: km * 1000, color: COLOR_ALCANCE[k], weight: 2, dashArray: k === 'sentido' ? '6 6' : undefined, fillColor: COLOR_ALCANCE[k], fillOpacity: 0.07, interactive: false }).addTo(c)
    L.circleMarker(centro, { radius: 7, color: '#14212b', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(c)
    if (ubic) L.polyline([centro, [ubic.lat, ubic.lon]], { color: '#14212b', weight: 2, dashArray: '2 6', interactive: false }).addTo(c)
    const base = alcanceElegido.alerta || alcanceElegido.sentido
    if (base) m.fitBounds(L.latLng(centro).toBounds(Math.max(base, 60) * 2000).extend(ubic ? [ubic.lat, ubic.lon] : centro), { maxZoom: 9, padding: [24, 24] })
  }, [sismoElegido, alcanceElegido, ubic])

  // El mapa se crea una vez y se quita al salir; los círculos se vuelven a dibujar cuando cambia la lista.
  useEffect(() => {
    if (mapa.current || !nodoMapa.current) return
    const m = L.map(nodoMapa.current, { scrollWheelZoom: false }).setView([-10, -75], 4.6)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: 'Mapa: Esri, HERE, Garmin, OpenStreetMap contributors',
    }).addTo(m)
    L.circleMarker([LIMA.lat, LIMA.lon], { radius: 5, color: '#14212b', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }).bindTooltip('Lima').addTo(m)
    capa.current = L.layerGroup().addTo(m)
    capaAlcance.current = L.layerGroup().addTo(m)
    capaUbic.current = L.layerGroup().addTo(m)
    // Con «Elegir en el mapa» activo, el toque o clic define la ubicación GPS.
    m.on('click', (e: L.LeafletMouseEvent) => {
      const modo = eligiendoRef.current
      if (!modo) return
      if (modo === 'ubicacion') guardarUbic({ lat: +e.latlng.lat.toFixed(5), lon: +e.latlng.lng.toFixed(5) })
      else setManualCampos((c) => ({ ...c, lat: e.latlng.lat.toFixed(4), lon: e.latlng.lng.toFixed(4) }))
      setEligiendo(null)
    })
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      capa.current = null
      capaAlcance.current = null
      capaUbic.current = null
    }
  }, [online, guardarUbic])
  useEffect(() => {
    eligiendoRef.current = eligiendo
    const nodo = nodoMapa.current
    if (nodo) nodo.style.cursor = eligiendo ? 'crosshair' : ''
  }, [eligiendo])
  // La ubicación se dibuja como un pin que también se puede arrastrar.
  useEffect(() => {
    const c = capaUbic.current
    if (!c) return
    c.clearLayers()
    if (!ubic) return
    const pin = L.marker([ubic.lat, ubic.lon], { draggable: true, title: 'Mi ubicación (arrástrala para moverla)', icon: L.divIcon({ className: 'pin-ubic-caja', html: '<span class="pin-ubic"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
    pin.on('dragend', () => {
      const p = pin.getLatLng()
      guardarUbic({ lat: +p.lat.toFixed(5), lon: +p.lng.toFixed(5) })
    })
    pin.addTo(c)
  }, [ubic, guardarUbic, online])
  useEffect(() => {
    const c = capa.current
    if (!c) return
    c.clearLayers()
    for (const s of visibles)
      L.circleMarker([s.lat, s.lon], { radius: 4 + s.mag * 1.6, color: '#14212b', weight: 1, fillColor: colorPorMagnitud(s.mag), fillOpacity: 0.75 })
        .bindPopup(`<b>M ${s.mag.toFixed(1)}</b><br>${escapar(formatearLugar(s.place))}<br>${formatearFechaHora(s.time)}`)
        .addTo(c)
  }, [visibles])

  // Al tocar un sismo de la lista se elige (o se deja de elegir) para ver su evaluación y su alcance.
  const enfocar = (s: Sismo) => {
    if (elegido === s.id) return setElegido(null)
    setElegido(s.id)
    if (!ubic) mapa.current?.setView([s.lat, s.lon], Math.max(mapa.current.getZoom(), 7))
  }

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
          {evaluaciones.get(alerta.id) && <> En tu ubicación: <InsigniaNivel ev={evaluaciones.get(alerta.id)!} />.</>}
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

      <div className="sismos-ubicacion" role="group" aria-label="Mi ubicación para evaluar los sismos">
        <div className="sismos-ubicacion-cab">
          <b>Mi ubicación</b>
          <span>{ubic ? `${ubic.lat.toFixed(4)}, ${ubic.lon.toFixed(4)}` : 'Sin definir: elige una para ver cuánto se sentiría cada sismo.'}</span>
        </div>
        <div className="sismos-ubicacion-acciones">
          <button className="btn-sec" type="button" disabled={gps?.tipo === 'buscando'} onClick={usarMiUbicacion}>
            <LocateFixed size={16} aria-hidden="true" /> {gps?.tipo === 'buscando' ? 'Buscando…' : 'Usar mi ubicación actual'}
          </button>
          <button className="btn-sec" type="button" aria-pressed={eligiendo === 'ubicacion'} onClick={() => setEligiendo((x) => (x === 'ubicacion' ? null : 'ubicacion'))}>
            <MapPin size={16} aria-hidden="true" /> {eligiendo === 'ubicacion' ? 'Toca el mapa…' : 'Elegir en el mapa'}
          </button>
          {ubic && (
            <button className="btn-link" type="button" onClick={() => (guardarUbic(null), setElegido(null))}>
              <X size={16} aria-hidden="true" /> Quitar
            </button>
          )}
        </div>
        {eligiendo === 'ubicacion' && <p className="nota">Toca el punto del mapa donde quieres evaluar los sismos. Después puedes arrastrar el pin para ajustarlo.</p>}
        <p className="nota">Se considera suelo blando o relleno, el criterio conservador del protocolo: así la estimación no se queda corta.</p>
        {gps?.tipo === 'error' && <p className="aviso-suave">{gps.mensaje}</p>}
      </div>

      <details className="sismos-manual" open={manualAbierto} onToggle={(e) => setManualAbierto(e.currentTarget.open)}>
        <summary>Cálculo manual (si los sismos no cargan, o para probar un caso)</summary>
        <form
          className="sismos-manual-form"
          onSubmit={(e) => {
            e.preventDefault()
            const lat = Number(manualCampos.lat), lon = Number(manualCampos.lon), prof = Number(manualCampos.prof), mag = Number(manualCampos.mag)
            const ok = (v: string, n: number, a: number, b: number) => v.trim() !== '' && Number.isFinite(n) && n >= a && n <= b
            if (!ok(manualCampos.lat, lat, -90, 90)) return setManualError('La latitud debe estar entre -90 y 90 (por ejemplo, -12.3 para el sur).')
            if (!ok(manualCampos.lon, lon, -180, 180)) return setManualError('La longitud debe estar entre -180 y 180 (por ejemplo, -77.7 para el oeste).')
            if (!ok(manualCampos.prof, prof, 0, 700)) return setManualError('La profundidad debe estar entre 0 y 700 km.')
            if (!ok(manualCampos.mag, mag, 2, 9.6)) return setManualError('La magnitud debe estar entre 2 y 9,6.')
            if (!ubic) return setManualError('Primero define tu ubicación (arriba): sin ella no hay dónde evaluar el sismo.')
            setManualError(null)
            setManual({ id: 'manual', mag, place: 'Cálculo manual', time: Date.now(), url: '', lat, lon, depth: prof })
            setElegido('manual')
          }}
        >
          <label>Latitud del epicentro<input inputMode="decimal" placeholder="-12.3" value={manualCampos.lat} onChange={(e) => setManualCampos((c) => ({ ...c, lat: e.target.value }))} /></label>
          <label>Longitud del epicentro<input inputMode="decimal" placeholder="-77.7" value={manualCampos.lon} onChange={(e) => setManualCampos((c) => ({ ...c, lon: e.target.value }))} /></label>
          <label>Profundidad (km)<input inputMode="decimal" placeholder="40" value={manualCampos.prof} onChange={(e) => setManualCampos((c) => ({ ...c, prof: e.target.value }))} /></label>
          <label>Magnitud<input inputMode="decimal" placeholder="7.0" value={manualCampos.mag} onChange={(e) => setManualCampos((c) => ({ ...c, mag: e.target.value }))} /></label>
          <div className="sismos-ubicacion-acciones">
            <button className="btn" type="submit">Calcular</button>
            <button className="btn-sec" type="button" aria-pressed={eligiendo === 'epicentro'} onClick={() => setEligiendo((x) => (x === 'epicentro' ? null : 'epicentro'))}>
              <MapPin size={16} aria-hidden="true" /> {eligiendo === 'epicentro' ? 'Toca el mapa…' : 'Epicentro en el mapa'}
            </button>
            {manual && (
              <button className="btn-link" type="button" onClick={() => { setManual(null); setElegido((x) => (x === 'manual' ? null : x)) }}>
                <X size={16} aria-hidden="true" /> Quitar el cálculo
              </button>
            )}
          </div>
          {manualError && <p className="aviso-suave">{manualError}</p>}
          <p className="nota">Latitud sur y longitud oeste van con signo menos. La magnitud es necesaria para el cálculo; la profundidad es la del hipocentro.</p>
        </form>
      </details>

      <div className="sismos-cuerpo">
        <div className="sismos-mapa" ref={nodoMapa} role="region" aria-label="Mapa de sismos" />
        <ul className="sismos-lista">
          {online && estado.tipo === 'cargando' && <li className="sismos-esq"><Esqueleto forma="lista" filas={4} /></li>}
          {visibles.map((s) => (
            <li key={s.id}>
              <button type="button" aria-pressed={elegido === s.id} onClick={() => enfocar(s)}>
                <span className="sismos-mag" style={{ background: colorPorMagnitud(s.mag), color: textoSobre(colorPorMagnitud(s.mag)) }}>{s.mag.toFixed(1)}</span>
                <span className="sismos-texto">
                  <b>{formatearLugar(s.place)}</b>
                  <small>{formatearFechaHora(s.time)} ({hace(s.time)})</small>
                  <small>
                    Profundidad {Math.round(s.depth)} km · a {distanciaDeLima(s.lat, s.lon)} km de Lima ·{' '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Detalle USGS</a>
                  </small>
                  {evaluaciones.get(s.id) && <small><InsigniaNivel ev={evaluaciones.get(s.id)!} /> a {evaluaciones.get(s.id)!.distanciaEpicentralKm} km de ti</small>}
                </span>
              </button>
            </li>
          ))}
          {online && estado.tipo !== 'cargando' && !visibles.length && (
            <li className="nota">No hay sismos con estos filtros. Prueba con una magnitud menor o un periodo más largo.</li>
          )}
        </ul>
      </div>

      {sismoElegido && evElegido && alcanceElegido && <DetalleEvaluacion sismo={sismoElegido} ev={evElegido} alcance={alcanceElegido} cfg={cfg} manual={elegido === 'manual'} comparacion={comparacion?.id === elegido ? comparacion.estado : null} />}
      {sismoElegido && !ubic && <p className="nota">Define tu ubicación (arriba) para ver cuánto se sentiría este sismo ahí. Mientras, el mapa muestra hasta dónde llega.</p>}

      <p className="sismos-legal">
        Datos: USGS (se actualizan cada minuto). Los valores son preliminares y pueden diferir de los del{' '}
        <a href={IGP} target="_blank" rel="noopener noreferrer">IGP</a>, que es la fuente oficial para Perú. Esta sección es informativa y no reemplaza las
        alertas oficiales de INDECI e IGP. Horas en horario de Lima. La intensidad en tu ubicación es una estimación (distancia hipocentral → aceleración, Youngs et al. 1997 → MMI, Worden et al. 2012, más el ajuste por suelo): no reemplaza la alerta oficial ni el criterio del Comité SST, que debe validar los umbrales.
      </p>
    </section>
  )
}
