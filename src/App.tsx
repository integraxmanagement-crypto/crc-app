import { Boxes, Building2, CircleCheck, ClipboardCheck, CalendarDays, ClipboardList, ListChecks, Download, Home, PenLine, ShieldCheck, Smartphone, Users } from 'lucide-react'
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
import { useInstall, useOnline } from './hooks'
import { Hallazgos } from './hallazgos/Hallazgos'
import { MisActividades } from './passt/MisActividades'
import { ProgramaAnual } from './passt/Programa'
import { Programas } from './passt/Programas'
import { AvancePasst } from './inicio/AvancePasst'
import { Campana } from './inicio/Campana'
import { PendientesMes } from './inicio/PendientesMes'
import { Ingreso } from './Ingreso'
import { pedirPersistencia } from './inspecciones/almacen'
import { useSincronizacion } from './inspecciones/campo'
import { Avance } from './inspecciones/Avance'
import { DetalleInspeccion } from './inspecciones/Detalle'
import { espacioLleno, useFirmasPendientes, useUso } from './inspecciones/ayudas'
import { Inspecciones } from './inspecciones/Inspecciones'
import { Llenar } from './inspecciones/Llenar'
import { MisFirmas } from './inspecciones/MisFirmas'
import { Logo } from './marca/Logo'
import { InfoEmpresa, MenuPerfil, MiInformacion } from './perfil/Perfil'
import { ir, useRuta } from './ruta'
import { type Perfil, useSesion } from './sesion'
import { Intentos } from './usuarios/Intentos'
import { Listas } from './usuarios/Listas'
import { Usuarios } from './usuarios/Usuarios'

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

/**
 * Nombre para el saludo (revisión de diseño, obs. 4): CRC guarda «APELLIDOS, Nombres»; se toma el primer nombre
 * (lo que va después de la coma) y, si viene todo en mayúsculas, se escribe con mayúscula inicial.
 */
function nombreCorto(apellidosNombres: string) {
  const [antes, despues] = apellidosNombres.split(',')
  const primero = (despues ?? antes).trim().split(/\s+/)[0] ?? ''
  return primero === primero.toLocaleUpperCase('es') ? primero.charAt(0) + primero.slice(1).toLocaleLowerCase('es') : primero
}

function Inicio({ perfil, firmas, online }: { perfil: Perfil; firmas: number; online: boolean }) {
  return (
    <>
      <h1 className="saludo">Hola, {nombreCorto(perfil.apellidosNombres)}</h1>

      {esEquipoSso(perfil) && perfil.empresaId && <AvancePasst empresaId={perfil.empresaId} online={online} />}
      {esEquipoSso(perfil) && perfil.empresaId && <PendientesMes empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />}

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
              <button className="btn-sec" type="button" onClick={() => ir('/perfil/empresa')}>
                <Building2 size={18} aria-hidden="true" /> Mi empresa
              </button>
            </>
          )}
          {esEquipoSso(perfil) && (
            <>
              <button className="btn" type="button" onClick={() => ir('/inspecciones')}>
                <ClipboardList size={20} aria-hidden="true" /> Inspecciones
              </button>
              <button className="btn-sec" type="button" onClick={() => ir('/passt')}>
                <CalendarDays size={18} aria-hidden="true" /> Programa anual de SST
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

      {perfil.empresaId && !esEquipoSso(perfil) && (
        <button className="btn" type="button" onClick={() => ir('/hallazgos')}>
          <ListChecks size={20} aria-hidden="true" /> Mis hallazgos
        </button>
      )}
      {firmas > 0 && (
        <button className="btn-sec" type="button" onClick={() => ir('/firmas')}>
          <PenLine size={18} aria-hidden="true" /> Tienes {firmas} firma(s) pendiente(s)
        </button>
      )}

      <Install />
    </>
  )
}

/** Barra superior compacta de las pantallas de gestión. */
function Barra({ perfil, firmas, online }: { perfil: Perfil; firmas: number; online: boolean }) {
  return (
    <header className="barra">
      <button className="barra-marca" type="button" onClick={() => ir('/')} title="Ir al inicio">
        <Logo fondo="oscuro" />
      </button>
      {/* Conexión junto al logo (revisión de diseño, obs. 2): luz verde con señal, roja sin señal. */}
      <span className="conexion" data-online={online} role="status" title={online ? 'En línea' : 'Modo sin conexión'}>
        <span className="conexion-luz" aria-hidden="true" />
        <span className="conexion-texto">{online ? 'En línea' : 'Modo sin conexión'}</span>
      </span>
      <nav aria-label="Secciones">
        <button type="button" onClick={() => ir('/')} title="Inicio">
          <Home size={18} aria-hidden="true" /> <span>Inicio</span>
        </button>
        {perfil.esDueno && (
          <button type="button" onClick={() => ir('/empresas')} title="Empresas">
            <Building2 size={18} aria-hidden="true" /> <span>Empresas</span>
          </button>
        )}
        {perfil.esDueno && (
          <button type="button" onClick={() => ir('/intentos')} title="Intentos">
            <ShieldCheck size={18} aria-hidden="true" /> <span>Intentos</span>
          </button>
        )}
        {esEquipoSso(perfil) && (
          <button type="button" onClick={() => ir('/inspecciones')} title="Inspecciones">
            <ClipboardList size={18} aria-hidden="true" /> <span>Inspecciones</span>
          </button>
        )}
        {esEquipoSso(perfil) && (
          <button type="button" onClick={() => ir('/passt')} title="PASST">
            <CalendarDays size={18} aria-hidden="true" /> <span>PASST</span>
          </button>
        )}
        {perfil.empresaId && (
          <button type="button" onClick={() => ir('/hallazgos')} title="Hallazgos">
            <ListChecks size={18} aria-hidden="true" /> <span>Hallazgos</span>
          </button>
        )}
        {esEquipoSso(perfil) && (
          <button type="button" onClick={() => ir('/formatos')} title="Formatos">
            <ClipboardCheck size={18} aria-hidden="true" /> <span>Formatos</span>
          </button>
        )}
        {perfil.empresaId && <Campana firmas={firmas} />}
        <MenuPerfil perfil={perfil} />
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
  if (ruta[0] === 'perfil') {
    if (ruta[1] === 'empresa' && perfil.empresaId) return <InfoEmpresa empresaId={perfil.empresaId} online={online} esAdmin={perfil.rolCodigo === 'admin_empresa'} />
    return <MiInformacion perfil={perfil} online={online} />
  }
  if (ruta[0] === 'intentos' && perfil.esDueno) return <Intentos />
  if (ruta[0] === 'inspecciones' && perfil.empresaId) {
    if (ruta[1] === 'llenar' && ruta[2] && esEquipoSso(perfil))
      return <PantallaLlenar key={ruta[2]} id={ruta[2]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} />
    if (ruta[1] === 'avance' && esEquipoSso(perfil)) return <Avance empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
    if (ruta[1] === 'nueva' && ruta[2] && esEquipoSso(perfil))
      return <Inspecciones key={ruta.join('/')} empresaId={perfil.empresaId} cuenta={perfil.id} online={online} preset={{ plantilla: ruta[2], unidad: ruta[3] ?? null }} />
    // El detalle también lo abre cada firmante (la base de datos decide qué puede ver).
    if (ruta[1])
      return <DetalleInspeccion key={ruta[1]} id={ruta[1]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} esAdmin={perfil.rolCodigo === 'admin_empresa'} />
    if (esEquipoSso(perfil)) return <Inspecciones empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
  }
  if (ruta[0] === 'firmas' && perfil.empresaId) return <MisFirmas cuenta={perfil.id} online={online} />
  if (ruta[0] === 'passt' && esEquipoSso(perfil) && perfil.empresaId) {
    if (ruta[1] === 'mis-actividades') return <MisActividades empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
    if (ruta[1])
      return <ProgramaAnual key={ruta[1]} id={ruta[1]} empresaId={perfil.empresaId} online={online}
        permisos={{ editar: true, admin: perfil.rolCodigo === 'admin_empresa', cuenta: perfil.id }} />
    return <Programas empresaId={perfil.empresaId} online={online} />
  }
  if (ruta[0] === 'hallazgos' && perfil.empresaId)
    return <Hallazgos key={ruta[1] ?? 'todos'} empresaId={perfil.empresaId} cuenta={perfil.id} gestiona={esEquipoSso(perfil)} online={online} inspeccionId={ruta[1]} />
  if ((ruta[0] === 'formatos' || ruta[0] === 'activos') && esEquipoSso(perfil) && perfil.empresaId) {
    const rutas: Rutas = { formatos: '/formatos', activos: '/activos', volver: null }
    return PantallasFormatos({ empresaId: perfil.empresaId, partes: ruta, rutas, perfil })
  }
  if (ruta[0] === 'mi-empresa' && perfil.rolCodigo === 'admin_empresa' && perfil.empresaId) {
    // «Mi empresa» vive ahora en Perfil → Información de la empresa (revisión de diseño, obs. 11).
    const volver = () => ir('/perfil/empresa')
    if (ruta[1] === 'usuarios') return <Usuarios empresaId={perfil.empresaId} esDueno={false} miId={perfil.id} onVolver={volver} />
    if (ruta[1] === 'listas') return <Listas empresaId={perfil.empresaId} onVolver={volver} />
    if (ruta[1] === 'carga') return <Carga empresaId={perfil.empresaId} onVolver={() => ir('/mi-empresa/usuarios')} />
    return <InfoEmpresa empresaId={perfil.empresaId} online={online} esAdmin />
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
        <Barra perfil={sesion.perfil} firmas={firmas} online={online} />
        {gestion ? (
          <section className="panel panel-ancho">{gestion}</section>
        ) : (
          <section className="panel panel-inicio">
            <Inicio perfil={sesion.perfil} firmas={firmas} online={online} />
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

const VERSION = 'Versión 0.9.0 · Formato LOTO, firmas en Excel y PDF'
