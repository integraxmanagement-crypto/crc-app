import { Camera, Image as Imagen, Plus, Settings, Table2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Esqueleto } from '../Esqueleto'
import { Aviso } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { prepararFoto } from '../inspecciones/imagen'
import { useSedeActiva } from '../sedeActiva'
import { ConfigurarColumnas } from './ConfigurarColumnas'
import { type Condicion, enlaceFotoCondicion, guardarCondicion, leerColumnas, listarCondiciones, personasDeSede, subirFotoCondicion } from './datos'
import { type Columna, type EstadoCondicion, NOMBRE_ESTADO_CONDICION, esAutomatica, estadoDe, faltantes, textoDe, valorDe } from './reglas'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const CLASE: Record<EstadoCondicion, string> = { pendiente: 'chip-aviso', atrasado: 'chip-mal', dentro_plazo: 'chip-ok', fuera_plazo: 'chip-gris' }

/**
 * Gestión de condiciones (pedido del dueño, 05/11/2026): matriz por sede de condiciones cargadas a mano. Cargan el administrador general, el
 * administrador de sede y el gestor. Los administradores configuran las columnas; el gestor propone y un administrador decide.
 */
export function Condiciones({ empresaId, sedes, rolCodigo, online }: { empresaId: string; sedes: { id: string; nombre: string }[]; rolCodigo: string; online: boolean }) {
  const activa = useSedeActiva()
  // La sede es la que eligió en el selector de la barra; si hay varias y no eligió ninguna, la primera. Aquí también se puede cambiar.
  const [elegida, setElegida] = useState('')
  const sedeId = [elegida, activa].find((x) => sedes.some((s) => s.id === x)) ?? sedes[0]?.id ?? ''
  const setSedeId = setElegida
  const [vista, setVista] = useState<'tabla' | 'nueva' | 'configurar'>('tabla')
  const [cargado, setCargado] = useState<{ sede: string; columnas: Columna[]; filas: Condicion[]; personas: { id: string; nombre: string }[] } | null>(null)
  const columnas = cargado?.sede === sedeId ? cargado.columnas : null
  const filas = cargado?.sede === sedeId ? cargado.filas : null
  const personas = cargado?.sede === sedeId ? cargado.personas : []
  const [editando, setEditando] = useState<Condicion | null>(null)
  const [filtro, setFiltro] = useState<EstadoCondicion | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const sede = sedes.find((s) => s.id === sedeId)
  const esAdmin = rolCodigo === 'admin_empresa' || rolCodigo === 'admin_sede'

  const cargar = useCallback(() => {
    if (!sedeId || !online) return Promise.resolve()
    return leerColumnas(sedeId)
      .then((cols) => Promise.all([listarCondiciones(sedeId), personasDeSede(sedeId)]).then(([lista, quienes]) => {
        setCargado({ sede: sedeId, columnas: cols, filas: lista, personas: quienes })
        setError(null)
      }))
      .catch((e) => setError((e as Error).message))
  }, [sedeId, online])
  useEffect(() => {
    void cargar()
  }, [cargar])

  const hoy = hoyLocal()
  const visibles = useMemo(() => (columnas ?? []).filter((c) => c.visible), [columnas])
  const mostradas = useMemo(() => (filas ?? []).filter((f) => !filtro || estadoDe(f, hoy) === filtro), [filas, filtro, hoy])
  const cuentaDe = (e: EstadoCondicion) => (filas ?? []).filter((f) => estadoDe(f, hoy) === e).length

  if (!sedes.length) return <div className="detalle"><p className="aviso-suave">Tu cuenta todavía no tiene una sede asignada.</p></div>

  return (
    <div className="detalle">
      <header className="detalle-cab">
        <h1>Gestión de condiciones</h1>
        <p>Matriz de condiciones de la sede: cárgalas, dales plazo y sigue su cierre.</p>
      </header>
      {sedes.length > 1 && (
        <label className="field">
          <span>Sede</span>
          <select value={sedeId} onChange={(e) => { setSedeId(e.target.value); setVista('tabla') }}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>
      {!online ? (
        <p className="aviso-suave">La gestión de condiciones necesita señal.</p>
      ) : !columnas || !filas ? (
        !error && <Esqueleto forma="lista" />
      ) : (
        <>
          <div className="filtros" role="group" aria-label="Qué quieres hacer">
            <button type="button" aria-pressed={vista === 'tabla'} onClick={() => { setVista('tabla'); setEditando(null) }}><Table2 size={16} aria-hidden="true" /> Matriz</button>
            <button type="button" aria-pressed={vista === 'nueva'} onClick={() => { setEditando(null); setVista('nueva'); setAviso(null) }}><Plus size={16} aria-hidden="true" /> Nueva condición</button>
            <button type="button" aria-pressed={vista === 'configurar'} onClick={() => setVista('configurar')}><Settings size={16} aria-hidden="true" /> {esAdmin ? 'Configurar columnas' : 'Proponer cambios a las columnas'}</button>
          </div>

          {vista === 'tabla' && (
            <>
              <div className="filtros" role="group" aria-label="Filtrar por estado">
                <button type="button" aria-pressed={filtro === ''} onClick={() => setFiltro('')}>Todas ({filas.length})</button>
                {(Object.keys(NOMBRE_ESTADO_CONDICION) as EstadoCondicion[]).map((e) => (
                  <button key={e} type="button" aria-pressed={filtro === e} onClick={() => setFiltro(e)}>{NOMBRE_ESTADO_CONDICION[e]} ({cuentaDe(e)})</button>
                ))}
              </div>
              <p className="nota"><span className="marca-obligatoria" aria-hidden="true">*</span> Columna obligatoria al cargar una condición.</p>
              {mostradas.length === 0 ? (
                <p className="nota">{filas.length ? 'No hay condiciones con ese estado.' : `Todavía no hay condiciones en ${sede?.nombre ?? 'esta sede'}. Pulsa «Nueva condición».`}</p>
              ) : (
                <div className="tabla-scroll">
                  <table className="tabla tabla-condiciones">
                    <thead>
                      <tr>
                        {visibles.map((c) => (
                          <th key={c.clave} scope="col">
                            {c.nombre}
                            {c.obligatoria && !esAutomatica(c) && <span className="marca-obligatoria" title="Obligatoria"> *<span className="solo-lectores"> (obligatoria)</span></span>}
                          </th>
                        ))}
                        <th scope="col"><span className="solo-lectores">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mostradas.map((f) => (
                        <tr key={f.id}>
                          {visibles.map((c) => <td key={c.clave}><Celda c={c} f={f} hoy={hoy} /></td>)}
                          <td><button className="btn-link" type="button" onClick={() => { setEditando(f); setVista('nueva'); setAviso(null) }}>Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {vista === 'nueva' && (
            <Formulario key={editando?.id ?? 'nueva'} sedeId={sedeId} empresaId={empresaId} columnas={columnas} personas={personas} editando={editando}
              onListo={async () => { setAviso(editando ? 'Condición actualizada.' : 'Condición guardada.'); setEditando(null); setVista('tabla'); await cargar() }}
              onCancelar={() => { setEditando(null); setVista('tabla') }} />
          )}

          {vista === 'configurar' && <ConfigurarColumnas sedeId={sedeId} columnas={columnas} esAdmin={esAdmin} onCambio={cargar} />}
        </>
      )}
    </div>
  )
}

function Celda({ c, f, hoy }: { c: Columna; f: Condicion; hoy: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)
  if (c.tipo === 'estado') {
    const e = estadoDe(f, hoy)
    return <span className={`chip ${CLASE[e]}`}>{NOMBRE_ESTADO_CONDICION[e]}</span>
  }
  if (c.tipo === 'responsable_auto') return <>{f.creado_por_nombre}</>
  if (c.tipo === 'fecha') {
    const v = valorDe(f, c.clave)
    return <>{typeof v === 'string' && v ? fechaCorta(v) : ''}</>
  }
  if (c.tipo === 'persona') return <>{String(f.datos[`${c.clave}_nombre`] ?? '')}</>
  if (c.tipo === 'foto') {
    const ruta = f.datos[c.clave]
    if (typeof ruta !== 'string') return null
    if (url) return <a href={url} target="_blank" rel="noreferrer">Abrir foto</a>
    return (
      <button className="btn-link" type="button" onClick={() => enlaceFotoCondicion(ruta).then(setUrl, () => setFallo(true))}>
        {fallo ? 'No se pudo abrir' : 'Ver foto'}
      </button>
    )
  }
  return <>{textoDe(valorDe(f, c.clave), c.tipo)}</>
}

function Formulario({ sedeId, empresaId, columnas, personas, editando, onListo, onCancelar }: {
  sedeId: string; empresaId: string; columnas: Columna[]; personas: { id: string; nombre: string }[]; editando: Condicion | null
  onListo: () => Promise<void>; onCancelar: () => void
}) {
  const [id] = useState(() => editando?.id ?? crypto.randomUUID())
  const [valores, setValores] = useState<Record<string, unknown>>(() => {
    if (!editando) return { fecha_hallazgo: hoyLocal() }
    const v: Record<string, unknown> = { ...editando.datos }
    for (const k of ['fecha_hallazgo', 'fecha_programada', 'fecha_cierre'] as const) v[k] = editando[k] ?? ''
    return v
  })
  const [foto, setFoto] = useState<Record<string, Blob>>({})
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const poner = (clave: string, valor: unknown) => setValores((v) => ({ ...v, [clave]: valor }))
  const visibles = columnas.filter((c) => c.visible)

  async function guardar() {
    setError(null)
    // La foto elegida cuenta como completada aunque todavía no se haya subido.
    const completos = { ...valores }
    for (const c of visibles) if (c.tipo === 'foto' && foto[c.clave]) completos[c.clave] = 'foto'
    const faltan = faltantes(visibles, completos)
    if (faltan.length) return setError(`Falta completar: ${faltan.join(', ')}.`)
    setOcupado(true)
    try {
      const envio: Record<string, unknown> = { ...valores }
      for (const c of visibles) if (c.tipo === 'foto' && foto[c.clave]) envio[c.clave] = await subirFotoCondicion(empresaId, id, foto[c.clave])
      await guardarCondicion(id, sedeId, envio)
      await onListo()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <form className="subform" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <h2>{editando ? 'Editar condición' : 'Nueva condición'}</h2>
      <p className="nota"><span className="marca-obligatoria" aria-hidden="true">*</span> Obligatorio. La descripción siempre pide el peligro observado y el riesgo asociado.</p>
      {visibles.map((c) => (
        <Campo key={c.clave} c={c} valor={valores[c.clave]} personas={personas} foto={foto[c.clave]} onValor={(v) => poner(c.clave, v)} onFoto={(b) => setFoto((f) => ({ ...f, [c.clave]: b }))} onError={setError} />
      ))}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar condición'}</button>
        <button className="btn-sec" type="button" disabled={ocupado} onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

function Campo({ c, valor, personas, foto, onValor, onFoto, onError }: {
  c: Columna; valor: unknown; personas: { id: string; nombre: string }[]; foto: Blob | undefined
  onValor: (v: unknown) => void; onFoto: (b: Blob) => void; onError: (m: string) => void
}) {
  const marca = c.obligatoria || c.tipo === 'descripcion' ? <span className="marca-obligatoria" aria-hidden="true"> *</span> : null
  const requerido = c.obligatoria || c.tipo === 'descripcion'
  const texto = typeof valor === 'string' ? valor : ''
  if (c.tipo === 'estado') return <p className="nota"><b>{c.nombre}:</b> se calcula solo con las fechas.</p>
  if (c.tipo === 'responsable_auto') return <p className="nota"><b>{c.nombre}:</b> la cuenta de quien guarda la condición (se completa sola).</p>
  if (c.tipo === 'descripcion') {
    const d = (valor ?? {}) as { peligro?: string; riesgo?: string }
    return (
      <fieldset className="field">
        <legend>{c.nombre}{marca}</legend>
        <label className="field"><span>Peligro observado{marca}</span>
          <textarea rows={2} maxLength={500} required value={d.peligro ?? ''} onChange={(e) => onValor({ ...d, peligro: e.target.value })} /></label>
        <label className="field"><span>Riesgo asociado{marca}</span>
          <textarea rows={2} maxLength={500} required value={d.riesgo ?? ''} onChange={(e) => onValor({ ...d, riesgo: e.target.value })} /></label>
      </fieldset>
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
    return <label className="field"><span>{c.nombre}{marca}</span><input type="date" required={requerido} value={texto} onChange={(e) => onValor(e.target.value)} /></label>
  }
  if (c.tipo === 'numero') {
    return <label className="field"><span>{c.nombre}{marca}</span><input type="number" required={requerido} value={typeof valor === 'number' ? valor : ''} onChange={(e) => onValor(e.target.value === '' ? '' : Number(e.target.value))} /></label>
  }
  if (c.tipo === 'lista') {
    return (
      <label className="field"><span>{c.nombre}{marca}</span>
        <select required={requerido} value={texto} onChange={(e) => onValor(e.target.value)}>
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
  if (c.tipo === 'persona') {
    return (
      <label className="field"><span>{c.nombre}{marca}</span>
        <select required={requerido} value={texto} onChange={(e) => onValor(e.target.value)}>
          <option value="">— Elige una persona —</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select></label>
    )
  }
  return <label className="field"><span>{c.nombre}{marca}</span><input type="text" maxLength={500} required={requerido} value={texto} onChange={(e) => onValor(e.target.value)} /></label>
}
