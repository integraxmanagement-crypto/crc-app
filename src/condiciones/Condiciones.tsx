import { Camera, Image as Imagen, Plus, Settings, Table2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Combo } from '../Combo'
import { Esqueleto } from '../Esqueleto'
import { leerUnidades } from '../areas'
import { SelectorArea } from '../SelectorArea'
import { Aviso } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { prepararFoto } from '../inspecciones/imagen'
import { Ventana } from '../inspecciones/Ventana'
import { useSedeActiva } from '../sedeActiva'
import type { Unidad } from '../usuarios/datos'
import { ConfigurarColumnas } from './ConfigurarColumnas'
import {
  type Condicion, enlaceFotoCondicion, enviarPendientes, esFalloDeRed, guardarCondicion, leerColumnas, leerTarjetas, listarCondiciones, personasDeSede, subirFotoCondicion, validarCierre,
} from './datos'
import { type CacheSede, type Pendiente, guardarCache, guardarPendiente, leerCache, pendientesDe } from './local'
import {
  type Columna, type EstadoCondicion, type Matriz, NOMBRE_ESTADO_CONDICION, RESPONSABLE_QUE_CARGA, TEXTOS, type Tarjeta, cumpleTarjeta, esAutomatica, estadoDe, faltantes, textoDe, valorDe,
} from './reglas'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const CLASE: Record<EstadoCondicion, string> = { pendiente: 'chip-aviso', atrasado: 'chip-mal', dentro_plazo: 'chip-ok', fuera_plazo: 'chip-gris' }
type Persona = { id: string; nombre: string }
type Fila = Condicion & { enEquipo?: boolean; error?: string }
const SIN_COLUMNAS: Columna[] = []

/** Una condición cargada en este equipo, con la forma de una fila de la matriz (siempre borrador hasta que llegue al servidor). */
function filaDePendiente(p: Pendiente, columnas: Columna[], personas: Persona[], cuenta: string): Fila {
  const v = p.valores
  const datos: Record<string, unknown> = {}
  for (const c of columnas) {
    if (['fecha_hallazgo', 'fecha_programada', 'fecha_cierre'].includes(c.clave) || esAutomatica(c)) continue
    if (v[c.clave] != null && v[c.clave] !== '') datos[c.clave] = c.tipo === 'foto' ? 'en-equipo' : v[c.clave]
    if (c.tipo === 'persona') datos[`${c.clave}_nombre`] = String(v[`${c.clave}_nombre`] ?? personas.find((x) => x.id === v[c.clave])?.nombre ?? '')
  }
  return {
    id: p.id, sede_id: p.sede_id, creado_por: cuenta, creado_por_nombre: personas.find((x) => x.id === cuenta)?.nombre ?? 'Tú', creado_en: p.creado_en, borrador: true, enEquipo: true, error: p.error,
    fecha_hallazgo: String(v.fecha_hallazgo ?? hoyLocal()), fecha_programada: v.fecha_programada ? String(v.fecha_programada) : null, fecha_cierre: null, datos,
  }
}

/**
 * Gestión de condiciones (pedido del dueño, 05/11/2026): matriz por sede de condiciones cargadas a mano. Cargan el administrador general, el
 * administrador de sede y el gestor. Los administradores configuran las columnas y las tarjetas; el gestor propone y un administrador decide.
 * Funciona sin señal: la matriz se ve desde la copia del equipo y lo que se carga espera, como borrador, hasta que haya señal.
 */
export function Condiciones({ cuenta, empresaId, sedes, rolCodigo, online, matriz = 'condiciones' }: { cuenta: string; empresaId: string; sedes: { id: string; nombre: string }[]; rolCodigo: string; online: boolean; matriz?: Matriz }) {
  const textos = TEXTOS[matriz]
  const activa = useSedeActiva()
  const [elegida, setElegida] = useState('')
  const sedeId = [elegida, activa].find((x) => sedes.some((s) => s.id === x)) ?? sedes[0]?.id ?? ''
  const [vista, setVista] = useState<'tabla' | 'nueva' | 'configurar'>('tabla')
  const [cargado, setCargado] = useState<(Omit<CacheSede, 'id'> & { desde_servidor: boolean }) | null>(null)
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [editando, setEditando] = useState<Fila | null>(null)
  const [cerrando, setCerrando] = useState<Fila | null>(null)
  const [filtro, setFiltro] = useState<{ tipo: 'estado'; valor: EstadoCondicion } | { tipo: 'tarjeta'; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const sede = sedes.find((s) => s.id === sedeId)
  const esAdmin = rolCodigo === 'admin_empresa' || rolCodigo === 'admin_sede'
  const datos = cargado?.sede_id === sedeId && cargado.matriz === matriz ? cargado : null

  const recargarPendientes = useCallback(() => pendientesDe(cuenta, sedeId, matriz).then(setPendientes), [cuenta, sedeId, matriz])

  const cargar = useCallback(() => {
    if (!sedeId) return Promise.resolve()
    if (!online) {
      return leerCache(cuenta, sedeId, matriz).then((c) => {
        if (c) setCargado({ ...c, desde_servidor: false })
        else setError('Abre esta sección una vez con señal para poder usarla sin señal.')
        return recargarPendientes()
      })
    }
    return enviarPendientes(cuenta)
      .then((r) => { if (r.enviadas) setAviso(`Se enviaron ${r.enviadas} ${r.enviadas === 1 ? textos.una : textos.unas} cargados sin señal.`) })
      .catch(() => {})
      .then(() => leerColumnas(sedeId, matriz))
      .then((columnas) => Promise.all([listarCondiciones(sedeId, matriz), personasDeSede(sedeId), leerTarjetas(sedeId, matriz), leerUnidades(empresaId).catch(() => [] as Unidad[])]).then(([filas, personas, tarjetas, unidades]) => {
        const c = { cuenta, matriz, sede_id: sedeId, empresa_id: empresaId, guardado_en: new Date().toISOString(), columnas, tarjetas, filas, personas, unidades }
        setCargado({ ...c, desde_servidor: true })
        setError(null)
        void guardarCache(c)
      }))
      .catch((e) => {
        if (esFalloDeRed(e)) return leerCache(cuenta, sedeId, matriz).then((c) => { if (c) setCargado({ ...c, desde_servidor: false }); else setError((e as Error).message) })
        setError((e as Error).message)
      })
      .then(() => recargarPendientes())
  }, [sedeId, online, cuenta, empresaId, matriz, textos, recargarPendientes])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const hoy = hoyLocal()
  const columnas = datos?.columnas ?? SIN_COLUMNAS
  const visibles = columnas.filter((c) => c.visible)
  const filas: Fila[] = [...pendientes.map((p) => filaDePendiente(p, columnas, datos?.personas ?? [], cuenta)), ...(datos?.filas ?? [])]
  const estadoVisible = (f: Fila): EstadoCondicion | 'borrador' => (f.borrador ? 'borrador' : estadoDe(f, hoy))
  const mostradas = filas.filter((f) => {
    if (!filtro) return true
    if (filtro.tipo === 'estado') return !f.borrador && estadoDe(f, hoy) === filtro.valor
    const t = datos?.tarjetas.find((x) => x.id === filtro.id)
    return t ? cumpleTarjeta(t, f, columnas, hoy) : true
  })
  const cuentaEstado = (e: EstadoCondicion) => filas.filter((f) => !f.borrador && estadoDe(f, hoy) === e).length
  const cuentaTarjeta = (t: Tarjeta) => filas.filter((f) => cumpleTarjeta(t, f, columnas, hoy)).length

  if (!sedes.length) return <div className="detalle"><p className="aviso-suave">Tu cuenta todavía no tiene una sede asignada.</p></div>

  return (
    <div className="detalle">
      <header className="detalle-cab">
        <h1>{textos.titulo}</h1>
        <p>{textos.subtitulo}</p>
      </header>
      {sedes.length > 1 && (
        <label className="field">
          <span>Sede</span>
          <select value={sedeId} onChange={(e) => { setElegida(e.target.value); setVista('tabla'); setFiltro(null) }}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>
      {!online && datos && <p className="aviso-suave">Sin señal: ves la última copia de este equipo ({new Date(datos.guardado_en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}). Lo que cargues quedará como borrador y se enviará cuando haya señal.</p>}
      {!datos ? (
        !error && <Esqueleto forma="lista" />
      ) : (
        <>
          <div className="tarjetas-cond" role="group" aria-label="Condiciones que requieren atención">
            {datos.tarjetas.map((t) => {
              const n = cuentaTarjeta(t)
              const act = filtro?.tipo === 'tarjeta' && filtro.id === t.id
              return (
                <button key={t.id} type="button" className={`tarjeta-cond ${n > 0 ? 'atencion' : ''}`} aria-pressed={act} onClick={() => { setFiltro(act ? null : { tipo: 'tarjeta', id: t.id }); setVista('tabla') }}>
                  <b>{n}</b>
                  <span>{t.titulo}</span>
                </button>
              )
            })}
          </div>
          <div className="filtros" role="group" aria-label="Qué quieres hacer">
            <button type="button" aria-pressed={vista === 'tabla'} onClick={() => { setVista('tabla'); setEditando(null) }}><Table2 size={16} aria-hidden="true" /> Matriz</button>
            <button type="button" aria-pressed={vista === 'nueva'} onClick={() => { setEditando(null); setVista('nueva'); setAviso(null) }}><Plus size={16} aria-hidden="true" /> {textos.nueva}</button>
            <button type="button" aria-pressed={vista === 'configurar'} onClick={() => setVista('configurar')}><Settings size={16} aria-hidden="true" /> {esAdmin ? 'Configurar columnas y tarjetas' : 'Proponer cambios a las columnas'}</button>
          </div>

          {vista === 'tabla' && (
            <>
              <div className="filtros" role="group" aria-label="Filtrar por estado">
                <button type="button" aria-pressed={filtro === null} onClick={() => setFiltro(null)}>Todas ({filas.length})</button>
                {(Object.keys(NOMBRE_ESTADO_CONDICION) as EstadoCondicion[]).map((e) => (
                  <button key={e} type="button" aria-pressed={filtro?.tipo === 'estado' && filtro.valor === e} onClick={() => setFiltro({ tipo: 'estado', valor: e })}>{NOMBRE_ESTADO_CONDICION[e]} ({cuentaEstado(e)})</button>
                ))}
              </div>
              <p className="nota"><span className="marca-obligatoria" aria-hidden="true">*</span> Columna obligatoria al cargar. Si falta algo obligatorio, queda como borrador.</p>
              {mostradas.length === 0 ? (
                <p className="nota">{filas.length ? 'No hay condiciones con ese filtro.' : `Todavía no hay ${textos.unas} en ${sede?.nombre ?? 'esta sede'}. Pulsa «${textos.nueva}».`}</p>
              ) : (
                <div className="tabla-scroll">
                  <table className={`tabla tabla-condiciones${matriz === 'planes' ? ' tabla-planes' : ''}`}>
                    <thead>
                      <tr>
                        {visibles.map((c) => (
                          <th key={c.clave} scope="col">
                            {c.nombre}
                            {c.obligatoria && !esAutomatica(c) && c.clave !== 'fecha_cierre' && <span className="marca-obligatoria" title="Obligatoria"> *<span className="solo-lectores"> (obligatoria)</span></span>}
                          </th>
                        ))}
                        <th scope="col"><span className="solo-lectores">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mostradas.map((f) => (
                        <tr key={f.id} className={f.borrador ? 'fila-borrador' : ''}>
                          {visibles.map((c) => <td key={c.clave}><Celda c={c} f={f} estado={estadoVisible(f)} alCerrar={() => setCerrando(f)} /></td>)}
                          <td>
                            <button className="btn-link" type="button" onClick={() => { setEditando(f); setVista('nueva'); setAviso(null) }}>{f.borrador ? 'Completar' : 'Editar'}</button>
                            {f.error && <small className="error-linea">No se pudo enviar: {f.error}</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {vista === 'nueva' && (
            <Formulario key={editando?.id ?? 'nueva'} matriz={matriz} sedeId={sedeId} empresaId={empresaId} cuenta={cuenta} columnas={columnas} personas={datos.personas} unidades={datos.unidades} online={online} editando={editando}
              onListo={async (m) => { setAviso(m); setEditando(null); setVista('tabla'); await cargar() }}
              onUnidades={() => leerUnidades(empresaId).then((u) => setCargado((c) => (c ? { ...c, unidades: u } : c)), () => {})}
              onCancelar={() => { setEditando(null); setVista('tabla') }} />
          )}

          {vista === 'configurar' && <ConfigurarColumnas sedeId={sedeId} matriz={matriz} columnas={columnas} tarjetas={datos.tarjetas} esAdmin={esAdmin} online={online} onCambio={cargar} />}
        </>
      )}

      {cerrando && (
        <Ventana titulo="Validar cierre" onCerrar={() => setCerrando(null)}>
          <CierreForm f={cerrando} onListo={async () => { setCerrando(null); setAviso('Cierre validado.'); await cargar() }} onCancelar={() => setCerrando(null)} />
        </Ventana>
      )}
    </div>
  )
}

function CierreForm({ f, onListo, onCancelar }: { f: Fila; onListo: () => Promise<void>; onCancelar: () => void }) {
  const [fecha, setFecha] = useState(hoyLocal())
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function enviar() {
    setError(null)
    if (fecha < f.fecha_hallazgo) return setError('La fecha de cierre no puede ser anterior a la fecha de hallazgo.')
    setOcupado(true)
    try {
      await validarCierre(f.id, fecha)
      await onListo()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }
  return (
    <form className="subform" onSubmit={(e) => { e.preventDefault(); void enviar() }}>
      <label className="field">
        <span>Fecha de cierre</span>
        <input type="date" required value={fecha} min={f.fecha_hallazgo} max={hoyLocal()} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Validar cierre'}</button>
        <button className="btn-sec" type="button" disabled={ocupado} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

function Celda({ c, f, estado, alCerrar }: { c: Columna; f: Fila; estado: EstadoCondicion | 'borrador'; alCerrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)
  if (c.tipo === 'estado') {
    return estado === 'borrador'
      ? <span className="chip chip-aviso">{f.enEquipo ? 'Borrador (en este equipo)' : 'Borrador'}</span>
      : <span className={`chip ${CLASE[estado]}`}>{NOMBRE_ESTADO_CONDICION[estado]}</span>
  }
  if (c.clave === 'fecha_cierre') {
    if (f.fecha_cierre) return <>{fechaCorta(f.fecha_cierre)}</>
    return <button className="btn-sec btn-validar" type="button" disabled={f.borrador} title={f.borrador ? 'Completa primero los datos de la condición' : undefined} onClick={alCerrar}>Validar cierre</button>
  }
  if (c.tipo === 'responsable_auto') return <>{f.creado_por_nombre}</>
  if (c.tipo === 'fecha') {
    const v = valorDe(f, c.clave)
    return <>{typeof v === 'string' && v ? fechaCorta(v) : ''}</>
  }
  if (c.tipo === 'persona') return <>{String(f.datos[`${c.clave}_nombre`] ?? (RESPONSABLE_QUE_CARGA.includes(c.clave) ? f.creado_por_nombre : ''))}</>
  if (c.tipo === 'foto') {
    const ruta = f.datos[c.clave]
    if (typeof ruta !== 'string') return null
    if (ruta === 'en-equipo') return <small>Foto en este equipo</small>
    // Un solo clic: la foto se ve en una ventana pequeña dentro de la misma página (pedido del dueño, 05/11/2026).
    return (
      <>
        <button className="btn-link" type="button" onClick={() => { setFallo(false); enlaceFotoCondicion(ruta).then(setUrl, () => setFallo(true)) }}>
          {fallo ? 'No se pudo abrir. Reintentar' : 'Ver foto'}
        </button>
        {url && (
          <Ventana titulo="Evidencia" onCerrar={() => setUrl(null)}>
            <img className="foto-evidencia" src={url} alt="Foto de evidencia de la condición" />
          </Ventana>
        )}
      </>
    )
  }
  return <>{textoDe(valorDe(f, c.clave), c.tipo)}</>
}

function Formulario({ matriz, sedeId, empresaId, cuenta, columnas, personas, unidades, online, editando, onListo, onUnidades, onCancelar }: {
  matriz: Matriz; sedeId: string; empresaId: string; cuenta: string; columnas: Columna[]; personas: Persona[]; unidades: Unidad[]; online: boolean; editando: Fila | null
  onListo: (mensaje: string) => Promise<void>; onUnidades: () => void; onCancelar: () => void
}) {
  const textos = TEXTOS[matriz]
  const [id] = useState(() => editando?.id ?? crypto.randomUUID())
  const [valores, setValores] = useState<Record<string, unknown>>(() => {
    if (!editando) {
      const yo = personas.find((p) => p.id === cuenta)
      const quien = columnas.find((c) => RESPONSABLE_QUE_CARGA.includes(c.clave))?.clave
      return { fecha_hallazgo: hoyLocal(), ...(yo && quien ? { [quien]: yo.id, [`${quien}_nombre`]: yo.nombre } : {}) }
    }
    const v: Record<string, unknown> = { ...editando.datos }
    for (const k of ['fecha_hallazgo', 'fecha_programada'] as const) v[k] = editando[k] ?? ''
    for (const c of columnas) if (c.tipo === 'foto' && v[c.clave] === 'en-equipo') delete v[c.clave]
    return v
  })
  const [foto, setFoto] = useState<Record<string, Blob>>({})
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const poner = (clave: string, valor: unknown) => setValores((v) => ({ ...v, [clave]: valor }))
  const visibles = columnas.filter((c) => c.visible && c.clave !== 'fecha_cierre')

  async function guardar() {
    setError(null)
    const completos = { ...valores }
    for (const c of visibles) if (c.tipo === 'foto' && foto[c.clave]) completos[c.clave] = 'foto'
    const faltan = faltantes(visibles, completos)
    const envio: Record<string, unknown> = { ...valores }
    setOcupado(true)
    const alEquipo = async () => {
      await guardarPendiente({ id, cuenta, matriz, sede_id: sedeId, empresa_id: empresaId, valores: envio, creado_en: new Date().toISOString() }, foto)
      await onListo(`Guardado en este equipo como borrador${faltan.length ? ` (falta: ${faltan.join(', ')})` : ''}. Se enviará cuando haya señal.`)
    }
    try {
      if (!online) return await alEquipo()
      for (const c of visibles) if (c.tipo === 'foto' && foto[c.clave]) envio[c.clave] = await subirFotoCondicion(empresaId, id, foto[c.clave])
      await guardarCondicion(id, sedeId, envio, faltan.length > 0, matriz)
      await onListo(faltan.length ? `Guardado como borrador. Falta: ${faltan.join(', ')}.` : editando ? 'Cambios guardados.' : 'Guardado.')
    } catch (e) {
      if (esFalloDeRed(e)) {
        try { return await alEquipo() } catch (e2) { setError((e2 as Error).message) }
      } else setError((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <form className="subform" noValidate onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <h2>{editando ? (editando.borrador ? `Completar ${textos.una}` : `Editar ${textos.una}`) : textos.nueva}</h2>
      <p className="nota"><span className="marca-obligatoria" aria-hidden="true">*</span> Obligatorio. Si dejas algo obligatorio sin completar, se guarda como borrador y requiere atención. La fecha de cierre se pone después, con «Validar cierre».</p>
      {visibles.map((c) => (
        <Campo key={c.clave} c={c} valor={valores[c.clave]} valores={valores} personas={personas} unidades={unidades} empresaId={empresaId} online={online} foto={foto[c.clave]}
          onValor={(v) => poner(c.clave, v)} onVarios={(p) => setValores((v) => ({ ...v, ...p }))} onFoto={(b) => setFoto((f) => ({ ...f, [c.clave]: b }))} onError={setError} onUnidades={onUnidades} />
      ))}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : `Guardar ${textos.una}`}</button>
        <button className="btn-sec" type="button" disabled={ocupado} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

function Campo({ c, valor, valores, personas, unidades, empresaId, online, foto, onValor, onVarios, onFoto, onError, onUnidades }: {
  c: Columna; valor: unknown; valores: Record<string, unknown>; personas: Persona[]; unidades: Unidad[]; empresaId: string; online: boolean; foto: Blob | undefined
  onValor: (v: unknown) => void; onVarios: (p: Record<string, unknown>) => void; onFoto: (b: Blob) => void; onError: (m: string) => void; onUnidades: () => void
}) {
  const marca = c.obligatoria || c.tipo === 'descripcion' ? <span className="marca-obligatoria" aria-hidden="true"> *</span> : null
  const texto = typeof valor === 'string' ? valor : ''
  if (c.tipo === 'estado') return <p className="nota"><b>{c.nombre}:</b> se calcula solo con las fechas.</p>
  if (c.tipo === 'responsable_auto') return <p className="nota"><b>{c.nombre}:</b> la cuenta de quien guarda la condición (se completa sola).</p>
  if (c.tipo === 'descripcion') {
    const d = (valor ?? {}) as { peligro?: string; riesgo?: string }
    return (
      <fieldset className="field">
        <legend>{c.nombre}{marca}</legend>
        <label className="field"><span>Peligro observado{marca}</span>
          <textarea rows={2} maxLength={500} value={d.peligro ?? ''} onChange={(e) => onValor({ ...d, peligro: e.target.value })} /></label>
        <label className="field"><span>Riesgo asociado{marca}</span>
          <textarea rows={2} maxLength={500} value={d.riesgo ?? ''} onChange={(e) => onValor({ ...d, riesgo: e.target.value })} /></label>
      </fieldset>
    )
  }
  if (c.tipo === 'area') {
    return <SelectorArea empresaId={empresaId} unidades={unidades} texto={texto} elegido={typeof valores[`${c.clave}_id`] === 'string' ? (valores[`${c.clave}_id`] as string) : null} etiqueta={c.nombre} marca={marca} online={online}
      onCambio={(t, id) => onVarios({ [c.clave]: t, [`${c.clave}_id`]: id })} onUnidadesCambio={onUnidades} />
  }
  if (c.tipo === 'persona') {
    return (
      <Combo etiqueta={c.nombre} marca={marca} placeholder="Escribe para buscar a la persona" opciones={personas.map((p) => ({ id: p.id, texto: p.nombre }))}
        texto={String(valores[`${c.clave}_nombre`] ?? '')} elegido={texto || null} vacio="No hay personas con ese nombre."
        onTexto={(t) => onVarios({ [`${c.clave}_nombre`]: t })}
        onElegir={(o) => onVarios(o ? { [c.clave]: o.id, [`${c.clave}_nombre`]: o.texto } : { [c.clave]: '' })} />
    )
  }
  if (c.tipo === 'foto') {
    const ruta = typeof valor === 'string' && valor !== 'foto' ? valor : null
    const leer = (e: React.ChangeEvent<HTMLInputElement>) => {
      const a = e.target.files?.[0]
      e.target.value = ''
      if (a) prepararFoto(a).then((f) => onFoto(f.blob), (err) => onError((err as Error).message))
    }
    return (
      <div className="field">
        <span>{c.nombre}{marca}</span>
        <div className="acciones">
          <label className="btn-sec boton-foto"><Camera size={16} aria-hidden="true" /> Tomar foto
            <input type="file" accept="image/*" capture="environment" hidden onChange={leer} /></label>
          <label className="btn-sec boton-foto"><Imagen size={16} aria-hidden="true" /> Elegir de la galería
            <input type="file" accept="image/*" hidden onChange={leer} /></label>
        </div>
        <small className="ayuda">{foto ? `Foto lista (${Math.round(foto.size / 1024)} KB)` : ruta ? 'Ya tiene una foto guardada; elige otra para cambiarla.' : 'Sin foto todavía.'}</small>
      </div>
    )
  }
  if (c.tipo === 'fecha') {
    return <label className="field"><span>{c.nombre}{marca}</span><input type="date" value={texto} onChange={(e) => onValor(e.target.value)} /></label>
  }
  if (c.tipo === 'numero') {
    return <label className="field"><span>{c.nombre}{marca}</span><input type="number" value={typeof valor === 'number' ? valor : ''} onChange={(e) => onValor(e.target.value === '' ? '' : Number(e.target.value))} /></label>
  }
  if (c.tipo === 'lista') {
    return (
      <label className="field"><span>{c.nombre}{marca}</span>
        <select value={texto} onChange={(e) => onValor(e.target.value)}>
          <option value="">— Elige —</option>
          {c.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
        </select></label>
    )
  }
  if (c.tipo === 'multiple') {
    const elegidas = Array.isArray(valor) ? (valor as string[]) : []
    return (
      <fieldset className="field"><legend>{c.nombre}{marca}</legend>
        {c.opciones.map((o) => (
          <label key={o} className="check-linea"><input type="checkbox" checked={elegidas.includes(o)} onChange={(e) => onValor(e.target.checked ? [...elegidas, o] : elegidas.filter((x) => x !== o))} /> {o}</label>
        ))}
      </fieldset>
    )
  }
  return <label className="field"><span>{c.nombre}{marca}</span><input type="text" maxLength={500} value={texto} onChange={(e) => onValor(e.target.value)} /></label>
}
