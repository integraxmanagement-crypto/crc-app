import { ArrowLeft, CalendarDays, Eye, FilePlus2, FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { NOMBRE_FRECUENCIA } from '../formatos/datos'
import { ir } from '../ruta'
import { type CopiaLocal, bajarCopia, leerCopia, useCampo } from './campo'
import { type Hallazgo, listarHallazgos } from '../hallazgos/datos'
import { type InspeccionDelMes, type ResumenInspeccion, conFrecuencias, frecuenciasActuales, inspeccionesDelMes, listarInspecciones, resultadosDeFormato, type ResultadoInspeccion } from './datos'
import { hoyLocal } from './ayudas'
import { Hallazgos } from '../hallazgos/Hallazgos'
import { type Unidad, unidadesAsignables } from '../usuarios/datos'
import { Extintores, mesesRecientes } from './Extintores'
import { BombasIncendio, esBombaIncendio } from './BombasIncendio'
import { FilaBorrador, FilaCola, ListaRecibidas } from './Inspecciones'
import { CargaMasivaEquipos } from '../activos/CargaMasiva'
import { Ventana } from './Ventana'

/**
 * Las inspecciones de un tipo (un formato), ordenadas por tipo desde la pantalla de Inspecciones (pedido del dueño, 29/10/2026).
 * Extintores tiene su propia pantalla (cumplimiento, no operativos, catastro…); los demás muestran sus inspecciones y «Nueva inspección».
 */
export function TipoInspeccion({ id, empresaId, cuenta, gestiona, online }: { id: string; empresaId: string; cuenta: string; gestiona: boolean; online: boolean }) {
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined)
  const [recibidas, setRecibidas] = useState<ResumenInspeccion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [porMes, setPorMes] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [cargaVersion, setCargaVersion] = useState(0) // sube al cargar equipos: la pantalla de extintores vuelve a leer el catastro
  const [pestana, setPestana] = useState<'resultados' | 'registros' | 'hallazgos'>('resultados')
  const { borradores: todosB, cola: todaCola } = useCampo(cuenta)
  const borradores = todosB.filter((b) => b.plantilla_id === id)
  const cola = todaCola.filter((c) => c.borrador.plantilla_id === id)

  useEffect(() => {
    void leerCopia(cuenta, empresaId).then(async (c) => {
      const x = c ?? (online ? await bajarCopia(cuenta, empresaId).catch(() => null) : null)
      // Con señal, la frecuencia es la de ahora (la copia del equipo puede traer una vieja).
      const m = x && online ? await frecuenciasActuales(empresaId).catch(() => null) : null
      setCopia(x && m ? conFrecuencias(x, m) : x)
    })
  }, [cuenta, empresaId, online])
  useEffect(() => {
    if (online) listarInspecciones(empresaId).then(setRecibidas, (e) => setError((e as Error).message))
  }, [empresaId, online])

  const formato = copia?.formatos.find((x) => x.plantilla.id === id)
  // Carga masiva de equipos: extintores y dispositivos del sistema DACI (alarma).
  const nombreTipo = (copia?.tipos.find((t) => t.id === formato?.plantilla.tipo_activo_id)?.nombre ?? '').toLowerCase()
  const cargaMasiva = formato?.plantilla.aplica_a === 'activo' && (nombreTipo.startsWith('extintor') || nombreTipo.includes('alarma'))
  const esDaci = Boolean(formato?.plantilla.aplica_a === 'activo' && nombreTipo.includes('alarma'))
  // Motobomba / electrobomba (bomba contra incendio): misma pantalla que extintores y DACI.
  const esBomba = Boolean(formato && esBombaIncendio(formato.plantilla.nombre))
  const esIpf = Boolean(formato?.version.receta.secciones.some((s) => s.puntos.some((p) => p.clave.startsWith('IPF-'))))
  const esLoto = Boolean(formato?.version.receta.secciones.some((s) => s.puntos.some((p) => p.clave.startsWith('LOTO-'))))
  const esExtintor = Boolean(formato && copia?.tipos.find((t) => t.id === formato.plantilla.tipo_activo_id)?.nombre.toLowerCase().startsWith('extintor'))

  // Motobomba y electrobomba comparten una sola pantalla, «Inspección de bomba contra incendio».
  if (esBomba) return <BombasIncendio empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} />

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/inspecciones')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inspecciones
      </button>
      {copia === undefined ? (
        <p className="nota">Cargando…</p>
      ) : !copia || !formato ? (
        <Aviso>No se encontró este tipo de inspección en este equipo. Vuelve a Inspecciones y pulsa «Actualizar».</Aviso>
      ) : (
        <>
          <header className="detalle-cab fila-entre">
            <div>
              <h1>{formato.plantilla.nombre}</h1>
              <p>Se inspecciona de forma {NOMBRE_FRECUENCIA[formato.plantilla.frecuencia].toLowerCase()}.</p>
            </div>
            <span className="acciones">
              {!esExtintor && !esDaci && !esLoto && !esIpf && (
                <button className="btn-sec" type="button" aria-pressed={porMes} onClick={() => setPorMes((x) => !x)}>
                  <CalendarDays size={18} aria-hidden="true" /> Ver por mes
                </button>
              )}
              {cargaMasiva && (
                <button className="btn-sec" type="button" onClick={() => setCargando(true)}>
                  <Upload size={18} aria-hidden="true" /> Cargar equipos
                </button>
              )}
              {!esLoto && !esIpf && <button className="btn" type="button" onClick={() => ir(`/inspecciones/nueva/${id}`)}>
                <FilePlus2 size={18} aria-hidden="true" /> Nueva inspección
              </button>}
            </span>
          </header>
          {cargando && formato.plantilla.tipo_activo_id && (
            <CargaMasivaEquipos empresaId={empresaId} empresaNombre={copia.empresa.razon_social} tipoId={formato.plantilla.tipo_activo_id} exigirTodo={esExtintor}
              onCerrar={() => setCargando(false)} onListo={() => setCargaVersion((v) => v + 1)} />
          )}
          {porMes && <PorMes plantillaId={id} nombre={formato.plantilla.nombre} online={online} onCerrar={() => setPorMes(false)} />}
          {esLoto && (
            <>
              <div className="fila-entre">
                <div className="filtros" role="group" aria-label="Secciones">
                  <button type="button" aria-pressed={pestana === 'resultados'} onClick={() => setPestana('resultados')}>Resultados</button>
                  <button type="button" aria-pressed={pestana === 'hallazgos'} onClick={() => setPestana('hallazgos')}>Hallazgos</button>
                </div>
                <button className="btn" type="button" onClick={() => ir(`/inspecciones/nueva/${id}`)}>
                  <FilePlus2 size={18} aria-hidden="true" /> Nueva inspección
                </button>
              </div>
              {pestana === 'resultados' ? (
                <ResultadosEficacia nombre={formato.plantilla.nombre} copia={copia} online={online} />
              ) : (
                <Hallazgos empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} fuenteFija={formato.plantilla.nombre} />
              )}
            </>
          )}
          {esIpf && (
            <>
              <div className="fila-entre">
                <div className="filtros" role="group" aria-label="Secciones">
                  <button type="button" aria-pressed={pestana === 'resultados'} onClick={() => setPestana('resultados')}>Resultados</button>
                  <button type="button" aria-pressed={pestana === 'registros'} onClick={() => setPestana('registros')}>Registros</button>
                  <button type="button" aria-pressed={pestana === 'hallazgos'} onClick={() => setPestana('hallazgos')}>Hallazgos</button>
                </div>
                <button className="btn" type="button" onClick={() => ir(`/inspecciones/nueva/${id}`)}>
                  <FilePlus2 size={18} aria-hidden="true" /> Nueva inspección
                </button>
              </div>
              {pestana === 'resultados' && <ResultadosHallazgos empresaId={empresaId} nombre={formato.plantilla.nombre} online={online} />}
              {pestana === 'registros' && (
                <Seccion titulo="Registros de inspección">
                  <TablaPorMes plantillaId={id} online={online} descargas />
                </Seccion>
              )}
              {pestana === 'hallazgos' && <Hallazgos empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} fuenteFija={formato.plantilla.nombre} />}
            </>
          )}
          {esExtintor || esDaci ? (
            <Extintores key={cargaVersion} variante={esExtintor ? 'extintor' : 'daci'} empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} copia={copia} formato={formato} />
          ) : null}
          {/* En la eficacia del LOTO no se muestra «En este equipo» (pedido del dueño, 29/10/2026). */}
          {!esLoto && !esDaci && (borradores.length > 0 || cola.length > 0) && (
            <Seccion titulo="En este equipo">
              <ul className="lista">
                {borradores.map((b) => <FilaBorrador key={b.id} b={b} />)}
                {cola.map((c) => <FilaCola key={c.id} c={c} online={online} />)}
              </ul>
            </Seccion>
          )}
          {!esExtintor && !esDaci && !esLoto && !esIpf && (
            <Seccion titulo="Inspecciones recibidas">
              <ListaRecibidas recibidas={recibidas?.filter((i) => i.plantilla_id === id) ?? null} error={error} online={online} />
            </Seccion>
          )}
        </>
      )}
    </div>
  )
}

/** Las inspecciones de un mes, ordenadas por área y ubicación (pedido del dueño, 29/10/2026: IPF y demás inspecciones programadas). */
function PorMes({ plantillaId, nombre, online, onCerrar }: { plantillaId: string; nombre: string; online: boolean; onCerrar: () => void }) {
  return (
    <Ventana titulo={`${nombre} · por mes`} onCerrar={onCerrar}>
      <TablaPorMes plantillaId={plantillaId} online={online} />
    </Ventana>
  )
}

/**
 * El historial de registros por mes y por área. Con descargas (pestaña «Registros» del IPF) cada registro tiene «Ver», «Excel» y «PDF»
 * (abren el registro y bajan el archivo) y se puede ver todo el año.
 */
function TablaPorMes({ plantillaId, online, descargas = false }: { plantillaId: string; online: boolean; descargas?: boolean }) {
  const hoy = hoyLocal()
  const meses = [
    ...(descargas ? [{ clave: 'anio', etiqueta: `Todo el año ${hoy.slice(0, 4)}`, desde: `${hoy.slice(0, 4)}-01-01`, hasta: `${hoy.slice(0, 4)}-12-31` }] : []),
    ...mesesRecientes(hoy),
  ]
  const [mes, setMes] = useState(meses[descargas ? 1 : 0].clave)
  const [lista, setLista] = useState<InspeccionDelMes[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const elegido = meses.find((m) => m.clave === mes) ?? meses[0]

  useEffect(() => {
    if (!online) return
    let vivo = true
    setLista(null)
    inspeccionesDelMes(plantillaId, elegido.desde, elegido.hasta).then((l) => vivo && setLista(l), (e) => vivo && setError((e as Error).message))
    return () => {
      vivo = false
    }
  }, [plantillaId, elegido.desde, elegido.hasta, online])

  // Un grupo por área y ubicación, con sus inspecciones del período.
  const grupos = new Map<string, { area: string; ubicacion: string; items: InspeccionDelMes[] }>()
  for (const i of lista ?? []) {
    const area = i.unidades?.nombre ?? 'Sin área'
    const ubicacion = i.ubicaciones?.nombre ?? (i.activo_foto?.codigo ? `Equipo ${i.activo_foto.codigo}` : 'Sin ubicación')
    const k = `${area}|${ubicacion}`
    const g = grupos.get(k) ?? { area, ubicacion, items: [] }
    g.items.push(i)
    grupos.set(k, g)
  }
  const filas = [...grupos.values()].sort((a, b) => a.area.localeCompare(b.area, 'es') || a.ubicacion.localeCompare(b.ubicacion, 'es'))
  const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

  return (
    <>
      <label className="field campo-fecha">
        <span>{descargas ? 'Período' : 'Mes'}</span>
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}
        </select>
      </label>
      <Aviso>{error}</Aviso>
      {!online ? <p className="nota">Se ve con señal.</p> : !lista ? <p className="nota">Cargando…</p> : !lista.length ? <p className="nota">No hay inspecciones en {elegido.etiqueta}.</p> : (
        <>
          <p className="nota">{lista.length} inspección(es) en {elegido.etiqueta}, en {filas.length} lugar(es).</p>
          <div className="tabla-scroll">
            <table className="tabla-catastro">
              <thead><tr><th>Área</th><th>Ubicación</th><th>Cantidad</th><th>Registros</th></tr></thead>
              <tbody>
                {filas.map((g) => (
                  <tr key={`${g.area}|${g.ubicacion}`}>
                    <td style={{ textAlign: 'left' }}>{g.area}</td>
                    <td style={{ textAlign: 'left' }}>{g.ubicacion}</td>
                    <td><b>{g.items.length}</b></td>
                    <td style={{ textAlign: 'left' }}>
                      {g.items.map((i) =>
                        descargas ? (
                          <span key={i.id} className="registro-fila">
                            <b>N.º {i.numero}</b> ({fecha(i.fecha)}){i.resultado ? ` · ${i.resultado}` : ''}
                            <button type="button" className="celda-btn" onClick={() => ir(`/inspecciones/${i.id}`)}><Eye size={14} aria-hidden="true" /> Ver</button>
                            <button type="button" className="celda-btn" onClick={() => ir(`/inspecciones/${i.id}/excel`)}><FileSpreadsheet size={14} aria-hidden="true" /> Excel</button>
                            <button type="button" className="celda-btn" onClick={() => ir(`/inspecciones/${i.id}/pdf`)}><FileText size={14} aria-hidden="true" /> PDF</button>
                          </span>
                        ) : (
                          <button key={i.id} type="button" className="celda-btn" title={i.resultado ?? ''} onClick={() => ir(`/inspecciones/${i.id}`)}>
                            N.º {i.numero} ({fecha(i.fecha)})
                          </button>
                        ),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Resultados de la eficacia del programa de bloqueo y etiquetado (pedido del dueño, 29/10/2026): una tarjeta con el promedio de lo más
 * reciente de cada área y, debajo, la tabla de áreas con su último porcentaje y el acceso a ese registro. Una área sin eficacia no entra
 * en el promedio.
 */
function ResultadosEficacia({ nombre, copia, online }: { nombre: string; copia: CopiaLocal; online: boolean }) {
  const [lista, setLista] = useState<ResultadoInspeccion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [anio, setAnio] = useState(hoyLocal().slice(0, 4))
  const [mes, setMes] = useState(Number(hoyLocal().slice(5, 7)))
  useEffect(() => {
    if (online) resultadosDeFormato(nombre).then(setLista, (e) => setError((e as Error).message))
  }, [nombre, online])

  if (!online) return <p className="nota">Los resultados se ven con señal.</p>
  if (!lista) return error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>

  // Desde el inicio del año hasta el mes elegido; de cada área, la más reciente en ese rango (la lista viene de la más nueva a la más antigua).
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-31`
  const enRango = lista.filter((r) => r.fecha >= `${anio}-01-01` && r.fecha <= hasta)
  const anios = [...new Set([hoyLocal().slice(0, 4), ...lista.map((r) => r.fecha.slice(0, 4))])].sort().reverse()
  const ultima = new Map<string, ResultadoInspeccion>()
  for (const r of enRango) if (!ultima.has(r.unidad_id ?? '-')) ultima.set(r.unidad_id ?? '-', r)
  const conResultado = [...ultima.values()]
  const promedio = conResultado.length ? Math.round((10 * conResultado.reduce((s, r) => s + r.puntaje, 0)) / conResultado.length) / 10 : null
  const nombreArea = (r: ResultadoInspeccion) => r.unidades?.nombre ?? 'Sin área'
  const sinResultado = unidadesAsignables(copia.unidades as Unidad[]).filter((u) => u.vigente && !ultima.has(u.id))
  const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`

  return (
    <>
      <div className="fila2 no-imprimir">
        <label className="field">
          <span>Hasta el mes</span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES_TXT.map((m, k) => <option key={m} value={k + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Año</span>
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <div className="tarjetas-ext">
        <div className="tarjeta-ext">
          <small>Eficacia promedio del programa</small>
          <b>{promedio == null ? '—' : `${promedio} %`}</b>
          <span>{conResultado.length} área(s) con resultado, de enero a {MESES_TXT[mes - 1]} de {anio}; promedio de la inspección más reciente de cada una</span>
        </div>
      </div>
      <Seccion titulo="Resultado por área">
        {!conResultado.length && <p className="nota">No hay inspecciones de eficacia con resultado de enero a {MESES_TXT[mes - 1]} de {anio}.</p>}
        {(
          <div className="tabla-scroll">
            <table className="tabla-catastro">
              <thead>
                <tr><th>Área</th><th>Última eficacia</th><th>Registro</th></tr>
              </thead>
              <tbody>
                {conResultado.sort((a, b) => nombreArea(a).localeCompare(nombreArea(b), 'es')).map((r) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: 'left' }}>{nombreArea(r)}</td>
                    <td><b>{r.puntaje} %</b> <small>({fecha(r.fecha)})</small></td>
                    <td><button type="button" className="celda-btn" onClick={() => ir(`/inspecciones/${r.id}`)}>Ver registro N.º {r.numero}</button></td>
                  </tr>
                ))}
                {sinResultado.map((u) => (
                  <tr key={u.id}>
                    <td style={{ textAlign: 'left' }}>{u.nombre}</td>
                    <td colSpan={2}><small>Sin eficacia registrada (en este período; no entra en el promedio)</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </>
  )
}

/**
 * Resultados del IPF (pedido del dueño, 29/10/2026): % de hallazgos cerrados, hallazgos abiertos o en proceso, hallazgos levantados (cerrados)
 * y un gráfico del % cerrado por mes. Cada mes cuenta los hallazgos que nacieron en él y cuántos de esos ya están cerrados.
 */
function ResultadosHallazgos({ empresaId, nombre, online }: { empresaId: string; nombre: string; online: boolean }) {
  const [lista, setLista] = useState<Hallazgo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [anio, setAnio] = useState(hoyLocal().slice(0, 4))
  useEffect(() => {
    if (online) listarHallazgos(empresaId).then(setLista, (e) => setError((e as Error).message))
  }, [empresaId, online])
  if (!online) return <p className="nota">Los resultados se ven con señal.</p>
  if (!lista) return error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>

  const todos = lista.filter((h) => h.plantillas?.nombre === nombre && h.estado !== 'anulado')
  const cerrados = todos.filter((h) => h.estado === 'cerrado').length
  const abiertos = todos.filter((h) => h.estado === 'abierto' || h.estado === 'en_proceso').length
  const pct = todos.length ? Math.round((100 * cerrados) / todos.length) : null
  const anios = [...new Set([hoyLocal().slice(0, 4), ...todos.map((h) => h.creado_en.slice(0, 4))])].sort().reverse()
  const meses = MESES_TXT.map((m, k) => {
    const delMes = todos.filter((h) => h.creado_en.slice(0, 4) === anio && Number(h.creado_en.slice(5, 7)) === k + 1)
    const cer = delMes.filter((h) => h.estado === 'cerrado').length
    return { mes: m, total: delMes.length, cer, pct: delMes.length ? Math.round((100 * cer) / delMes.length) : null }
  })

  return (
    <>
      <div className="tarjetas-ext">
        <div className="tarjeta-ext">
          <small>Hallazgos cerrados</small>
          <b>{pct == null ? '—' : `${pct} %`}</b>
          <span>{cerrados} cerrados de {todos.length} en total</span>
        </div>
        <div className={`tarjeta-ext ${abiertos ? 'aviso' : ''}`}>
          <small>Abiertos o en proceso</small>
          <b>{abiertos}</b>
          <span>por cerrar</span>
        </div>
        <div className="tarjeta-ext">
          <small>Hallazgos levantados</small>
          <b>{cerrados}</b>
          <span>ya cerrados</span>
        </div>
      </div>
      <Seccion titulo="% de hallazgos cerrados por mes">
        <label className="field campo-fecha">
          <span>Año</span>
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <GraficoBarras datos={meses} />
        <p className="nota">Cada mes cuenta los hallazgos que nacieron en él y qué porcentaje de ellos ya está cerrado. Un mes sin hallazgos queda vacío.</p>
      </Seccion>
    </>
  )
}

/** Barras de 0 a 100 %, una por mes. */
function GraficoBarras({ datos }: { datos: { mes: string; total: number; cer: number; pct: number | null }[] }) {
  const ancho = 720, alto = 240, izq = 36, base = 200, tope = 20
  const paso = (ancho - izq - 8) / datos.length
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Porcentaje de hallazgos cerrados por mes" className="grafico-barras">
      {[0, 25, 50, 75, 100].map((v) => {
        const y = base - ((base - tope) * v) / 100
        return (
          <g key={v}>
            <line x1={izq} x2={ancho - 8} y1={y} y2={y} stroke="currentColor" opacity="0.15" />
            <text x={izq - 6} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.7">{v}%</text>
          </g>
        )
      })}
      {datos.map((d, k) => {
        const h = d.pct == null ? 0 : ((base - tope) * d.pct) / 100
        const x = izq + k * paso + paso * 0.15
        return (
          <g key={d.mes}>
            <title>{`${d.mes}: ${d.pct == null ? 'sin hallazgos' : `${d.pct} % (${d.cer} de ${d.total})`}`}</title>
            <rect x={x} y={base - h} width={paso * 0.7} height={h} rx="3" fill="#3b82a0" />
            <text x={x + paso * 0.35} y={base - h - 5} textAnchor="middle" fontSize="11" fill="currentColor">{d.pct == null ? '' : `${d.pct}%`}</text>
            <text x={x + paso * 0.35} y={base + 16} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.8">{d.mes.slice(0, 3)}</text>
          </g>
        )
      })}
    </svg>
  )
}
