import { Esqueleto } from '../Esqueleto'
import { ArrowLeft, ClipboardCheck, FileSpreadsheet, FileText, ListChecks, PenLine, Search, Upload } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { InsigniaListo } from '../InsigniaListo'
import { CargaMasivaEquipos } from '../activos/CargaMasiva'
import { FormActivo, useContextoActivos } from '../activos/Activos'
import { Aviso, Seccion } from '../empresas/campos'
import { type Activo, listarActivos } from '../formatos/datos'
import { type Hallazgo, listarHallazgos } from '../hallazgos/datos'
import { Hallazgos } from '../hallazgos/Hallazgos'
import { ir } from '../ruta'
import { hoyLocal } from './ayudas'
import { type CopiaLocal, type FormatoLocal, leerCopia } from './campo'
import { type FilaAvance, type UltimaInspeccion, avancePeriodo, ultimasInspecciones } from './datos'
import type { vistaDeExcel } from './excelVista'
import { BuscadorExtintor, mesesDelAnio, periodosDelAnio } from './Extintores'
import { PanelFirma } from './Firma'
import { periodoDe, periodosHasta } from './periodos'
import { armarRegistroBomba } from './registroBomba'
import { entregarRegistro } from './registroPeriodo'
import { Ventana } from './Ventana'
import { VistaExcel } from './VistaExcel'

/** Los formatos que forman «Inspección de bomba contra incendio» (se reconocen por su nombre). */
export const esBombaIncendio = (nombre: string) => /^inspecci[oó]n de (moto|electro)bomba/i.test(nombre)

type Clave = 'electrobomba' | 'motobomba'
type Grupo = { clave: Clave; nombre: string; formato: FormatoLocal; activos: Activo[]; filas: FilaAvance[]; ultimas: Map<string, UltimaInspeccion> }
type Vista = 'ninguna' | 'catastro' | 'inspeccion' | 'registro' | 'hallazgos'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const NOMBRES: Record<Clave, string> = { electrobomba: 'Electrobomba', motobomba: 'Motobomba' }

/**
 * «Inspección de bomba contra incendio» (pedido del dueño, 30/10/2026): una sola pantalla para las dos bombas, con el filtro de semana,
 * las tarjetas de cumplimiento general y de hallazgos, y los botones catastro (separado por tipo), realizar inspección, generar registro
 * y ver hallazgos (acumulado de las dos). La frecuencia semanal es la del programa anual de SST.
 */
export function BombasIncendio({ empresaId, cuenta, gestiona, online, abrir }: { empresaId: string; cuenta: string; gestiona: boolean; online: boolean; abrir?: 'registro' }) {
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined)
  useEffect(() => {
    void leerCopia(cuenta, empresaId).then((c) => setCopia(c ?? null), () => setCopia(null))
  }, [cuenta, empresaId])
  const formatos = useMemo(
    () => (['electrobomba', 'motobomba'] as Clave[]).flatMap((k) => {
      const f = copia?.formatos.find((x) => new RegExp(`^inspecci[oó]n de ${k}`, 'i').test(x.plantilla.nombre))
      return f ? [{ clave: k, formato: f }] : []
    }),
    [copia],
  )
  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/inspecciones')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inspecciones
      </button>
      <header className="detalle-cab">
        <h1>Inspección de bomba contra incendio</h1>
        <p>Electrobomba y motobomba: cada bomba se inspecciona una vez por semana, según el programa anual de SST.</p>
      </header>
      {copia === undefined ? (
        <Esqueleto forma="lista" />
      ) : !copia || !formatos.length ? (
        <Aviso>No hay formatos de bomba contra incendio en este equipo. Vuelve a Inspecciones y pulsa «Actualizar».</Aviso>
      ) : !online ? (
        <p className="nota">La pantalla de bombas necesita señal. Sin señal, empieza una inspección desde «Nueva inspección» en Inspecciones.</p>
      ) : (
        <Panel abrir={abrir} empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} copia={copia} formatos={formatos} />
      )}
    </div>
  )
}

function Panel({ abrir, empresaId, cuenta, gestiona, online, copia, formatos }: { abrir?: 'registro'; empresaId: string; cuenta: string; gestiona: boolean; online: boolean; copia: CopiaLocal; formatos: { clave: Clave; formato: FormatoLocal }[] }) {
  const hoy = hoyLocal()
  const semanas = useMemo(() => periodosHasta(hoy, 'semanal', 13), [hoy])
  const [semana, setSemana] = useState(semanas[0]?.clave ?? '')
  // La semana se elige con dos listas, semana y año (pedido del dueño, 09/11/2026), igual que en la caseta.
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const periodosAnio = useMemo(() => periodosDelAnio(anio, 'semanal'), [anio])
  const periodo = periodosAnio.find((s) => s.clave === semana) ?? periodosAnio[0]
  const cambiarAnio = (nuevo: number) => {
    setAnio(nuevo)
    const mismo = periodo ? periodoDe(`${nuevo}${periodo.desde.slice(4)}`, 'semanal') : null
    if (mismo) setSemana(mismo.clave)
  }
  const [sede, setSede] = useState(copia.sedes[0]?.id ?? '')
  const [vista, setVista] = useState<Vista>(abrir === 'registro' ? 'registro' : 'inspeccion')
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState<'elegir' | Clave | null>(null)
  const [version, setVersion] = useState(0)
  // Observaciones abiertas: los planes de acción de estas inspecciones que siguen abiertos o en proceso.
  const [observaciones, setObservaciones] = useState<Hallazgo[] | null>(null)
  useEffect(() => {
    listarHallazgos(empresaId).then(setObservaciones, () => setObservaciones([]))
  }, [empresaId, vista])
  const { contexto } = useContextoActivos(empresaId, true, false)
  const nombrePersona = useMemo(() => new Map(copia.personas.map((p) => [p.persona_id, p.apellidos_nombres])), [copia])
  const nombreArea = (id: string | null) => copia.unidades.find((u) => u.id === id)?.nombre ?? ''
  const nombreUbic = (id: string | null) => copia.ubicaciones.find((u) => u.id === id)?.nombre ?? ''

  const cargar = useCallback(() => {
    if (!sede || !periodo) return
    setGrupos(null)
    Promise.all(
      formatos.map(async ({ clave, formato }): Promise<Grupo> => {
        const tipoId = formato.plantilla.tipo_activo_id
        const [activos, filas, ultimas] = await Promise.all([
          tipoId ? listarActivos(empresaId, tipoId).then((a) => a.filter((x) => x.estado === 'activo')) : Promise.resolve([] as Activo[]),
          avancePeriodo(formato.plantilla.id, sede, periodo.desde, periodo.hasta),
          ultimasInspecciones(formato.plantilla.id).catch(() => new Map<string, UltimaInspeccion>()),
        ])
        return { clave, nombre: NOMBRES[clave], formato, activos, filas, ultimas }
      }),
    ).then(setGrupos, (e) => setError((e as Error).message))
  }, [empresaId, formatos, sede, periodo])
  useEffect(cargar, [cargar, version])

  if (!grupos) return <>{error ? <Aviso>{error}</Aviso> : <Esqueleto forma="lista" />}</>

  const total = grupos.reduce((n, g) => n + g.filas.length, 0)
  const hechos = grupos.reduce((n, g) => n + g.filas.filter((f) => f.inspeccion_id).length, 0)
  const pct = total ? Math.round((100 * hechos) / total) : 0
  const nombresFormato = grupos.map((g) => g.formato.plantilla.nombre)
  const propias = (observaciones ?? []).filter((h) => nombresFormato.includes(h.plantillas?.nombre ?? '') && h.estado !== 'anulado')
  const generadas = propias.length
  const abiertas = propias.filter((h) => h.estado === 'abierto' || h.estado === 'en_proceso').length
  const recargar = () => (setVersion((v) => v + 1), contexto?.recargar())

  const pestanas: { v: Vista; texto: string; icono: ReactNode }[] = [
    { v: 'inspeccion', texto: 'Realizar inspección', icono: <ClipboardCheck size={16} aria-hidden="true" /> },
    { v: 'catastro', texto: 'Ver catastro', icono: <Search size={16} aria-hidden="true" /> },
    { v: 'hallazgos', texto: 'Ver planes de acción', icono: <ListChecks size={16} aria-hidden="true" /> },
    { v: 'registro', texto: 'Generar registro', icono: <FileSpreadsheet size={16} aria-hidden="true" /> },
  ]
  const activa = pestanas.some((p) => p.v === vista) ? vista : 'inspeccion'
  // Flechas, inicio y fin mueven la pestaña (teclado).
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = pestanas.findIndex((p) => p.v === activa)
    const j = e.key === 'ArrowRight' ? (i + 1) % pestanas.length : e.key === 'ArrowLeft' ? (i + pestanas.length - 1) % pestanas.length : e.key === 'Home' ? 0 : e.key === 'End' ? pestanas.length - 1 : -1
    if (j < 0) return
    e.preventDefault()
    setVista(pestanas[j].v)
    requestAnimationFrame(() => document.getElementById(`pest-${pestanas[j].v}`)?.focus())
  }

  return (
    <>
      <Aviso>{error}</Aviso>
      {cargando === 'elegir' && (
        <Ventana titulo="Cargar equipos" onCerrar={() => setCargando(null)}>
          <p className="nota">¿Qué tipo de bomba vas a cargar?</p>
          <div className="acciones">
            {grupos.map((g) => <button key={g.clave} className="btn-sec" type="button" onClick={() => setCargando(g.clave)}>{g.nombre}s</button>)}
          </div>
        </Ventana>
      )}
      {cargando && cargando !== 'elegir' && (() => {
        const g = grupos.find((x) => x.clave === cargando)
        return g?.formato.plantilla.tipo_activo_id ? (
          <CargaMasivaEquipos empresaId={empresaId} empresaNombre={copia.empresa.razon_social} tipoId={g.formato.plantilla.tipo_activo_id} exigirTodo={false}
            onCerrar={() => setCargando(null)} onListo={recargar} />
        ) : null
      })()}

      <div className="pestanas no-imprimir" role="tablist" aria-label="Secciones de la inspección" onKeyDown={teclas}>
        {pestanas.map((p) => (
          <button key={p.v} id={`pest-${p.v}`} type="button" role="tab" aria-selected={activa === p.v} aria-controls="pest-panel" tabIndex={activa === p.v ? 0 : -1} onClick={() => setVista(p.v)}>
            {p.icono} {p.texto}
          </button>
        ))}
      </div>
      <div className="pestana-panel" id="pest-panel" role="tabpanel" aria-labelledby={`pest-${activa}`}>
        {activa === 'inspeccion' && (
          <>
            <div className={`${copia.sedes.length > 1 ? 'fila3' : 'fila2'} no-imprimir`}>
              {copia.sedes.length > 1 && (
                <label className="field">
                  <span>Sede</span>
                  <select value={sede} onChange={(e) => setSede(e.target.value)}>
                    {copia.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
              )}
              <label className="field">
                <span>Semana</span>
                <select value={periodo?.clave ?? ''} onChange={(e) => setSemana(e.target.value)}>
                  {periodosAnio.map((s) => <option key={s.clave} value={s.clave}>{s.etiqueta.replace(` de ${anio}`, '')}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Año</span>
                <select value={anio} onChange={(e) => cambiarAnio(Number(e.target.value))}>
                  {Array.from({ length: 7 }, (_, k) => Number(hoy.slice(0, 4)) + 1 - k).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>

            <div className="tarjetas-ext">
              <div className="tarjeta-ext">
                <small>Cumplimiento general de la semana</small>
                <b>{pct} %</b>
                <span>{hechos} de {total} bombas inspeccionadas ({grupos.map((g) => `${g.filas.filter((f) => f.inspeccion_id).length}/${g.filas.length} ${g.nombre.toLowerCase()}s`).join(' · ')})</span>
              </div>
              <button type="button" className={`tarjeta-ext ${abiertas ? 'mal' : ''}`} onClick={() => setVista('hallazgos')}>
                <small>Observaciones abiertas</small>
                <b>{observaciones ? abiertas : '…'}</b>
                <span>{observaciones ? `de ${generadas} ${generadas === 1 ? 'observación generada' : 'observaciones generadas'} como plan de acción` : 'leyendo los planes de acción'}</span>
              </button>
            </div>

            {contexto && <Buscador grupos={grupos} contexto={contexto} copia={copia} nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} semanaActual={semanas[0]?.clave === semana} onCambio={recargar} />}
            <TablaInspeccion grupos={grupos} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} />
          </>
        )}
        {activa === 'catastro' && (
          <>
            <div className="acciones no-imprimir">
              <button className="btn-sec" type="button" onClick={() => setCargando('elegir')}>
                <Upload size={18} aria-hidden="true" /> Cargar equipos
              </button>
            </div>
            {grupos.map((g) => <Catastro key={g.clave} g={g} contexto={contexto} onCambio={recargar} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} />)}
          </>
        )}
        {activa === 'hallazgos' && <Hallazgos empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} fuentes={nombresFormato} />}
        {activa === 'registro' && <Registro grupos={grupos} sede={sede} hoy={hoy} copia={copia} nombreUbic={nombreUbic} />}
      </div>
    </>
  )
}

/** Buscador por código: se elige el tipo de bomba y se escribe el código (ficha, modificar, eliminar o agregar). */
function Buscador({ grupos, contexto, copia, nombreArea, nombreUbic, hoy, semanaActual, onCambio }: {
  grupos: Grupo[]; contexto: NonNullable<ReturnType<typeof useContextoActivos>['contexto']>; copia: CopiaLocal
  nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string; hoy: string; semanaActual: boolean; onCambio: () => void
}) {
  const [clave, setClave] = useState<Clave>(grupos[0].clave)
  const g = grupos.find((x) => x.clave === clave) ?? grupos[0]
  return (
    <>
      {grupos.length > 1 && (
        <div className="filtros no-imprimir" role="group" aria-label="Tipo de bomba">
          {grupos.map((x) => <button key={x.clave} type="button" aria-pressed={clave === x.clave} onClick={() => setClave(x.clave)}>{x.nombre}</button>)}
        </div>
      )}
      <BuscadorExtintor key={g.clave} variante="bomba" subtipos={[]} activos={g.activos} filas={g.filas} ultimas={g.ultimas} formato={g.formato} contexto={contexto} copia={copia}
        nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} semanaActual={semanaActual} onCambio={onCambio} />
    </>
  )
}

/** Catastro de un tipo de bomba, con sus características al lado. */
function Catastro({ g, contexto, onCambio, nombrePersona, nombreArea, nombreUbic }: { g: Grupo; contexto: NonNullable<ReturnType<typeof useContextoActivos>['contexto']> | null; onCambio: () => void; nombrePersona: Map<string, string>; nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string }) {
  const electro = g.clave === 'electrobomba'
  const [editando, setEditando] = useState<Activo | null>(null)
  const tipo = contexto?.tipos.find((t) => t.id === g.formato.plantilla.tipo_activo_id)
  const ficha = (a: Activo, q: 'principal' | 'jockey') =>
    [a.datos[`${q}_marca`], a.datos[`${q}_potencia`], a.datos[`${q}_caudal`], a.datos[`${q}_presion_nominal`] && `${a.datos[`${q}_presion_nominal`]}`, a.datos[`${q}_arranque_parada`], a.datos[`${q}_alimentacion`]]
      .filter(Boolean).join(' · ') || '—'
  return (
    <Seccion titulo={`Catastro de ${g.nombre.toLowerCase()}s (${g.activos.length})`}>
      {!g.activos.length ? <p className="nota">No hay {g.nombre.toLowerCase()}s registradas.</p> : (
        <div className="tabla-scroll">
          <table className={`tabla-catastro ${tipo ? 'tabla-clic' : ''}`}>
            <thead>
              <tr>
                <th>Código</th><th>Ubicación</th><th>Área</th><th>Responsable</th>
                {electro && <><th>Electrobomba principal (marca · potencia · caudal · presión · arranque/parada · alimentación)</th><th>Electrobomba Jockey</th></>}
              </tr>
            </thead>
            <tbody>
              {g.activos.map((a) => (
                <tr key={a.id} tabIndex={tipo ? 0 : undefined} onClick={() => tipo && setEditando(a)} onKeyDown={(e) => tipo && e.key === 'Enter' && setEditando(a)}>
                  <td><b>{a.codigo}</b></td>
                  <td>{nombreUbic(a.ubicacion_id)}</td>
                  <td>{nombreArea(a.unidad_id)}</td>
                  <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                  {electro && <><td>{ficha(a, 'principal')}</td><td>{ficha(a, 'jockey')}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!g.activos.length && <p className="nota">Toca una fila para ver o modificar su información.</p>}
      {editando && tipo && contexto && (
        <Ventana titulo={`Modificar ${editando.codigo}`} onCerrar={() => setEditando(null)}>
          <FormActivo exigirTodo={false} ctx={contexto} tipo={tipo} activo={editando} materiales={[]} onListo={() => (setEditando(null), onCambio())} onCancelar={() => setEditando(null)} />
        </Ventana>
      )}
    </Seccion>
  )
}

/** Realizar inspección: todas las bombas con su estado en la semana, con filtro por tipo. */
function TablaInspeccion({ grupos, nombrePersona, nombreArea, nombreUbic }: { grupos: Grupo[]; nombrePersona: Map<string, string>; nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string }) {
  const [tipo, setTipo] = useState<'todas' | Clave>('todas')
  const [estado, setEstado] = useState<'todos' | 'pendiente' | 'realizado'>('todos')
  const [resp, setResp] = useState('')
  const filas = grupos.filter((g) => tipo === 'todas' || g.clave === tipo).flatMap((g) => g.activos.map((a) => ({ g, a, f: g.filas.find((x) => x.activo_id === a.id) })))
  const lista = filas.filter(({ a, f }) => (estado === 'todos' || (estado === 'realizado') === Boolean(f?.inspeccion_id)) && (!resp || a.responsable_id === resp))
  const responsables = [...new Set(grupos.flatMap((g) => g.activos.map((a) => a.responsable_id)).filter((x): x is string => Boolean(x)))].sort((x, y) => (nombrePersona.get(x) ?? '').localeCompare(nombrePersona.get(y) ?? '', 'es'))
  return (
    <section className="seccion">
      <div className="fila3 no-imprimir">
        <label className="field">
          <span>Tipo de bomba</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="todas">Electrobomba y motobomba</option>
            {grupos.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Solo pendientes</option>
            <option value="realizado">Solo realizados</option>
          </select>
        </label>
        <label className="field">
          <span>Responsable</span>
          <select value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => <option key={r} value={r}>{nombrePersona.get(r) ?? 'Persona de la empresa'}</option>)}
          </select>
        </label>
      </div>
      {!lista.length ? <p className="nota">No hay bombas con este filtro.</p> : (
        <div className="tabla-scroll">
          <table className="tabla-catastro tabla-clic">
            <thead>
              <tr><th>Tipo</th><th>Código</th><th>Ubicación</th><th>Área</th><th>Responsable</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {lista.map(({ g, a, f }) => {
                const hecho = Boolean(f?.inspeccion_id)
                return (
                  <tr key={a.id} tabIndex={0} onClick={() => ir(hecho ? `/inspecciones/${f!.inspeccion_id}` : `/inspecciones/nueva/${g.formato.plantilla.id}/-/${a.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLElement).click()}>
                    <td>{g.nombre}</td>
                    <td><b>{a.codigo}</b></td>
                    <td>{nombreUbic(a.ubicacion_id)}</td>
                    <td>{nombreArea(a.unidad_id)}</td>
                    <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                    <td><span className={`chip ${hecho ? 'chip-ok' : 'chip-aviso'}`}>{hecho ? 'Inspeccionada' : 'Pendiente'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">Toca una fila: si está pendiente empieza su inspección; si ya está inspeccionada, la abre.</p>
    </section>
  )
}

/**
 * Generar registro (09/11/2026), igual que en la caseta: tipo de bomba y equipo, mes y año, fecha de la inspección, responsable de la inspección
 * y custodia del registro con su cargo, y firma electrónica avanzada o física. Sale la hoja de la última inspección de esa bomba en el mes.
 */
function Registro({ grupos, sede, hoy, copia, nombreUbic }: { grupos: Grupo[]; sede: string; hoy: string; copia: CopiaLocal; nombreUbic: (id: string | null) => string }) {
  const [clave, setClave] = useState<Clave>(grupos[0].clave)
  const g = grupos.find((x) => x.clave === clave) ?? grupos[0]
  const [equipo, setEquipo] = useState('')
  const a = g.activos.find((x) => x.id === equipo) ?? g.activos[0]
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)))
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const meses = useMemo(() => mesesDelAnio(anio), [anio])
  const elegido = meses.find((m) => m.clave === mes) ?? meses[0]
  // La inspección de esta bomba en el mes (undefined: se está buscando; null: no tiene).
  const [hecha, setHecha] = useState<FilaAvance | null | undefined>(undefined)
  const [fecha, setFecha] = useState('')
  const [registro, setRegistro] = useState({ nombre: '', cargo: '' })
  const [tipoFirma, setTipoFirma] = useState<'electronica' | 'fisica'>('electronica')
  const [firma, setFirma] = useState<Uint8Array | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [armando, setArmando] = useState(false)
  const [armandoDe, setArmandoDe] = useState<'excel' | 'pdf' | null>(null)
  const [listoDe, setListoDe] = useState<'excel' | 'pdf' | null>(null)
  const [vistaPdf, setVistaPdf] = useState<ReturnType<typeof vistaDeExcel> | null>(null)
  const firmaFisica = tipoFirma === 'fisica'

  useEffect(() => {
    let vivo = true
    setHecha(undefined)
    if (!a) return
    avancePeriodo(g.formato.plantilla.id, sede, elegido.desde, elegido.hasta).then((filas) => {
      if (!vivo) return
      const f = filas.find((x) => x.activo_id === a.id)
      setHecha(f?.inspeccion_id ? f : null)
      if (f?.fecha) setFecha(f.fecha)
    }, (e) => vivo && setError((e as Error).message))
    return () => {
      vivo = false
    }
  }, [g.formato.plantilla.id, sede, elegido.desde, elegido.hasta, a])
  useEffect(() => {
    if (!listoDe) return
    const t = setTimeout(() => setListoDe(null), 4000)
    return () => clearTimeout(t)
  }, [listoDe])
  useEffect(() => {
    if (!vistaPdf) return
    const listo = () => setVistaPdf(null)
    window.addEventListener('afterprint', listo)
    const t = setTimeout(() => window.print(), 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', listo)
    }
  }, [vistaPdf])

  async function generar(como: 'excel' | 'pdf') {
    setError(null)
    setAviso(null)
    if (!a || !hecha?.inspeccion_id) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError('Escribe la fecha de la inspección.')
    if (registro.nombre.trim().length < 3 || !registro.cargo.trim() || (!firmaFisica && !firma)) {
      return setError(firmaFisica ? 'Escribe tu nombre y apellido y tu cargo: el pie del formato los pide.' : 'Escribe tu nombre y apellido, tu cargo y firma: el pie del formato los pide.')
    }
    setArmando(true)
    setArmandoDe(como)
    setListoDe(null)
    try {
      const bytes = await armarRegistroBomba({ inspeccionId: hecha.inspeccion_id, copia, registro: { ...registro, fecha }, firma: firmaFisica ? null : firma })
      if (!bytes) return setAviso('Este formato no tiene un Excel de la organización. Súbelo en el formato.')
      const vista = await entregarRegistro(bytes, como, `Inspección ${g.nombre}- ${a.codigo}- ${elegido.clave}`)
      if (vista) setVistaPdf(vista)
      setListoDe(como)
      setAviso(`Registro listo: ${a.codigo}.`)
    } catch (e) {
      setError(`No se pudo armar el registro: ${(e as Error).message}`)
    } finally {
      setArmando(false)
      setArmandoDe(null)
    }
  }

  return (
    <Seccion titulo="Generar registro">
      <div className="fila2">
        <label className="field">
          <span>Tipo de bomba</span>
          <select value={clave} onChange={(e) => (setClave(e.target.value as Clave), setEquipo(''))}>
            {grupos.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Equipo</span>
          <select value={a?.id ?? ''} onChange={(e) => setEquipo(e.target.value)} disabled={!g.activos.length}>
            {g.activos.map((x) => <option key={x.id} value={x.id}>{x.codigo}{nombreUbic(x.ubicacion_id) ? ` · ${nombreUbic(x.ubicacion_id)}` : ''}</option>)}
          </select>
        </label>
      </div>
      <div className="fila2">
        <label className="field">
          <span>Mes</span>
          <select value={elegido.clave} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta.split(' ')[0]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Año</span>
          <select value={anio} onChange={(e) => { const n = Number(e.target.value); setAnio(n); setMes(`${n}-${elegido.clave.slice(5, 7)}`) }}>
            {Array.from({ length: 5 }, (_, k) => Number(hoy.slice(0, 4)) - k).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {!a ? <p className="nota">No hay {g.nombre.toLowerCase()}s registradas.</p> : hecha === undefined ? <p className="nota">Buscando la inspección…</p> : !hecha ? (
        <p className="nota">{a.codigo} no tiene inspección en este mes.</p>
      ) : (
        <>
          <p className="aviso-ok">{a.codigo} · última inspección del mes: {fechaCorta(hecha.fecha ?? '')}.</p>
          <label className="field campo-fecha">
            <span>Fecha de inspección (por defecto, la de la inspección; puedes cambiarla)</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <div className="fila2">
            <label className="field">
              <span>Responsable de la inspección y custodia del registro: nombre y apellido *</span>
              <input type="text" maxLength={200} value={registro.nombre} onChange={(e) => setRegistro((r) => ({ ...r, nombre: e.target.value }))} />
            </label>
            <label className="field">
              <span>Cargo *</span>
              <input type="text" maxLength={120} value={registro.cargo} onChange={(e) => setRegistro((r) => ({ ...r, cargo: e.target.value }))} />
            </label>
          </div>
          <fieldset className="opciones-firma">
            <legend>Firma del registro</legend>
            <label className={tipoFirma === 'electronica' ? 'marcada' : ''}>
              <input type="radio" name="tipo-firma-bomba" checked={tipoFirma === 'electronica'} onChange={() => setTipoFirma('electronica')} />
              <span><b>Firma electrónica avanzada</b><small>Firmas aquí en pantalla y tu firma sale en el registro.</small></span>
            </label>
            <label className={tipoFirma === 'fisica' ? 'marcada' : ''}>
              <input type="radio" name="tipo-firma-bomba" checked={tipoFirma === 'fisica'} onChange={() => (setTipoFirma('fisica'), setFirmando(false))} />
              <span><b>Firma física</b><small>El espacio de la firma sale en blanco para firmar a mano en el papel.</small></span>
            </label>
          </fieldset>
          {firmaFisica ? null : firmando ? (
            <PanelFirma onListo={(png) => void png.arrayBuffer().then((b) => (setFirma(new Uint8Array(b)), setFirmando(false)))} onCancelar={() => setFirmando(false)} />
          ) : (
            <div className="acciones">
              <button className="btn-sec" type="button" onClick={() => setFirmando(true)}>
                <PenLine size={16} aria-hidden="true" /> {firma ? 'Firmar de nuevo' : 'Firmar *'}
              </button>
              {firma && <span className="chip chip-ok">Firma lista (no se guarda: hay que firmar cada vez)</span>}
            </div>
          )}
          <Aviso>{error}</Aviso>
          {aviso && <p className="aviso-suave">{aviso}</p>}
          <div className="acciones">
            <button className="btn" type="button" disabled={armando} onClick={() => void generar('excel')}>
              {armandoDe === 'excel' || listoDe === 'excel' ? <InsigniaListo armando={armandoDe === 'excel'} listo={listoDe === 'excel'} /> : <FileSpreadsheet size={18} aria-hidden="true" />} {armandoDe === 'excel' ? 'Armando…' : listoDe === 'excel' ? '¡Listo!' : 'Generar en Excel'}
            </button>
            <button className="btn" type="button" disabled={armando} onClick={() => void generar('pdf')}>
              {armandoDe === 'pdf' || listoDe === 'pdf' ? <InsigniaListo armando={armandoDe === 'pdf'} listo={listoDe === 'pdf'} /> : <FileText size={18} aria-hidden="true" />} {armandoDe === 'pdf' ? 'Armando…' : listoDe === 'pdf' ? '¡Listo!' : 'Generar en PDF'}
            </button>
          </div>
        </>
      )}
      {error && !hecha && <Aviso>{error}</Aviso>}
      {vistaPdf && createPortal(<VistaExcel vista={vistaPdf.vista} medias={vistaPdf.medias} />, document.body)}
    </Seccion>
  )
}
