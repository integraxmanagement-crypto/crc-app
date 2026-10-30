import { ArrowDown, ArrowLeft, ArrowUp, FlaskConical, Lock, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso, Campo, Seccion as Caja } from '../empresas/campos'
import { ExcelFormato } from '../inspecciones/ExcelFormato'
import { ir } from '../ruta'
import {
  type Lista, type Logo, NOMBRE_ESTADO, NOMBRE_FRECUENCIA, type Plantilla, type TipoActivo, type Version, cambiarVigenciaPlantilla,
  descartarBorrador, guardarBorrador, guardarPlantilla, leerPlantilla, listarListas, listarTipos, listarTiposBase, nuevoBorrador,
  publicarVersion,
} from './datos'
import type { Rutas } from './Formatos'
import { Prueba } from './Prueba'
import {
  type CuandoHallazgo, type Firma, type Formula, NOMBRE_FORMULA, NOMBRE_HALLAZGO, NOMBRE_REGLA, NOMBRE_TIPO, type Punto, type Receta,
  type Regla, type Seccion, TIPOS, TIPOS_EVALUABLES, type TipoRegla, puntoNuevo, siguienteClave, todosLosPuntos, validarReceta,
} from './receta'

type Encabezado = { codigo_formato: string; version_formato: string; fecha_aprobacion: string; logo: Logo }

function mover<T>(lista: T[], i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= lista.length) return
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
}

/** Prefijo para las claves de los puntos nuevos: el de los puntos que ya hay (EXT, CAR…) o «P». */
function prefijo(r: Receta) {
  const conteo = new Map<string, number>()
  for (const { punto } of todosLosPuntos(r)) {
    const p = punto.clave.split('-')[0]
    conteo.set(p, (conteo.get(p) ?? 0) + 1)
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'P'
}

/**
 * Constructor de formatos por formulario (decisión del dueño, 26/10/2026): se agregan, quitan y mueven secciones y
 * puntos, se cambian textos y marcas, y se eligen las reglas de una lista fija. Solo se edita el borrador;
 * al publicarlo queda congelado. Las plantillas base de CRC se ven, pero no se editan desde una empresa.
 */
export function Editor({
  plantillaId, rutas, puedeEditar, puedePublicar,
}: { plantillaId: string; rutas: Rutas; puedeEditar: boolean; puedePublicar: boolean }) {
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null)
  const [versiones, setVersiones] = useState<Version[]>([])
  const [verId, setVerId] = useState<string | null>(null)
  const [receta, setReceta] = useState<Receta | null>(null)
  const [enc, setEnc] = useState<Encabezado>({ codigo_formato: '', version_formato: '', fecha_aprobacion: '', logo: 'positivo' })
  const [sucio, setSucio] = useState(false)
  const [listas, setListas] = useState<Lista[]>([])
  const [tipo, setTipo] = useState<TipoActivo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [probar, setProbar] = useState(false)

  const cargar = useCallback(
    async (elegir?: string) => {
      try {
        const { plantilla: p, versiones: vs } = await leerPlantilla(plantillaId)
        if (!p) throw new Error('El formato no existe o no tienes acceso.')
        const [ls, ts] = await Promise.all([listarListas(p.empresa_id), p.empresa_id ? listarTipos(p.empresa_id) : listarTiposBase()])
        setPlantilla(p)
        setVersiones(vs)
        setListas(ls)
        setTipo(ts.find((t) => t.id === p.tipo_activo_id) ?? null)
        const v = vs.find((x) => x.id === elegir) ?? vs.find((x) => x.estado === 'borrador') ?? vs.find((x) => x.estado === 'vigente') ?? vs[0]
        setVerId(v?.id ?? null)
        setReceta(v ? structuredClone(v.receta) : null)
        setEnc({
          codigo_formato: v?.codigo_formato ?? '',
          version_formato: v?.version_formato ?? '',
          fecha_aprobacion: v?.fecha_aprobacion ?? '',
          logo: v?.logo ?? 'positivo',
        })
        setSucio(false)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [plantillaId],
  )
  useEffect(() => void cargar(), [cargar])

  // Avisa antes de salir si hay cambios sin guardar.
  useEffect(() => {
    if (!sucio) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  const version = versiones.find((v) => v.id === verId) ?? null
  const esBase = plantilla?.empresa_id === null
  const editable = Boolean(puedeEditar && !esBase && version?.estado === 'borrador')
  const hayBorrador = versiones.some((v) => v.estado === 'borrador')
  const problemas = useMemo(() => (receta ? validarReceta(receta, true) : []), [receta])
  const subtipos = tipo?.subtipos ?? []

  function cambiar(fn: (r: Receta) => void) {
    setReceta((r) => {
      if (!r) return r
      const copia = structuredClone(r)
      fn(copia)
      return copia
    })
    setSucio(true)
    setOk(null)
  }

  async function hacer(fn: () => Promise<unknown>, mensajeOk: string) {
    setOcupado(true)
    setError(null)
    setOk(null)
    try {
      await fn()
      setOk(mensajeOk)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const datosBorrador = () => ({
    codigo_formato: enc.codigo_formato.trim() || null,
    version_formato: enc.version_formato.trim() || null,
    fecha_aprobacion: enc.fecha_aprobacion || null,
    logo: enc.logo,
    receta: receta!,
  })

  function guardar() {
    if (!version) return
    void hacer(async () => {
      await guardarBorrador(version.id, datosBorrador())
      await cargar(version.id)
    }, 'Borrador guardado.')
  }

  function publicar() {
    if (!version) return
    if (problemas.length) return setError('Antes de publicar, corrige lo que aparece en «Revisión del formato».')
    if (!enc.codigo_formato.trim() || !enc.version_formato.trim() || !enc.fecha_aprobacion)
      return setError('Para publicar, completa el código, la versión y la fecha de aprobación del formato.')
    if (!window.confirm(`¿Publicar la v${version.numero}? Quedará congelada y será la que se use en las inspecciones nuevas.`)) return
    void hacer(async () => {
      await guardarBorrador(version.id, datosBorrador())
      await publicarVersion(version.id)
      await cargar(version.id)
    }, `v${version.numero} publicada: queda congelada y es la que se usará en las inspecciones nuevas.`)
  }

  function descartar() {
    if (!version || !window.confirm('¿Descartar este borrador? Se pierden sus cambios.')) return
    const unico = versiones.length === 1
    void (async () => {
      setOcupado(true)
      try {
        await descartarBorrador(version.id)
        setSucio(false)
        if (unico) ir(rutas.formatos)
        else await cargar()
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setOcupado(false)
      }
    })()
  }

  function abrirBorrador() {
    void hacer(async () => {
      const id = await nuevoBorrador(plantillaId)
      await cargar(id)
    }, 'Borrador abierto: los cambios no afectan a la versión vigente ni a las inspecciones ya hechas.')
  }

  function verVersion(id: string) {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Cambiar de versión igual?')) return
    const v = versiones.find((x) => x.id === id)
    if (!v) return
    setVerId(id)
    setReceta(structuredClone(v.receta))
    setEnc({ codigo_formato: v.codigo_formato ?? '', version_formato: v.version_formato ?? '', fecha_aprobacion: v.fecha_aprobacion ?? '', logo: v.logo })
    setSucio(false)
  }

  if (!plantilla || !receta || !version) {
    return (
      <div className="detalle">
        <button className="btn-link volver" type="button" onClick={() => ir(rutas.formatos)}>
          <ArrowLeft size={18} aria-hidden="true" /> Formatos
        </button>
        <Aviso>{error}</Aviso>
        {!error && <p className="nota">Cargando…</p>}
      </div>
    )
  }

  return (
    <div className="detalle editor-formato">
      <button className="btn-link volver" type="button" onClick={() => (!sucio || window.confirm('Hay cambios sin guardar. ¿Salir igual?')) && ir(rutas.formatos)}>
        <ArrowLeft size={18} aria-hidden="true" /> Formatos
      </button>
      <header className="detalle-cab">
        <h1>{plantilla.nombre}</h1>
        <p>
          {esBase ? 'Plantilla base de CRC · ' : ''}
          {plantilla.aplica_a === 'activo' ? `Se aplica a: ${tipo?.nombre ?? 'activo'}` : 'Se aplica a un área'} ·{' '}
          {NOMBRE_FRECUENCIA[plantilla.frecuencia]}
        </p>
        <div className="chips">
          <span className={`chip ${version.estado === 'vigente' ? 'chip-ok' : version.estado === 'borrador' ? 'chip-aviso' : ''}`}>
            v{version.numero} · {NOMBRE_ESTADO[version.estado]}
          </span>
          {!editable && (
            <span className="chip">
              <Lock size={12} aria-hidden="true" /> Solo lectura
            </span>
          )}
          {sucio && <span className="chip chip-mal">Cambios sin guardar</span>}
        </div>
      </header>

      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>

      <div className="acciones barra-editor">
        {editable && (
          <button className="btn" type="button" disabled={ocupado || !sucio} onClick={guardar}>
            <Save size={18} aria-hidden="true" /> {ocupado ? 'Guardando…' : 'Guardar borrador'}
          </button>
        )}
        {editable && puedePublicar && (
          <button className="btn-sec" type="button" disabled={ocupado} onClick={publicar}>
            <Send size={18} aria-hidden="true" /> Publicar v{version.numero}
          </button>
        )}
        {puedeEditar && !esBase && !hayBorrador && (
          <button className="btn-sec" type="button" disabled={ocupado} onClick={abrirBorrador}>
            <Pencil size={18} aria-hidden="true" /> Abrir borrador para cambiarlo
          </button>
        )}
        <button className="btn-sec" type="button" onClick={() => setProbar((x) => !x)} aria-expanded={probar}>
          <FlaskConical size={18} aria-hidden="true" /> {probar ? 'Cerrar prueba' : 'Probar el formato'}
        </button>
        {editable && (
          <button className="btn-link" type="button" disabled={ocupado} onClick={descartar}>
            <Trash2 size={16} aria-hidden="true" /> Descartar borrador
          </button>
        )}
      </div>
      {editable && !puedePublicar && <p className="nota">Puedes guardar el borrador; lo publica un administrador de la empresa.</p>}

      {probar && <Prueba receta={receta} subtipos={subtipos} campos={tipo?.campos ?? []} listas={listas} />}

      {versiones.length > 1 && (
        <label className="field selector-version">
          <span>Ver otra versión</span>
          <select value={version.id} onChange={(e) => verVersion(e.target.value)}>
            {versiones.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.numero} · {NOMBRE_ESTADO[v.estado]}
                {v.publicado_en ? ` · publicada el ${new Date(v.publicado_en).toLocaleDateString('es-PE')}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!esBase && puedeEditar && <DatosPlantilla plantilla={plantilla} onCambio={() => void cargar(version.id)} />}

      <Caja titulo="Encabezado de esta versión">
        <p className="nota">Razón social, RUC, domicilio y actividad salen solos de la ficha de la empresa.</p>
        <div className="fila3">
          <Campo etiqueta="Código del formato" value={enc.codigo_formato} disabled={!editable} maxLength={40} placeholder="Lo define la empresa"
            onChange={(e) => (setEnc({ ...enc, codigo_formato: e.target.value }), setSucio(true))} />
          <Campo etiqueta="Versión" value={enc.version_formato} disabled={!editable} maxLength={20} placeholder="Ej.: 01"
            onChange={(e) => (setEnc({ ...enc, version_formato: e.target.value }), setSucio(true))} />
          <Campo etiqueta="Fecha de aprobación" type="date" value={enc.fecha_aprobacion} disabled={!editable}
            onChange={(e) => (setEnc({ ...enc, fecha_aprobacion: e.target.value }), setSucio(true))} />
        </div>
        <label className="field">
          <span>Logo en el formato</span>
          <select value={enc.logo} disabled={!editable} onChange={(e) => (setEnc({ ...enc, logo: e.target.value as Logo }), setSucio(true))}>
            <option value="positivo">Logo de la ficha (fondo claro)</option>
            <option value="negativo">Logo de la ficha (fondo oscuro)</option>
            <option value="ninguno">Sin logo</option>
          </select>
        </label>
      </Caja>

      {!esBase && plantilla.empresa_id && (
        <ExcelFormato plantillaId={plantilla.id} empresaId={plantilla.empresa_id} receta={receta} puedeEditar={puedeEditar} />
      )}

      <Caja
        titulo={`Secciones y puntos (${todosLosPuntos(receta).length} puntos)`}
        accion={
          editable ? (
            <button className="btn-sec" type="button" onClick={() => cambiar((r) => r.secciones.push({ clave: claveSeccion(r), titulo: 'Sección nueva', puntos: [] }))}>
              <Plus size={18} aria-hidden="true" /> Agregar sección
            </button>
          ) : null
        }
      >
        {receta.secciones.length === 0 && <p className="nota">Todavía no hay secciones.</p>}
        {receta.secciones.map((s, i) => (
          <TarjetaSeccion key={s.clave} receta={receta} indice={i} editable={editable} subtipos={subtipos} listas={listas}
            campos={tipo?.campos ?? []} cambiar={cambiar} />
        ))}
      </Caja>

      <EditorFirmas receta={receta} editable={editable} cambiar={cambiar} />
      <EditorReglas receta={receta} editable={editable} campos={tipo?.campos ?? []} cambiar={cambiar} />

      <Caja titulo="Revisión del formato">
        {problemas.length === 0 ? (
          <p className="aviso-ok">Está listo para publicar.</p>
        ) : (
          <ul className="problemas">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </Caja>
    </div>
  )
}

function claveSeccion(r: Receta) {
  for (let n = 1; ; n++) if (!r.secciones.some((s) => s.clave === `seccion-${n}`)) return `seccion-${n}`
}

function DatosPlantilla({ plantilla, onCambio }: { plantilla: Plantilla; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(plantilla.nombre)
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? '')
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setError(null)
    try {
      await guardarPlantilla(plantilla.id, { nombre, descripcion: descripcion || null, frecuencia: plantilla.frecuencia })
      setAbierto(false)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function alternar() {
    try {
      await cambiarVigenciaPlantilla(plantilla.id, !plantilla.vigente)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Caja
      titulo="Datos del formato"
      accion={
        !abierto ? (
          <span className="lista-acciones">
            <button className="btn-link" type="button" onClick={() => setAbierto(true)}>
              <Pencil size={16} aria-hidden="true" /> Editar
            </button>
            <button className="btn-link" type="button" onClick={() => void alternar()}>
              {plantilla.vigente ? 'Desactivar' : 'Activar'}
            </button>
          </span>
        ) : null
      }
    >
      <p className="nota">
        Un formato no tiene un período propio: la frecuencia (semanal, mensual…) se define en la actividad del programa anual de SST a la que se vincula (solo el administrador). El nombre y la
        descripción no forman parte de la versión.
      </p>
      {abierto && (
        <div className="form subform">
          <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={160} />
          <Campo etiqueta="Descripción" opcional value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} />
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => void guardar()}>
              Guardar
            </button>
            <button className="btn-link" type="button" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Caja>
  )
}

/** Botones para subir, bajar y quitar un elemento. */
function Mover({ onSubir, onBajar, onQuitar, etiqueta }: { onSubir: () => void; onBajar: () => void; onQuitar: () => void; etiqueta: string }) {
  return (
    <span className="mover">
      <button type="button" className="icono" onClick={onSubir} aria-label={`Subir ${etiqueta}`} title="Subir">
        <ArrowUp size={16} />
      </button>
      <button type="button" className="icono" onClick={onBajar} aria-label={`Bajar ${etiqueta}`} title="Bajar">
        <ArrowDown size={16} />
      </button>
      <button type="button" className="icono" onClick={onQuitar} aria-label={`Quitar ${etiqueta}`} title="Quitar">
        <X size={16} />
      </button>
    </span>
  )
}

function Subtipos({ todos, valor, onCambio, disabled }: { todos: { codigo: string; nombre: string }[]; valor: string[] | null | undefined; onCambio: (v: string[] | null) => void; disabled: boolean }) {
  if (!todos.length) return null
  const elegidos = valor ?? []
  return (
    <fieldset className="subtipos">
      <legend>Solo para estos subtipos (ninguno marcado = todos)</legend>
      {todos.map((s) => (
        <label key={s.codigo} className="check-linea">
          <input type="checkbox" disabled={disabled} checked={elegidos.includes(s.codigo)}
            onChange={(e) => {
              const v = e.target.checked ? [...elegidos, s.codigo] : elegidos.filter((x) => x !== s.codigo)
              onCambio(v.length ? v : null)
            }} />
          {s.nombre}
        </label>
      ))}
    </fieldset>
  )
}

function TarjetaSeccion({
  receta, indice, editable, subtipos, listas, campos, cambiar,
}: {
  receta: Receta; indice: number; editable: boolean; subtipos: { codigo: string; nombre: string }[]; listas: Lista[]
  campos: { clave: string; etiqueta: string; tipo: string }[]; cambiar: (fn: (r: Receta) => void) => void
}) {
  const s = receta.secciones[indice]
  const [abierto, setAbierto] = useState<string | null>(null)
  const enSeccion = (fn: (sec: Seccion, r: Receta) => void) => cambiar((r) => fn(r.secciones[indice], r))
  const puntosSiNo = todosLosPuntos(receta).filter((x) => x.punto.tipo === 'si_no' && x.seccion.clave !== s.clave)

  return (
    <article className="tarjeta-seccion">
      <header className="tarjeta-cab">
        {editable ? (
          <input className="titulo-seccion" value={s.titulo} maxLength={120} aria-label="Título de la sección"
            onChange={(e) => enSeccion((sec) => void (sec.titulo = e.target.value))} />
        ) : (
          <h3>{s.titulo}</h3>
        )}
        {editable && (
          <Mover etiqueta={`la sección ${s.titulo}`} onSubir={() => cambiar((r) => mover(r.secciones, indice, -1))}
            onBajar={() => cambiar((r) => mover(r.secciones, indice, 1))}
            onQuitar={() => (!s.puntos.length || window.confirm(`¿Quitar la sección «${s.titulo}» y sus ${s.puntos.length} puntos?`)) &&
              cambiar((r) => {
                r.secciones.splice(indice, 1)
                r.reglas = r.reglas.filter((g) => !((g.tipo === 'filas' || (g.tipo === 'x_en' && g.alcance === 'seccion')) && g.seccion === s.clave))
              })} />
        )}
      </header>
      <div className="chips">
        {s.solo_subtipos?.length ? <span className="chip">Solo: {s.solo_subtipos.map((c) => subtipos.find((x) => x.codigo === c)?.nombre ?? c).join(', ')}</span> : null}
        {s.repetible && (
          <span className="chip chip-aviso">
            Repetible (mín. {s.repetible.minimo}){s.repetible.genera_hallazgo ? ' · cada fila genera un hallazgo' : ''}
          </span>
        )}
      </div>
      {editable && (
        <details className="opciones-seccion">
          <summary>Opciones de la sección</summary>
          <Subtipos todos={subtipos} valor={s.solo_subtipos} disabled={!editable} onCambio={(v) => enSeccion((sec) => void (sec.solo_subtipos = v))} />
          <label className="check-linea">
            <input type="checkbox" checked={Boolean(s.repetible)}
              onChange={(e) => enSeccion((sec) => void (sec.repetible = e.target.checked ? { activa_con: null, minimo: 1, genera_hallazgo: true } : null))} />
            Bloque repetible (se agregan las filas que hagan falta, como «condición insegura»)
          </label>
          {s.repetible && (
            <div className="fila3">
              <label className="field">
                <span>Se activa con</span>
                <select value={s.repetible.activa_con ?? ''} onChange={(e) => enSeccion((sec) => void (sec.repetible!.activa_con = e.target.value || null))}>
                  <option value="">Siempre</option>
                  {puntosSiNo.map(({ punto }) => (
                    <option key={punto.clave} value={punto.clave}>
                      «Sí» en {punto.clave}: {punto.texto.slice(0, 50)}
                    </option>
                  ))}
                </select>
              </label>
              <Campo etiqueta="Filas mínimas" type="number" min={0} max={50} value={s.repetible.minimo}
                onChange={(e) => enSeccion((sec) => void (sec.repetible!.minimo = Math.max(0, Math.round(Number(e.target.value) || 0))))} />
              <label className="check-linea">
                <input type="checkbox" checked={s.repetible.genera_hallazgo} onChange={(e) => enSeccion((sec) => void (sec.repetible!.genera_hallazgo = e.target.checked))} />
                Cada fila genera un hallazgo
              </label>
            </div>
          )}
        </details>
      )}

      <ol className="puntos">
        {s.puntos.map((p, j) => (
          <li key={p.clave + j} className={abierto === p.clave ? 'abierto' : ''}>
            <div className="punto-fila">
              <code>{p.clave}</code>
              <span className="punto-texto">{p.texto || <em className="vacio">Sin texto</em>}</span>
              <span className="chips">
                <span className="chip">{NOMBRE_TIPO[p.tipo]}</span>
                {p.critico && <span className="chip chip-mal">Crítico</span>}
                {p.hallazgo !== 'nunca' && <span className="chip chip-aviso">Hallazgo</span>}
                {p.pide_accion && <span className="chip">Pide acción</span>}
                {p.cantidad != null && <span className="chip">Cantidad: {p.cantidad}</span>}
                {p.unidad && <span className="chip">{p.unidad}</span>}
                {!p.obligatorio && <span className="chip chip-gris">Opcional</span>}
                {p.solo_subtipos?.length ? <span className="chip">Solo: {p.solo_subtipos.join(', ')}</span> : null}
              </span>
              <span className="lista-acciones">
                <button className="btn-link" type="button" onClick={() => setAbierto(abierto === p.clave ? null : p.clave)}>
                  {editable ? <Pencil size={16} aria-hidden="true" /> : null} {abierto === p.clave ? 'Cerrar' : editable ? 'Editar' : 'Detalle'}
                </button>
                {editable && (
                  <Mover etiqueta={`el punto ${p.clave}`} onSubir={() => enSeccion((sec) => mover(sec.puntos, j, -1))}
                    onBajar={() => enSeccion((sec) => mover(sec.puntos, j, 1))}
                    onQuitar={() => window.confirm(`¿Quitar el punto ${p.clave}?`) &&
                      cambiar((r) => {
                        r.secciones[indice].puntos.splice(j, 1)
                        r.reglas = r.reglas.filter((g) => !(g.tipo === 'respuesta' && g.clave === p.clave))
                        for (const g of r.reglas) if (g.tipo === 'x_en' && g.claves) g.claves = g.claves.filter((c) => c !== p.clave)
                      })} />
                )}
              </span>
            </div>
            {abierto === p.clave && (
              <FormPunto punto={p} editable={editable} subtipos={subtipos} listas={listas} campos={campos}
                onCambio={(fn) => enSeccion((sec) => fn(sec.puntos[j]))} />
            )}
          </li>
        ))}
      </ol>
      {editable && (
        <button className="btn-link" type="button"
          onClick={() => {
            const clave = siguienteClave(receta, prefijo(receta))
            enSeccion((sec) => void sec.puntos.push(puntoNuevo(clave)))
            setAbierto(clave)
          }}>
          <Plus size={16} aria-hidden="true" /> Agregar punto
        </button>
      )}
    </article>
  )
}

function Marca({ etiqueta, valor, disabled, onCambio, ayuda }: { etiqueta: string; valor: boolean; disabled: boolean; onCambio: (v: boolean) => void; ayuda?: string }) {
  return (
    <label className="check-linea" title={ayuda}>
      <input type="checkbox" checked={valor} disabled={disabled} onChange={(e) => onCambio(e.target.checked)} />
      {etiqueta}
    </label>
  )
}

const numero = (v: string) => (v.trim() === '' ? null : Number(v))

function FormPunto({
  punto: p, editable, subtipos, listas, campos, onCambio,
}: {
  punto: Punto; editable: boolean; subtipos: { codigo: string; nombre: string }[]; listas: Lista[]
  campos: { clave: string; etiqueta: string; tipo: string }[]; onCambio: (fn: (p: Punto) => void) => void
}) {
  const evaluable = TIPOS_EVALUABLES.includes(p.tipo)
  const set = <K extends keyof Punto>(k: K, v: Punto[K]) => onCambio((x) => void (x[k] = v))
  return (
    <fieldset className="form-punto" disabled={!editable}>
      <label className="field">
        <span>Texto del punto</span>
        <textarea rows={2} maxLength={300} value={p.texto} onChange={(e) => set('texto', e.target.value)} />
      </label>
      <Campo etiqueta="Ayuda para el inspector" opcional value={p.ayuda ?? ''} maxLength={300} onChange={(e) => set('ayuda', e.target.value || null)} />
      <div className="fila2">
        <label className="field">
          <span>Tipo de respuesta</span>
          <select value={p.tipo}
            onChange={(e) =>
              onCambio((x) => {
                x.tipo = e.target.value as Punto['tipo']
                if (!TIPOS_EVALUABLES.includes(x.tipo)) {
                  x.critico = x.obs_si_no_cumple = x.foto_si_no_cumple = x.pide_accion = false
                  if (x.hallazgo === 'no_cumple') x.hallazgo = 'nunca'
                }
                if (x.tipo !== 'numero' && x.hallazgo === 'fuera_rango') x.hallazgo = 'nunca'
              })
            }>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Genera hallazgo</span>
          <select value={p.hallazgo} onChange={(e) => set('hallazgo', e.target.value as CuandoHallazgo)}>
            {(Object.keys(NOMBRE_HALLAZGO) as CuandoHallazgo[])
              .filter((h) => h === 'nunca' || (h === 'no_cumple' ? evaluable : p.tipo === 'numero'))
              .map((h) => (
                <option key={h} value={h}>
                  {NOMBRE_HALLAZGO[h]}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="marcas">
        <Marca etiqueta="Obligatorio" valor={p.obligatorio} disabled={!editable} onCambio={(v) => set('obligatorio', v)} />
        {evaluable && (
          <>
            <Marca etiqueta="Crítico" valor={p.critico} disabled={!editable} onCambio={(v) => set('critico', v)} ayuda="Lo usan reglas como «no conforme si un crítico no cumple»" />
            <Marca etiqueta="Observación obligatoria si no cumple" valor={p.obs_si_no_cumple} disabled={!editable} onCambio={(v) => set('obs_si_no_cumple', v)} />
            <Marca etiqueta="Foto obligatoria si no cumple" valor={p.foto_si_no_cumple} disabled={!editable} onCambio={(v) => set('foto_si_no_cumple', v)} />
            <Marca etiqueta="Pide acción, responsable y plazo si no cumple" valor={p.pide_accion} disabled={!editable} onCambio={(v) => set('pide_accion', v)} />
          </>
        )}
      </div>
      {evaluable && (
        <div className="fila2">
          <Campo etiqueta="Cantidad esperada (materiales)" opcional type="number" min={0} max={9999} value={p.cantidad ?? ''}
            ayuda="Cada activo puede tener la suya (por ejemplo, la dotación de cada caseta)."
            onChange={(e) => set('cantidad', numero(e.target.value) == null ? null : Math.round(numero(e.target.value)!))} />
          <Campo etiqueta="Peso en el puntaje" opcional type="number" min={0} max={100} value={p.peso ?? ''} placeholder="1"
            onChange={(e) => set('peso', numero(e.target.value))} />
        </div>
      )}
      {p.tipo === 'numero' && (
        <div className="fila3">
          <Campo etiqueta="Unidad" opcional value={p.unidad ?? ''} maxLength={12} placeholder="psi, min, V…" onChange={(e) => set('unidad', e.target.value || null)} />
          <Campo etiqueta="Mínimo" opcional type="number" value={p.min ?? ''} onChange={(e) => set('min', numero(e.target.value))} />
          <Campo etiqueta="Máximo" opcional type="number" value={p.max ?? ''} onChange={(e) => set('max', numero(e.target.value))} />
        </div>
      )}
      {p.tipo === 'lista' && (
        <div className="fila2">
          <label className="field">
            <span>Lista de la empresa</span>
            <select value={p.lista ?? ''} onChange={(e) => set('lista', e.target.value || null)}>
              <option value="">— Opciones escritas aquí —</option>
              {listas.map((l) => (
                <option key={l.id} value={l.codigo}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </label>
          {!p.lista && (
            <Campo etiqueta="Opciones (separadas por coma)" value={(p.opciones ?? []).join(', ')}
              onChange={(e) => set('opciones', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
          )}
        </div>
      )}
      {p.tipo === 'calculo' && (
        <div className="fila2">
          <label className="field">
            <span>Qué se calcula</span>
            <select value={p.formula ?? ''} onChange={(e) => set('formula', (e.target.value || null) as Formula | null)}>
              <option value="">— Elige —</option>
              {(Object.keys(NOMBRE_FORMULA) as Formula[]).map((f) => (
                <option key={f} value={f}>
                  {NOMBRE_FORMULA[f]}
                </option>
              ))}
            </select>
          </label>
          {p.formula === 'antiguedad' && (
            <label className="field">
              <span>Dato del activo</span>
              <select value={p.campo ?? ''} onChange={(e) => set('campo', e.target.value || null)}>
                <option value="">— Elige —</option>
                {campos.filter((c) => c.tipo === 'anio').map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <Subtipos todos={subtipos} valor={p.solo_subtipos} disabled={!editable} onCambio={(v) => set('solo_subtipos', v)} />
      <p className="nota">Clave fija del punto: {p.clave} (no cambia entre versiones).</p>
    </fieldset>
  )
}

function EditorFirmas({ receta, editable, cambiar }: { receta: Receta; editable: boolean; cambiar: (fn: (r: Receta) => void) => void }) {
  const en = (i: number, fn: (f: Firma) => void) => cambiar((r) => fn(r.firmas[i]))
  return (
    <Caja
      titulo="Firmas"
      accion={
        editable ? (
          <button className="btn-sec" type="button"
            onClick={() => cambiar((r) => {
              let n = 1
              while (r.firmas.some((f) => f.clave === `firma-${n}`)) n++
              r.firmas.push({ clave: `firma-${n}`, titulo: 'Firma nueva', obligatoria: true, externo: false, minimo: 1 })
            })}>
            <Plus size={18} aria-hidden="true" /> Agregar firma
          </button>
        ) : null
      }
    >
      <p className="nota">Firma simple con registro de quién, cuándo y con qué versión del formato (D-32). «Externo» permite un firmante sin cuenta (nombre y documento escritos).</p>
      <ul className="lista lista-firmas">
        {receta.firmas.map((f, i) => (
          <li key={f.clave}>
            <fieldset disabled={!editable} className="fila-firma">
              <Campo etiqueta="Rol de la firma" value={f.titulo} maxLength={120} onChange={(e) => en(i, (x) => void (x.titulo = e.target.value))} />
              <Campo etiqueta="Mínimo de firmantes" type="number" min={1} max={10} value={f.minimo}
                onChange={(e) => en(i, (x) => void (x.minimo = Math.min(10, Math.max(1, Math.round(Number(e.target.value) || 1)))))} />
              <Marca etiqueta="Obligatoria" valor={f.obligatoria} disabled={!editable} onCambio={(v) => en(i, (x) => void (x.obligatoria = v))} />
              <Marca etiqueta="Permite externo" valor={f.externo} disabled={!editable} onCambio={(v) => en(i, (x) => void (x.externo = v))} />
            </fieldset>
            {editable && (
              <Mover etiqueta={`la firma ${f.titulo}`} onSubir={() => cambiar((r) => mover(r.firmas, i, -1))} onBajar={() => cambiar((r) => mover(r.firmas, i, 1))}
                onQuitar={() => cambiar((r) => void r.firmas.splice(i, 1))} />
            )}
          </li>
        ))}
      </ul>
    </Caja>
  )
}

function reglaNueva(tipo: TipoRegla, r: Receta): Regla {
  const repetible = r.secciones.find((s) => s.repetible)?.clave ?? ''
  switch (tipo) {
    case 'vencido':
      return { tipo, etiqueta: 'No conforme: vencido', controles: [] }
    case 'x_en':
      return { tipo, etiqueta: 'No conforme', alcance: 'todos' }
    case 'respuesta':
      return { tipo, etiqueta: 'No conforme', clave: todosLosPuntos(r)[0]?.punto.clave ?? '', valor: 'no' }
    case 'filas':
      return { tipo, etiqueta: 'Con condiciones inseguras', seccion: repetible }
    default:
      return { tipo, etiqueta: 'No conforme' }
  }
}

function EditorReglas({ receta, editable, campos, cambiar }: { receta: Receta; editable: boolean; campos: { clave: string; etiqueta: string; tipo: string }[]; cambiar: (fn: (r: Receta) => void) => void }) {
  const [tipoNuevo, setTipoNuevo] = useState<TipoRegla>('x_en')
  const en = (i: number, fn: (g: Regla) => void) => cambiar((r) => fn(r.reglas[i]))
  const puntos = todosLosPuntos(receta).map((x) => x.punto)
  const fijas = receta.secciones.filter((s) => !s.repetible)
  const repetibles = receta.secciones.filter((s) => s.repetible)
  const fechables = campos.filter((c) => c.tipo === 'mes' || c.tipo === 'anio')

  return (
    <Caja titulo="Resultado y reglas">
      <p className="nota">Las reglas se revisan en orden: la primera que se cumple da el resultado. Si ninguna se cumple, queda el resultado por defecto.</p>
      <ol className="reglas">
        {receta.reglas.map((g, i) => (
          <li key={i}>
            <fieldset disabled={!editable} className="form-regla">
              <div className="fila2">
                <p className="regla-tipo">
                  <b>{i + 1}.</b> {NOMBRE_REGLA[g.tipo]}
                </p>
                <Campo etiqueta="Resultado que da" value={g.etiqueta} maxLength={60} onChange={(e) => en(i, (x) => void (x.etiqueta = e.target.value))} />
              </div>
              {g.tipo === 'x_en' && (
                <div className="fila2">
                  <label className="field">
                    <span>Dónde se busca</span>
                    <select value={g.alcance} onChange={(e) => en(i, (x) => void ((x as typeof g).alcance = e.target.value as typeof g.alcance))}>
                      <option value="todos">En cualquier punto</option>
                      <option value="criticos">En los puntos críticos</option>
                      <option value="seccion">En una sección</option>
                      <option value="claves">En estos puntos</option>
                    </select>
                  </label>
                  {g.alcance === 'seccion' && (
                    <label className="field">
                      <span>Sección</span>
                      <select value={g.seccion ?? ''} onChange={(e) => en(i, (x) => void ((x as typeof g).seccion = e.target.value))}>
                        <option value="">— Elige —</option>
                        {fijas.map((s) => (
                          <option key={s.clave} value={s.clave}>
                            {s.titulo}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {g.alcance === 'claves' && (
                    <Campo etiqueta="Claves de los puntos (separadas por coma)" value={(g.claves ?? []).join(', ')}
                      onChange={(e) => en(i, (x) => void ((x as typeof g).claves = e.target.value.toUpperCase().split(',').map((c) => c.trim()).filter(Boolean)))} />
                  )}
                </div>
              )}
              {g.tipo === 'respuesta' && (
                <div className="fila2">
                  <label className="field">
                    <span>Punto</span>
                    <select value={g.clave} onChange={(e) => en(i, (x) => void ((x as typeof g).clave = e.target.value))}>
                      {puntos.map((p) => (
                        <option key={p.clave} value={p.clave}>
                          {p.clave} · {p.texto.slice(0, 50)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Respuesta</span>
                    <select value={g.valor} onChange={(e) => en(i, (x) => void ((x as typeof g).valor = e.target.value))}>
                      <option value="no">X / No</option>
                      <option value="si">√ / Sí</option>
                      <option value="na">N/A</option>
                    </select>
                  </label>
                </div>
              )}
              {g.tipo === 'filas' && (
                <label className="field">
                  <span>Bloque repetible</span>
                  <select value={g.seccion} onChange={(e) => en(i, (x) => void ((x as typeof g).seccion = e.target.value))}>
                    <option value="">— Elige —</option>
                    {repetibles.map((s) => (
                      <option key={s.clave} value={s.clave}>
                        {s.titulo}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {g.tipo === 'vencido' && (
                <div className="controles">
                  {!fechables.length && <p className="nota">Este tipo de activo no tiene fechas ni años en su ficha.</p>}
                  {fechables.map((c) => {
                    const control = g.controles.find((x) => x.campo === c.clave)
                    return (
                      <div key={c.clave} className="fila2">
                        <Marca etiqueta={c.etiqueta} valor={Boolean(control)} disabled={!editable}
                          onCambio={(v) => en(i, (x) => {
                            const r = x as typeof g
                            r.controles = v
                              ? [...r.controles, c.tipo === 'mes' ? { campo: c.clave, tipo: 'fecha_limite' } : { campo: c.clave, tipo: 'anios', anios: null }]
                              : r.controles.filter((k) => k.campo !== c.clave)
                          })} />
                        {control?.tipo === 'anios' && (
                          <Campo etiqueta="Vence a los (años)" type="number" min={1} max={100} value={control.anios ?? ''}
                            ayuda="Vacío = no se controla hasta que la empresa ponga su plazo (validar con la norma)."
                            onChange={(e) => en(i, (x) => {
                              const k = (x as typeof g).controles.find((y) => y.campo === c.clave)
                              if (k && k.tipo === 'anios') k.anios = e.target.value ? Math.round(Number(e.target.value)) : null
                            })} />
                        )}
                        {control?.tipo === 'fecha_limite' && <p className="nota">Vencido si este mes ya pasó.</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </fieldset>
            {editable && (
              <Mover etiqueta={`la regla ${i + 1}`} onSubir={() => cambiar((r) => mover(r.reglas, i, -1))} onBajar={() => cambiar((r) => mover(r.reglas, i, 1))}
                onQuitar={() => cambiar((r) => void r.reglas.splice(i, 1))} />
            )}
          </li>
        ))}
      </ol>
      {editable && (
        <div className="fila-form">
          <label className="field">
            <span>Agregar regla</span>
            <select value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value as TipoRegla)}>
              {(Object.keys(NOMBRE_REGLA) as TipoRegla[]).map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_REGLA[t]}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-sec" type="button" onClick={() => cambiar((r) => void r.reglas.push(reglaNueva(tipoNuevo, r)))}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        </div>
      )}
      <fieldset disabled={!editable} className="form-opciones">
        <Campo etiqueta="Resultado por defecto (si ninguna regla se cumple)" value={receta.resultado_defecto ?? ''} maxLength={60}
          ayuda="Vacío = sin resultado: la inspección solo queda «Realizada»."
          onChange={(e) => cambiar((r) => void (r.resultado_defecto = e.target.value.trim() ? e.target.value : null))} />
        <div className="marcas">
          <Marca etiqueta="Calcular puntaje (% de favorables)" valor={receta.puntaje} disabled={!editable} onCambio={(v) => cambiar((r) => void (r.puntaje = v))} />
          <Marca etiqueta="N/A cuenta como favorable" valor={receta.na_favorable} disabled={!editable} onCambio={(v) => cambiar((r) => void (r.na_favorable = v))} />
          <Marca etiqueta="Cada vencimiento genera un hallazgo" valor={receta.hallazgo_vencimiento} disabled={!editable} onCambio={(v) => cambiar((r) => void (r.hallazgo_vencimiento = v))} />
          <Marca etiqueta="Observación general al cerrar" valor={receta.observacion_general} disabled={!editable} onCambio={(v) => cambiar((r) => void (r.observacion_general = v))} />
        </div>
      </fieldset>
    </Caja>
  )
}

