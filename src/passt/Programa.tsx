import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, FileSpreadsheet, FileText, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Aviso, Seccion } from '../empresas/campos'
import { hoyLocal, ordenarUnidades } from '../inspecciones/ayudas'
import { type CopiaLocal, leerCopia } from '../inspecciones/campo'
import { llenarExcel, partes } from '../inspecciones/excel'
import { vistaDeExcel } from '../inspecciones/excelVista'
import { guardarExcel, logoPng } from '../inspecciones/hoja'
import { VistaExcel } from '../inspecciones/VistaExcel'
import { prepararFoto } from '../inspecciones/imagen'
import { semanasConMes } from '../inspecciones/periodos'
import { ir } from '../ruta'
import { type EstadoSemana, estadosPorActividad, mesDeHoy, promedioDe, semanaActual, textoPct, totalGeneral, totalesActividad, totalesPorMes } from './calculo'
import {
  type DatosPrograma, HIJO_DE, NOMBRE_TIPO, type Nodo, type Responsable, aprobarPrograma, bajaNodo, formatosDeEmpresa, guardarMetas, guardarNodo,
  areasDeEmpresa, guardarPrograma, leerPrograma, marcarSemana, moverNodo, programarSemana, responsables, trabajadores, NOMBRE_FRECUENCIA_ACTIVIDAD,
} from './datos'
import { Ventana } from '../inspecciones/Ventana'
import { excelPasst } from './excelPasst'
import { type NodoNumerado, numerar } from './numeracion'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
type Pestana = 'estructura' | 'calendario' | 'historial'
type Area = { id: string; nombre: string; nivel: string; padre_id: string | null; vigente: boolean; profundidad: number }

export type PermisosPasst = { editar: boolean; admin: boolean; cuenta: string }

/**
 * Un programa anual de SST (tarea 3.4-E, D-41 y decisiones del dueño del 28/10/2026). Tres partes: la estructura
 * (objetivos, metas, secciones y actividades con numeración automática), el calendario de semanas (P y E, totales y %
 * de cumplimiento contra la meta) y el historial. En borrador lo editan el administrador y el gestor; aprobado, solo el
 * administrador, con motivo.
 */
export function ProgramaAnual({ id, empresaId, online, permisos }: { id: string; empresaId: string; online: boolean; permisos: PermisosPasst }) {
  const [d, setD] = useState<DatosPrograma | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pestana, setPestana] = useState<Pestana>('calendario')
  const [personas, setPersonas] = useState<Responsable[]>([])
  const [formatos, setFormatos] = useState<{ id: string; nombre: string; vigente: boolean }[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [pideMotivo, setPideMotivo] = useState<((m: string | null) => void) | null>(null)
  const [borradorMotivo, setBorradorMotivo] = useState('')
  const [toast, setToast] = useState<{ texto: string; mal: boolean } | null>(null)
  const [empresa, setEmpresa] = useState<{ razon_social: string; ruc: string; domicilio: string; actividad: string } | null>(null)
  const [nTrabajadores, setNTrabajadores] = useState<number | null>(null)
  const [copiaEmpresa, setCopiaEmpresa] = useState<CopiaLocal | null>(null)
  const [vistaPdf, setVistaPdf] = useState<ReturnType<typeof vistaDeExcel> | null>(null)
  const [verEncabezado, setVerEncabezado] = useState(false)

  const cargar = useCallback(() => {
    leerPrograma(id).then(setD, (e) => setError((e as Error).message))
  }, [id])
  useEffect(() => {
    if (!online) return
    cargar()
    responsables(empresaId).then(setPersonas, () => {})
    formatosDeEmpresa(empresaId).then(setFormatos, () => {})
    areasDeEmpresa(empresaId).then((a) => setAreas(ordenarUnidades(a)), () => {})
    trabajadores(empresaId).then(setNTrabajadores, () => {})
    void leerCopia(permisos.cuenta, empresaId).then((c) => c && (setEmpresa(c.empresa), setCopiaEmpresa(c)))
  }, [online, cargar, empresaId, permisos.cuenta])

  const nombre = useMemo(() => {
    const m = new Map(personas.map((p) => [p.persona_id, p.apellidos_nombres]))
    return (pid: string | null) => (!pid ? 'Sin responsable' : (m.get(pid) ?? 'Persona de la empresa'))
  }, [personas])

  // PDF: cuando la hoja ya está dibujada, se abre «Imprimir» (ahí se elige «Guardar como PDF»).
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

  if (!online && !d) return <p className="nota">El programa anual se ve con señal.</p>
  if (!d) return error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>

  const p = d.programa
  const faltan = [!p.codigo_formato?.trim() && 'el código', !p.version_formato?.trim() && 'la versión', !p.fecha_aprobacion && 'la fecha de aprobación'].filter((x): x is string => Boolean(x))
  /** Excel o PDF con el diseño del modelo del dueño (src/passt/excelPasst.ts); el logo de la empresa va arriba a la izquierda. */
  async function descargar(como: 'excel' | 'pdf') {
    setError(null)
    try {
      const base = excelPasst(d!, empresa, nTrabajadores, nombre, hoyLocal())
      const logo = await logoPng(copiaEmpresa, 'positivo').catch(() => null)
      const lleno = await llenarExcel(base, () => '', logo ? new Map([['logo', logo]]) : undefined)
      if (como === 'excel') guardarExcel(lleno, `PASST-${p.anio}-${p.nombre}`)
      else setVistaPdf(vistaDeExcel(await partes(lleno)))
    } catch (e) {
      setError(`No se pudo armar el ${como === 'excel' ? 'Excel' : 'PDF'}: ${(e as Error).message}`)
    }
  }
  const aprobado = p.estado === 'aprobado'
  const puedeCambiar = permisos.editar && (!aprobado || permisos.admin)
  const arbol = numerar(d.nodos)

  // Hace una acción y vuelve a leer. Si el programa está aprobado y falta el motivo, lo pide en una ventana (antes salía un aviso
  // arriba de la pantalla que no se veía al estar abajo). Al terminar, avisa con un mensaje visible.
  const avisar = (texto: string, mal = false) => {
    setToast({ texto, mal })
    setTimeout(() => setToast(null), mal ? 6000 : 3000)
  }
  async function hacer(fn: (motivo: string | null) => Promise<unknown>, sinMotivo = false): Promise<boolean> {
    setError(null)
    // Cada cambio de un programa aprobado pide su motivo justo al guardar (no hay un campo fijo arriba).
    let m = ''
    if (aprobado && !sinMotivo) {
      const dado = await new Promise<string | null>((res) => (setBorradorMotivo(''), setPideMotivo(() => res)))
      setPideMotivo(null)
      if (!dado || dado.trim().length < 3) return false
      m = dado.trim()
    }
    try {
      await fn(aprobado ? m : null)
      cargar()
      avisar('Cambio guardado')
      return true
    } catch (e) {
      setError((e as Error).message)
      avisar((e as Error).message, true)
      return false
    }
  }

  return (
    <div className="detalle passt">
      <button className="btn-link volver no-imprimir" type="button" onClick={() => ir('/passt')}>
        <ArrowLeft size={18} aria-hidden="true" /> Programas
      </button>
      <header className="detalle-cab fila-entre">
        <div>
          <h1>{p.nombre}</h1>
          <p>
            {p.anio} · {p.sede_id ? `Sede ${p.sedes?.nombre ?? ''}` : 'General (todas las sedes)'} ·{' '}
            {aprobado ? `Aprobado el ${fechaHora(p.aprobado_en!)} por ${nombre(p.aprobado_por)}` : 'Borrador'}
          </p>
        </div>
        <span className="acciones no-imprimir">
          {!aprobado && permisos.admin && (
            <button className="btn" type="button" onClick={() => void hacer(() => aprobarPrograma(p.id), true)}>
              <CheckCircle2 size={18} aria-hidden="true" /> Aprobar
            </button>
          )}
          <button className="btn-sec" type="button" onClick={() => void descargar('excel')}>
            <FileSpreadsheet size={18} aria-hidden="true" /> Excel
          </button>
          <button className="btn-sec" type="button" onClick={() => void descargar('pdf')}>
            <FileText size={18} aria-hidden="true" /> PDF
          </button>
          {puedeCambiar && !faltan.length && (
            <button className="btn-link" type="button" onClick={() => setVerEncabezado((v) => !v)}>
              <Pencil size={16} aria-hidden="true" /> Encabezado
            </button>
          )}
        </span>
      </header>
      <Aviso>{error}</Aviso>
      {toast && <p className={`toast-aviso ${toast.mal ? 'mal' : ''}`} role="status">{toast.texto}</p>}
      {pideMotivo && (
        <Ventana titulo="Motivo del cambio" onCerrar={() => pideMotivo(null)}>
          <p className="nota">El programa está aprobado: el cambio queda en el historial con su motivo (mínimo 3 letras).</p>
          <label className="field">
            <span>Motivo del cambio</span>
            <input type="text" autoFocus maxLength={500} value={borradorMotivo} onChange={(e) => setBorradorMotivo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && borradorMotivo.trim().length >= 3 && pideMotivo(borradorMotivo)} placeholder="Ej.: Se movió la inspección por el feriado" />
          </label>
          <div className="acciones">
            <button className="btn" type="button" disabled={borradorMotivo.trim().length < 3} onClick={() => pideMotivo(borradorMotivo)}>Guardar el cambio</button>
            <button className="btn-link" type="button" onClick={() => pideMotivo(null)}>Cancelar</button>
          </div>
        </Ventana>
      )}
      {aprobado && !permisos.admin && <p className="nota">El programa está aprobado: solo el administrador lo cambia. Puedes marcar tus actividades sin formato vinculado.</p>}

      {/* El encabezado queda oculto; solo sale, con una alerta, si falta el código, la versión o la fecha de aprobación. */}
      {faltan.length > 0 && (
        <div className="alerta-formatos" role="alert">
          <p>
            <TriangleAlert size={18} aria-hidden="true" /> <b>Falta {faltan.join(', ')} del programa.</b> Van en el encabezado del Excel y del PDF.
          </p>
        </div>
      )}
      {(faltan.length > 0 || verEncabezado) && <Encabezado d={d} empresa={empresa} nTrabajadores={nTrabajadores} puedeCambiar={puedeCambiar} hacer={hacer} />}

      <div className="filtros no-imprimir" role="tablist">
        {(['calendario', 'estructura', 'historial'] as Pestana[]).map((t) => (
          <button key={t} type="button" role="tab" aria-pressed={pestana === t} onClick={() => setPestana(t)}>
            {t === 'calendario' ? 'Calendario (P / E)' : t === 'estructura' ? 'Objetivos y actividades' : 'Historial'}
          </button>
        ))}
      </div>

      {pestana === 'estructura' && <Estructura d={d} arbol={arbol} puedeCambiar={puedeCambiar} esAdmin={permisos.admin} personas={personas} formatos={formatos} areas={areas} nombre={nombre} hacer={hacer} />}
      {pestana === 'calendario' && <Calendario d={d} arbol={arbol} puedeCambiar={puedeCambiar} permisos={permisos} nombre={nombre} formatos={formatos} areas={areas} hacer={hacer} />}
      {pestana === 'historial' && (
        <Seccion titulo="Historial">
          <ul className="historial">
            {d.historial.map((c) => (
              <li key={c.id}>
                <b>{NOMBRE_CAMBIO[c.cambio] ?? c.cambio}</b> · {fechaHora(c.hecho_en)} · {nombre(c.hecho_por)}
                {c.detalle && typeof c.detalle.semana === 'number' ? ` · semana ${c.detalle.semana}` : ''}
                {c.motivo ? ` · ${c.motivo}` : ''}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      {vistaPdf && createPortal(<VistaExcel vista={vistaPdf.vista} medias={vistaPdf.medias} />, document.body)}
    </div>
  )
}

const NOMBRE_CAMBIO: Record<string, string> = {
  creado: 'Creado', duplicado: 'Duplicado de otro programa', aprobado: 'Aprobado', estructura: 'Cambio de estructura',
  reprogramado: 'Reprogramado', marcado: 'Marcado como ejecutado a mano', desmarcado: 'Se quitó la marca manual', baja: 'Baja',
}

type Hacer = (fn: (motivo: string | null) => Promise<unknown>, sinMotivo?: boolean) => Promise<boolean>

function Encabezado({ d, empresa, nTrabajadores, puedeCambiar, hacer }: { d: DatosPrograma; empresa: { razon_social: string; ruc: string; domicilio: string; actividad: string } | null; nTrabajadores: number | null; puedeCambiar: boolean; hacer: Hacer }) {
  const p = d.programa
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ nombre: p.nombre, codigo_formato: p.codigo_formato ?? '', version_formato: p.version_formato ?? '', fecha_aprobacion: p.fecha_aprobacion ?? '', meta_cumplimiento: String(Number(p.meta_cumplimiento)) })
  return (
    <Seccion titulo="Encabezado" accion={puedeCambiar && !abierto ? <button className="btn-link no-imprimir" type="button" onClick={() => setAbierto(true)}><Pencil size={16} aria-hidden="true" /> Editar</button> : null}>
      <dl className="ficha">
        <div><dt>Razón social</dt><dd>{empresa?.razon_social ?? '—'}</dd></div>
        <div><dt>RUC</dt><dd>{empresa?.ruc ?? '—'}</dd></div>
        <div><dt>Domicilio</dt><dd>{empresa?.domicilio || '—'}</dd></div>
        <div><dt>Actividad económica</dt><dd>{empresa?.actividad || '—'}</dd></div>
        <div><dt>N.° de trabajadores</dt><dd>{nTrabajadores ?? '—'}</dd></div>
        <div><dt>Código · versión · aprobación</dt><dd>{[p.codigo_formato, p.version_formato, p.fecha_aprobacion?.split('-').reverse().join('/')].filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt>Meta de cumplimiento</dt><dd>{Number(p.meta_cumplimiento)} %</dd></div>
      </dl>
      {abierto && (
        <div className="form subform">
          <div className="fila3">
            <label className="field"><span>Nombre</span><input type="text" maxLength={160} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label className="field"><span>Código</span><input type="text" maxLength={40} value={f.codigo_formato} onChange={(e) => setF({ ...f, codigo_formato: e.target.value })} /></label>
            <label className="field"><span>Versión</span><input type="text" maxLength={20} value={f.version_formato} onChange={(e) => setF({ ...f, version_formato: e.target.value })} /></label>
            <label className="field"><span>Fecha de aprobación</span><input type="date" value={f.fecha_aprobacion} onChange={(e) => setF({ ...f, fecha_aprobacion: e.target.value })} /></label>
            <label className="field"><span>Meta de cumplimiento (%)</span><input type="number" min={0} max={100} value={f.meta_cumplimiento} onChange={(e) => setF({ ...f, meta_cumplimiento: e.target.value })} /></label>
          </div>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => void hacer((motivo) => guardarPrograma(p.id, { ...f, meta_cumplimiento: Number(f.meta_cumplimiento), motivo })).then((ok) => ok && setAbierto(false))}>Guardar</button>
            <button className="btn-link" type="button" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </Seccion>
  )
}

// ───────────────────────── Estructura ─────────────────────────

function Estructura({ d, arbol, puedeCambiar, esAdmin, personas, formatos, areas, nombre, hacer }: {
  esAdmin: boolean
  d: DatosPrograma; arbol: NodoNumerado<Nodo>[]; puedeCambiar: boolean; personas: Responsable[]; formatos: { id: string; nombre: string; vigente: boolean }[]
  areas: Area[]; nombre: (id: string | null) => string; hacer: Hacer
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [agregando, setAgregando] = useState<string | null>(null)
  const formato = (id: string | null) => formatos.find((f) => f.id === id)?.nombre
  return (
    <Seccion titulo="Objetivos, metas y actividades">
      <p className="nota">La numeración es automática: se recalcula sola al agregar, mover o dar de baja.</p>
      <ul className="arbol-passt">
        {arbol.map((n) => {
          const metas = d.metas.filter((m) => m.nodo_id === n.id)
          const hijo = HIJO_DE[n.tipo]
          return (
            <li key={n.id} className={`nodo-${n.tipo}`} style={{ marginLeft: `${n.nivel * 1.1}rem` }}>
              <div className="fila-entre">
                <div>
                  <small className="tipo-nodo">{NOMBRE_TIPO[n.tipo]} {n.numero}</small>
                  <b>{n.texto}</b>
                  {n.tipo === 'objetivo_especifico' && (
                    <>
                      {n.recursos && <small>Recursos: {n.recursos}</small>}
                      {metas.map((m) => <small key={m.id}>Meta {m.orden}: {m.texto}{m.indicador ? ` · Indicador: ${m.indicador}` : ''}</small>)}
                    </>
                  )}
                  {n.tipo === 'actividad' && (
                    <small>
                      Responsable: {nombre(n.responsable_id)} · Meta {Number(n.meta_pct ?? 100)} %
                      {n.unidad_id ? ` · Área: ${areas.find((a) => a.id === n.unidad_id)?.nombre ?? 'área'}` : ''}
                      {n.plantilla_id ? ` · Se ejecuta con: ${formato(n.plantilla_id) ?? 'formato'}` : ' · Se marca a mano'}
                      {` · Frecuencia: ${n.frecuencia ? NOMBRE_FRECUENCIA_ACTIVIDAD[n.frecuencia] : 'manual'}`}
                      {n.observaciones ? ` · ${n.observaciones}` : ''}
                    </small>
                  )}
                </div>
                {puedeCambiar && (
                  <span className="lista-acciones">
                    <button className="btn-link" type="button" aria-label="Editar" onClick={() => setEditando(editando === n.id ? null : n.id)}><Pencil size={16} aria-hidden="true" /></button>
                    {n.tipo !== 'objetivo_general' && (
                      <>
                        <button className="btn-link" type="button" aria-label="Subir" onClick={() => void hacer((motivo) => moverNodo(n.id, { direccion: 'subir', motivo: motivo ?? undefined }))}><ArrowUp size={16} aria-hidden="true" /></button>
                        <button className="btn-link" type="button" aria-label="Bajar" onClick={() => void hacer((motivo) => moverNodo(n.id, { direccion: 'bajar', motivo: motivo ?? undefined }))}><ArrowDown size={16} aria-hidden="true" /></button>
                        <button className="btn-link" type="button" aria-label="Dar de baja"
                          onClick={() => window.confirm(`¿Dar de baja «${n.texto}» y todo lo que tiene debajo?`) && void hacer((motivo) => bajaNodo(n.id, motivo))}><Trash2 size={16} aria-hidden="true" /></button>
                      </>
                    )}
                    {hijo && <button className="btn-link" type="button" onClick={() => setAgregando(agregando === n.id ? null : n.id)}><Plus size={16} aria-hidden="true" /> {NOMBRE_TIPO[hijo]}</button>}
                  </span>
                )}
              </div>
              {editando === n.id && (
                <FormNodo esAdmin={esAdmin} d={d} nodo={n} tipo={n.tipo} padreId={n.padre_id} arbol={arbol} personas={personas} formatos={formatos} areas={areas} hacer={hacer} onListo={() => setEditando(null)} />
              )}
              {agregando === n.id && hijo && (
                <FormNodo esAdmin={esAdmin} d={d} nodo={null} tipo={hijo} padreId={n.id} arbol={arbol} personas={personas} formatos={formatos} areas={areas} hacer={hacer} onListo={() => setAgregando(null)} />
              )}
            </li>
          )
        })}
      </ul>
    </Seccion>
  )
}

function FormNodo({ esAdmin, d, nodo, tipo, padreId, arbol, personas, formatos, areas, hacer, onListo }: {
  esAdmin: boolean; d: DatosPrograma; nodo: Nodo | null; tipo: Nodo['tipo']; padreId: string | null; arbol: NodoNumerado<Nodo>[]; personas: Responsable[]
  formatos: { id: string; nombre: string; vigente: boolean }[]; areas: Area[]; hacer: Hacer; onListo: () => void
}) {
  const [texto, setTexto] = useState(nodo?.texto ?? '')
  const [recursos, setRecursos] = useState(nodo?.recursos ?? '')
  const [resp, setResp] = useState(nodo?.responsable_id ?? '')
  const [meta, setMeta] = useState(String(Number(nodo?.meta_pct ?? 100)))
  const [obs, setObs] = useState(nodo?.observaciones ?? '')
  const [plantilla, setPlantilla] = useState(nodo?.plantilla_id ?? '')
  const [unidad, setUnidad] = useState(nodo?.unidad_id ?? '')
  const [frecuencia, setFrecuencia] = useState<string>(nodo?.frecuencia ?? '')
  const [mover, setMover] = useState('')
  const metasIniciales = nodo ? d.metas.filter((m) => m.nodo_id === nodo.id).map((m) => ({ texto: m.texto, indicador: m.indicador ?? '' })) : []
  const [metas, setMetas] = useState(metasIniciales.length ? metasIniciales : [{ texto: '', indicador: '' }])
  const tipoPadre = arbol.find((x) => x.id === padreId)?.tipo
  const otrosPadres = nodo && tipoPadre ? arbol.filter((x) => x.tipo === tipoPadre && x.id !== padreId) : []

  async function guardar() {
    const datos = { tipo, padre_id: padreId, texto, recursos, responsable_id: resp || null, meta_pct: meta, observaciones: obs, plantilla_id: plantilla || null, unidad_id: unidad || null, frecuencia: frecuencia || null }
    const ok = await hacer(async (motivo) => {
      const id = await guardarNodo(d.programa.id, nodo?.id ?? null, { ...datos, motivo })
      if (tipo === 'objetivo_especifico') await guardarMetas(id, metas, motivo)
      if (nodo && mover) await moverNodo(nodo.id, { padre_id: mover, motivo: motivo ?? undefined })
    })
    if (ok) onListo()
  }

  return (
    <div className="form subform">
      <label className="field">
        <span>{NOMBRE_TIPO[tipo]}</span>
        <textarea rows={2} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      {tipo === 'objetivo_especifico' && (
        <>
          <label className="field">
            <span>Recursos</span>
            <input type="text" maxLength={1000} value={recursos} onChange={(e) => setRecursos(e.target.value)} />
          </label>
          <p className="nota">Metas (hasta 5), cada una con su indicador:</p>
          {metas.map((m, k) => (
            <div key={k} className="fila2">
              <input type="text" aria-label={`Meta ${k + 1}`} placeholder={`Meta ${k + 1}`} maxLength={400} value={m.texto}
                onChange={(e) => setMetas(metas.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)))} />
              <input type="text" aria-label={`Indicador ${k + 1}`} placeholder="Indicador" maxLength={400} value={m.indicador}
                onChange={(e) => setMetas(metas.map((x, j) => (j === k ? { ...x, indicador: e.target.value } : x)))} />
            </div>
          ))}
          {metas.length < 5 && <button className="btn-link" type="button" onClick={() => setMetas([...metas, { texto: '', indicador: '' }])}><Plus size={16} aria-hidden="true" /> Otra meta</button>}
        </>
      )}
      {tipo === 'actividad' && (
        <div className="fila3">
          <label className="field">
            <span>Responsable</span>
            <select value={resp} onChange={(e) => setResp(e.target.value)}>
              <option value="">— Sin responsable —</option>
              {personas.map((x) => (
                <option key={x.persona_id} value={x.persona_id}>
                  {x.apellidos_nombres} ({x.rol === 'admin_empresa' ? 'administrador' : 'gestor'})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Meta (%)</span>
            <input type="number" min={0} max={100} value={meta} onChange={(e) => setMeta(e.target.value)} />
          </label>
          <label className="field">
            <span>Formato vinculado (referencia, opcional)</span>
            <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)}>
              <option value="">— Ninguno (se marca a mano) —</option>
              {formatos.filter((f) => f.vigente || f.id === plantilla).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          {/* Área de la actividad (revisión LOTO, 29/10/2026): p. ej. estrategia «Eficacia LOTO» con una actividad por área. */}
          <label className="field">
            <span>Área (opcional)</span>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="">— Cualquier área —</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {'\u00a0\u00a0'.repeat(a.profundidad)}{a.nombre}
                </option>
              ))}
            </select>
          </label>
          {/* Frecuencia de la actividad (pedido del dueño, 29/10/2026): periódica o manual. Solo el administrador la cambia. */}
          <label className="field">
            <span>Frecuencia de la actividad</span>
            <select value={frecuencia} disabled={!esAdmin} onChange={(e) => setFrecuencia(e.target.value)}>
              <option value="">Manual: elijo las semanas o meses en el calendario</option>
              {Object.entries(NOMBRE_FRECUENCIA_ACTIVIDAD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} (se programa solo)
                </option>
              ))}
            </select>
            {!esAdmin && <small className="ayuda">Solo el administrador de la empresa cambia la frecuencia.</small>}
          </label>
          <label className="field">
            <span>Observaciones</span>
            <input type="text" maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          {plantilla && unidad && <p className="nota">Se ejecuta sola con una inspección de ese formato hecha en esa área (o en una subárea) en la semana programada.</p>}
        </div>
      )}
      {otrosPadres.length > 0 && (
        <label className="field">
          <span>Cambiar de lugar (opcional)</span>
          <select value={mover} onChange={(e) => setMover(e.target.value)}>
            <option value="">— Se queda donde está —</option>
            {otrosPadres.map((x) => (
              <option key={x.id} value={x.id}>
                {NOMBRE_TIPO[x.tipo]} {x.numero} · {x.texto.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="acciones">
        <button className="btn" type="button" disabled={!texto.trim()} onClick={() => void guardar()}>Guardar</button>
        <button className="btn-link" type="button" onClick={onListo}>Cancelar</button>
      </div>
    </div>
  )
}

// ───────────────────────── Calendario ─────────────────────────

function Calendario({ d, arbol, puedeCambiar, permisos, nombre, formatos, areas, hacer }: {
  d: DatosPrograma; arbol: NodoNumerado<Nodo>[]; puedeCambiar: boolean; permisos: PermisosPasst; nombre: (id: string | null) => string
  formatos: { id: string; nombre: string; vigente: boolean }[]; areas: Area[]; hacer: Hacer
}) {
  const p = d.programa
  // Por defecto se ve el mes en que estamos (0 = todo el año); el mes y la semana de hoy se resaltan en pastel.
  const [mes, setMes] = useState(() => mesDeHoy(d.programa.anio, hoyLocal()))
  const [marcando, setMarcando] = useState<{ actividad: Nodo; semana: number } | null>(null)
  const semanas = useMemo(() => semanasConMes(p.anio), [p.anio])
  // Por mes: una casilla por mes (en su primera semana); por semana: todas las semanas, o las de un mes.
  const porMesSeg = p.seguimiento === 'mes'
  const visibles = porMesSeg ? MESES.map((_, k) => semanas.find((s) => s.mes === k + 1)).filter((s): s is NonNullable<typeof s> => Boolean(s))
    : mes ? semanas.filter((s) => s.mes === mes) : semanas
  const estados = useMemo(() => estadosPorActividad(d.semanas, d.ejecucion, p.anio, hoyLocal(), p.seguimiento), [d, p.anio, p.seguimiento])
  const actividades = arbol.filter((n) => n.tipo === 'actividad')
  const porMes = totalesPorMes(estados, actividades.map((a) => a.id), p.anio)
  const general = totalGeneral(porMes)
  const meta = Number(p.meta_cumplimiento)
  const puedeProgramar = puedeCambiar && permisos.admin // programar semanas o meses a mano: solo el administrador
  const puedeMarcar = (a: Nodo) => permisos.admin || (!a.plantilla_id && a.responsable_id === permisos.cuenta)
  const estado = (a: string, w: number): EstadoSemana | undefined => estados.get(a)?.get(w)
  const hoy = hoyLocal()
  const semHoy = semanaActual(p.anio, hoy)
  const mesHoy = mesDeHoy(p.anio, hoy)
  // Columna de hoy: la semana actual (por semana) o el mes actual (por mes).
  const esHoy = (s: { semana: number; mes: number }) => (porMesSeg ? s.mes === mesHoy && semHoy > 0 && semHoy < 99 : s.semana === semHoy)

  return (
    <Seccion titulo="Calendario: programado (P) y ejecutado (E)">
      <div className="fila-entre no-imprimir">
        {!porMesSeg && <label className="field campo-fecha">
          <span>Ver</span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todo el año ({semanas.length} semanas)</option>
            {MESES_LARGOS.map((m, k) => (
              <option key={m} value={k + 1}>{m}</option>
            ))}
          </select>
        </label>}
        <p className="nota leyenda">
          <span className="c-p">P</span> programada · <span className="c-e">✓</span> ejecutada · <span className="c-v">!</span> vencida · <span className="c-x">✓</span> ejecutada sin programar
          {puedeProgramar ? ' · Toca una casilla P para programar o quitar (solo el administrador; la actividad pasa a manual).' : ''}
        </p>
      </div>
      {!actividades.length ? (
        <p className="nota">Todavía no hay actividades. Agrégalas en «Objetivos y actividades».</p>
      ) : (
        <div className="grilla-scroll">
          <table className="grilla-passt">
            <thead>
              <tr>
                <th rowSpan={2} className="col-act">Actividad</th>
                <th rowSpan={2} className="col-pe">P/E</th>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <th key={m} colSpan={n} rowSpan={porMesSeg ? 2 : 1} className={k + 1 === mesHoy && semHoy > 0 && semHoy < 99 ? 'mes-hoy' : ''}>{m}</th> : null
                })}
                <th rowSpan={2} className="col-av">#</th>
                <th rowSpan={2} className="col-pct">%</th>
                <th rowSpan={2} className="col-meta">Meta</th>
              </tr>
              {!porMesSeg && (
                <tr>
                  {visibles.map((s) => <th key={s.semana} className={`col-sem ${esHoy(s) ? 'col-hoy' : ''}`}>{s.semana}</th>)}
                </tr>
              )}
            </thead>
            <tbody>
              {arbol.filter((n) => n.tipo !== 'objetivo_general').map((n) => {
                if (n.tipo !== 'actividad') return (
                  <tr key={n.id} className={`fila-${n.tipo}`}>
                    {/* El texto queda fijo a la izquierda (junto a Actividad y P/E) y solo se mueven los meses. */}
                    <td colSpan={2} className="col-fijo-texto">{n.numero} {n.texto}</td>
                    <td colSpan={visibles.length + 1} className="relleno-fila" />
                    {/* % y meta del objetivo o la estrategia: el promedio de sus actividades. */}
                    {(() => {
                      const pr = promedioDe(arbol, arbol.indexOf(n), estados)
                      return (
                        <>
                          <td className={`col-pct ${pr.pct == null || pr.meta == null ? '' : pr.pct >= pr.meta ? 'pct-ok' : 'pct-bajo'}`}>{pr.pct == null ? '—' : `${pr.pct} %`}</td>
                          <td className="col-meta">{pr.meta == null ? '—' : `${pr.meta} %`}</td>
                        </>
                      )
                    })()}
                  </tr>
                )
                const t = totalesActividad(estados.get(n.id))
                const alcanza = t.pct != null && t.pct >= Number(n.meta_pct ?? 100)
                return (
                  <Fragment key={n.id}>
                    <tr>
                      <td rowSpan={2} className="col-act">
                        <b>{n.numero}</b> {n.texto}
                        <small>
                          {nombre(n.responsable_id)}{n.plantilla_id ? ` · ${formatos.find((f) => f.id === n.plantilla_id)?.nombre ?? 'formato'}` : ''}
                          {n.unidad_id ? ` · Área: ${areas.find((a) => a.id === n.unidad_id)?.nombre ?? 'área'}` : ''}
                        </small>
                      </td>
                      <td className="col-pe">P</td>
                      {visibles.map((s) => {
                        const e = estado(n.id, s.semana)
                        return (
                          <td key={s.semana} className={`celda ${e?.programada ? 'c-p' : ''} ${esHoy(s) ? 'col-hoy' : ''}`}>
                            {puedeProgramar ? (
                              <button type="button" aria-label={`${porMesSeg ? MESES_LARGOS[s.mes - 1] : `Semana ${s.semana}`}: ${e?.programada ? 'quitar' : 'programar'}`} aria-pressed={Boolean(e?.programada)}
                                onClick={() => void hacer((motivo) => programarSemana(n.id, s.semana, !e?.programada, motivo))}>
                                {e?.programada ? 'P' : ''}
                              </button>
                            ) : e?.programada ? 'P' : ''}
                          </td>
                        )
                      })}
                      <td className="col-av">{t.programadas}</td>
                      <td rowSpan={2} className={`col-pct ${t.pct == null ? '' : alcanza ? 'pct-ok' : 'pct-bajo'}`}>{textoPct(t)}</td>
                      <td rowSpan={2} className="col-meta">{Number(n.meta_pct ?? 100)} %</td>
                    </tr>
                    <tr>
                      <td className="col-pe">E</td>
                      {visibles.map((s) => {
                        const e = estado(n.id, s.semana)
                        const clase = e?.ejecutada ? (e.programada ? 'c-e' : 'c-x') : e?.vencida ? 'c-v' : ''
                        const titulo = e?.inspecciones ? `${e.inspecciones} inspección(es)` : e?.manual ? 'Marcada a mano' : e?.vencida ? 'Vencida' : ''
                        return (
                          <td key={s.semana} className={`celda ${clase} ${esHoy(s) ? 'col-hoy' : ''}`} title={titulo}>
                            {puedeMarcar(n) && !e?.inspecciones ? (
                              <button type="button" aria-label={`${porMesSeg ? MESES_LARGOS[s.mes - 1] : `Semana ${s.semana}`}: ejecutado`} onClick={() => setMarcando({ actividad: n, semana: s.semana })}>
                                {e?.ejecutada ? '✓' : e?.vencida ? '!' : ''}
                              </button>
                            ) : e?.ejecutada ? '✓' : e?.vencida ? '!' : ''}
                          </td>
                        )
                      })}
                      <td className="col-av">{t.ejecutadas}{t.fuera ? `+${t.fuera}` : ''}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="col-fijo-texto">Programadas</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <td key={m} colSpan={n}>{porMes[k].programadas}</td> : null
                })}
                <td colSpan={3} className="col-total">{general.programadas}</td>
              </tr>
              <tr>
                <td colSpan={2} className="col-fijo-texto">Ejecutadas</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <td key={m} colSpan={n}>{porMes[k].ejecutadas}</td> : null
                })}
                <td colSpan={3} className="col-total">{general.ejecutadas}{general.fuera ? `+${general.fuera}` : ''}</td>
              </tr>
              <tr>
                <td colSpan={2} className="col-fijo-texto">% de cumplimiento (meta {meta} %)</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  const t = porMes[k]
                  return n ? <td key={m} colSpan={n} className={t.pct == null ? '' : t.pct >= meta ? 'pct-ok' : 'pct-bajo'}>{textoPct(t)}</td> : null
                })}
                <td colSpan={3} className={`col-total ${general.pct == null ? '' : general.pct >= meta ? 'pct-ok' : 'pct-bajo'}`}>{textoPct(general)} · meta {meta} %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {marcando && (
        <MarcaManual programa={d} actividad={marcando.actividad} semana={marcando.semana} estado={estado(marcando.actividad.id, marcando.semana)}
          onListo={() => setMarcando(null)} hacer={hacer} />
      )}
    </Seccion>
  )
}

function MarcaManual({ programa, actividad, semana, estado, onListo, hacer }: {
  programa: DatosPrograma; actividad: Nodo; semana: number; estado: EstadoSemana | undefined; onListo: () => void; hacer: Hacer
}) {
  const [comentario, setComentario] = useState('')
  const [foto, setFoto] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const guardada = programa.semanas.find((s) => s.actividad_id === actividad.id && s.semana === semana)
  const n = { id: actividad.id, empresa_id: programa.programa.empresa_id }
  // Marcar lo ejecutado no es reprogramar: no pide el motivo de cambio del programa aprobado.
  const marcar = (ejecutada: boolean) =>
    void hacer(() => marcarSemana(n, semana, ejecutada, ejecutada ? comentario : 'Se quitó la marca', ejecutada ? foto : null), true).then((ok) => ok && onListo())
  return (
    <div className="panel-hallazgo marca-manual">
      <b>Semana {semana} · {actividad.texto}</b>
      {estado?.manual && guardada ? (
        <>
          <p className="nota">Marcada a mano el {fechaHora(guardada.manual_en!)}: {guardada.manual_comentario}</p>
          <div className="acciones">
            <button className="btn-link peligro" type="button" onClick={() => marcar(false)}>Quitar la marca</button>
            <button className="btn-link" type="button" onClick={onListo}>Cerrar</button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Qué se hizo</span>
            <textarea rows={2} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </label>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <label className="btn-link boton-foto">
              {foto ? `Foto lista (${Math.round(foto.size / 1024)} KB)` : 'Agregar foto (opcional)'}
              <input type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => {
                  const a = e.target.files?.[0]
                  e.target.value = ''
                  if (a) prepararFoto(a).then((f) => setFoto(f.blob), (err) => setError((err as Error).message))
                }} />
            </label>
            <button className="btn" type="button" disabled={comentario.trim().length < 3} onClick={() => marcar(true)}>Marcar ejecutada</button>
            <button className="btn-link" type="button" onClick={onListo}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  )
}

// ───────────────────────── Hoja para imprimir ─────────────────────────

