import { ArrowLeft, CalendarRange, Eye, FileSpreadsheet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { NOMBRE_FRECUENCIA } from '../formatos/datos'
import { ir } from '../ruta'
import { hoyLocal } from './ayudas'
import { type CopiaLocal, type FormatoLocal, bajarCopia, leerCopia } from './campo'
import { type FilaAvance, avancePeriodo, inspeccionesCompletas } from './datos'
import { valoresDe } from './excel'
import { type EquipoPeriodo, llenarExcelPeriodo, valoresFilas, valoresGenerales } from './excelPeriodo'
import { datosHoja, excelDeFormato, guardarExcel } from './hoja'
import { CON_PERIODO, type Periodo, periodoDe, periodosHasta } from './periodos'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const porcentaje = (hechos: number, total: number) => (total ? Math.round((100 * hechos) / total) : 0)

/** Resumen del avance de una lista de filas: equipos inspeccionados de total (formatos de activo). */
function resumir(f: FormatoLocal, filas: FilaAvance[]) {
  if (f.plantilla.aplica_a !== 'activo') return { hechos: filas.length, total: null as number | null }
  return { hechos: filas.filter((x) => x.inspeccion_id).length, total: filas.length }
}

/**
 * Avance por período (tarea 3.4-D, decisiones del dueño 27/10/2026): por formato y sede, «equipos inspeccionados de
 * total» del período según la frecuencia del formato, la lista de los que faltan y el Excel de la organización con
 * una fila por equipo. Necesita señal (cuenta lo que ya llegó al servidor).
 */
export function Avance({ empresaId, cuenta, online }: { empresaId: string; cuenta: string; online: boolean }) {
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined)
  const [sede, setSede] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Record<string, { periodo: Periodo; hechos: number; total: number | null } | string>>({})

  useEffect(() => {
    void leerCopia(cuenta, empresaId).then(async (c) => {
      const x = c ?? (online ? await bajarCopia(cuenta, empresaId).catch(() => null) : null)
      setCopia(x)
      if (x?.sedes.length) setSede((s) => s || x.sedes[0].id)
    })
  }, [cuenta, empresaId, online])

  const programados = useMemo(() => (copia?.formatos ?? []).filter((f) => CON_PERIODO.includes(f.plantilla.frecuencia)), [copia])

  useEffect(() => {
    if (!online || !sede) return
    let vivo = true
    const hoy = hoyLocal()
    for (const f of programados) {
      const periodo = periodoDe(hoy, f.plantilla.frecuencia)!
      avancePeriodo(f.plantilla.id, sede, periodo.desde, periodo.hasta).then(
        (filas) => vivo && setResumen((r) => ({ ...r, [f.plantilla.id]: { periodo, ...resumir(f, filas) } })),
        (e) => vivo && setResumen((r) => ({ ...r, [f.plantilla.id]: (e as Error).message })),
      )
    }
    return () => {
      vivo = false
    }
  }, [programados, sede, online])

  const formato = programados.find((f) => f.plantilla.id === elegido)
  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => (elegido ? setElegido(null) : ir('/inspecciones'))}>
        <ArrowLeft size={18} aria-hidden="true" /> {elegido ? 'Avance por período' : 'Inspecciones'}
      </button>
      <header className="detalle-cab">
        <h1>{formato ? formato.plantilla.nombre : 'Avance por período'}</h1>
        <p>
          Equipos inspeccionados de los que tiene la sede en cada período, según la frecuencia de cada formato. Las semanas van de lunes a domingo y cada
          una cuenta en el mes de su jueves.
        </p>
      </header>
      {copia === undefined ? (
        <p className="nota">Cargando…</p>
      ) : !copia ? (
        <p className="nota">Este equipo todavía no tiene los datos de la empresa. Conéctate una vez para bajarlos.</p>
      ) : (
        <>
          <label className="field campo-fecha">
            <span>Sede</span>
            <select value={sede} onChange={(e) => (setSede(e.target.value), setResumen({}))}>
              {copia.sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          {!online && <p className="aviso-suave">El avance se calcula con lo que ya llegó al servidor: necesita señal.</p>}
          {formato ? (
            <DetalleAvance key={`${formato.plantilla.id}-${sede}`} formato={formato} sede={sede} copia={copia} online={online} />
          ) : (
            <Seccion titulo="Período actual">
              {!programados.length ? (
                <p className="nota">Ningún formato vigente tiene frecuencia. El administrador la define en cada formato.</p>
              ) : (
                <ul className="lista">
                  {programados.map((f) => {
                    const r = resumen[f.plantilla.id]
                    return (
                      <li key={f.plantilla.id}>
                        <CalendarRange aria-hidden="true" />
                        <div>
                          <b>{f.plantilla.nombre}</b>
                          <span className="chip">{NOMBRE_FRECUENCIA[f.plantilla.frecuencia]}</span>
                          {typeof r === 'string' ? (
                            <small className="error-linea">{r}</small>
                          ) : r ? (
                            <>
                              <small>{r.periodo.etiqueta}</small>
                              <Barra hechos={r.hechos} total={r.total} />
                            </>
                          ) : (
                            <small>{online ? 'Calculando…' : 'Sin señal'}</small>
                          )}
                        </div>
                        <span className="lista-acciones">
                          <button className="btn-link" type="button" onClick={() => setElegido(f.plantilla.id)}>
                            <Eye size={16} aria-hidden="true" /> Ver
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Seccion>
          )}
        </>
      )}
    </div>
  )
}

function Barra({ hechos, total }: { hechos: number; total: number | null }) {
  if (total == null) return <small><b>{hechos}</b> inspección(es) en el período</small>
  const pct = porcentaje(hechos, total)
  return (
    <span className="avance">
      <span className="avance-barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance">
        <span style={{ width: `${pct}%` }} />
      </span>
      <b>
        {hechos} de {total}
      </b>{' '}
      ({pct} %)
    </span>
  )
}

function DetalleAvance({ formato, sede, copia, online }: { formato: FormatoLocal; sede: string; copia: CopiaLocal; online: boolean }) {
  const periodos = useMemo(() => periodosHasta(hoyLocal(), formato.plantilla.frecuencia, 13), [formato])
  const [clave, setClave] = useState(periodos[0]?.clave ?? '')
  const periodo = periodos.find((p) => p.clave === clave) ?? periodos[0]
  // Las filas guardan su período: al cambiar de período se ven «Calculando…» hasta que lleguen las nuevas.
  const [cargado, setCargado] = useState<{ clave: string; filas: FilaAvance[] } | null>(null)
  const filas = cargado && cargado.clave === periodo?.clave ? cargado.filas : null
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [armando, setArmando] = useState(false)
  const esActivo = formato.plantilla.aplica_a === 'activo'
  const nombreUbicacion = (id: string | null) => (id ? (copia.ubicaciones.find((u) => u.id === id)?.nombre ?? '') : '')
  const nombreSede = copia.sedes.find((s) => s.id === sede)?.nombre ?? ''

  useEffect(() => {
    if (!online || !periodo) return
    let vivo = true
    avancePeriodo(formato.plantilla.id, sede, periodo.desde, periodo.hasta).then(
      (f) => vivo && setCargado({ clave: periodo.clave, filas: f }),
      (e) => vivo && setError((e as Error).message),
    )
    return () => {
      vivo = false
    }
  }, [formato, sede, periodo, online])

  async function excel() {
    if (!filas || !periodo) return
    setArmando(true)
    setError(null)
    setAviso(null)
    try {
      const archivo = await excelDeFormato(formato.plantilla.id)
      if (!archivo) {
        setAviso('Este formato no tiene un Excel de la organización. Súbelo en el formato (con una fila modelo {{fila.…}}).')
        return
      }
      const completas = new Map((await inspeccionesCompletas(filas.flatMap((f) => (f.inspeccion_id ? [f.inspeccion_id] : [])))).map((i) => [i.id, i]))
      const personas = new Map(copia.personas.map((p) => [p.persona_id, p.apellidos_nombres]))
      const nombre = (id: string | null) => (id ? (personas.get(id) ?? 'Persona de la empresa') : '')
      const equipos: EquipoPeriodo[] = filas.map((f) => {
        const i = f.inspeccion_id ? completas.get(f.inspeccion_id) : undefined
        return {
          codigo: f.codigo ?? '',
          datos: copia.activos.find((a) => a.id === f.activo_id)?.datos ?? {},
          inspeccion: i && i.plantillas_versiones
            ? datosHoja(i, { nombreFormato: formato.plantilla.nombre, version: i.plantillas_versiones, copia, nombre, lugares: { sede: i.sedes?.nombre, area: i.unidades?.nombre, ubicacion: i.ubicaciones?.nombre } })
            : null,
        }
      })
      const v = formato.version
      const base = valoresDe({
        empresa: copia.empresa,
        formato: { nombre: formato.plantilla.nombre, codigo_formato: v.codigo_formato, version_formato: v.version_formato, fecha_aprobacion: v.fecha_aprobacion },
        receta: v.receta, numero: null, fecha: periodo.hasta, hora: null, sede: nombreSede, area: null, ubicacion: null, inspector: null,
        resultado: null, puntaje: null, observacion: null, activo: null, respuestas: {}, filas: {}, firmantes: [], persona: () => null,
      })
      const r = await llenarExcelPeriodo(archivo, valoresGenerales(base, periodo, resumir(formato, filas)), valoresFilas(equipos))
      guardarExcel(r.bytes, `${formato.plantilla.nombre}-${nombreSede}-${periodo.clave}`)
      setAviso(
        r.hoja
          ? `Excel listo: ${r.filas} fila(s)${r.agregadas ? `; se agregaron ${r.agregadas} porque el formato tenía espacio para ${r.usadasDelFormato}` : ''}.`
          : 'El Excel no tiene una fila modelo con marcas {{fila.…}}: solo se llenó el encabezado.',
      )
    } catch (e) {
      setError(`No se pudo armar el Excel: ${(e as Error).message}`)
    } finally {
      setArmando(false)
    }
  }

  const hechos = filas?.filter((f) => f.inspeccion_id) ?? []
  const faltan = esActivo ? (filas?.filter((f) => !f.inspeccion_id) ?? []) : []
  return (
    <>
      <div className="fila-entre">
        <label className="field">
          <span>Período ({NOMBRE_FRECUENCIA[formato.plantilla.frecuencia].toLowerCase()})</span>
          <select value={clave} onChange={(e) => setClave(e.target.value)}>
            {periodos.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-sec" type="button" disabled={!filas || armando} onClick={() => void excel()}>
          <FileSpreadsheet size={18} aria-hidden="true" /> {armando ? 'Armando…' : 'Excel del período'}
        </button>
      </div>
      <Aviso>{error}</Aviso>
      {aviso && <p className="aviso-suave">{aviso}</p>}
      {!filas ? (
        !error && <p className="nota">{online ? 'Calculando…' : 'Necesita señal.'}</p>
      ) : (
        <>
          <div className="resultado-prueba" role="status">
            <Barra hechos={hechos.length} total={esActivo ? filas.length : null} />
            {esActivo && <p className="nota">Cuentan los equipos de la sede que existían al terminar el período y no estaban dados de baja. «Inoperativo» cuenta como inspeccionado.</p>}
          </div>
          {esActivo && (
            <Seccion titulo={`Faltan (${faltan.length})`}>
              {!faltan.length ? (
                <p className="aviso-ok">No falta ningún equipo en este período.</p>
              ) : (
                <ul className="lista">
                  {faltan.map((f) => (
                    <li key={f.activo_id}>
                      <CalendarRange aria-hidden="true" />
                      <div>
                        <b>{f.codigo}</b>
                        <small>{nombreUbicacion(f.ubicacion_id) || 'Sin ubicación'}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>
          )}
          <Seccion titulo={`Inspeccionados (${hechos.length})`}>
            {!hechos.length ? (
              <p className="nota">Todavía no hay inspecciones en este período.</p>
            ) : (
              <ul className="lista">
                {hechos.map((f) => (
                  <li key={f.inspeccion_id}>
                    <CalendarRange aria-hidden="true" />
                    <div>
                      <b>
                        {f.codigo ? `${f.codigo} · ` : ''}N.º {f.inspeccion_numero}
                      </b>
                      {f.resultado && <span className={`chip ${f.hallazgos ? 'chip-aviso' : 'chip-ok'}`}>{f.resultado}</span>}
                      {f.hallazgos > 0 && <span className="chip chip-mal">{f.hallazgos} hallazgo(s)</span>}
                      <small>
                        {fechaCorta(f.fecha!)}
                        {nombreUbicacion(f.ubicacion_id) ? ` · ${nombreUbicacion(f.ubicacion_id)}` : ''}
                      </small>
                    </div>
                    <span className="lista-acciones">
                      <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${f.inspeccion_id}`)}>
                        <Eye size={16} aria-hidden="true" /> Ver
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </>
      )}
    </>
  )
}
