import { CalendarRange, CloudOff, CloudUpload, ClipboardCheck, Eye, FilePlus2, PenLine, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { ir } from '../ruta'
import { NOMBRE_NIVEL, type Nivel } from '../usuarios/datos'
import { type Borrador, type CopiaLocal, type EnCola, bajarCopia, descartarBorrador, guardarBorrador, leerCopia, sincronizar, useCampo, volverABorrador } from './campo'
import { type ResumenInspeccion, listarInspecciones } from './datos'
import { espacioLleno, hoyLocal, ordenarUnidades, useUso } from './ayudas'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const hora = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const mb = (b: number) => `${(b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0)} MB`

/**
 * Inspecciones (tarea 3.4-C): nueva inspección, lo que está en este equipo (borradores y cola de envío) y las ya
 * recibidas por el servidor. Lo del equipo funciona sin señal.
 */
export function Inspecciones({ empresaId, cuenta, online }: { empresaId: string; cuenta: string; online: boolean }) {
  const { borradores, cola } = useCampo(cuenta)
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined)
  const [recibidas, setRecibidas] = useState<ResumenInspeccion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)
  const [bajando, setBajando] = useState(false)

  useEffect(() => {
    void leerCopia(cuenta, empresaId).then((c) => setCopia(c ?? null))
  }, [cuenta, empresaId])
  const enviadas = cola.filter((c) => c.estado === 'enviada').length
  const uso = useUso(empresaId, online, enviadas)
  useEffect(() => {
    if (!online) return
    listarInspecciones(empresaId).then(setRecibidas, (e) => setError((e as Error).message))
  }, [empresaId, online, enviadas])

  async function actualizarCopia() {
    setBajando(true)
    setError(null)
    try {
      setCopia(await bajarCopia(cuenta, empresaId))
    } catch (e) {
      setError(`No se pudieron bajar los datos: ${(e as Error).message}`)
    } finally {
      setBajando(false)
    }
  }

  const porEnviar = cola.filter((c) => c.estado === 'pendiente' || c.estado === 'enviando').length

  return (
    <div className="detalle">
      <header className="detalle-cab fila-entre">
        <div>
          <h1>Inspecciones</h1>
          <p>Se llenan en el celular con o sin señal. Al cerrarlas se envían solas cuando vuelve la señal.</p>
        </div>
        <span className="acciones">
          <button className="btn-sec" type="button" onClick={() => ir('/inspecciones/avance')}>
            <CalendarRange size={18} aria-hidden="true" /> Avance por período
          </button>
          <button className="btn" type="button" disabled={!copia?.formatos.length} onClick={() => setNueva(true)}>
            <FilePlus2 size={18} aria-hidden="true" /> Nueva inspección
          </button>
        </span>
      </header>
      <Aviso>{error}</Aviso>

      <p className={`estado-equipo ${copia ? '' : 'falta'}`}>
        {copia === undefined ? (
          'Revisando el equipo…'
        ) : copia ? (
          <>
            Datos en este equipo: {copia.formatos.length} formato(s) y {copia.activos.length} activo(s), bajados el {hora(copia.bajada_en)}.
          </>
        ) : (
          <>Este equipo todavía no tiene los datos para inspeccionar sin señal.</>
        )}{' '}
        {online && (
          <button className="btn-link" type="button" disabled={bajando} onClick={() => void actualizarCopia()}>
            <RefreshCw size={16} aria-hidden="true" /> {bajando ? 'Bajando…' : copia ? 'Actualizar' : 'Bajar ahora'}
          </button>
        )}
        {!online && !copia && ' Conéctate una vez para bajarlos.'}
      </p>
      {copia && !copia.formatos.length && <p className="nota">La empresa no tiene formatos publicados. Publica uno en «Formatos de inspección».</p>}
      {uso?.tope && (
        <p className={espacioLleno(uso) ? 'aviso-suave' : 'nota'}>
          {espacioLleno(uso) ? <TriangleAlert size={16} aria-hidden="true" /> : null} Espacio de fotos de la empresa: {mb(uso.usado)} de {mb(uso.tope)}
          {espacioLleno(uso) ? ' — lleno: no se pueden tomar fotos nuevas hasta liberar espacio o pasar al plan de pago.' : '.'}
        </p>
      )}

      {nueva && copia && <NuevaInspeccion copia={copia} cuenta={cuenta} onCancelar={() => setNueva(false)} />}

      <Seccion
        titulo="En este equipo"
        accion={
          porEnviar > 0 && online ? (
            <button className="btn-sec" type="button" onClick={() => void sincronizar(cuenta, true)}>
              <CloudUpload size={18} aria-hidden="true" /> Enviar ahora
            </button>
          ) : null
        }
      >
        {!borradores.length && !cola.length ? (
          <p className="nota">No hay inspecciones a medio llenar ni por enviar.</p>
        ) : (
          <ul className="lista">
            {borradores.map((b) => (
              <FilaBorrador key={b.id} b={b} />
            ))}
            {cola.map((c) => (
              <FilaCola key={c.id} c={c} online={online} />
            ))}
          </ul>
        )}
        {porEnviar > 0 && !online && (
          <p className="nota">
            <CloudOff size={16} aria-hidden="true" /> Sin señal: {porEnviar} inspección(es) esperan para enviarse. No cierres sesión en este equipo.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Recibidas">
        {!online ? (
          <p className="nota">Se ven con señal.</p>
        ) : !recibidas ? (
          !error && <p className="nota">Cargando…</p>
        ) : !recibidas.length ? (
          <p className="nota">Todavía no hay inspecciones recibidas.</p>
        ) : (
          <ul className="lista">
            {recibidas.map((i) => (
              <li key={i.id} className={i.estado === 'anulada' ? 'inactiva' : ''}>
                <ClipboardCheck aria-hidden="true" />
                <div>
                  <b>
                    N.º {i.numero} · {i.plantillas?.nombre}
                  </b>
                  {i.estado === 'anulada' && <span className="chip chip-gris">Anulada</span>}
                  {i.resultado && <span className={`chip ${i.hallazgos.length ? 'chip-aviso' : 'chip-ok'}`}>{i.resultado}</span>}
                  {i.hallazgos.length > 0 && <span className="chip chip-mal">{i.hallazgos.length} hallazgo(s)</span>}
                  <small>
                    {fechaCorta(i.fecha)} · {i.activo_foto ? i.activo_foto.codigo : (i.sedes?.nombre ?? '')}
                    {i.puntaje != null ? ` · ${i.puntaje} %` : ''}
                  </small>
                </div>
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${i.id}`)}>
                    <Eye size={16} aria-hidden="true" /> Ver
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}

function FilaBorrador({ b }: { b: Borrador }) {
  const [seguro, setSeguro] = useState(false)
  return (
    <li>
      <PenLine aria-hidden="true" />
      <div>
        <b>{b.nombre_formato}</b>
        <span className="chip chip-aviso">A medio llenar</span>
        <small>
          {b.activo_foto ? b.activo_foto.codigo : 'Área'} · {fechaCorta(b.fecha)} · guardada {hora(b.actualizado_en)} · {b.fotos.length} foto(s)
        </small>
      </div>
      <span className="lista-acciones">
        <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/llenar/${b.id}`)}>
          Continuar
        </button>
        {seguro ? (
          <button className="btn-link peligro" type="button" onClick={() => void descartarBorrador(b)}>
            ¿Descartar? Sí
          </button>
        ) : (
          <button className="btn-link" type="button" aria-label="Descartar" onClick={() => setSeguro(true)}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </span>
    </li>
  )
}

const NOMBRE_ESTADO_COLA: Record<EnCola['estado'], [string, string]> = {
  pendiente: ['Por enviar', 'chip-aviso'],
  enviando: ['Enviando…', 'chip-aviso'],
  enviada: ['Enviada', 'chip-ok'],
  rechazada: ['No aceptada', 'chip-mal'],
}

function FilaCola({ c, online }: { c: EnCola; online: boolean }) {
  const [texto, clase] = NOMBRE_ESTADO_COLA[c.estado]
  return (
    <li>
      {c.estado === 'enviada' ? <ClipboardCheck aria-hidden="true" /> : <CloudUpload aria-hidden="true" />}
      <div>
        <b>
          {c.numero ? `N.º ${c.numero} · ` : ''}
          {c.borrador.nombre_formato}
        </b>
        <span className={`chip ${clase}`}>{texto}</span>
        <small>
          {c.borrador.activo_foto ? c.borrador.activo_foto.codigo : 'Área'} · cerrada {hora(c.cerrada_en)} · {c.borrador.fotos.length} foto(s)
          {c.estado === 'pendiente' && c.error ? ` · ${c.error}${online ? ' Se reintentará sola.' : ''}` : ''}
        </small>
        {c.estado === 'rechazada' && (
          <small className="error-linea">
            {c.error}
            {c.faltan?.length ? `: ${c.faltan.slice(0, 3).join(' · ')}` : ''}
          </small>
        )}
      </div>
      <span className="lista-acciones">
        {c.estado === 'rechazada' && (
          <button className="btn-link" type="button" onClick={() => void volverABorrador(c).then(() => ir(`/inspecciones/llenar/${c.id}`))}>
            Revisar y corregir
          </button>
        )}
        {c.estado === 'enviada' && (
          <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${c.id}`)}>
            <Eye size={16} aria-hidden="true" /> Ver
          </button>
        )}
      </span>
    </li>
  )
}

/** Elegir formato y qué se inspecciona (un activo, o un área: sede, área y ubicación). Todo sale de la copia local. */
function NuevaInspeccion({ copia, cuenta, onCancelar }: { copia: CopiaLocal; cuenta: string; onCancelar: () => void }) {
  const [formatoId, setFormatoId] = useState(copia.formatos[0]?.plantilla.id ?? '')
  const [activoId, setActivoId] = useState('')
  const [buscar, setBuscar] = useState('')
  const [sede, setSede] = useState(copia.sedes.length === 1 ? copia.sedes[0].id : '')
  const [unidad, setUnidad] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const f = copia.formatos.find((x) => x.plantilla.id === formatoId)
  const deTipo = f?.plantilla.aplica_a === 'activo' ? copia.activos.filter((a) => a.tipo_id === f.plantilla.tipo_activo_id) : []
  const filtrados = deTipo.filter((a) => !buscar || a.codigo.toLowerCase().includes(buscar.toLowerCase())).slice(0, 100)
  // Áreas en árbol, con su nivel a la vista (gerencia, área o subárea).
  const unidades = ordenarUnidades(copia.unidades.filter((u) => u.vigente))
  const ubicaciones = copia.ubicaciones.filter((u) => !sede || u.sede_id === sede)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!f) return setError('Elige el formato.')
    const activo = f.plantilla.aplica_a === 'activo' ? copia.activos.find((a) => a.id === activoId) : null
    if (f.plantilla.aplica_a === 'activo' && !activo) return setError('Elige el activo que vas a inspeccionar.')
    if (!activo && !sede) return setError('Elige la sede.')
    const tipo = activo ? copia.tipos.find((t) => t.id === activo.tipo_id) : null
    const ahora = new Date().toISOString()
    // La firma de quien registra suele ser la primera: se propone su nombre (se puede cambiar).
    const primera = f.version.receta.firmas[0]
    const b: Borrador = {
      id: crypto.randomUUID(),
      cuenta,
      empresa_id: copia.empresa_id,
      plantilla_id: f.plantilla.id,
      version_id: f.version.id,
      nombre_formato: f.plantilla.nombre,
      receta: f.version.receta,
      sede_id: activo ? activo.sede_id : sede,
      unidad_id: activo ? activo.unidad_id : unidad || null,
      ubicacion_id: activo ? activo.ubicacion_id : ubicacion || null,
      activo_id: activo?.id ?? null,
      activo_foto: activo
        ? { codigo: activo.codigo, numero: activo.numero, subtipo: activo.subtipo, datos: activo.datos, dotacion: activo.dotacion, tipo: tipo?.nombre ?? '' }
        : null,
      respuestas: {},
      filas: {},
      observacion: '',
      fecha: hoyLocal(),
      iniciada_en: ahora,
      fotos: [],
      firmantes: primera && copia.personas.some((p) => p.persona_id === cuenta) ? [{ rol_clave: primera.clave, rol_titulo: primera.titulo, orden: 1, persona_id: cuenta }] : [],
      mi_firma: null,
      actualizado_en: ahora,
    }
    try {
      await guardarBorrador(b)
      ir(`/inspecciones/llenar/${b.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="form subform" onSubmit={crear} noValidate>
      <label className="field">
        <span>Formato</span>
        <select value={formatoId} onChange={(e) => (setFormatoId(e.target.value), setActivoId(''))}>
          {copia.formatos.map((x) => (
            <option key={x.plantilla.id} value={x.plantilla.id}>
              {x.plantilla.nombre} (v{x.version.numero})
            </option>
          ))}
        </select>
      </label>
      {f?.plantilla.aplica_a === 'activo' ? (
        <div className="fila2">
          <label className="field">
            <span>Buscar por código</span>
            <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej.: EXT-001" />
          </label>
          <label className="field">
            <span>Activo</span>
            <select value={activoId} onChange={(e) => setActivoId(e.target.value)}>
              <option value="">— Elige ({deTipo.length}) —</option>
              {filtrados.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo}
                  {a.ubicacion_id ? ` · ${copia.ubicaciones.find((u) => u.id === a.ubicacion_id)?.nombre ?? ''}` : ''}
                </option>
              ))}
            </select>
            {!deTipo.length && <small className="ayuda">No hay activos de este tipo en este equipo.</small>}
          </label>
        </div>
      ) : (
        <div className="fila3">
          <label className="field">
            <span>Sede</span>
            <select value={sede} onChange={(e) => (setSede(e.target.value), setUbicacion(''))}>
              <option value="">— Elige —</option>
              {copia.sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Área <em className="opcional">(opcional)</em>
            </span>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="">— Sin área —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {'  '.repeat(u.profundidad)}
                  {NOMBRE_NIVEL[u.nivel as Nivel] ?? u.nivel}: {u.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Ubicación <em className="opcional">(opcional)</em>
            </span>
            <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
              <option value="">— Sin ubicación —</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit">
          Empezar
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
