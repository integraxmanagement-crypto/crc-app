import { Building2, CircleCheck, Download, Menu, ShieldCheck, Smartphone } from 'lucide-react'
import { type ReactNode, Suspense, lazy, useEffect, useState } from 'react'
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
import { Emergencias } from './inicio/Emergencias'
import { MisHallazgos } from './inicio/MisHallazgos'
import { PendientesMes } from './inicio/PendientesMes'
import { Ingreso } from './Ingreso'
import { pedirPersistencia } from './inspecciones/almacen'
import { useSincronizacion } from './inspecciones/campo'
import { Avance } from './inspecciones/Avance'
import { DetalleInspeccion } from './inspecciones/Detalle'
import { espacioLleno, useFirmasPendientes, useUso } from './inspecciones/ayudas'
import { Inspecciones } from './inspecciones/Inspecciones'
import { TipoInspeccion } from './inspecciones/TipoInspeccion'
import { BombasIncendio } from './inspecciones/BombasIncendio'
import { Llenar } from './inspecciones/Llenar'
import { MisFirmas } from './inspecciones/MisFirmas'
import { Logo } from './marca/Logo'
import { MenuLateral } from './MenuLateral'
import { LogoBarra } from './marca/LogoBarra'
import { InfoEmpresa, MenuPerfil, MiInformacion } from './perfil/Perfil'
import { ir, useRuta } from './ruta'
import { elegirSede, useSedeActiva, validarSede } from './sedeActiva'
import { type Perfil, esAdminDeEmpresa, puede, useSesion } from './sesion'
import { Solicitudes } from './solicitudes/Solicitudes'
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

function Inicio({ perfil, online }: { perfil: Perfil; online: boolean }) {
  return (
    <>
      <h1 className="saludo">Hola, {nombreCorto(perfil.apellidosNombres)}</h1>

      {esEquipoSso(perfil) && perfil.empresaId && <AvancePasst empresaId={perfil.empresaId} online={online} />}
      {esEquipoSso(perfil) && perfil.empresaId && <PendientesMes empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />}

      {/* Debajo de los atrasados: mis hallazgos por cerrar (pedido del dueño, 29/10/2026). */}
      {perfil.empresaId && <MisHallazgos empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />}

      {/* Alerta de sismos — Perú (pedido del dueño, 29/10/2026). */}
      <Suspense fallback={null}>
        <AlertaSismos online={online} />
      </Suspense>

      {/* Lo último del inicio: cómo instalar la aplicación (pedido del dueño, 30/10/2026). */}
      <Install />
    </>
  )
}

// El mapa de sismos (Leaflet) se carga aparte, para que el inicio abra rápido.
const AlertaSismos = lazy(() => import('./inicio/AlertaSismos'))

/** Barra superior compacta de las pantallas de gestión. */
function Barra({ perfil, firmas, online }: { perfil: Perfil; firmas: number; online: boolean }) {
  const [menu, setMenu] = useState(false)
  return (
    <header className="barra">
      {/* Las tres líneas abren el menú lateral (Inicio, Programa anual de SST, Inspecciones y Formatos) (pedido del dueño, 29/10/2026). */}
      <button className="barra-menu" type="button" aria-label="Abrir el menú" aria-expanded={menu} onClick={() => setMenu(true)}>
        <Menu size={22} aria-hidden="true" />
      </button>
      <MenuLateral perfil={perfil} equipoSso={esEquipoSso(perfil)} online={online} abierto={menu} onCerrar={() => setMenu(false)} />
      <button className="barra-marca" type="button" onClick={() => ir('/')} title="Ir al inicio">
        <LogoBarra perfil={perfil} />
      </button>
      {/* Conexión junto al logo (revisión de diseño, obs. 2): luz verde con señal, roja sin señal. */}
      <span className="conexion" data-online={online} role="status" title={online ? 'En línea' : 'Modo sin conexión'}>
        <span className="conexion-luz" aria-hidden="true" />
        <span className="conexion-texto">{online ? 'En línea' : 'Modo sin conexión'}</span>
      </span>
      <nav aria-label="Secciones">
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
        <SelectorSede perfil={perfil} />
        {perfil.empresaId && <Campana firmas={firmas} cuenta={perfil.id} online={online} resuelve={puede(perfil, 'solicitudes.resolver')} solicita={perfil.rolCodigo === 'gestor'} />}
        <Emergencias />
        <MenuPerfil perfil={perfil} />
      </nav>
    </header>
  )
}

/**
 * Selector de sede de la barra: solo sale si la cuenta tiene más de una sede. El administrador general elige «Todas las sedes» o una;
 * las demás cuentas con varias sedes, «Todas mis sedes» o una de las suyas. Lo elegido filtra las listas de la pantalla.
 */
function SelectorSede({ perfil }: { perfil: Perfil }) {
  const elegida = useSedeActiva()
  const ids = perfil.sedes.map((s) => s.id).join(',')
  useEffect(() => validarSede(ids ? ids.split(',') : []), [ids])
  if (perfil.sedes.length < 2) return null
  return (
    <label className="selector-sede">
      <span className="solo-lectores">Sede</span>
      <select value={elegida} onChange={(e) => elegirSede(e.target.value)} aria-label="Sede">
        <option value="">{perfil.rolCodigo === 'admin_empresa' ? 'Todas las sedes' : 'Todas mis sedes'}</option>
        {perfil.sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Administrador y gestor (equipo SSO) de una empresa: trabajan con los formatos y los activos (tarea 3.4-B).
 * El usuario gestor entra a esas pantallas solo si el administrador le marcó alguna facultad que las usa (etapa 2); lo que de verdad puede lo decide la base de datos.
 */
function esEquipoSso(perfil: Perfil) {
  if (!perfil.empresaId) return false
  if (esAdminDeEmpresa(perfil) || perfil.rolCodigo === 'gestor') return true
  return perfil.rolCodigo === 'usuario_gestor' && ['inspecciones.registrar', 'inspecciones.ver', 'hallazgos.gestionar', 'passt.ver'].some((p) => puede(perfil, p))
}

/**
 * Formatos y activos de una empresa. Los botones se muestran según el rol (comodidad); quien decide de verdad
 * qué se puede hacer es la base de datos (permisos plantillas.editar, plantillas.publicar y activos.editar).
 */
function PantallasFormatos({ empresaId, partes, rutas, perfil }: { empresaId: string; partes: string[]; rutas: Rutas; perfil: Perfil }): ReactNode {
  const puedeEditar = perfil.esDueno || esAdminDeEmpresa(perfil) || perfil.rolCodigo === 'gestor'
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
    if (ruta[2] === 'usuarios') return <Usuarios key={ruta[1]} empresaId={ruta[1]} esDueno miId={perfil.id} sedesPropias={null} onVolver={volver} />
    if (ruta[2] === 'listas') return <Listas key={ruta[1]} empresaId={ruta[1]} onVolver={volver} />
    if (ruta[2] === 'carga') return <Carga key={ruta[1]} empresaId={ruta[1]} sedesPropias={null} onVolver={() => ir(`/empresas/${ruta[1]}/usuarios`)} />
    if (ruta[2] === 'formatos' || ruta[2] === 'activos') {
      const rutas: Rutas = { formatos: `/empresas/${ruta[1]}/formatos`, activos: `/empresas/${ruta[1]}/activos`, volver: `/empresas/${ruta[1]}` }
      return PantallasFormatos({ empresaId: ruta[1], partes: ruta.slice(2), rutas, perfil })
    }
    return <DetalleEmpresa key={ruta[1]} empresaId={ruta[1]} modo="dueno" />
  }
  if (ruta[0] === 'perfil') {
    if (ruta[1] === 'empresa' && perfil.empresaId) return <InfoEmpresa empresaId={perfil.empresaId} online={online} esAdmin={perfil.rolCodigo === 'admin_empresa'} esAdminSede={perfil.rolCodigo === 'admin_sede'} />
    return <MiInformacion perfil={perfil} online={online} />
  }
  if (ruta[0] === 'intentos' && perfil.esDueno) return <Intentos />
  if (ruta[0] === 'inspecciones' && perfil.empresaId) {
    if (ruta[1] === 'llenar' && ruta[2] && esEquipoSso(perfil))
      return <PantallaLlenar key={ruta[2]} id={ruta[2]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} />
    if (ruta[1] === 'avance' && esEquipoSso(perfil)) return <Avance empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
    if (ruta[1] === 'nueva' && ruta[2] && esEquipoSso(perfil))
      return <Inspecciones key={ruta.join('/')} empresaId={perfil.empresaId} cuenta={perfil.id} online={online} preset={{ plantilla: ruta[2], unidad: ruta[3] && ruta[3] !== '-' ? ruta[3] : null, activo: ruta[4] ?? null }} />
    if (ruta[1] === 'tipo' && ruta[2] === 'bombas' && esEquipoSso(perfil)) return <BombasIncendio key={ruta[3] ?? ''} abrir={ruta[3] === 'registro' ? 'registro' : undefined} empresaId={perfil.empresaId} cuenta={perfil.id} gestiona={esEquipoSso(perfil)} online={online} />
    if (ruta[1] === 'tipo' && ruta[2] && esEquipoSso(perfil))
      return <TipoInspeccion key={`${ruta[2]}${ruta[3] ?? ''}`} abrir={ruta[3] === 'registro' ? 'registro' : undefined} id={ruta[2]} empresaId={perfil.empresaId} cuenta={perfil.id} gestiona={esEquipoSso(perfil)} online={online} />
    // El detalle también lo abre cada firmante (la base de datos decide qué puede ver).
    if (ruta[1])
      return <DetalleInspeccion key={`${ruta[1]}${ruta[2] ?? ''}`} auto={ruta[2] === 'excel' || ruta[2] === 'pdf' ? ruta[2] : undefined} id={ruta[1]} cuenta={perfil.id} empresaId={perfil.empresaId} online={online} esAdmin={esAdminDeEmpresa(perfil)}
        puedeAnular={esAdminDeEmpresa(perfil) || puede(perfil, 'inspecciones.anular')} puedeCorregir={esAdminDeEmpresa(perfil) || puede(perfil, 'inspecciones.editar_cerrada')} solicita={perfil.rolCodigo === 'gestor'} />
    if (esEquipoSso(perfil)) return <Inspecciones empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
  }
  if (ruta[0] === 'firmas' && perfil.empresaId) return <MisFirmas cuenta={perfil.id} online={online} />
  if (ruta[0] === 'passt' && esEquipoSso(perfil) && perfil.empresaId) {
    if (ruta[1] === 'mis-actividades') return <MisActividades empresaId={perfil.empresaId} cuenta={perfil.id} online={online} />
    if (ruta[1])
      return <ProgramaAnual key={ruta[1]} id={ruta[1]} empresaId={perfil.empresaId} online={online}
        permisos={{ editar: puede(perfil, 'passt.editar') || esAdminDeEmpresa(perfil) || perfil.rolCodigo === 'gestor', admin: esAdminDeEmpresa(perfil) || puede(perfil, 'passt.reprogramar'), general: perfil.rolCodigo === 'admin_empresa', cuenta: perfil.id, solicita: perfil.rolCodigo === 'gestor' && !puede(perfil, 'passt.reprogramar') }} />
    return <Programas empresaId={perfil.empresaId} online={online} sedesPropias={perfil.rolCodigo === 'admin_empresa' ? null : perfil.sedes} />
  }
  if (ruta[0] === 'hallazgos' && perfil.empresaId)
    return <Hallazgos key={ruta[1] ?? 'todos'} empresaId={perfil.empresaId} cuenta={perfil.id} gestiona={esEquipoSso(perfil)} online={online} inspeccionId={ruta[1]} />
  if ((ruta[0] === 'formatos' || ruta[0] === 'activos') && esEquipoSso(perfil) && perfil.empresaId) {
    const rutas: Rutas = { formatos: '/formatos', activos: '/activos', volver: null }
    return PantallasFormatos({ empresaId: perfil.empresaId, partes: ruta, rutas, perfil })
  }
  // Solicitudes de cambio del gestor y su respuesta (etapa 2).
  if (ruta[0] === 'solicitudes' && perfil.empresaId && (esAdminDeEmpresa(perfil) || perfil.rolCodigo === 'gestor'))
    return <Solicitudes cuenta={perfil.id} resuelve={puede(perfil, 'solicitudes.resolver')} online={online} />
  // El gestor maneja el personal de sus sedes (usuarios y usuarios gestores): solo las pantallas de Usuarios y de la carga por Excel.
  if (ruta[0] === 'mi-empresa' && perfil.rolCodigo === 'gestor' && perfil.empresaId && (ruta[1] === 'usuarios' || ruta[1] === 'carga')) {
    if (ruta[1] === 'carga') return <Carga empresaId={perfil.empresaId} sedesPropias={perfil.sedes} onVolver={() => ir('/mi-empresa/usuarios')} />
    return <Usuarios empresaId={perfil.empresaId} esDueno={false} miId={perfil.id} sedesPropias={perfil.sedes} rolMio="gestor" onVolver={() => ir('/perfil')} />
  }
  if (ruta[0] === 'mi-empresa' && esAdminDeEmpresa(perfil) && perfil.empresaId) {
    // «Mi empresa» vive ahora en Perfil → Información de la empresa (revisión de diseño, obs. 11).
    // El administrador de sede maneja las personas de sus sedes; las listas, los contactos y los logos son del administrador general.
    const general = perfil.rolCodigo === 'admin_empresa'
    const volver = () => ir('/perfil/empresa')
    if (ruta[1] === 'usuarios') return <Usuarios empresaId={perfil.empresaId} esDueno={false} miId={perfil.id} sedesPropias={general ? null : perfil.sedes} rolMio={perfil.rolCodigo ?? 'admin_empresa'} puedeFacultades={puede(perfil, 'facultades.dar')} onVolver={volver} />
    if (ruta[1] === 'listas' && general) return <Listas empresaId={perfil.empresaId} onVolver={volver} />
    if (ruta[1] === 'carga') return <Carga empresaId={perfil.empresaId} sedesPropias={general ? null : perfil.sedes} onVolver={() => ir('/mi-empresa/usuarios')} />
    return <InfoEmpresa empresaId={perfil.empresaId} online={online} esAdmin={general} esAdminSede={!general} />
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
  // Al cambiar la sede activa, las pantallas se arman de nuevo con los datos de esa sede.
  const sedeElegida = useSedeActiva()

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
          <section key={sedeElegida} className="panel panel-ancho">{gestion}</section>
        ) : (
          <section key={sedeElegida} className="panel panel-inicio">
            <Inicio perfil={sesion.perfil} online={online} />
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

const VERSION = 'Versión 0.9.4 · Usuario gestor, facultades y solicitudes de cambio'
