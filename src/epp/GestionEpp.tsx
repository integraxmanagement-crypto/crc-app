import { FileSpreadsheet, FileText, HardHat, PenLine, Plus, Search, ShieldCheck } from 'lucide-react'
import { usePdfAutomatico } from '../inspecciones/pdf'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BotonEliminar } from '../BotonEliminar'
import { CampoClave } from '../CamposIngreso'
import { InsigniaListo } from '../InsigniaListo'
import { Aviso, Seccion } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { PanelFirma } from '../inspecciones/Firma'
import { entregarRegistro } from '../inspecciones/registroPeriodo'
import { VistaExcel } from '../inspecciones/VistaExcel'
import { plural } from '../plural'
import {
  type ConfigFormato, type Entrega, type EppCatalogo, type Motivo, NOMBRE_DOC, NOMBRE_MOTIVO, type Trabajador,
  anularEntrega, buscarTrabajadores, confirmarEntrega, entregasDe, fijarCodigo, guardarCatalogo, guardarConfig, leerCatalogo, leerConfig, registrarEntrega,
} from './datos'
import { type EmpresaEpp, armarRegistroEpp, leerEmpresaEpp } from './registro'

const fechaPeru = (f: string | null) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '—')
const sumarMeses = (f: string, m: number) => {
  const d = new Date(`${f}T12:00:00`)
  d.setMonth(d.getMonth() + m)
  return d.toISOString().slice(0, 10)
}

type Props = { cuenta: string; empresaId: string; nombre: string; cargo: string | null; esAdmin: boolean; online: boolean }

/**
 * Gestión de EPPs (09/11/2026): se busca al trabajador (nombre, apellido, documento o código), se elige el EPP que se le entrega,
 * el trabajador da su conformidad con su documento y su contraseña, y el gestor genera el registro en Excel o PDF.
 */
export function GestionEpp({ empresaId, nombre, cargo, esAdmin, online }: Props) {
  const [catalogo, setCatalogo] = useState<EppCatalogo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [verConfig, setVerConfig] = useState(false)

  const cargarCatalogo = useCallback(() => {
    leerCatalogo().then(setCatalogo, (e) => setError((e as Error).message))
  }, [])
  useEffect(() => {
    if (online) cargarCatalogo() // eslint-disable-line react-hooks/set-state-in-effect
  }, [online, cargarCatalogo])

  return (
    <div className="detalle epp">
      <header className="detalle-cab">
        <h1>Gestión de EPPs</h1>
        <p>Registra los equipos de protección personal que entregas a cada trabajador, con su conformidad, y genera el registro.</p>
      </header>
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="nota">La gestión de EPPs necesita señal.</p>
      ) : (
        <>
          <Buscador catalogo={catalogo} empresaId={empresaId} nombre={nombre} cargo={cargo} />
          {esAdmin && (
            <div className="acciones">
              <button className="btn-sec" type="button" aria-expanded={verConfig} onClick={() => setVerConfig((v) => !v)}>
                <HardHat size={16} aria-hidden="true" /> {verConfig ? 'Cerrar la configuración' : 'Lista de EPP y datos del formato'}
              </button>
            </div>
          )}
          {esAdmin && verConfig && <Configuracion empresaId={empresaId} catalogo={catalogo} onCambio={cargarCatalogo} />}
        </>
      )}
    </div>
  )
}

// ───────────────────────── Buscar al trabajador ─────────────────────────
function Buscador({ catalogo, empresaId, nombre, cargo }: { catalogo: EppCatalogo[]; empresaId: string; nombre: string; cargo: string | null }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Trabajador[] | null>(null)
  const [elegido, setElegido] = useState<Trabajador | null>(null)
  const [error, setError] = useState<string | null>(null)
  const n = useRef(0)

  useEffect(() => {
    const t = texto.trim()
    if (t.length < 2) {
      setResultados(null) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    const yo = ++n.current
    const reloj = setTimeout(() => {
      buscarTrabajadores(t).then(
        (r) => yo === n.current && (setResultados(r), setError(null)),
        (e) => yo === n.current && setError((e as Error).message),
      )
    }, 250)
    return () => clearTimeout(reloj)
  }, [texto])

  return (
    <Seccion titulo="1. Busca al trabajador">
      <label className="field">
        <span>Nombre, apellido, DNI o carnet de extranjería, o código de trabajador</span>
        <span className="epp-buscar">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={texto} maxLength={60} autoComplete="off" placeholder="Escribe al menos 2 letras o números" onChange={(e) => { setTexto(e.target.value); setElegido(null) }} />
        </span>
      </label>
      <Aviso>{error}</Aviso>
      {!elegido && resultados && (
        <ul className="epp-resultados" aria-label="Trabajadores encontrados">
          {resultados.map((r) => (
            <li key={r.vinculo_id}>
              <button type="button" onClick={() => setElegido(r)}>
                <b>{r.apellidos_nombres}</b>
                <small>
                  {NOMBRE_DOC[r.tipo_documento]} {r.numero_documento}
                  {r.codigo_trabajador ? ` · Código ${r.codigo_trabajador}` : ''}
                  {r.cargo ? ` · ${r.cargo}` : ''}
                </small>
              </button>
            </li>
          ))}
          {!resultados.length && <li className="nota">No hay trabajadores con ese dato en tus sedes.</li>}
        </ul>
      )}
      {elegido && <PanelTrabajador key={elegido.vinculo_id} trabajador={elegido} catalogo={catalogo} empresaId={empresaId} nombre={nombre} cargo={cargo} onCambio={setElegido} />}
    </Seccion>
  )
}

// ───────────────────────── Un trabajador ─────────────────────────
function PanelTrabajador({ trabajador: t, catalogo, empresaId, nombre, cargo, onCambio }: { trabajador: Trabajador; catalogo: EppCatalogo[]; empresaId: string; nombre: string; cargo: string | null; onCambio: (t: Trabajador) => void }) {
  const [entregas, setEntregas] = useState<Entrega[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [codigo, setCodigo] = useState(t.codigo_trabajador ?? '')
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(() => {
    entregasDe(t.vinculo_id).then(setEntregas, (e) => setError((e as Error).message))
  }, [t.vinculo_id])
  useEffect(cargar, [cargar])

  async function guardarCodigo() {
    setError(null)
    try {
      await fijarCodigo(t.vinculo_id, codigo)
      onCambio({ ...t, codigo_trabajador: codigo.trim() || null })
      setAviso('Código guardado.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const pendiente = entregas?.find((e) => e.id === confirmando) ?? null
  return (
    <div className="epp-trabajador">
      <div className="epp-ficha">
        <h3>{t.apellidos_nombres}</h3>
        <dl>
          <div><dt>{NOMBRE_DOC[t.tipo_documento]}</dt><dd>{t.numero_documento}</dd></div>
          <div><dt>Cargo</dt><dd>{t.cargo || '—'}</dd></div>
          <div><dt>Área</dt><dd>{t.area || '—'}</dd></div>
        </dl>
        <form className="epp-codigo" onSubmit={(e) => { e.preventDefault(); void guardarCodigo() }}>
          <label className="field">
            <span>Código de trabajador</span>
            <input type="text" value={codigo} maxLength={30} onChange={(e) => { setCodigo(e.target.value); setAviso(null) }} />
          </label>
          <button className="btn-sec" type="submit" disabled={codigo.trim() === (t.codigo_trabajador ?? '')}>Guardar código</button>
        </form>
        <Aviso tipo="ok">{aviso}</Aviso>
      </div>
      <Aviso>{error}</Aviso>

      <h3 className="epp-sub">2. Entrega un EPP</h3>
      <NuevaEntrega trabajador={t} catalogo={catalogo} onRegistrada={(id) => { cargar(); setConfirmando(id) }} />

      {pendiente && (
        <Conformidad entrega={pendiente} trabajador={t} onListo={() => { setConfirmando(null); cargar() }} onPendiente={() => setConfirmando(null)} />
      )}

      <h3 className="epp-sub">3. Entregas de este trabajador</h3>
      {!entregas ? (
        <p className="nota">Cargando…</p>
      ) : !entregas.length ? (
        <p className="nota">Todavía no se le ha entregado ningún EPP.</p>
      ) : (
        <ul className="epp-entregas">
          {entregas.map((e) => (
            <li key={e.id}>
              <span className="epp-entrega-dato">
                <b>{e.epp_nombre}</b>
                <small>
                  {fechaPeru(e.fecha_entrega)} · {NOMBRE_MOTIVO[e.motivo]}
                  {e.fecha_renovacion ? ` · Renovar el ${fechaPeru(e.fecha_renovacion)}` : ''}
                </small>
              </span>
              {e.conformidad_en ? (
                <span className="chip chip-ok"><ShieldCheck size={14} aria-hidden="true" /> Conforme</span>
              ) : (
                <span className="epp-pendiente">
                  <span className="chip chip-aviso">Pendiente de conformidad</span>
                  <button className="btn-link" type="button" onClick={() => setConfirmando(e.id)}>Dar conformidad</button>
                  <BotonEliminar etiqueta={`Anular la entrega de ${e.epp_nombre}`} verbo="anular" compacto onEliminar={() => void anularEntrega(e.id).then(cargar, (x) => setError((x as Error).message))} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <GenerarRegistroEpp trabajador={t} entregas={entregas ?? []} empresaId={empresaId} nombre={nombre} cargo={cargo} />
    </div>
  )
}

function NuevaEntrega({ trabajador, catalogo, onRegistrada }: { trabajador: Trabajador; catalogo: EppCatalogo[]; onRegistrada: (id: string) => void }) {
  const vigentes = useMemo(() => catalogo.filter((c) => c.vigente), [catalogo])
  const [filtro, setFiltro] = useState('')
  const [epp, setEpp] = useState('')
  const [fecha, setFecha] = useState(hoyLocal())
  const [motivo, setMotivo] = useState<Motivo>('nuevo')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const lista = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    return f ? vigentes.filter((c) => c.nombre.toLowerCase().includes(f)) : vigentes
  }, [vigentes, filtro])
  const sel = vigentes.find((c) => c.id === epp)
  const renovacion = sel?.vida_meses && fecha ? sumarMeses(fecha, sel.vida_meses) : null

  async function registrar() {
    setError(null)
    if (!epp) return setError('Elige el EPP que se entrega.')
    setOcupado(true)
    try {
      const id = await registrarEntrega(trabajador.vinculo_id, epp, fecha, motivo)
      setEpp('')
      setFiltro('')
      onRegistrada(id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (!vigentes.length) return <p className="nota">Todavía no hay EPP en la lista de la empresa. Un administrador los agrega en «Lista de EPP y datos del formato».</p>
  return (
    <form className="subform epp-nueva" onSubmit={(e) => { e.preventDefault(); void registrar() }}>
      <label className="field">
        <span>EPP (busca por nombre)</span>
        <input type="search" value={filtro} placeholder="Casco, guantes, lentes…" onChange={(e) => setFiltro(e.target.value)} />
      </label>
      <div className="epp-opciones" role="listbox" aria-label="EPP de la empresa">
        {lista.map((c) => (
          <button key={c.id} type="button" role="option" aria-selected={c.id === epp} onClick={() => setEpp(c.id)}>
            {c.nombre}
            {c.vida_meses ? <small> · se renueva cada {plural(c.vida_meses, 'mes', 'meses')}</small> : null}
          </button>
        ))}
        {!lista.length && <span className="nota">Ningún EPP coincide.</span>}
      </div>
      <div className="fila2">
        <label className="field">
          <span>Fecha de entrega</span>
          <input type="date" required value={fecha} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="field">
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
            {(Object.keys(NOMBRE_MOTIVO) as Motivo[]).map((m) => <option key={m} value={m}>{NOMBRE_MOTIVO[m]}</option>)}
          </select>
        </label>
      </div>
      {sel && <p className="nota">Fecha estimada de renovación: <b>{renovacion ? fechaPeru(renovacion) : 'sin fecha (este EPP no tiene meses de renovación)'}</b></p>}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}><Plus size={18} aria-hidden="true" /> {ocupado ? 'Registrando…' : 'Registrar y pedir conformidad'}</button>
      </div>
    </form>
  )
}

// ───────────────────────── Conformidad del trabajador ─────────────────────────
function Conformidad({ entrega, trabajador: t, onListo, onPendiente }: { entrega: Entrega; trabajador: Trabajador; onListo: () => void; onPendiente: () => void }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function dar() {
    setError(null)
    if (!clave) return setError('El trabajador debe escribir su contraseña.')
    setOcupado(true)
    const fallo = await confirmarEntrega(entrega.id, t.tipo_documento, t.numero_documento, clave)
    setClave('')
    setOcupado(false)
    if (fallo) setError(fallo)
    else onListo()
  }

  return (
    <form className="subform epp-conformidad" onSubmit={(e) => { e.preventDefault(); void dar() }} autoComplete="off">
      <h3><ShieldCheck size={18} aria-hidden="true" /> Conformidad del trabajador</h3>
      <p>
        <b>{t.apellidos_nombres}</b>, al ingresar tu contraseña das conformidad de haber recibido <b>{entrega.epp_nombre}</b> el {fechaPeru(entrega.fecha_entrega)}, la información de uso, los riesgos de los que te protege y te comprometes a usarlo y cuidarlo.
      </p>
      <p className="epp-usuario">Usuario: <b>{NOMBRE_DOC[t.tipo_documento]} {t.numero_documento}</b></p>
      <CampoClave etiqueta="Contraseña del trabajador" valor={clave} onCambio={setClave} autoComplete="off" maxLength={64} />
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Verificando…' : 'Dar mi conformidad'}</button>
        <button className="btn-link" type="button" onClick={onPendiente}>Dejar pendiente</button>
      </div>
    </form>
  )
}

// ───────────────────────── Generar el registro ─────────────────────────
function GenerarRegistroEpp({ trabajador, entregas, empresaId, nombre, cargo }: { trabajador: Trabajador; entregas: Entrega[]; empresaId: string; nombre: string; cargo: string | null }) {
  const [firma, setFirma] = useState<Uint8Array | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [armandoDe, setArmandoDe] = useState<'excel' | 'pdf' | null>(null)
  const [listoDe, setListoDe] = useState<'excel' | 'pdf' | null>(null)
  const [vistaPdf, setVistaPdf] = useState<Awaited<ReturnType<typeof entregarRegistro>>>(null)
  const [empresa, setEmpresa] = useState<EmpresaEpp | null>(null)
  const [config, setConfig] = useState<ConfigFormato | null>(null)

  useEffect(() => {
    leerEmpresaEpp(empresaId).then(setEmpresa, () => {})
    leerConfig(empresaId).then(setConfig, () => {})
  }, [empresaId])
  useEffect(() => {
    if (!listoDe) return
    const t = setTimeout(() => setListoDe(null), 4000)
    return () => clearTimeout(t)
  }, [listoDe])
  // PDF: se descarga solo, sin abrir «Imprimir» (09/11/2026).
  usePdfAutomatico(vistaPdf, () => setVistaPdf(null), setError)

  async function generar(como: 'excel' | 'pdf') {
    setError(null)
    if (!empresa || !config) return setError('Todavía se están cargando los datos de la empresa. Reintenta en un momento.')
    setArmandoDe(como)
    setListoDe(null)
    try {
      const r = await armarRegistroEpp({ empresa, config, trabajador, entregas, responsable: { nombre, cargo: cargo ?? '', fecha: hoyLocal() }, firma })
      const vista = await entregarRegistro(r.bytes, como, `Entrega de EPP ${trabajador.apellidos_nombres}`)
      if (vista) setVistaPdf(vista)
      setListoDe(como)
    } catch (e) {
      setError(`No se pudo armar el registro: ${(e as Error).message}`)
    } finally {
      setArmandoDe(null)
    }
  }

  const ocupado = armandoDe !== null
  return (
    <>
      <h3 className="epp-sub">4. Genera el registro</h3>
      <div className="subform">
        <p className="nota">
          Sale tal cual el formato de la empresa, con los datos de {trabajador.apellidos_nombres} y sus {plural(entregas.length, 'entrega', 'entregas')}. Responsable del registro: <b>{nombre}</b>{cargo ? ` (${cargo})` : ''}.
        </p>
        {firmando ? (
          <PanelFirma onListo={(png) => void png.arrayBuffer().then((b) => (setFirma(new Uint8Array(b)), setFirmando(false)))} onCancelar={() => setFirmando(false)} />
        ) : (
          <div className="acciones">
            <button className="btn-sec" type="button" onClick={() => setFirmando(true)}>
              <PenLine size={16} aria-hidden="true" /> {firma ? 'Firmar de nuevo' : 'Firmar el registro (opcional)'}
            </button>
            {firma && <span className="chip chip-ok">Firma lista (no se guarda: hay que firmar cada vez)</span>}
          </div>
        )}
        <Aviso>{error}</Aviso>
        <div className="acciones">
          <button className="btn" type="button" disabled={ocupado || !entregas.length} onClick={() => void generar('excel')}>
            {armandoDe === 'excel' || listoDe === 'excel' ? <InsigniaListo armando={armandoDe === 'excel'} listo={listoDe === 'excel'} /> : <FileSpreadsheet size={18} aria-hidden="true" />} {armandoDe === 'excel' ? 'Armando…' : listoDe === 'excel' ? '¡Listo!' : 'Generar en Excel'}
          </button>
          <button className="btn" type="button" disabled={ocupado || !entregas.length} onClick={() => void generar('pdf')}>
            {armandoDe === 'pdf' || listoDe === 'pdf' ? <InsigniaListo armando={armandoDe === 'pdf'} listo={listoDe === 'pdf'} /> : <FileText size={18} aria-hidden="true" />} {armandoDe === 'pdf' ? 'Armando…' : listoDe === 'pdf' ? '¡Listo!' : 'Generar en PDF'}
          </button>
        </div>
        {!entregas.length && <p className="nota">Registra al menos una entrega para generar el registro.</p>}
      </div>
      {vistaPdf && createPortal(<VistaExcel vista={vistaPdf.vista} medias={vistaPdf.medias} />, document.body)}
    </>
  )
}

// ───────────────────────── Lista de EPP y datos del formato (administradores) ─────────────────────────
function Configuracion({ empresaId, catalogo, onCambio }: { empresaId: string; catalogo: EppCatalogo[]; onCambio: () => void }) {
  const [config, setConfig] = useState<ConfigFormato>({ codigo_formato: '', version_formato: '', fecha_aprobacion: '' })
  const [nuevo, setNuevo] = useState({ nombre: '', meses: '' })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    leerConfig(empresaId).then((c) => setConfig({ codigo_formato: c.codigo_formato ?? '', version_formato: c.version_formato ?? '', fecha_aprobacion: c.fecha_aprobacion ?? '' }), () => {})
  }, [empresaId])

  const hacer = async (f: () => Promise<unknown>, ok: string) => {
    setError(null)
    setAviso(null)
    try {
      await f()
      setAviso(ok)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Seccion titulo="Configuración de EPPs">
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>
      <h3 className="epp-sub">Datos del formato (van en el encabezado del registro)</h3>
      <form className="subform" onSubmit={(e) => { e.preventDefault(); void hacer(() => guardarConfig(config), 'Datos del formato guardados.') }}>
        <div className="fila3">
          <label className="field"><span>Código</span><input type="text" maxLength={40} value={config.codigo_formato ?? ''} onChange={(e) => setConfig({ ...config, codigo_formato: e.target.value })} /></label>
          <label className="field"><span>Versión</span><input type="text" maxLength={20} value={config.version_formato ?? ''} onChange={(e) => setConfig({ ...config, version_formato: e.target.value })} /></label>
          <label className="field"><span>Fecha de aprobación</span><input type="date" value={config.fecha_aprobacion ?? ''} onChange={(e) => setConfig({ ...config, fecha_aprobacion: e.target.value })} /></label>
        </div>
        <div className="acciones"><button className="btn-sec" type="submit">Guardar datos del formato</button></div>
      </form>

      <h3 className="epp-sub">Lista de EPP de la empresa</h3>
      <ul className="epp-catalogo">
        {catalogo.map((c) => (
          <FilaCatalogo key={c.id} c={c} onGuardar={(n, m, v) => hacer(() => guardarCatalogo(c.id, n, m, v), 'EPP actualizado.')} />
        ))}
        {!catalogo.length && <li className="nota">Todavía no hay EPP en la lista.</li>}
      </ul>
      <form className="subform epp-agregar" onSubmit={(e) => { e.preventDefault(); const m = nuevo.meses.trim(); void hacer(() => guardarCatalogo(null, nuevo.nombre, m ? Number(m) : null, true).then(() => setNuevo({ nombre: '', meses: '' })), 'EPP agregado.') }}>
        <div className="fila2">
          <label className="field"><span>Nuevo EPP</span><input type="text" required maxLength={120} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej.: Casco de seguridad" /></label>
          <label className="field"><span>Se renueva cada (meses, opcional)</span><input type="number" min={1} max={120} value={nuevo.meses} onChange={(e) => setNuevo({ ...nuevo, meses: e.target.value })} /></label>
        </div>
        <div className="acciones"><button className="btn-sec" type="submit"><Plus size={16} aria-hidden="true" /> Agregar a la lista</button></div>
      </form>
    </Seccion>
  )
}

function FilaCatalogo({ c, onGuardar }: { c: EppCatalogo; onGuardar: (nombre: string, meses: number | null, vigente: boolean) => Promise<void> }) {
  const [nombre, setNombre] = useState(c.nombre)
  const [meses, setMeses] = useState(c.vida_meses == null ? '' : String(c.vida_meses))
  const cambio = nombre.trim() !== c.nombre || meses !== (c.vida_meses == null ? '' : String(c.vida_meses))
  return (
    <li className={c.vigente ? '' : 'epp-inactivo'}>
      <input type="text" aria-label="Nombre del EPP" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input type="number" aria-label="Meses de renovación" min={1} max={120} placeholder="meses" value={meses} onChange={(e) => setMeses(e.target.value)} />
      <button className="btn-link" type="button" disabled={!cambio} onClick={() => void onGuardar(nombre, meses.trim() ? Number(meses) : null, c.vigente)}>Guardar</button>
      <button className="btn-link" type="button" onClick={() => void onGuardar(c.nombre, c.vida_meses, !c.vigente)}>{c.vigente ? 'Desactivar' : 'Activar'}</button>
    </li>
  )
}
