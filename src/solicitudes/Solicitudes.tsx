import { ArrowLeft, Check, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { ir } from '../ruta'
import { type Solicitud, NOMBRE_ESTADO, aprobarSolicitud, listarSolicitudes, marcarSolicitudVista, nombresDe, resolverSolicitud } from './datos'

const OPERACION: Record<string, string> = {
  programar_semana: 'Programar o quitar una semana',
  guardar_nodo: 'Agregar o editar un objetivo, sección o actividad',
  baja_nodo: 'Dar de baja un objetivo, sección o actividad',
  mover_nodo: 'Mover un objetivo, sección o actividad',
  guardar_metas: 'Cambiar las metas de un objetivo',
}
const cuando = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })

/**
 * Solicitudes de cambio (etapa 2, 03/11/2026). El gestor ve las suyas y sus respuestas; el administrador de la sede (o el general) ve lo que
 * espera su decisión, las comunicaciones de lo que un gestor hizo directo con su facultad y lo ya resuelto.
 */
export function Solicitudes({ cuenta, resuelve, online }: { cuenta: string; resuelve: boolean; online: boolean }) {
  const [lista, setLista] = useState<Solicitud[] | null>(null)
  const [nombres, setNombres] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    listarSolicitudes().then(async (l) => {
      setLista(l)
      setNombres(await nombresDe(l.flatMap((s) => [s.solicitado_por, ...(s.resuelto_por ? [s.resuelto_por] : [])])))
      // Al abrir la pantalla, lo que ya se ve deja de contar como aviso.
      for (const s of l) {
        const sinVer = s.solicitado_por === cuenta ? !s.visto_solicitante && s.estado !== 'pendiente' : s.estado === 'comunicada' && !s.vistos.includes(cuenta)
        if (sinVer) void marcarSolicitudVista(s.id).catch(() => {})
      }
    }, (e) => setError((e as Error).message))
  }, [cuenta])
  useEffect(() => {
    if (online) cargar()
  }, [online, cargar])

  const nombre = (id: string | null) => (id ? (nombres.get(id) ?? 'Una persona de la empresa') : '')
  const porResolver = (lista ?? []).filter((s) => s.estado === 'pendiente' && s.solicitado_por !== cuenta)
  const comunicadas = (lista ?? []).filter((s) => s.estado === 'comunicada')
  const mias = (lista ?? []).filter((s) => s.solicitado_por === cuenta && s.estado !== 'comunicada')
  const resueltas = (lista ?? []).filter((s) => ['aprobada', 'denegada'].includes(s.estado) && s.solicitado_por !== cuenta)

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inicio
      </button>
      <header className="detalle-cab">
        <h1>Solicitudes de cambio</h1>
        <p>{resuelve
          ? 'Lo que piden los gestores de tus sedes (anular o corregir inspecciones, cambiar el programa anual aprobado) espera tu decisión. Si apruebas, el cambio se hace en ese momento; si denegas, queda todo como estaba, y el gestor recibe la respuesta.'
          : 'Lo que pides al administrador y su respuesta. Mientras está por resolver, no cambia nada.'}</p>
      </header>
      <Aviso>{error}</Aviso>
      {!online ? <p className="nota">Las solicitudes se ven con señal.</p> : !lista ? <p className="nota">Cargando…</p> : (
        <>
          {resuelve && (
            <Seccion titulo={`Por resolver (${porResolver.length})`}>
              {!porResolver.length ? <p className="nota">No hay solicitudes por resolver.</p> : (
                <ul className="lista">{porResolver.map((s) => <Fila key={s.id} s={s} nombre={nombre} puedeResolver onCambio={cargar} />)}</ul>
              )}
            </Seccion>
          )}
          {resuelve && comunicadas.length > 0 && (
            <Seccion titulo={`Comunicaciones (${comunicadas.length})`}>
              <p className="nota">Un gestor con la facultad lo hizo directo, sin pedir aprobación. Aquí queda el aviso.</p>
              <ul className="lista">{comunicadas.map((s) => <Fila key={s.id} s={s} nombre={nombre} onCambio={cargar} />)}</ul>
            </Seccion>
          )}
          {mias.length > 0 && (
            <Seccion titulo={`Mis solicitudes (${mias.length})`}>
              <ul className="lista">{mias.map((s) => <Fila key={s.id} s={s} nombre={nombre} onCambio={cargar} />)}</ul>
            </Seccion>
          )}
          {resuelve && resueltas.length > 0 && (
            <Seccion titulo="Resueltas">
              <ul className="lista">{resueltas.slice(0, 30).map((s) => <Fila key={s.id} s={s} nombre={nombre} onCambio={cargar} />)}</ul>
            </Seccion>
          )}
          {!resuelve && !mias.length && <p className="nota">Todavía no has pedido ningún cambio. Se piden desde la inspección (Corregir o Anular) o desde el programa anual aprobado.</p>}
        </>
      )}
    </div>
  )
}

function Fila({ s, nombre, puedeResolver = false, onCambio }: { s: Solicitud; nombre: (id: string | null) => string; puedeResolver?: boolean; onCambio: () => void }) {
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const clase = s.estado === 'aprobada' ? 'chip-ok' : s.estado === 'denegada' ? 'chip-mal' : s.estado === 'pendiente' ? 'chip-aviso' : 'chip-gris'
  const operacion = s.tipo === 'cambio_programa' ? OPERACION[String(s.datos.operacion)] : null

  async function resolver(aprobar: boolean) {
    setError(null)
    if (!aprobar && comentario.trim().length < 3) return setError('Escribe por qué se deniega.')
    setOcupado(true)
    try {
      if (aprobar) await aprobarSolicitud(s, comentario.trim() || null)
      else await resolverSolicitud(s.id, false, comentario.trim())
      onCambio()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <li>
      <div>
        <b>{s.titulo}</b>
        <span className="chips"><span className={`chip ${clase}`}>{NOMBRE_ESTADO[s.estado]}</span></span>
        <small>
          {nombre(s.solicitado_por)} · {cuando(s.solicitado_en)}
          {operacion ? ` · ${operacion}` : ''}
          {s.tipo !== 'cambio_programa' && <> · <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${s.objetivo_id}`)}>Ver la inspección</button></>}
        </small>
        <small>Motivo: {s.motivo}</small>
        {s.estado !== 'pendiente' && s.estado !== 'comunicada' && (
          <small>{s.estado === 'aprobada' ? 'Aprobada' : 'Denegada'} por {nombre(s.resuelto_por)}{s.resuelto_en ? ` · ${cuando(s.resuelto_en)}` : ''}{s.comentario_resolucion ? ` · ${s.comentario_resolucion}` : ''}</small>
        )}
        {puedeResolver && (
          <div className="subform">
            <label className="field">
              <span>Comentario (obligatorio si deniegas)</span>
              <input type="text" maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </label>
            {s.tipo === 'corregir_inspeccion' && <p className="nota">Al aprobar se aplica la corrección pedida; el servidor la valida como cualquier corrección. Si no pasa la validación, la solicitud sigue pendiente y puedes denegarla.</p>}
            <Aviso>{error}</Aviso>
            <div className="acciones">
              <button className="btn" type="button" disabled={ocupado} onClick={() => void resolver(true)}><Check size={18} aria-hidden="true" /> {ocupado ? 'Guardando…' : 'Aprobar'}</button>
              <button className="btn-sec btn-sec-peligro" type="button" disabled={ocupado} onClick={() => void resolver(false)}><X size={18} aria-hidden="true" /> Denegar</button>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
