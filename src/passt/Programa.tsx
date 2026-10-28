import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Aviso, Seccion } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { leerCopia } from '../inspecciones/campo'
import { prepararFoto } from '../inspecciones/imagen'
import { semanasConMes } from '../inspecciones/periodos'
import { ir } from '../ruta'
import { type EstadoSemana, estadosPorActividad, textoPct, totalesActividad, totalesPorMes } from './calculo'
import {
  type DatosPrograma, HIJO_DE, NOMBRE_TIPO, type Nodo, type Responsable, aprobarPrograma, bajaNodo, formatosDeEmpresa, guardarMetas, guardarNodo,
  guardarPrograma, leerPrograma, marcarSemana, moverNodo, programarSemana, responsables, trabajadores,
} from './datos'
import { type NodoNumerado, numerar } from './numeracion'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
type Pestana = 'estructura' | 'calendario' | 'historial'

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
  const [motivo, setMotivo] = useState('')
  const [empresa, setEmpresa] = useState<{ razon_social: string; ruc: string; domicilio: string; actividad: string } | null>(null)
  const [nTrabajadores, setNTrabajadores] = useState<number | null>(null)

  const cargar = useCallback(() => {
    leerPrograma(id).then(setD, (e) => setError((e as Error).message))
  }, [id])
  useEffect(() => {
    if (!online) return
    cargar()
    responsables(empresaId).then(setPersonas, () => {})
    formatosDeEmpresa(empresaId).then(setFormatos, () => {})
    trabajadores(empresaId).then(setNTrabajadores, () => {})
    void leerCopia(permisos.cuenta, empresaId).then((c) => c && setEmpresa(c.empresa))
  }, [online, cargar, empresaId, permisos.cuenta])

  const nombre = useMemo(() => {
    const m = new Map(personas.map((p) => [p.persona_id, p.apellidos_nombres]))
    return (pid: string | null) => (!pid ? 'Sin responsable' : (m.get(pid) ?? 'Persona de la empresa'))
  }, [personas])

  if (!online && !d) return <p className="nota">El programa anual se ve con señal.</p>
  if (!d) return error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>

  const p = d.programa
  const aprobado = p.estado === 'aprobado'
  const puedeCambiar = permisos.editar && (!aprobado || permisos.admin)
  const motivoListo = !aprobado || motivo.trim().length >= 3
  const arbol = numerar(d.nodos)

  // Hace una acción y vuelve a leer. Si el programa está aprobado, exige el motivo.
  async function hacer(fn: (motivo: string | null) => Promise<unknown>, sinMotivo = false): Promise<boolean> {
    setError(null)
    if (!motivoListo && !sinMotivo) {
      setError('El programa está aprobado: escribe arriba el motivo del cambio.')
      return false
    }
    try {
      await fn(aprobado ? motivo.trim() : null)
      cargar()
      return true
    } catch (e) {
      setError((e as Error).message)
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
          <button className="btn-link" type="button" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" /> Imprimir
          </button>
        </span>
      </header>
      <Aviso>{error}</Aviso>
      {aprobado && permisos.admin && (
        <label className="field aviso-suave motivo-cambio">
          <span>Programa aprobado: para cambiar semanas o la estructura, escribe el motivo (queda en el historial)</span>
          <input type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del cambio" />
        </label>
      )}
      {aprobado && !permisos.admin && <p className="nota">El programa está aprobado: solo el administrador lo cambia. Puedes marcar tus actividades sin formato vinculado.</p>}

      <Encabezado d={d} empresa={empresa} nTrabajadores={nTrabajadores} puedeCambiar={puedeCambiar} hacer={hacer} />

      <div className="filtros no-imprimir" role="tablist">
        {(['calendario', 'estructura', 'historial'] as Pestana[]).map((t) => (
          <button key={t} type="button" role="tab" aria-pressed={pestana === t} onClick={() => setPestana(t)}>
            {t === 'calendario' ? 'Calendario (P / E)' : t === 'estructura' ? 'Objetivos y actividades' : 'Historial'}
          </button>
        ))}
      </div>

      {pestana === 'estructura' && <Estructura d={d} arbol={arbol} puedeCambiar={puedeCambiar} personas={personas} formatos={formatos} nombre={nombre} hacer={hacer} />}
      {pestana === 'calendario' && <Calendario d={d} arbol={arbol} puedeCambiar={puedeCambiar} permisos={permisos} nombre={nombre} formatos={formatos} hacer={hacer} />}
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
      {createPortal(<HojaPasst d={d} arbol={arbol} empresa={empresa} nTrabajadores={nTrabajadores} nombre={nombre} />, document.body)}
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

function Estructura({ d, arbol, puedeCambiar, personas, formatos, nombre, hacer }: {
  d: DatosPrograma; arbol: NodoNumerado<Nodo>[]; puedeCambiar: boolean; personas: Responsable[]; formatos: { id: string; nombre: string; vigente: boolean }[]
  nombre: (id: string | null) => string; hacer: Hacer
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
                      {n.plantilla_id ? ` · Se ejecuta con: ${formato(n.plantilla_id) ?? 'formato'}` : ' · Se marca a mano'}
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
                <FormNodo d={d} nodo={n} tipo={n.tipo} padreId={n.padre_id} arbol={arbol} personas={personas} formatos={formatos} hacer={hacer} onListo={() => setEditando(null)} />
              )}
              {agregando === n.id && hijo && (
                <FormNodo d={d} nodo={null} tipo={hijo} padreId={n.id} arbol={arbol} personas={personas} formatos={formatos} hacer={hacer} onListo={() => setAgregando(null)} />
              )}
            </li>
          )
        })}
      </ul>
    </Seccion>
  )
}

function FormNodo({ d, nodo, tipo, padreId, arbol, personas, formatos, hacer, onListo }: {
  d: DatosPrograma; nodo: Nodo | null; tipo: Nodo['tipo']; padreId: string | null; arbol: NodoNumerado<Nodo>[]; personas: Responsable[]
  formatos: { id: string; nombre: string; vigente: boolean }[]; hacer: Hacer; onListo: () => void
}) {
  const [texto, setTexto] = useState(nodo?.texto ?? '')
  const [recursos, setRecursos] = useState(nodo?.recursos ?? '')
  const [resp, setResp] = useState(nodo?.responsable_id ?? '')
  const [meta, setMeta] = useState(String(Number(nodo?.meta_pct ?? 100)))
  const [obs, setObs] = useState(nodo?.observaciones ?? '')
  const [plantilla, setPlantilla] = useState(nodo?.plantilla_id ?? '')
  const [mover, setMover] = useState('')
  const metasIniciales = nodo ? d.metas.filter((m) => m.nodo_id === nodo.id).map((m) => ({ texto: m.texto, indicador: m.indicador ?? '' })) : []
  const [metas, setMetas] = useState(metasIniciales.length ? metasIniciales : [{ texto: '', indicador: '' }])
  const tipoPadre = arbol.find((x) => x.id === padreId)?.tipo
  const otrosPadres = nodo && tipoPadre ? arbol.filter((x) => x.tipo === tipoPadre && x.id !== padreId) : []

  async function guardar() {
    const datos = { tipo, padre_id: padreId, texto, recursos, responsable_id: resp || null, meta_pct: meta, observaciones: obs, plantilla_id: plantilla || null }
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
            <span>Se ejecuta con el formato</span>
            <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)}>
              <option value="">— Ninguno (se marca a mano) —</option>
              {formatos.filter((f) => f.vigente || f.id === plantilla).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Observaciones</span>
            <input type="text" maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
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

function Calendario({ d, arbol, puedeCambiar, permisos, nombre, formatos, hacer }: {
  d: DatosPrograma; arbol: NodoNumerado<Nodo>[]; puedeCambiar: boolean; permisos: PermisosPasst; nombre: (id: string | null) => string
  formatos: { id: string; nombre: string; vigente: boolean }[]; hacer: Hacer
}) {
  const p = d.programa
  const [mes, setMes] = useState(0) // 0 = todo el año
  const [marcando, setMarcando] = useState<{ actividad: Nodo; semana: number } | null>(null)
  const semanas = useMemo(() => semanasConMes(p.anio), [p.anio])
  const visibles = mes ? semanas.filter((s) => s.mes === mes) : semanas
  const estados = useMemo(() => estadosPorActividad(d.semanas, d.ejecucion, p.anio, hoyLocal()), [d, p.anio])
  const actividades = arbol.filter((n) => n.tipo === 'actividad')
  const porMes = totalesPorMes(estados, actividades.map((a) => a.id), p.anio)
  const meta = Number(p.meta_cumplimiento)
  const hallazgos = new Map(d.hallazgos.map((h) => [h.actividad_id, h]))
  const puedeMarcar = (a: Nodo) => permisos.admin || (!a.plantilla_id && a.responsable_id === permisos.cuenta)
  const estado = (a: string, w: number): EstadoSemana | undefined => estados.get(a)?.get(w)

  return (
    <Seccion titulo="Calendario: programado (P) y ejecutado (E)">
      <div className="fila-entre no-imprimir">
        <label className="field campo-fecha">
          <span>Ver</span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            <option value={0}>Todo el año ({semanas.length} semanas)</option>
            {MESES_LARGOS.map((m, k) => (
              <option key={m} value={k + 1}>{m}</option>
            ))}
          </select>
        </label>
        <p className="nota leyenda">
          <span className="c-p">P</span> programada · <span className="c-e">✓</span> ejecutada · <span className="c-v">!</span> vencida · <span className="c-x">✓</span> ejecutada sin programar
          {puedeCambiar ? ' · Toca una casilla P para programar o quitar.' : ''}
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
                <th rowSpan={2}>P/E</th>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <th key={m} colSpan={n}>{m}</th> : null
                })}
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>%</th>
                <th rowSpan={2}>Meta</th>
              </tr>
              <tr>
                {visibles.map((s) => <th key={s.semana} className="col-sem">{s.semana}</th>)}
              </tr>
            </thead>
            <tbody>
              {arbol.filter((n) => n.tipo !== 'objetivo_general').map((n) => {
                if (n.tipo !== 'actividad') return (
                  <tr key={n.id} className={`fila-${n.tipo}`}>
                    <td colSpan={visibles.length + 5}>{n.numero} {n.texto}</td>
                  </tr>
                )
                const t = totalesActividad(estados.get(n.id))
                const h = hallazgos.get(n.id)
                const alcanza = t.pct != null && t.pct >= Number(n.meta_pct ?? 100)
                return (
                  <Fragment key={n.id}>
                    <tr>
                      <td rowSpan={2} className="col-act">
                        <b>{n.numero}</b> {n.texto}
                        <small>{nombre(n.responsable_id)}{n.plantilla_id ? ` · ${formatos.find((f) => f.id === n.plantilla_id)?.nombre ?? 'formato'}` : ''}</small>
                        {h && h.abiertos > 0 && (
                          <button className="btn-link mini" type="button" onClick={() => ir('/hallazgos')}>
                            {h.abiertos} hallazgo(s) abierto(s){h.vencidos ? `, ${h.vencidos} vencido(s)` : ''}
                          </button>
                        )}
                      </td>
                      <td>P</td>
                      {visibles.map((s) => {
                        const e = estado(n.id, s.semana)
                        return (
                          <td key={s.semana} className={`celda ${e?.programada ? 'c-p' : ''}`}>
                            {puedeCambiar ? (
                              <button type="button" aria-label={`Semana ${s.semana}: ${e?.programada ? 'quitar' : 'programar'}`} aria-pressed={Boolean(e?.programada)}
                                onClick={() => void hacer((motivo) => programarSemana(n.id, s.semana, !e?.programada, motivo))}>
                                {e?.programada ? 'P' : ''}
                              </button>
                            ) : e?.programada ? 'P' : ''}
                          </td>
                        )
                      })}
                      <td>{t.programadas}</td>
                      <td rowSpan={2} className={t.pct == null ? '' : alcanza ? 'pct-ok' : 'pct-bajo'}>{textoPct(t)}</td>
                      <td rowSpan={2}>{Number(n.meta_pct ?? 100)} %</td>
                    </tr>
                    <tr>
                      <td>E</td>
                      {visibles.map((s) => {
                        const e = estado(n.id, s.semana)
                        const clase = e?.ejecutada ? (e.programada ? 'c-e' : 'c-x') : e?.vencida ? 'c-v' : ''
                        const titulo = e?.inspecciones ? `${e.inspecciones} inspección(es)` : e?.manual ? 'Marcada a mano' : e?.vencida ? 'Vencida' : ''
                        return (
                          <td key={s.semana} className={`celda ${clase}`} title={titulo}>
                            {puedeMarcar(n) && !e?.inspecciones ? (
                              <button type="button" aria-label={`Semana ${s.semana}: ejecutado`} onClick={() => setMarcando({ actividad: n, semana: s.semana })}>
                                {e?.ejecutada ? '✓' : e?.vencida ? '!' : ''}
                              </button>
                            ) : e?.ejecutada ? '✓' : e?.vencida ? '!' : ''}
                          </td>
                        )
                      })}
                      <td>{t.ejecutadas}{t.fuera ? `+${t.fuera}` : ''}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Programadas</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <td key={m} colSpan={n}>{porMes[k].programadas}</td> : null
                })}
                <td colSpan={3} />
              </tr>
              <tr>
                <td colSpan={2}>Ejecutadas</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  return n ? <td key={m} colSpan={n}>{porMes[k].ejecutadas}</td> : null
                })}
                <td colSpan={3} />
              </tr>
              <tr>
                <td colSpan={2}>% de cumplimiento (meta {meta} %)</td>
                {MESES.map((m, k) => {
                  const n = visibles.filter((s) => s.mes === k + 1).length
                  const t = porMes[k]
                  return n ? <td key={m} colSpan={n} className={t.pct == null ? '' : t.pct >= meta ? 'pct-ok' : 'pct-bajo'}>{textoPct(t)}</td> : null
                })}
                <td colSpan={3} />
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

function HojaPasst({ d, arbol, empresa, nTrabajadores, nombre }: { d: DatosPrograma; arbol: NodoNumerado<Nodo>[]; empresa: { razon_social: string; ruc: string; domicilio: string; actividad: string } | null; nTrabajadores: number | null; nombre: (id: string | null) => string }) {
  const p = d.programa
  const semanas = semanasConMes(p.anio)
  const estados = estadosPorActividad(d.semanas, d.ejecucion, p.anio, hoyLocal())
  const actividades = arbol.filter((n) => n.tipo === 'actividad')
  const porMes = totalesPorMes(estados, actividades.map((a) => a.id), p.anio)
  return (
    <div className="hoja-entrega hoja-passt">
      <h1>{p.nombre}</h1>
      <p>
        {empresa?.razon_social} · RUC {empresa?.ruc} · {empresa?.domicilio} · {empresa?.actividad} · N.° de trabajadores: {nTrabajadores ?? '—'}
        {p.codigo_formato ? ` · Código ${p.codigo_formato}` : ''}{p.version_formato ? ` · Versión ${p.version_formato}` : ''}
        {p.fecha_aprobacion ? ` · Aprobado ${p.fecha_aprobacion.split('-').reverse().join('/')}` : ''}
      </p>
      <table>
        <thead>
          <tr>
            <th>Actividad</th><th>Responsable</th><th>P/E</th>
            {semanas.map((s) => <th key={s.semana}>{s.semana}</th>)}
            <th>#</th><th>%</th><th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {arbol.map((n) => {
            if (n.tipo !== 'actividad') {
              const metas = d.metas.filter((m) => m.nodo_id === n.id)
              return (
                <tr key={n.id}>
                  <td colSpan={semanas.length + 6}>
                    <b>{n.tipo === 'objetivo_general' ? 'OBJETIVO GENERAL' : `${NOMBRE_TIPO[n.tipo]} ${n.numero}`}:</b> {n.texto}
                    {n.recursos ? ` · Recursos: ${n.recursos}` : ''}
                    {metas.map((m) => ` · Meta ${m.orden}: ${m.texto}${m.indicador ? ` (indicador: ${m.indicador})` : ''}`).join('')}
                  </td>
                </tr>
              )
            }
            const t = totalesActividad(estados.get(n.id))
            return (
              <Fragment key={n.id}>
                <tr>
                  <td rowSpan={2}>{n.numero} {n.texto}</td>
                  <td rowSpan={2}>{nombre(n.responsable_id)}</td>
                  <td>P</td>
                  {semanas.map((s) => <td key={s.semana}>{estados.get(n.id)?.get(s.semana)?.programada ? 'P' : ''}</td>)}
                  <td>{t.programadas}</td>
                  <td rowSpan={2}>{textoPct(t)}</td>
                  <td rowSpan={2}>{Number(n.meta_pct ?? 100)} %</td>
                </tr>
                <tr>
                  <td>E</td>
                  {semanas.map((s) => <td key={s.semana}>{estados.get(n.id)?.get(s.semana)?.ejecutada ? 'E' : ''}</td>)}
                  <td>{t.ejecutadas}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <table>
        <thead><tr><th>Mes</th>{MESES.map((m) => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>
          <tr><td>Programadas</td>{porMes.map((t, k) => <td key={k}>{t.programadas}</td>)}</tr>
          <tr><td>Ejecutadas</td>{porMes.map((t, k) => <td key={k}>{t.ejecutadas}</td>)}</tr>
          <tr><td>% de cumplimiento (meta {Number(p.meta_cumplimiento)} %)</td>{porMes.map((t, k) => <td key={k}>{textoPct(t)}</td>)}</tr>
        </tbody>
      </table>
      <table className="firmas-papel">
        <thead><tr><th>Cargo</th><th>Nombre y apellidos</th><th>Firma</th></tr></thead>
        <tbody>
          {['Jefe de Seguridad y Salud Ocupacional', 'Gerente de planta', 'Gerente general', 'Miembro del Comité SST', 'Presidente del Comité SST'].map((c) => (
            <tr key={c}><td>{c}</td><td /><td /></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
