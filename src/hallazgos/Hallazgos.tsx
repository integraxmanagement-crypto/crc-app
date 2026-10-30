import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ChevronUp, Eye, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { type PersonaLista, listarPersonas } from '../formatos/datos'
import { hoyLocal } from '../inspecciones/ayudas'
import { enlaceEvidencia } from '../inspecciones/datos'
import { prepararFoto } from '../inspecciones/imagen'
import { ir } from '../ruta'
import {
  type CambioHallazgo, type EstadoHallazgo, type Hallazgo, NOMBRE_CAMBIO, NOMBRE_ESTADO_HALLAZGO, cerrarHallazgo, gestionarHallazgo, hallazgoEnProceso,
  historialHallazgo, listarHallazgos, reabrirHallazgo, vencido,
} from './datos'

type Filtro = 'pendientes' | 'vencidos' | 'cerrados' | 'anulados' | 'todos'
const FILTROS: [Filtro, string][] = [['pendientes', 'Abiertos y en proceso'], ['vencidos', 'Vencidos'], ['cerrados', 'Cerrados'], ['anulados', 'Anulados'], ['todos', 'Todos']]
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
const CLASE: Record<EstadoHallazgo, string> = { abierto: 'chip-aviso', en_proceso: 'chip-aviso', cerrado: 'chip-ok', anulado: 'chip-gris' }

/**
 * Seguimiento de hallazgos (tarea 3.4-D, parte 2). El administrador y el gestor ven todos los de su empresa, asignan
 * responsable, plazo y acción, cierran y reabren. El usuario ve solo los suyos y los cierra con un comentario y una
 * foto opcional. Necesita señal en la v1 (decisión del dueño, 28/10/2026).
 */
export function Hallazgos({ empresaId, cuenta, gestiona, online, inspeccionId, fuenteFija, fuentes }: { empresaId: string; cuenta: string; gestiona: boolean; online: boolean; inspeccionId?: string; fuenteFija?: string; fuentes?: string[] }) {
  // «fuentes»: varios formatos juntos con el acumulado (bomba contra incendio: motobomba y electrobomba).
  const fijo = Boolean(fuenteFija || fuentes)
  const [lista, setLista] = useState<Hallazgo[] | null>(null)
  const [personas, setPersonas] = useState<PersonaLista[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(inspeccionId ? 'todos' : 'pendientes')
  const [responsable, setResponsable] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  // Primero las tarjetas por fuente (formato); al elegir una, el detalle de sus hallazgos (pedido del dueño, 29/10/2026).
  const [fuente, setFuente] = useState<string | 'todas' | null>(inspeccionId || fuentes ? 'todas' : (fuenteFija ?? null))
  const hoy = hoyLocal()

  const cargar = useCallback(() => {
    listarHallazgos(empresaId).then(setLista, (e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(() => {
    if (online) cargar()
  }, [online, cargar])
  useEffect(() => {
    if (online && gestiona) listarPersonas(empresaId, false).then(setPersonas, () => {})
  }, [online, gestiona, empresaId])

  const nombre = useMemo(() => {
    const m = new Map(personas.map((p) => [p.persona_id, p.apellidos_nombres]))
    return (id: string | null) => (!id ? 'Sin asignar' : id === cuenta ? 'Tú' : (m.get(id) ?? 'Persona de la empresa'))
  }, [personas, cuenta])

  const visibles = (lista ?? []).filter((h) => {
    if (inspeccionId && h.inspeccion_id !== inspeccionId) return false
    if (fuentes && !fuentes.includes(h.plantillas?.nombre ?? '')) return false
    if (fuente && fuente !== 'todas' && h.plantillas?.nombre !== fuente) return false
    if (responsable && (responsable === '-' ? h.responsable_id : h.responsable_id !== responsable)) return false
    if (filtro === 'pendientes') return h.estado === 'abierto' || h.estado === 'en_proceso'
    if (filtro === 'vencidos') return vencido(h, hoy)
    if (filtro === 'cerrados') return h.estado === 'cerrado'
    if (filtro === 'anulados') return h.estado === 'anulado'
    return true
  })
  const cuenta_ = (f: Filtro) => (lista ?? []).filter((h) => (inspeccionId ? h.inspeccion_id === inspeccionId : true) && (!fuentes || fuentes.includes(h.plantillas?.nombre ?? '')) && (fuente && fuente !== 'todas' ? h.plantillas?.nombre === fuente : true) && (
    f === 'pendientes' ? h.estado === 'abierto' || h.estado === 'en_proceso' : f === 'vencidos' ? vencido(h, hoy) : f === 'cerrados' ? h.estado === 'cerrado' : f === 'anulados' ? h.estado === 'anulado' : true)).length

  return (
    <div className="detalle">
      {!fijo && <header className="detalle-cab">
        <h1>{gestiona ? 'Hallazgos' : 'Mis hallazgos'}</h1>
        <p>
          {gestiona
            ? 'Nacen solos de las inspecciones. Asigna responsable, plazo y acción, y sigue su cierre.'
            : 'Los hallazgos que tienes asignados. Ciérralos contando qué se hizo; puedes agregar una foto.'}
        </p>
      </header>}
      {inspeccionId && (
        <p className="nota">
          Solo los de una inspección.{' '}
          <button className="btn-link" type="button" onClick={() => ir('/hallazgos')}>Ver todos</button>
        </p>
      )}
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="aviso-suave">Los hallazgos se ven y se cierran con señal (v1).</p>
      ) : !lista ? (
        !error && <p className="nota">Cargando…</p>
      ) : (
        fuente === null ? (
          <Fuentes lista={lista} onElegir={setFuente} />
        ) : (
        <>
          {!inspeccionId && !fijo && (
            <p className="nota">
              <button className="btn-link" type="button" onClick={() => (setFuente(null), setFiltro('pendientes'), setAbierto(null))}>
                <ArrowLeft size={16} aria-hidden="true" /> Todas las fuentes
              </button>
              {' · '}
              <b>{fuente === 'todas' ? 'Todos los hallazgos' : fuente}</b>
            </p>
          )}
          <div className="filtros" role="group" aria-label="Filtrar">
            {FILTROS.map(([f, t]) => (
              <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                {t} ({cuenta_(f)})
              </button>
            ))}
            {gestiona && (
              <select aria-label="Responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">Todos los responsables</option>
                <option value="-">Sin asignar</option>
                {personas.map((p) => (
                  <option key={p.persona_id} value={p.persona_id}>
                    {p.apellidos_nombres}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!visibles.length ? (
            <p className="nota">No hay hallazgos en esta lista.</p>
          ) : (
            <ul className="lista lista-hallazgos">
              {visibles.map((h) => (
                <li key={h.id} className={`con-panel ${h.estado === 'anulado' ? 'inactiva' : ''}`}>
                  {vencido(h, hoy) ? <AlertTriangle aria-hidden="true" className="icono-mal" /> : <CheckCircle2 aria-hidden="true" />}
                  <div>
                    <b>{h.texto}</b>
                    <span className={`chip ${CLASE[h.estado]}`}>{NOMBRE_ESTADO_HALLAZGO[h.estado]}</span>
                    {vencido(h, hoy) && <span className="chip chip-mal">Vencido</span>}
                    <small>
                      {h.activo_codigo ? `${h.activo_codigo} · ` : ''}
                      {h.plantillas?.nombre}
                      {h.inspeccion_numero ? ` · Inspección N.º ${h.inspeccion_numero}` : ''} · {h.sedes?.nombre} · desde el {fechaCorta(h.creado_en.slice(0, 10))}
                    </small>
                    <small>
                      Responsable: {nombre(h.responsable_id)} · Plazo: {h.plazo ? fechaCorta(h.plazo) : 'sin plazo'}
                      {h.accion ? ` · Acción: ${h.accion}` : ''}
                    </small>
                    {abierto === h.id && (
                      <PanelHallazgo h={h} gestiona={gestiona} cuenta={cuenta} personas={personas} nombre={nombre}
                        onCambio={() => cargar()} />
                    )}
                  </div>
                  <span className="lista-acciones">
                    <button className="btn-link" type="button" aria-expanded={abierto === h.id} onClick={() => setAbierto(abierto === h.id ? null : h.id)}>
                      {abierto === h.id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />} {abierto === h.id ? 'Cerrar panel' : 'Abrir'}
                    </button>
                    {gestiona && (
                      <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${h.inspeccion_id}`)}>
                        <Eye size={16} aria-hidden="true" /> Inspección
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
        )
      )}
    </div>
  )
}

function PanelHallazgo({ h, gestiona, cuenta, personas, nombre, onCambio }: {
  h: Hallazgo; gestiona: boolean; cuenta: string; personas: PersonaLista[]; nombre: (id: string | null) => string; onCambio: () => void
}) {
  const [historial, setHistorial] = useState<CambioHallazgo[] | null>(null)
  const [resp, setResp] = useState(h.responsable_id ?? '')
  const [plazo, setPlazo] = useState(h.plazo ?? '')
  const [accion, setAccion] = useState(h.accion ?? '')
  const [comentario, setComentario] = useState('')
  const [foto, setFoto] = useState<Blob | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fotoCierre, setFotoCierre] = useState<string | null>(null)
  const pendiente = h.estado === 'abierto' || h.estado === 'en_proceso'
  const puedeCerrar = pendiente && (gestiona || h.responsable_id === cuenta)

  useEffect(() => {
    historialHallazgo(h.id).then(setHistorial, () => setHistorial([]))
    if (h.cierre_foto_ruta) enlaceEvidencia(h.cierre_foto_ruta).then(setFotoCierre, () => {})
  }, [h.id, h.cierre_foto_ruta])

  async function hacer(fn: () => Promise<unknown>, texto: string) {
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      await fn()
      setOk(texto)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="panel-hallazgo">
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      {h.estado === 'anulado' && <p className="nota">Anulado: {h.anulado_motivo}</p>}
      {h.estado === 'cerrado' && (
        <p className="nota">
          Cerrado el {fechaHora(h.cerrado_en!)} por {nombre(h.cerrado_por)}: {h.cierre_comentario}
          {fotoCierre && (
            <>
              {' '}
              <a href={fotoCierre} target="_blank" rel="noreferrer">Ver foto de cierre</a>
            </>
          )}
        </p>
      )}

      {gestiona && pendiente && (
        <Seccion titulo="Responsable, plazo y acción">
          <div className="fila3">
            <label className="field">
              <span>Responsable</span>
              <select value={resp} onChange={(e) => setResp(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {personas.map((p) => (
                  <option key={p.persona_id} value={p.persona_id}>
                    {p.apellidos_nombres}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Plazo</span>
              <input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} />
            </label>
            <label className="field">
              <span>Acción correctiva</span>
              <input type="text" maxLength={1000} value={accion} onChange={(e) => setAccion(e.target.value)} />
            </label>
          </div>
          <button className="btn-sec" type="button" disabled={ocupado}
            onClick={() => void hacer(() => gestionarHallazgo(h.id, { responsable_id: resp || null, plazo: plazo || null, accion: accion || null }), 'Guardado.')}>
            Guardar
          </button>
        </Seccion>
      )}

      {puedeCerrar && (
        <Seccion titulo="Cerrar el hallazgo">
          {h.estado === 'abierto' && (
            <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => hallazgoEnProceso(h.id), 'Marcado «en proceso».')}>
              Marcar «en proceso»
            </button>
          )}
          <label className="field">
            <span>Qué se hizo</span>
            <textarea rows={2} maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </label>
          <div className="acciones">
            <label className="btn-link boton-foto">
              <Camera size={16} aria-hidden="true" /> {foto ? `Foto lista (${Math.round(foto.size / 1024)} KB)` : 'Agregar foto (opcional)'}
              <input type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => {
                  const a = e.target.files?.[0]
                  e.target.value = ''
                  if (a) prepararFoto(a).then((f) => setFoto(f.blob), (err) => setError((err as Error).message))
                }} />
            </label>
            <button className="btn" type="button" disabled={ocupado || comentario.trim().length < 3}
              onClick={() => void hacer(() => cerrarHallazgo(h, comentario, foto), 'Hallazgo cerrado.')}>
              {ocupado ? 'Cerrando…' : 'Cerrar hallazgo'}
            </button>
          </div>
        </Seccion>
      )}

      {gestiona && h.estado === 'cerrado' && (
        <Seccion titulo="Reabrir">
          <label className="field">
            <span>Motivo</span>
            <input type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button className="btn-sec" type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => void hacer(() => reabrirHallazgo(h.id, motivo), 'Reabierto.')}>
            <RotateCcw size={16} aria-hidden="true" /> Reabrir
          </button>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        {!historial ? (
          <p className="nota">Cargando…</p>
        ) : (
          <ul className="historial">
            {historial.map((c) => (
              <li key={c.id}>
                <b>{NOMBRE_CAMBIO[c.cambio] ?? c.cambio}</b> · {fechaHora(c.hecho_en)} · {nombre(c.hecho_por)}
                {c.comentario ? ` · ${c.comentario}` : ''}
                {c.cambio === 'asignado' && c.despues
                  ? ` · ${nombre((c.despues.responsable_id as string) ?? null)}, plazo ${c.despues.plazo ? fechaCorta(String(c.despues.plazo)) : '—'}`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}

/** Tarjetas por fuente: de qué formato nacieron los hallazgos, con los abiertos (y en proceso) frente al total. */
function Fuentes({ lista, onElegir }: { lista: Hallazgo[]; onElegir: (f: string) => void }) {
  const noAnulados = lista.filter((h) => h.estado !== 'anulado')
  const abiertos = (xs: Hallazgo[]) => xs.filter((h) => h.estado === 'abierto' || h.estado === 'en_proceso').length
  const porFuente = new Map<string, { nombre: string; items: Hallazgo[] }>()
  for (const h of noAnulados) {
    // Una fuente es un tipo de inspección (el nombre del formato): las copias del mismo formato cuentan juntas.
    const nombre = h.plantillas?.nombre ?? 'Otra fuente'
    const g = porFuente.get(nombre) ?? { nombre, items: [] }
    g.items.push(h)
    porFuente.set(nombre, g)
  }
  const fuentes = [...porFuente.entries()].sort((a, b) => abiertos(b[1].items) - abiertos(a[1].items) || a[1].nombre.localeCompare(b[1].nombre, 'es'))
  return (
    <>
      <p className="nota">Elige una fuente para ver sus hallazgos. Cada tarjeta muestra los abiertos y en proceso frente al total.</p>
      <ul className="tarjetas-tipos">
        <li>
          <button type="button" onClick={() => onElegir('todas')}>
            <ListChecksIcon />
            <b>Todos los hallazgos</b>
            <small>{abiertos(noAnulados)} abiertos de {noAnulados.length} en total</small>
          </button>
        </li>
        {fuentes.map(([id, g]) => (
          <li key={id}>
            <button type="button" onClick={() => onElegir(g.nombre)}>
              <ListChecksIcon />
              <b>{g.nombre}</b>
              <small>{abiertos(g.items)} abiertos de {g.items.length} en total</small>
              {abiertos(g.items) > 0 && <span className="chip chip-aviso">{abiertos(g.items)} por cerrar</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
const ListChecksIcon = () => <CheckCircle2 aria-hidden="true" />
