import { Boxes, Building2, CircleCheck, ClipboardCheck, ClipboardList, Database, Download, Home, LogOut, PenLine, ShieldCheck, Smartphone, Users, Wifi, WifiOff } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Activos } from './activos/Activos'
import { CambioContrasena } from './CambioContrasena'
import { Carga } from './carga/Carga'
import { DetalleEmpresa } from './empresas/DetalleEmpresa'
import { crearEmpresa } from './empresas/datos'
import { FormFicha } from './empresas/FormFicha'
import { Editor } from './formatos/Editor'
import { Formatos, type Rutas } from './formatos/Formatos'
import { ListaEmpresas } from './empresas/ListaEmpresas'
import { type DbState, useDatabase, useInstall, useOnline } from './hooks'
import { Ingreso } from './Ingreso'
import { pedirPersistencia } from './inspecciones/almacen'
import { useSincronizacion } from './inspecciones/campo'
import { DetalleInspeccion } from './inspecciones/Detalle'
import { espacioLleno, useFirmasPendientes, useUso } from './inspecciones/ayudas'
import { Inspecciones } from './inspecciones/Inspecciones'
import { Llenar } from './inspecciones/Llenar'
import { MisFirmas } from './inspecciones/MisFirmas'
import { Logo } from './marca/Logo'
import { ir, useRuta } from './ruta'
import { type Perfil, salir, useSesion } from './sesion'
import { Intentos } from './usuarios/Intentos'
import { Listas } from './usuarios/Listas'
import { Usuarios } from './usuarios/Usuarios'

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

function Inicio({ perfil, online, firmas }: { perfil: Perfil; online: boolean; firmas: number }) {
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

      {(perfil.esDueno || perfil.rolCodigo === 'admin_empresa' || perfil.rolCodigo === 'gestor') && (
        <div className="accesos">
          {perfil.esDueno && (
            <>
              <button className="btn" type="button" onClick={() => ir('/empresas')}>
                <Building2 size={20} aria-hidden="true" /> Empresas clientes
              </button>
              <button className="btn-sec" type="button" onClick={() => ir('/intentos')}>
                <ShieldCheck size={18} aria-hidden="true" /> Registro de intentos de ingreso
              </button>
            </>
          )}
          {perfil.rolCodigo === 'admin_empresa' && perfil.empresaId && (
            <>
              <button className="btn" type="button" onClick={() => ir('/mi-empresa/usuarios')}>
                <Users size={20} aria-hidden="true" /> Usuarios de mi empresa
              </button>
              <button className="btn-sec" type="button" onClick={() => ir('/mi-empresa')}>
                <Building2 size={18} aria-hidden="true" /> Mi empresa
              </button>
            </>
          )}
          {esEquipoSso(perfil) && (
            <>
              <button className="btn" type="button" onClick={() => ir('/inspecciones')}>
                <ClipboardList size={20} aria-hidden="true" /> Inspecciones
              </button>
              <button className="btn-sec" type="button" onClick={() => ir('/formatos')}>
                <ClipboardCheck size={18} aria-hidden="true" /> Formatos de inspección
              </button>
              <button className="btn-sec" type="button" onClick={() => ir('/activos')}>
                <Boxes size={18} aria-hidden="true" /> Activos y listas
              </button>
            </>
          )}
        </div>
      )}

      {firmas > 0 && (
        <button className="btn-sec" type="button" onClick={() => ir('/firmas')}>
          <PenLine size={18} aria-hidden="true" /> Tienes {firmas} firma(s) pendiente(s)
        </button>
      )}

      <Install />

      <button className="btn-link" type="button" onClick={() => void salir()}>
        <LogOut size={18} aria-hidden="true" /> Cerrar sesión
      </button>
    </>
  )
}

/** Barra superior compacta de las pantallas de gestión. */
function Barra({ perfil, firmas }: { perfil: Perfil; firmas: number }) {
  return (
    <header className="barra">
      <button className="barra-marca" type="button" onClick={() => ir('/')} title="Ir al inicio">
        <Logo fondo="oscuro" />
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
        {perfil.esDueno && (
          <button type="button" onClick={() => ir('/intentos')}>
            <ShieldCheck size={18} aria-hidden="true" /> <span>Intentos</span>
          </button>
        )}
        {esEquipoSso(perfil) && (
          <button type="button" onClick={() => ir('/inspecciones')}>
            <ClipboardList size={18} aria-hidden="true" /> <span>Inspecciones</span>
          </button>
        )}
        {firmas > 0 && (
          <button type="button" onClick={() => ir('/firmas')}>
            <PenLine size={18} aria-hidden="true" /> <span>Firmas ({firmas})</span>
          </button>
        )}
        {esEquipoSso(perfil) && (
          <button type="button" onClick={() => ir('/formatos')}>
            <ClipboardCheck size={18} aria-hidden="true" /> <span>Formatos</span>
          </button>
        )}
        {perfil.rolCodigo === 'admin_empresa' && (
          <>
            <button type="button" onClick={() => ir('/mi-empresa')}>
              <Building2 size={18} aria-hidden="true" /> <span>Mi empresa</span>
            </button>
            <button type="button" onClick={() => ir('/mi-empresa/usuarios')}>
              <Users size={18} aria-hidden="true" /> <span>Usuarios</span>
            </button>
          </>
        )}
        <button type="button" onClick={() => void salir()} aria-label="Cerrar sesión">
          <LogOut size={18} aria-hidden="true" />
        </button>
      </nav>
    </header>
  )
}

/** Administrador y gestor (equipo SSO) de una empresa: trabajan con los formatos y los activos (tarea 3.4-B). */
function esEquipoSso(perfil: Perfil) {
  return Boolean(perfil.empresaId) && (perfil.rolCodigo === 'admin_empresa' || perfil.rolCodigo === 'gestor')
}

/**
 * Formatos y activos de una empresa. Los botones se muestran según el rol (comodidad); quien decide de verdad
 * qué se puede hacer es la base de datos (permisos plantillas.editar, plantillas.publicar y activos.editar).
 */
function PantallasFormatos({ empresaId, partes, rutas, perfil }: { empresaId: string; partes: string[]; rutas: Rutas; perfil: Perfil }): ReactNode {
  const puedeEditar = perfil.esDueno || perfil.rolCodigo === 'admin_empresa' || perfil.rolCodigo === 'gestor'
  const puedePublicar = perfil.esDueno || perfil.rolCodigo === 'admin_empresa'
  if (partes[0] === 'activos') return <Activos key={empresaId} empresaId={empresaId} rutas={rutas} puedeEditar={puedeEditar} esDueno={perfil.esDueno} />
  if (partes[1])
    return <Editor key={partes[1]} plantillaId={partes[1]} rutas={rutas} puedeEditar={puedeEditar} puedePublicar={puedePublicar} />
  return <Formatos key={empresaId} empresaId={empresaId} rutas={rutas} puedeEditar={puedeEditar} />
}

function PantallaLlenar({ id, cuenta, empresaId, online }: { id: string; cuenta: string; empresaId: string; online: boolean }) {
  const uso = useUso(empresaId, online)
  return <Llenar id={id} cuenta={cuenta} sinEspacio={espacioLleno(uso)} />
}

/** Pantallas de gestión según la dirección (#/empresas, #/mi-empresa…). null = pantalla de inicio. */
function Gestion({ perfil, ruta, online }: { perfil: Perfil; ruta: string[]; online: boolean }): ReactNode {
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
    const volver = () => ir(`/empresas/${ruta[1]}`)
    if (ruta[2] === 'usuarios') return <Usuarios key={ruta[1]} empresaId={ruta[1]} esDueno miId={perfil.id} onVolver={volver} />
    if (ruta[2] === 'listas') return <Listas key={ruta[1]} empresaId={ruta[1]} onVolver={volver} />
    if (ruta[2] === 'carga') return <Carga key={ruta[1]} empresaId={ruta[1]} onVolver={() => ir(`/empresas/${ruta[1]}/usuarios`)} />
    if (ruta[2] === 'formatos' || ruta[2] === 'activos') {
      const rutas: Rutas = { formatos: `/empresas/${ruta[1]}/formatos`, activos: `/empresas/${ruta[1]}/activos`, volver: `/empresas/${ruta[1]}` }
      return PantallasFormatos({ empresaId: ruta[1], partes: ruta.slice(2), rutas, perfil })
    }
    return <DetalleEmpresa key={ruta[1]} empresaId={ruta[1]} modo="dueno" />
  }
  if (ruta[0] === 'intentos' && perfil.esDueno) return <Intentos />
  if (ruta[0] === 'inspecciones' && perfil.empresaId) {
    if (ruta[1] === 'llenar' && ruta[2] && esEquipoSso(perfil))
      return <PantallaLlenar key={ruta[2]} id={ruta[2]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} />
    // El detalle también lo abre cada firmante (la base de datos decide qué puede ver).
    if (ruta[1])
      return <DetalleInspeccion key={ruta[1]} id={ruta[1]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} esAdmin={perfil.rolCodigo === 'admin_empresa'} />
    if (esEquipoSso(perfil)) return <Inspecciones empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
  }
  if (ruta[0] === 'firmas' && perfil.empresaId) return <MisFirmas cuenta={perfil.id} online={online} />
  if ((ruta[0] === 'formatos' || ruta[0] === 'activos') && esEquipoSso(perfil) && perfil.empresaId) {
    const rutas: Rutas = { formatos: '/formatos', activos: '/activos', volver: null }
    return PantallasFormatos({ empresaId: perfil.empresaId, partes: ruta, rutas, perfil })
  }
  if (ruta[0] === 'mi-empresa' && perfil.rolCodigo === 'admin_empresa' && perfil.empresaId) {
    const volver = () => ir('/mi-empresa')
    if (ruta[1] === 'usuarios') return <Usuarios empresaId={perfil.empresaId} esDueno={false} miId={perfil.id} onVolver={volver} />
    if (ruta[1] === 'listas') return <Listas empresaId={perfil.empresaId} onVolver={volver} />
    if (ruta[1] === 'carga') return <Carga empresaId={perfil.empresaId} onVolver={() => ir('/mi-empresa/usuarios')} />
    return <DetalleEmpresa empresaId={perfil.empresaId} modo="admin" />
  }
  return null
}

export default function App() {
  const online = useOnline()
  const ruta = useRuta()
  const { sesion, recargar } = useSesion(online)
  // La contraseña recién escrita se guarda solo en memoria, para no volver a pedirla en el cambio obligatorio.
  const [claveIngreso, setClaveIngreso] = useState<string | null>(null)
  // Inspecciones sin señal (3.4-C): se pide que el navegador no borre la memoria de la app, y con sesión y señal
  // se envía la cola y se actualiza la copia local de formatos y activos.
  const perfil = sesion.fase === 'dentro' ? sesion.perfil : null
  useEffect(() => void pedirPersistencia(), [])
  useSincronizacion(perfil?.id ?? null, perfil?.empresaId ?? null, online, perfil ? esEquipoSso(perfil) : false)
  const firmas = useFirmasPendientes(perfil?.empresaId ? perfil.id : null, online)

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
    // Ya con sesión: barra con el logo pequeño (decisión del dueño, tarea 2.1a), también en el inicio.
    const gestion = Gestion({ perfil: sesion.perfil, ruta, online })
    return (
      <main className="screen gestion">
        <Barra perfil={sesion.perfil} firmas={firmas} />
        {gestion ? (
          <section className="panel panel-ancho">{gestion}</section>
        ) : (
          <section className="panel panel-inicio">
            <Inicio perfil={sesion.perfil} online={online} firmas={firmas} />
            <footer className="foot">{VERSION}</footer>
          </section>
        )}
      </main>
    )
  }

  // Antes de entrar (y en el cambio obligatorio de contraseña): franja azul con el logo animado.
  return (
    <main className="screen" data-fase={sesion.fase}>
      <header className="sign">
        {/* Mientras se revisa la sesión todavía no se sabe si toca el ingreso: así el animado no se descarga sin necesidad. */}
        {sesion.fase === 'cargando' ? <span className="logo logo-ingreso" /> : <Logo animado fondo="oscuro" className="logo-ingreso" />}
        <h1 className="brand">
          <span className="brand-1">Centinel</span> <span className="brand-2">
            Risk <span>Control</span>
          </span>
        </h1>
      </header>

      <section className="panel">
        {contenido}
        <footer className="foot">{VERSION}</footer>
      </section>
    </main>
  )
}

const VERSION = 'Versión 0.6.0 · Inspecciones en el celular'
