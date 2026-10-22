import { Building2, CircleCheck, Database, Download, Home, LogOut, Smartphone, Wifi, WifiOff } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { CambioContrasena } from './CambioContrasena'
import { DetalleEmpresa } from './empresas/DetalleEmpresa'
import { crearEmpresa } from './empresas/datos'
import { FormFicha } from './empresas/FormFicha'
import { ListaEmpresas } from './empresas/ListaEmpresas'
import { type DbState, useDatabase, useInstall, useOnline } from './hooks'
import { Ingreso } from './Ingreso'
import { ir, useRuta } from './ruta'
import { type Perfil, salir, useSesion } from './sesion'

const dbText: Record<DbState, { value: string; note?: string; tone: Tone }> = {
  checking: { value: 'Comprobando…', tone: 'idle' },
  ok: { value: 'Conectada', tone: 'ok' },
  offline: { value: 'En espera', note: 'Se conectará al volver la señal', tone: 'idle' },
  error: { value: 'Sin respuesta', note: 'Se reintentará más tarde', tone: 'idle' },
  unconfigured: { value: 'Por conectar', tone: 'idle' },
}

function Mark() {
  return (
    <svg className="mark" viewBox="96 96 320 320" aria-hidden="true">
      <path
        className="mark-arc"
        d="M355.6 172.4 A130 130 0 1 0 355.6 339.6"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={56}
      />
      <circle className="mark-dot" cx="256" cy="256" r="42" />
    </svg>
  )
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

function Install() {
  const { state, install } = useInstall()

  if (state === 'installed') {
    return (
      <p className="install-note">
        <CircleCheck size={18} aria-hidden="true" /> Instalada en este equipo
      </p>
    )
  }
  if (state === 'available') {
    return (
      <button className="install" type="button" onClick={install}>
        <Download size={20} aria-hidden="true" /> Instalar en este equipo
      </button>
    )
  }
  return (
    <p className="install-note">
      <Smartphone size={18} aria-hidden="true" />
      {state === 'ios'
        ? 'Para instalar: botón Compartir → “Agregar a inicio”.'
        : 'Para instalar: menú del navegador → “Instalar aplicación”.'}
    </p>
  )
}

function Inicio({ perfil, online }: { perfil: Perfil; online: boolean }) {
  const db = dbText[useDatabase(online)]
  const datos = [
    ['Empresa', perfil.esDueno && !perfil.empresa ? 'Integrax · Dueño de la plataforma' : perfil.empresa],
    ['Rol', perfil.rol ?? (perfil.esDueno ? 'Dueño de la plataforma' : null)],
    ['Puesto', perfil.puesto],
    ['Área', perfil.area],
  ].filter((d): d is [string, string] => Boolean(d[1]))

  return (
    <>
      <p className="lede">Hola, {perfil.apellidosNombres}.</p>

      <dl className="ficha">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <h2 id="estado">Estado del sistema</h2>
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

      {(perfil.esDueno || perfil.rolCodigo === 'admin_empresa') && (
        <div className="accesos">
          {perfil.esDueno && (
            <button className="btn" type="button" onClick={() => ir('/empresas')}>
              <Building2 size={20} aria-hidden="true" /> Empresas clientes
            </button>
          )}
          {perfil.rolCodigo === 'admin_empresa' && perfil.empresaId && (
            <button className="btn" type="button" onClick={() => ir('/mi-empresa')}>
              <Building2 size={20} aria-hidden="true" /> Mi empresa
            </button>
          )}
        </div>
      )}

      <Install />

      <button className="btn-link" type="button" onClick={() => void salir()}>
        <LogOut size={18} aria-hidden="true" /> Cerrar sesión
      </button>
    </>
  )
}

/** Barra superior compacta de las pantallas de gestión. */
function Barra({ perfil }: { perfil: Perfil }) {
  return (
    <header className="barra">
      <button className="barra-marca" type="button" onClick={() => ir('/')} aria-label="Ir al inicio">
        <Mark />
        <span>CRC</span>
      </button>
      <nav aria-label="Secciones">
        <button type="button" onClick={() => ir('/')}>
          <Home size={18} aria-hidden="true" /> <span>Inicio</span>
        </button>
        {perfil.esDueno && (
          <button type="button" onClick={() => ir('/empresas')}>
            <Building2 size={18} aria-hidden="true" /> <span>Empresas</span>
          </button>
        )}
        {perfil.rolCodigo === 'admin_empresa' && (
          <button type="button" onClick={() => ir('/mi-empresa')}>
            <Building2 size={18} aria-hidden="true" /> <span>Mi empresa</span>
          </button>
        )}
        <button type="button" onClick={() => void salir()} aria-label="Cerrar sesión">
          <LogOut size={18} aria-hidden="true" />
        </button>
      </nav>
    </header>
  )
}

/** Pantallas de gestión según la dirección (#/empresas, #/mi-empresa…). null = pantalla de inicio. */
function Gestion({ perfil, ruta }: { perfil: Perfil; ruta: string[] }): ReactNode {
  if (ruta[0] === 'empresas' && perfil.esDueno) {
    if (!ruta[1]) return <ListaEmpresas />
    if (ruta[1] === 'nueva')
      return (
        <FormFicha
          onCancelar={() => ir('/empresas')}
          onGuardar={async (ficha, sede) => {
            const id = await crearEmpresa(ficha, sede!)
            ir(`/empresas/${id}`)
          }}
        />
      )
    return <DetalleEmpresa key={ruta[1]} empresaId={ruta[1]} modo="dueno" />
  }
  if (ruta[0] === 'mi-empresa' && perfil.rolCodigo === 'admin_empresa' && perfil.empresaId)
    return <DetalleEmpresa empresaId={perfil.empresaId} modo="admin" />
  return null
}

export default function App() {
  const online = useOnline()
  const ruta = useRuta()
  const { sesion, recargar } = useSesion(online)
  // La contraseña recién escrita se guarda solo en memoria, para no volver a pedirla en el cambio obligatorio.
  const [claveIngreso, setClaveIngreso] = useState<string | null>(null)

  let contenido: ReactNode
  if (sesion.fase === 'cargando') {
    contenido = <p className="lede">Cargando…</p>
  } else if (sesion.fase === 'fuera') {
    contenido = <Ingreso aviso={sesion.aviso} onIngreso={setClaveIngreso} />
  } else if (sesion.perfil.debeCambiarContrasena) {
    contenido = (
      <CambioContrasena
        perfil={sesion.perfil}
        claveActual={claveIngreso}
        onListo={() => {
          setClaveIngreso(null)
          recargar()
        }}
      />
    )
  } else {
    const gestion = Gestion({ perfil: sesion.perfil, ruta })
    if (gestion)
      return (
        <main className="screen gestion">
          <Barra perfil={sesion.perfil} />
          <section className="panel panel-ancho">{gestion}</section>
        </main>
      )
    contenido = <Inicio perfil={sesion.perfil} online={online} />
  }

  return (
    <main className="screen" data-fase={sesion.fase}>
      <header className="sign">
        <Mark />
        <h1 className="brand">
          CRC
          <span>Centinel Risk Control</span>
        </h1>
      </header>

      <section className="panel">
        {contenido}
        <footer className="foot">Versión 0.3 · Registro de empresas</footer>
      </section>
    </main>
  )
}
