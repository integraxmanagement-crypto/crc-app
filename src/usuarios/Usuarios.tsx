import { ArrowLeft, KeyRound, Pencil, Search, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Campo, ClaveUnica, Seccion, SelectorLista } from '../empresas/campos'
import { normalizar } from '../empresas/datos'
import { TIPOS_DOCUMENTO, type TipoDocumento, normalizarDocumento } from '../sesion'
import { EnBloque } from './EnBloque'
import {
  type ContrasenaDada, type Cuenta, type Item, type Lista, NOMBRE_ROL, type Rol, actualizarPersona, cesarCuenta, crearCuenta,
  darContrasena, leerListas, listarContrasenasDadas, listarCuentas, reactivarCuenta,
} from './datos'

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
export function Usuarios({ empresaId, esDueno, miId, onVolver }: { empresaId: string; esDueno: boolean; miId: string; onVolver: () => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [listas, setListas] = useState<Record<Lista, Item[]>>({ areas: [], puestos: [] })
  const [dadas, setDadas] = useState<ContrasenaDada[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [estado, setEstado] = useState<'activo' | 'cesado' | 'todos'>('activo')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [clave, setClave] = useState<Clave | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(() => {
    Promise.all([listarCuentas(empresaId), leerListas(empresaId), listarContrasenasDadas(empresaId)])
      .then(([c, l, d]) => {
        setCuentas(c)
        setListas(l)
        setDadas(d)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(cargar, [cargar])

  const f = normalizar(filtro)
  const visibles = (cuentas ?? []).filter(
    (c) =>
      (estado === 'todos' || c.estado === estado) &&
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
          <button className="btn" type="button" onClick={() => { setClave(null); setAviso(null); setCreando(true) }}>
            <UserPlus size={20} aria-hidden="true" /> Nueva cuenta
          </button>
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
      {creando && <NuevaCuenta empresaId={empresaId} esDueno={esDueno} listas={listas} onCancelar={() => setCreando(false)} onListo={listo} />}

      <div className="filtros">
        <span className="buscador">
          <Search aria-hidden="true" />
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre, documento, puesto o área" aria-label="Buscar persona" />
        </span>
        <div className="segmentos" role="group" aria-label="Estado">
          {(['activo', 'cesado', 'todos'] as const).map((e) => (
            <button key={e} type="button" aria-pressed={estado === e} onClick={() => setEstado(e)}>
              {e === 'activo' ? 'Activos' : e === 'cesado' ? 'Cesados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>
      <Aviso>{error}</Aviso>

      <ul className="lista lista-usuarios">
        {visibles.map((c) => {
          const propia = c.persona_id === miId
          const gestionable = !propia && (esDueno || c.rol !== 'admin_empresa')
          return (
            <li key={c.id} className={c.estado === 'activo' ? '' : 'inactiva'}>
              <div>
                <b>{c.personas?.apellidos_nombres}</b>
                <span className="chips">
                  <span className="chip chip-gris">{NOMBRE_ROL[c.rol]}</span>
                  {c.estado === 'cesado' && <span className="chip chip-mal">Cesado {c.fecha_cese ? fecha(c.fecha_cese) : ''}</span>}
                  {c.estado === 'activo' && c.personas?.debe_cambiar_contrasena && <span className="chip chip-aviso">Debe cambiar su contraseña</span>}
                  {propia && <span className="chip chip-ok">Tú</span>}
                </span>
                <small>
                  {c.personas?.tipo_documento.toUpperCase()} {c.personas?.numero_documento}
                  {c.puesto ? ` · ${c.puesto}` : ''}
                  {c.area ? ` · ${c.area}` : ''}
                  {c.estado === 'cesado' && c.motivo_cese ? ` · Motivo: ${c.motivo_cese}` : ''}
                </small>
                {abierta === c.id && <PanelCuenta cuenta={c} esDueno={esDueno} listas={listas} onCerrar={() => setAbierta(null)} onListo={listo} />}
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
      {!esDueno && <p className="nota">Los administradores los crea y gestiona Integrax. Tu propia contraseña la cambias desde tu cuenta.</p>}

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
  empresaId, esDueno, listas, onCancelar, onListo,
}: { empresaId: string; esDueno: boolean; listas: Record<Lista, Item[]>; onCancelar: () => void; onListo: (c?: Clave, texto?: string) => void }) {
  const [rol, setRol] = useState<Rol>('usuario')
  const [tipo, setTipo] = useState<TipoDocumento>('dni')
  const [numero, setNumero] = useState('')
  const [nombres, setNombres] = useState('')
  const [ingreso, setIngreso] = useState(hoy)
  const [puestoId, setPuestoId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)!
  const nombreDe = (l: Lista, id: string) => listas[l].find((i) => i.id === id)?.nombre ?? null

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = normalizarDocumento(numero)
    if (!tipoDoc.patron.test(n)) return setError(`Revisa el número de documento (${tipoDoc.ayuda}).`)
    if (nombres.trim().length < 3) return setError('Escribe apellidos y nombres.')
    setOcupado(true)
    try {
      const r = await crearCuenta(empresaId, {
        rol, tipo_documento: tipo, numero_documento: n, apellidos_nombres: nombres, fecha_ingreso: ingreso,
        puesto: nombreDe('puestos', puestoId), area: nombreDe('areas', areaId),
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
          <option value="gestor">{NOMBRE_ROL.gestor}</option>
          {esDueno && <option value="admin_empresa">{NOMBRE_ROL.admin_empresa}</option>}
        </select>
        <small className="ayuda">El rol decide qué puede hacer la persona. El puesto es solo un dato de su ficha.</small>
      </label>
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
        <SelectorLista etiqueta="Área" items={listas.areas} valor={areaId} onCambio={setAreaId} />
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
  cuenta: c, esDueno, listas, onCerrar, onListo,
}: { cuenta: Cuenta; esDueno: boolean; listas: Record<Lista, Item[]>; onCerrar: () => void; onListo: (c?: Clave) => void }) {
  const [accion, setAccion] = useState<'menu' | 'corregir' | 'clave' | 'cesar'>('menu')
  const [nombres, setNombres] = useState(c.personas?.apellidos_nombres ?? '')
  const [ingreso, setIngreso] = useState(c.fecha_ingreso)
  const [rol, setRol] = useState<Rol>(c.rol)
  const [puestoId, setPuestoId] = useState(c.puesto_id ?? '')
  const [areaId, setAreaId] = useState(c.area_id ?? '')
  const [fechaCese, setFechaCese] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const nombre = c.personas?.apellidos_nombres ?? ''

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
    if (areaId !== (c.area_id ?? '')) cambios.area_id = areaId || null
    if (!Object.keys(cambios).length) return setError('No cambiaste ningún dato.')
    void hacer(() => actualizarPersona(c.id, cambios))
  }

  function cesar(e: FormEvent) {
    e.preventDefault()
    if (motivo.trim().length < 3) return setError('Indica el motivo del cese.')
    void hacer(() => cesarCuenta(c.id, fechaCese, motivo))
  }

  return (
    <div className="panel-cuenta">
      {accion === 'menu' && (
        <div className="acciones">
          {c.estado === 'activo' ? (
            <>
              <button className="btn-sec" type="button" onClick={() => setAccion('corregir')}>
                <Pencil size={18} aria-hidden="true" /> Corregir datos
              </button>
              <button className="btn-sec" type="button" onClick={() => setAccion('clave')}>
                <KeyRound size={18} aria-hidden="true" /> Contraseña nueva
              </button>
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
                <option value="gestor">{NOMBRE_ROL.gestor}</option>
                {(esDueno || c.rol === 'admin_empresa') && <option value="admin_empresa">{NOMBRE_ROL.admin_empresa}</option>}
              </select>
            </label>
          </div>
          <div className="fila2">
            <SelectorLista etiqueta="Puesto" items={listas.puestos} valor={puestoId} onCambio={setPuestoId} />
            <SelectorLista etiqueta="Área" items={listas.areas} valor={areaId} onCambio={setAreaId} />
          </div>
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
