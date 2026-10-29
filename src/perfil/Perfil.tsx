import { ArrowLeft, Building2, ChevronDown, Database, LogOut, UserRound, Wifi, WifiOff } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Aviso, Dato, Seccion } from '../empresas/campos'
import { conLimite, db, mensaje } from '../empresas/datos'
import { type DbState, useDatabase, useMenu } from '../hooks'
import { ir } from '../ruta'
import { type Perfil, salir } from '../sesion'

/**
 * Botón «Perfil» de la barra superior (revisión de diseño, obs. 1): abre un menú con la información de la persona,
 * la de su empresa y el cierre de sesión. Reemplaza la ficha que antes se veía en el inicio.
 */
export function MenuPerfil({ perfil }: { perfil: Perfil }) {
  const { abierto, setAbierto, caja } = useMenu<HTMLDivElement>()

  const elegir = (accion: () => void) => () => {
    setAbierto(false)
    accion()
  }

  return (
    <div className="perfil-menu" ref={caja}>
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <UserRound size={18} aria-hidden="true" /> <span>Perfil</span> <ChevronDown size={14} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="perfil-lista" role="menu">
          <p className="perfil-quien">
            <b>{perfil.apellidosNombres}</b>
            <small>{rolDe(perfil)}</small>
          </p>
          <button type="button" role="menuitem" onClick={elegir(() => ir('/perfil'))}>
            <UserRound size={18} aria-hidden="true" /> Mi información
          </button>
          {perfil.empresaId && (
            <button type="button" role="menuitem" onClick={elegir(() => ir('/perfil/empresa'))}>
              <Building2 size={18} aria-hidden="true" /> Información de la empresa
            </button>
          )}
          <button type="button" role="menuitem" onClick={elegir(() => void salir())}>
            <LogOut size={18} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

const rolDe = (perfil: Perfil) => perfil.rol ?? (perfil.esDueno ? 'Dueño de la plataforma' : '')

/** Mi información: lo que CRC sabe de la persona que ingresó. */
export function MiInformacion({ perfil, online }: { perfil: Perfil; online: boolean }) {
  const db = dbText[useDatabase(online)]
  return (
    <div className="detalle">
      <Volver />
      <header className="detalle-cab">
        <h1>Mi información</h1>
        <p>Tus datos en CRC. Si algo no es correcto, avisa al administrador de tu empresa.</p>
      </header>
      <Seccion titulo="Datos personales">
        <dl className="ficha">
          <Dato etiqueta="Apellidos y nombres" valor={perfil.apellidosNombres} />
          <Dato etiqueta="Documento" valor={perfil.numeroDocumento ?? (perfil.empresaId || perfil.esDueno ? 'Se ve con señal' : null)} />
        </dl>
      </Seccion>
      <Seccion titulo="En la empresa">
        <dl className="ficha">
          <Dato etiqueta="Empresa" valor={perfil.esDueno && !perfil.empresa ? 'Integrax · Dueño de la plataforma' : perfil.empresa} />
          <Dato etiqueta="Rol" valor={rolDe(perfil)} />
          <Dato etiqueta="Puesto" valor={perfil.puesto} />
          <Dato etiqueta="Área" valor={perfil.area} />
        </dl>
      </Seccion>
      {/* Estado del sistema (revisión de diseño, obs. 3): antes estaba en el inicio. */}
      <Seccion titulo="Conexión de este equipo">
        <ul className="checks">
          <Check
            icon={online ? <Wifi /> : <WifiOff />}
            label="Internet"
            value={online ? 'En línea' : 'Sin conexión'}
            note={online ? undefined : 'La app sigue disponible'}
            tone={online ? 'ok' : 'idle'}
          />
          <Check icon={<Database />} label="Base de datos" value={db.value} note={db.note} tone={db.tone} />
        </ul>
      </Seccion>
    </div>
  )
}

const dbText: Record<DbState, { value: string; note?: string; tone: Tone }> = {
  checking: { value: 'Comprobando…', tone: 'idle' },
  ok: { value: 'Conectada', tone: 'ok' },
  offline: { value: 'En espera', note: 'Se conectará al volver la señal', tone: 'idle' },
  error: { value: 'Sin respuesta', note: 'Se reintentará más tarde', tone: 'idle' },
  unconfigured: { value: 'Por conectar', tone: 'idle' },
}

type Tone = 'ok' | 'idle'

function Check({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note?: string; tone: Tone }) {
  return (
    <li className="check" data-tone={tone}>
      <span className="check-icon">{icon}</span>
      <span className="check-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="check-value" key={value}>
        {value}
      </span>
    </li>
  )
}

type DatosEmpresa = {
  empresa: { ruc: string; razon_social: string; nombre_comercial: string | null; domicilio_direccion: string | null; domicilio_distrito: string | null; domicilio_provincia: string | null; domicilio_departamento: string | null; actividad_texto: string | null } | null
  sedes: { id: string; nombre: string; direccion: string; distrito: string; provincia: string; departamento: string }[]
}

/** Información de la empresa: la ficha y las sedes activas, solo para leer (las cambia Integrax o el administrador). */
export function InfoEmpresa({ empresaId, online }: { empresaId: string; online: boolean }) {
  const [datos, setDatos] = useState<DatosEmpresa | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    conLimite(Promise.all([
      db().from('empresas').select('ruc, razon_social, nombre_comercial, domicilio_direccion, domicilio_distrito, domicilio_provincia, domicilio_departamento, actividad_texto').eq('id', empresaId).maybeSingle(),
      db().from('sedes').select('id, nombre, direccion, distrito, provincia, departamento').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
    ])).then(([e, s]) => {
      const falla = e.error || s.error
      if (falla) setError(mensaje(falla))
      else setDatos({ empresa: e.data, sedes: s.data ?? [] })
    }, (e) => setError((e as Error).message))
  }, [empresaId, online])

  const empresa = datos?.empresa
  return (
    <div className="detalle">
      <Volver />
      <header className="detalle-cab">
        <h1>Información de la empresa</h1>
        <p>Datos de tu empresa en CRC.</p>
      </header>
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="aviso-suave">Se ve con señal.</p>
      ) : !datos ? (
        !error && <p className="nota">Cargando…</p>
      ) : !empresa ? (
        <p className="nota">No se encontró la empresa.</p>
      ) : (
        <>
          <Seccion titulo="Ficha">
            <dl className="ficha">
              <Dato etiqueta="Razón social" valor={empresa.razon_social} />
              <Dato etiqueta="Nombre comercial" valor={empresa.nombre_comercial} />
              <Dato etiqueta="RUC" valor={empresa.ruc} />
              <Dato
                etiqueta="Domicilio legal"
                valor={empresa.domicilio_direccion && `${empresa.domicilio_direccion} · ${empresa.domicilio_distrito}, ${empresa.domicilio_provincia}, ${empresa.domicilio_departamento}`}
              />
              <Dato etiqueta="Actividad" valor={empresa.actividad_texto} />
            </dl>
          </Seccion>
          <Seccion titulo={`Sedes (${datos.sedes.length})`}>
            {!datos.sedes.length ? (
              <p className="nota">La empresa no tiene sedes activas.</p>
            ) : (
              <dl className="ficha">
                {datos.sedes.map((s) => (
                  <Dato key={s.id} etiqueta={s.nombre} valor={`${s.direccion} · ${s.distrito}, ${s.provincia}, ${s.departamento}`} />
                ))}
              </dl>
            )}
          </Seccion>
        </>
      )}
    </div>
  )
}

function Volver() {
  return (
    <button className="btn-link volver" type="button" onClick={() => ir('/')}>
      <ArrowLeft size={18} aria-hidden="true" /> Inicio
    </button>
  )
}
