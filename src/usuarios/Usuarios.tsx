import { ArrowLeft, FileSpreadsheet, KeyRound, Pencil, Search, UserCheck, UserMinus, UserPlus, UserRoundCheck } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Campo, ClaveUnica, Seccion, SelectorLista } from '../empresas/campos'
import { normalizar } from '../empresas/datos'
import { ir } from '../ruta'
import { sedeActiva } from '../sedeActiva'
import { TIPOS_DOCUMENTO, type TipoDocumento, normalizarDocumento } from '../sesion'
import { EnBloque } from './EnBloque'
import {
  type ContrasenaDada, type Cuenta, darFacultad, ES_ADMIN, FACULTADES, leerFacultades, type Listas, NOMBRE_ROL, quitarFacultad, type Rol, actualizarPersona, asignarSedes, cesarCuenta, confirmarSigue,
  crearCuenta, darContrasena, leerListas, leerSedesActivas, listarContrasenasDadas, listarCuentas, reactivarCuenta, unidadesAsignables,
} from './datos'

type SedeLista = { id: string; nombre: string }

/** Elegir las sedes de una cuenta (casillas). Con una sola sede posible no se pregunta. */
function SelectorSedes({ sedes, valor, onCambio }: { sedes: SedeLista[]; valor: string[]; onCambio: (v: string[]) => void }) {
  if (sedes.length <= 1) return null
  return (
    <fieldset className="field">
      <legend>Sedes de la cuenta</legend>
      {sedes.map((s) => (
        <label key={s.id} className="check-linea">
          <input type="checkbox" checked={valor.includes(s.id)} onChange={(e) => onCambio(e.target.checked ? [...valor, s.id] : valor.filter((x) => x !== s.id))} /> {s.nombre}
        </label>
      ))}
      <small className="ayuda">Toda cuenta tiene al menos una sede. Solo ve y trabaja con lo de esas sedes.</small>
    </fieldset>
  )
}

const hoy = () => new Date().toLocaleDateString('en-CA')
const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE')
const MODO: Record<ContrasenaDada['modo'], string> = { individual: 'Individual', en_bloque: 'En bloque', rescate: 'Rescate' }

type Clave = { nombre: string; clave: string; nueva: boolean }

// El administrador no puede leer los datos de Integrax: si la dio alguien que no es de su empresa, fue el dueño.
const autor = (d: ContrasenaDada) => (d.dado_por ? (d.autor?.apellidos_nombres ?? 'Integrax (dueño de la plataforma)') : 'la herramienta de rescate')

/**
 * Usuarios de una empresa (tarea 3.3). La usa el administrador para su empresa y el dueño dentro de cada empresa.
 * Los botones son solo comodidad: quien decide qué se puede hacer es la base de datos.
 */
export function Usuarios({ empresaId, esDueno, miId, sedesPropias, onVolver, rolMio = 'admin_empresa', puedeFacultades = false }: {
  empresaId: string; esDueno: boolean; miId: string; sedesPropias: SedeLista[] | null; onVolver: () => void
  // El gestor (desde la etapa 2) maneja solo usuarios y usuarios gestores de sus sedes; no cambia contraseñas.
  rolMio?: string; puedeFacultades?: boolean
}) {
  const esGestor = rolMio === 'gestor'
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [listas, setListas] = useState<Listas>({ puestos: [], unidades: [] })
  const [dadas, setDadas] = useState<ContrasenaDada[]>([])
  const [sedes, setSedes] = useState<SedeLista[]>([])
  // Quien administra una o varias sedes solo da y quita sedes que son suyas; el general y el dueño, cualquiera de la empresa.
  const asignables = sedesPropias ?? sedes
  const nombreSede = (id: string) => sedes.find((x) => x.id === id)?.nombre ?? ''
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [estado, setEstado] = useState<'activo' | 'cesado' | 'todos' | 'por_revisar'>('activo')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [clave, setClave] = useState<Clave | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(() => {
    Promise.all([listarCuentas(empresaId), leerListas(empresaId), listarContrasenasDadas(empresaId), leerSedesActivas(empresaId)])
      .then(([c, l, d, s]) => {
        setCuentas(c)
        setListas(l)
        setDadas(d)
        setSedes(s)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(cargar, [cargar])

  const f = normalizar(filtro)
  const porRevisar = (cuentas ?? []).filter((c) => c.estado === 'activo' && c.por_revisar_desde).length
  const filtroActual = estado === 'por_revisar' && !porRevisar ? 'activo' : estado
  const visibles = (cuentas ?? []).filter(
    (c) =>
      // Con una sede activa se ven las cuentas de esa sede (y los administradores generales, que son de todas).
      (!sedeActiva() || !c.vinculos_sedes.length || c.vinculos_sedes.some((x) => x.sede_id === sedeActiva())) &&
      (filtroActual === 'todos' || c.estado === filtroActual || (filtroActual === 'por_revisar' && Boolean(c.por_revisar_desde))) &&
      (!f || normalizar(`${c.personas?.apellidos_nombres} ${c.personas?.numero_documento} ${c.puesto ?? ''} ${c.area ?? ''}`).includes(f)),
  )
  const cuenta = (e: Cuenta['estado']) => (cuentas ?? []).filter((c) => c.estado === e).length

  function listo(nuevaClave?: Clave, texto?: string) {
    setAbierta(null)
    setCreando(false)
    setClave(nuevaClave ?? null)
    setAviso(texto ?? null)
    cargar()
  }

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={onVolver}>
        <ArrowLeft size={18} aria-hidden="true" /> Ficha de la empresa
      </button>
      <header className="detalle-cab fila-entre">
        <div>
          <h1>Usuarios</h1>
          <p>{cuentas ? `${cuenta('activo')} activos · ${cuenta('cesado')} cesados` : 'Cargando…'}</p>
        </div>
        {!creando && (
          <div className="acciones">
            <button className="btn-sec" type="button" onClick={() => ir(esDueno ? `/empresas/${empresaId}/carga` : '/mi-empresa/carga')}>
              <FileSpreadsheet size={18} aria-hidden="true" /> Cargar desde Excel
            </button>
            <button className="btn" type="button" onClick={() => { setClave(null); setAviso(null); setCreando(true) }}>
              <UserPlus size={20} aria-hidden="true" /> Nueva cuenta
            </button>
          </div>
        )}
      </header>

      {clave && (
        <ClaveUnica
          clave={clave.clave}
          onOcultar={() => setClave(null)}
          texto={
            <>
              {clave.nueva ? 'Cuenta creada para ' : 'Contraseña nueva para '}
              <b>{clave.nombre}</b>. Se muestra <b>una sola vez</b>: entrégasela en persona o por un medio seguro. Deberá cambiarla al ingresar.
            </>
          }
        />
      )}

      <Aviso tipo="ok">{aviso}</Aviso>
      {porRevisar > 0 && filtroActual !== 'por_revisar' && (
        <div className="aviso-revisar" role="status">
          <p>
            <b>{porRevisar === 1 ? '1 persona está' : `${porRevisar} personas están`} «por revisar»</b>: no aparecieron en la última carga
            de Excel marcada como lista completa. Confirma su cese o que siguen en la empresa. Nadie se cesa solo.
          </p>
          <button className="btn-sec" type="button" onClick={() => setEstado('por_revisar')}>
            Revisar ahora
          </button>
        </div>
      )}
      {creando && <NuevaCuenta empresaId={empresaId} esDueno={esDueno} esGestor={esGestor} listas={listas} sedes={asignables} onCancelar={() => setCreando(false)} onListo={listo} />}

      <div className="filtros">
        <span className="buscador">
          <Search aria-hidden="true" />
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre, documento, puesto o área" aria-label="Buscar persona" />
        </span>
        <div className={`segmentos${porRevisar ? ' cuatro' : ''}`} role="group" aria-label="Estado">
          {(['activo', 'cesado', 'todos', ...(porRevisar ? ['por_revisar' as const] : [])] as const).map((e) => (
            <button key={e} type="button" aria-pressed={filtroActual === e} onClick={() => setEstado(e)}>
              {e === 'activo' ? 'Activos' : e === 'cesado' ? 'Cesados' : e === 'todos' ? 'Todos' : `Por revisar (${porRevisar})`}
            </button>
          ))}
        </div>
      </div>
      <Aviso>{error}</Aviso>

      <ul className="lista lista-usuarios">
        {visibles.map((c) => {
          const propia = c.persona_id === miId
          const gestionable = !propia && (esGestor ? c.rol === 'usuario' || c.rol === 'usuario_gestor' : esDueno || !ES_ADMIN.includes(c.rol))
          return (
            <li key={c.id} className={c.estado === 'activo' ? '' : 'inactiva'}>
              <div>
                <b>{c.personas?.apellidos_nombres}</b>
                <span className="chips">
                  <span className="chip chip-gris">{NOMBRE_ROL[c.rol]}</span>
                  {c.estado === 'cesado' && <span className="chip chip-mal">Cesado {c.fecha_cese ? fecha(c.fecha_cese) : ''}</span>}
                  {c.estado === 'activo' && c.por_revisar_desde && <span className="chip chip-aviso">Por revisar</span>}
                  {c.estado === 'activo' && c.personas?.debe_cambiar_contrasena && <span className="chip chip-aviso">Debe cambiar su contraseña</span>}
                  {propia && <span className="chip chip-ok">Tú</span>}
                </span>
                <small>
                  {c.personas?.tipo_documento.toUpperCase()} {c.personas?.numero_documento}
                  {c.puesto ? ` · ${c.puesto}` : ''}
                  {c.area ? ` · ${c.area}` : ''}
                  {sedes.length > 1 && (c.vinculos_sedes.length ? ` · ${c.vinculos_sedes.map((x) => nombreSede(x.sede_id)).filter(Boolean).join(', ')}` : ' · todas las sedes')}
                  {c.estado === 'cesado' && c.motivo_cese ? ` · Motivo: ${c.motivo_cese}` : ''}
                </small>
                {abierta === c.id && <PanelCuenta cuenta={c} esDueno={esDueno} esGestor={esGestor} puedeFacultades={puedeFacultades} listas={listas} sedes={asignables} todasLasSedes={sedes} onCerrar={() => setAbierta(null)} onListo={listo} />}
              </div>
              {gestionable && abierta !== c.id && (
                <span className="lista-acciones">
                  <button className="btn-sec" type="button" onClick={() => { setClave(null); setAbierta(c.id) }}>
                    Gestionar
                  </button>
                </span>
              )}
            </li>
          )
        })}
        {cuentas && !visibles.length && <li className="vacio">Nadie coincide con la búsqueda.</li>}
      </ul>
      {!esDueno && <p className="nota">{esGestor ? 'Puedes crear, corregir y cesar usuarios y usuarios gestores de tus sedes. Los gestores y los administradores los define el administrador o Integrax. ' : 'Los administradores (general y de sede) los crea y gestiona Integrax. '}Tu propia contraseña la cambias desde tu cuenta.</p>}

      <Seccion titulo="Últimas contraseñas nuevas dadas">
        {dadas.length === 0 ? (
          <p className="nota">Todavía no se ha dado ninguna. Aquí queda anotado quién la dio y cuándo; la contraseña nunca se guarda.</p>
        ) : (
          <ul className="lista">
            {dadas.map((d) => (
              <li key={d.id}>
                <div>
                  <b>{d.persona?.apellidos_nombres}</b>
                  <small>
                    {new Date(d.dado_en).toLocaleString('es-PE')} · {MODO[d.modo]} · dada por {autor(d)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {esDueno && <EnBloque empresaId={empresaId} onListo={cargar} />}
    </div>
  )
}

/** Formulario para crear una cuenta nueva (función crear-cuenta de la 3.1). */
function NuevaCuenta({
  empresaId, esDueno, esGestor, listas, sedes, onCancelar, onListo,
}: { empresaId: string; esDueno: boolean; esGestor: boolean; listas: Listas; sedes: SedeLista[]; onCancelar: () => void; onListo: (c?: Clave, texto?: string) => void }) {
  const [rol, setRol] = useState<Rol>('usuario')
  const [tipo, setTipo] = useState<TipoDocumento>('dni')
  const [numero, setNumero] = useState('')
  const [nombres, setNombres] = useState('')
  const [ingreso, setIngreso] = useState(hoy)
  const [puestoId, setPuestoId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [sedeIds, setSedeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)!
  const nombrePuesto = (id: string) => listas.puestos.find((i) => i.id === id)?.nombre ?? null

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = normalizarDocumento(numero)
    if (!tipoDoc.patron.test(n)) return setError(`Revisa el número de documento (${tipoDoc.ayuda}).`)
    if (nombres.trim().length < 3) return setError('Escribe apellidos y nombres.')
    // Con varias sedes posibles hay que elegir; con una sola, esa es la sede de la cuenta.
    const elegidas = sedes.length === 1 ? [sedes[0].id] : sedeIds
    if (rol !== 'admin_empresa' && !elegidas.length) return setError('Elige al menos una sede para la cuenta.')
    setOcupado(true)
    try {
      const r = await crearCuenta(empresaId, {
        rol, tipo_documento: tipo, numero_documento: n, apellidos_nombres: nombres, fecha_ingreso: ingreso,
        puesto: nombrePuesto(puestoId), unidad_id: unidadId || null, ...(rol !== 'admin_empresa' ? { sedes: elegidas } : {}),
      })
      if (r.contrasena_inicial) onListo({ nombre: nombres.trim(), clave: r.contrasena_inicial, nueva: true })
      else onListo(undefined, `${nombres.trim()} ya tenía cuenta en CRC (cambió de empresa): se le dio de alta aquí y sigue usando su contraseña de siempre.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="form subform" onSubmit={crear} noValidate>
      <h2>Nueva cuenta</h2>
      <label className="field">
        <span>Rol</span>
        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          <option value="usuario">{NOMBRE_ROL.usuario}</option>
          <option value="usuario_gestor">{NOMBRE_ROL.usuario_gestor}</option>
          {!esGestor && <option value="gestor">{NOMBRE_ROL.gestor}</option>}
          {esDueno && <option value="admin_sede">{NOMBRE_ROL.admin_sede}</option>}
          {esDueno && <option value="admin_empresa">{NOMBRE_ROL.admin_empresa}</option>}
        </select>
        <small className="ayuda">El rol decide qué puede hacer la persona. El usuario gestor es un trabajador al que el administrador le marca facultades extra. El puesto es solo un dato de su ficha.</small>
      </label>
      {rol !== 'admin_empresa' && <SelectorSedes sedes={sedes} valor={sedeIds} onCambio={setSedeIds} />}
      <div className="fila2">
        <label className="field">
          <span>Tipo de documento</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <Campo
          etiqueta="Número"
          value={numero}
          onChange={(e) => setNumero(tipo === 'dni' ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase())}
          inputMode={tipo === 'dni' ? 'numeric' : 'text'}
          maxLength={tipo === 'dni' ? 8 : 12}
          placeholder={tipoDoc.ayuda}
          autoComplete="off"
        />
      </div>
      <Campo etiqueta="Apellidos y nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} maxLength={200} autoComplete="off" />
      <div className="fila3">
        <Campo etiqueta="Fecha de ingreso" type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
        <SelectorLista etiqueta="Puesto" items={listas.puestos} valor={puestoId} onCambio={setPuestoId} />
        <SelectorLista etiqueta="Área o subárea" items={unidadesAsignables(listas.unidades)} valor={unidadId} onCambio={setUnidadId} />
      </div>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          <UserPlus size={20} aria-hidden="true" /> {ocupado ? 'Creando…' : 'Crear cuenta'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Acciones sobre una cuenta: corregir datos, contraseña nueva, cesar o reactivar. */
function PanelCuenta({
  cuenta: c, esDueno, esGestor, puedeFacultades, listas, sedes, todasLasSedes, onCerrar, onListo,
}: { cuenta: Cuenta; esDueno: boolean; esGestor: boolean; puedeFacultades: boolean; listas: Listas; sedes: SedeLista[]; todasLasSedes: SedeLista[]; onCerrar: () => void; onListo: (c?: Clave) => void }) {
  const [accion, setAccion] = useState<'menu' | 'corregir' | 'clave' | 'cesar' | 'facultades'>('menu')
  const [nombres, setNombres] = useState(c.personas?.apellidos_nombres ?? '')
  const [ingreso, setIngreso] = useState(c.fecha_ingreso)
  const [rol, setRol] = useState<Rol>(c.rol)
  const [puestoId, setPuestoId] = useState(c.puesto_id ?? '')
  const [unidadId, setUnidadId] = useState(c.unidad_id ?? '')
  const sedesActuales = c.vinculos_sedes.map((x) => x.sede_id)
  const [sedeIds, setSedeIds] = useState<string[]>(sedesActuales)
  const [fechaCese, setFechaCese] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const nombre = c.personas?.apellidos_nombres ?? ''

  const desde = c.por_revisar_desde ? new Date(c.por_revisar_desde).toLocaleDateString('es-PE') : null

  async function hacer(fn: () => Promise<Clave | void>) {
    setError(null)
    setOcupado(true)
    try {
      onListo((await fn()) ?? undefined)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function corregir(e: FormEvent) {
    e.preventDefault()
    const cambios: Record<string, string | null> = {}
    if (nombres.trim() !== nombre) cambios.apellidos_nombres = nombres
    if (ingreso !== c.fecha_ingreso) cambios.fecha_ingreso = ingreso
    if (rol !== c.rol) cambios.rol = rol
    if (puestoId !== (c.puesto_id ?? '')) cambios.puesto_id = puestoId || null
    if (unidadId !== (c.unidad_id ?? '')) cambios.unidad_id = unidadId || null
    const cambiaronSedes = c.rol !== 'admin_empresa' && (sedeIds.length !== sedesActuales.length || sedeIds.some((x) => !sedesActuales.includes(x)))
    if (!Object.keys(cambios).length && !cambiaronSedes) return setError('No cambiaste ningún dato.')
    if (cambiaronSedes && !sedeIds.length) return setError('La cuenta debe tener al menos una sede.')
    void hacer(async () => {
      if (Object.keys(cambios).length) await actualizarPersona(c.id, cambios)
      if (cambiaronSedes) await asignarSedes(c.id, sedeIds)
    })
  }

  function cesar(e: FormEvent) {
    e.preventDefault()
    if (motivo.trim().length < 3) return setError('Indica el motivo del cese.')
    void hacer(() => cesarCuenta(c.id, fechaCese, motivo))
  }

  return (
    <div className="panel-cuenta">
      {accion === 'menu' && c.estado === 'activo' && desde && (
        <div className="por-revisar">
          <p className="nota">
            <b>Por revisar</b>: no apareció en la carga de Excel del {desde}, marcada como lista completa. ¿Sigue en la empresa?
          </p>
          <div className="acciones">
            <button className="btn-sec" type="button" disabled={ocupado} onClick={() => void hacer(() => confirmarSigue(c.id))}>
              <UserRoundCheck size={18} aria-hidden="true" /> {ocupado ? 'Guardando…' : 'Sí, sigue en la empresa'}
            </button>
            <button className="btn-sec btn-sec-peligro" type="button" onClick={() => setAccion('cesar')}>
              <UserMinus size={18} aria-hidden="true" /> No, confirmar cese
            </button>
          </div>
        </div>
      )}
      {accion === 'menu' && (
        <div className="acciones">
          {c.estado === 'activo' ? (
            <>
              <button className="btn-sec" type="button" onClick={() => setAccion('corregir')}>
                <Pencil size={18} aria-hidden="true" /> Corregir datos
              </button>
              {!esGestor && (
                <button className="btn-sec" type="button" onClick={() => setAccion('clave')}>
                  <KeyRound size={18} aria-hidden="true" /> Contraseña nueva
                </button>
              )}
              {puedeFacultades && FACULTADES[c.rol] && (
                <button className="btn-sec" type="button" onClick={() => setAccion('facultades')}>
                  <UserRoundCheck size={18} aria-hidden="true" /> Facultades
                </button>
              )}
              <button className="btn-sec btn-sec-peligro" type="button" onClick={() => setAccion('cesar')}>
                <UserMinus size={18} aria-hidden="true" /> Cesar
              </button>
            </>
          ) : (
            <button className="btn-sec" type="button" disabled={ocupado} onClick={() => void hacer(() => reactivarCuenta(c.id))}>
              <UserCheck size={18} aria-hidden="true" /> {ocupado ? 'Reactivando…' : 'Reactivar cuenta'}
            </button>
          )}
          <button className="btn-link" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      )}

      {accion === 'corregir' && (
        <form className="form" onSubmit={corregir} noValidate>
          <Campo etiqueta="Apellidos y nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} maxLength={200} autoComplete="off" />
          <div className="fila2">
            <Campo etiqueta="Fecha de ingreso" type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
            <label className="field">
              <span>Rol</span>
              <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                <option value="usuario">{NOMBRE_ROL.usuario}</option>
                <option value="usuario_gestor">{NOMBRE_ROL.usuario_gestor}</option>
                {!esGestor && <option value="gestor">{NOMBRE_ROL.gestor}</option>}
                {(esDueno || c.rol === 'admin_sede') && <option value="admin_sede">{NOMBRE_ROL.admin_sede}</option>}
                {(esDueno || c.rol === 'admin_empresa') && <option value="admin_empresa">{NOMBRE_ROL.admin_empresa}</option>}
              </select>
            </label>
          </div>
          <div className="fila2">
            <SelectorLista etiqueta="Puesto" items={listas.puestos} valor={puestoId} onCambio={setPuestoId} />
            <SelectorLista etiqueta="Área o subárea" items={unidadesAsignables(listas.unidades)} valor={unidadId} onCambio={setUnidadId} />
          </div>
          {c.rol !== 'admin_empresa' && (
            // Quien administra una sede solo mueve las suyas: las demás sedes de la cuenta se conservan tal cual.
            <SelectorSedes
              sedes={esDueno || sedes.length === todasLasSedes.length ? sedes : todasLasSedes.filter((x) => sedes.some((m) => m.id === x.id))}
              valor={sedeIds}
              onCambio={(nuevo) => setSedeIds(esDueno ? nuevo : [...nuevo.filter((id) => sedes.some((m) => m.id === id)), ...sedesActuales.filter((id) => !sedes.some((m) => m.id === id))])}
            />
          )}
          <p className="nota">El número de documento no se corrige: es con lo que la persona ingresa. Si está mal, cesa esta cuenta y crea una nueva.</p>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button className="btn-link" type="button" onClick={() => setAccion('menu')}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {accion === 'facultades' && <PanelFacultades cuenta={c} onVolver={() => setAccion('menu')} />}

      {accion === 'clave' && (
        <div className="form">
          <p className="nota">
            Se generará una contraseña nueva para <b>{nombre}</b>. Su contraseña actual dejará de funcionar, se cerrarán sus sesiones abiertas y deberá cambiarla al ingresar.
          </p>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button
              className="btn"
              type="button"
              disabled={ocupado}
              onClick={() => void hacer(async () => ({ nombre, clave: (await darContrasena(c.persona_id)).contrasena, nueva: false }))}
            >
              <KeyRound size={20} aria-hidden="true" /> {ocupado ? 'Generando…' : 'Sí, dar contraseña nueva'}
            </button>
            <button className="btn-link" type="button" onClick={() => setAccion('menu')}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {accion === 'cesar' && (
        <form className="form" onSubmit={cesar} noValidate>
          <p className="nota">
            <b>{nombre}</b> no podrá ingresar desde la fecha de cese y se cerrarán sus sesiones. Su cuenta y su historial no se borran; se puede reactivar.
          </p>
          <div className="fila2">
            <Campo etiqueta="Fecha de cese" type="date" value={fechaCese} min={c.fecha_ingreso} onChange={(e) => setFechaCese(e.target.value)} />
            <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej.: término de contrato" />
          </div>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn-peligro" type="submit" disabled={ocupado}>
              {ocupado ? 'Cesando…' : 'Sí, cesar cuenta'}
            </button>
            <button className="btn-link" type="button" onClick={() => setAccion('menu')}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {accion === 'menu' && <Aviso>{error}</Aviso>}
    </div>
  )
}

/** Facultades de una cuenta: casillas de una lista fija. Marcar o quitar una la hace la base de datos, con su historial. */
function PanelFacultades({ cuenta: c, onVolver }: { cuenta: Cuenta; onVolver: () => void }) {
  const lista = FACULTADES[c.rol] ?? []
  const [marcadas, setMarcadas] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  useEffect(() => {
    void leerFacultades(c.id).then(setMarcadas, (e) => setError((e as Error).message))
  }, [c.id])
  async function cambiar(permiso: string, marcar: boolean) {
    setError(null)
    setOcupado(permiso)
    try {
      await (marcar ? darFacultad(c.id, permiso) : quitarFacultad(c.id, permiso))
      setMarcadas(await leerFacultades(c.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }
  return (
    <fieldset className="form sedes-cuenta">
      <legend>Facultades de {c.personas?.apellidos_nombres}</legend>
      {c.rol === 'gestor' ? (
        <p className="nota">Sin marca, el gestor <b>pide</b> anular o corregir una inspección o cambiar el programa aprobado y un administrador lo aprueba o lo deniega. Con la marca lo hace <b>directo</b> y a los administradores les llega solo un aviso a modo de comunicación.</p>
      ) : (
        <p className="nota">Sin marcas se comporta como un usuario. Cada marca vale solo en las sedes de la cuenta.</p>
      )}
      {!marcadas ? <p className="nota">Cargando…</p> : lista.map((f) => (
        <label key={f.permiso} className="check">
          <input type="checkbox" checked={marcadas.includes(f.permiso)} disabled={ocupado !== null}
            onChange={(e) => void cambiar(f.permiso, e.target.checked)} />
          <span>{f.titulo}<small className="ayuda"> {f.ayuda}</small></span>
        </label>
      ))}
      <Aviso>{error}</Aviso>
      <div className="acciones"><button className="btn-link" type="button" onClick={onVolver}>Volver</button></div>
    </fieldset>
  )
}
