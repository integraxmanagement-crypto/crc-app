import { UsersRound, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, Home, ListChecks, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type CopiaLocal, leerCopia } from './inspecciones/campo'
import { listarInspecciones } from './inspecciones/datos'
import { ir, useRuta } from './ruta'
import type { Perfil } from './sesion'
import { useEscritorio } from './useEscritorio'
import { Logo } from './marca/Logo'

/**
 * Menú lateral (pedido del dueño, 29/10/2026): se abre desde las tres líneas de la barra y se desliza desde la izquierda. Trae Inicio,
 * Programa anual de SST, Inspecciones (con las cuatro inspecciones más usadas y «Ver todas») y Formatos. Reemplaza esos botones de la barra.
 */
export function MenuLateral({ perfil, equipoSso, online, abierto, onCerrar }: { perfil: Perfil; equipoSso: boolean; online: boolean; abierto: boolean; onCerrar: () => void }) {
  const [masUsadas, setMasUsadas] = useState<{ id: string; nombre: string }[]>([])
  const [restantes, setRestantes] = useState<{ id: string; nombre: string }[]>([])
  // Inspecciones se despliega con la flecha; «Ver más» muestra el resto de los tipos en este mismo panel y «Ocultar» los vuelve a esconder.
  // Al elegir otra sección, todo se recoge (pedido del dueño, 05/11/2026).
  const [inspAbierto, setInspAbierto] = useState(() => location.hash.startsWith('#/inspecciones'))
  const [verMas, setVerMas] = useState(false)
  // En pantalla de escritorio el menú está siempre a la vista (fijo a la izquierda); en celular y tablet es un cajón que se abre.
  const escritorio = useEscritorio()
  const ruta = useRuta()
  // La página en la que está la persona se resalta en el menú (y se anuncia como «página actual»).
  const aqui = (activo: boolean) => (activo ? { className: 'activo', 'aria-current': 'page' as const } : {})
  const visible = abierto || escritorio

  // Las cuatro inspecciones más usadas: las que más registros tienen; sin señal (o sin registros), por orden alfabético.
  useEffect(() => {
    if (!visible || !equipoSso || !perfil.empresaId) return
    let vivo = true
    ;(async () => {
      let copia: CopiaLocal | undefined = await leerCopia(perfil.id, perfil.empresaId!)
      // En el primer ingreso la copia de formatos tarda unos segundos en bajar: se vuelve a mirar unas veces.
      for (let k = 0; k < 6 && vivo && !copia?.formatos.length; k++) {
        await new Promise((r) => setTimeout(r, 2500))
        copia = await leerCopia(perfil.id, perfil.empresaId!)
      }
      const formatos = copia?.formatos.map((f) => ({ id: f.plantilla.id, nombre: f.plantilla.nombre })) ?? []
      let cuenta = new Map<string, number>()
      if (online) {
        const lista = await listarInspecciones(perfil.empresaId!).catch(() => [])
        // Una misma inspección puede tener varias copias del formato: se cuenta por nombre.
        const idDeNombre = new Map(formatos.map((f) => [f.nombre, f.id]))
        for (const i of lista) {
          const id = idDeNombre.get(i.plantillas?.nombre ?? '')
          if (id) cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
        }
      } else cuenta = new Map()
      const orden = [...formatos].sort((a, b) => (cuenta.get(b.id) ?? 0) - (cuenta.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
      if (vivo) {
        setMasUsadas(orden.slice(0, 4))
        setRestantes(orden.slice(4))
      }
    })().catch(() => {})
    return () => {
      vivo = false
    }
  }, [visible, equipoSso, online, perfil.id, perfil.empresaId])

  useEffect(() => {
    if (!abierto || escritorio) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, escritorio, onCerrar])

  const ir_ = (ruta: string) => () => {
    setInspAbierto(false)
    setVerMas(false)
    onCerrar()
    ir(ruta)
  }
  // Dentro del grupo de inspecciones el grupo se queda abierto.
  const irSub = (ruta: string) => () => {
    onCerrar()
    ir(ruta)
  }

  return (
    <>
      <div className={`menu-fondo ${abierto ? 'abierto' : ''}`} onClick={onCerrar} aria-hidden="true" />
      <aside className={`menu-lateral ${abierto ? 'abierto' : ''}`} aria-label="Menú principal" aria-hidden={!visible} inert={!visible}>
        <div className="menu-cab">
          <Logo fondo="oscuro" />
          <button type="button" aria-label="Cerrar el menú" onClick={onCerrar}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav>
          <button type="button" onClick={ir_('/')} {...aqui(ruta.length === 0)}>
            <Home size={18} aria-hidden="true" /> Inicio
          </button>
          {equipoSso && (
            <button type="button" onClick={ir_('/passt')} {...aqui(ruta[0] === 'passt')}>
              <CalendarDays size={18} aria-hidden="true" /> Programa anual de SST
            </button>
          )}
          {equipoSso && (
            <div className="menu-grupo">
              <div className="menu-fila">
                <button type="button" onClick={() => { setInspAbierto(true); onCerrar(); ir('/inspecciones') }} {...aqui(ruta[0] === 'inspecciones')}>
                  <ClipboardList size={18} aria-hidden="true" /> Inspecciones
                </button>
                <button type="button" className="menu-flecha" aria-expanded={inspAbierto} aria-controls="menu-inspecciones"
                  aria-label={inspAbierto ? 'Ocultar las inspecciones' : 'Mostrar las inspecciones'}
                  onClick={() => { setInspAbierto((x) => !x); setVerMas(false) }}>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
              </div>
              {inspAbierto && (
                <ul id="menu-inspecciones" className="menu-sub">
                  {[...masUsadas, ...(verMas ? restantes : [])].map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={irSub(`/inspecciones/tipo/${f.id}`)}>{f.nombre}</button>
                    </li>
                  ))}
                  {restantes.length > 0 && (
                    <li>
                      <button type="button" className="menu-ver-mas" aria-expanded={verMas} onClick={() => setVerMas((x) => !x)}>
                        {verMas ? 'Ocultar' : `Ver más (${restantes.length})`}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
          {perfil.empresaId && ['admin_empresa', 'admin_sede', 'gestor'].includes(perfil.rolCodigo ?? '') && (
            <button type="button" onClick={ir_('/condiciones')} {...aqui(ruta[0] === 'condiciones')}>
              <ListChecks size={18} aria-hidden="true" /> Gestión de condiciones
            </button>
          )}
          {equipoSso && (
            <button type="button" onClick={ir_('/formatos')} {...aqui(ruta[0] === 'formatos' || ruta[0] === 'activos')}>
              <ClipboardCheck size={18} aria-hidden="true" /> Formatos
            </button>
          )}
          {perfil.empresaId && (
            <button type="button" onClick={ir_('/equipo')} {...aqui(ruta[0] === 'equipo')}>
              <UsersRound size={18} aria-hidden="true" /> Equipo de SST
            </button>
          )}
        </nav>
      </aside>
    </>
  )
}
