import { UsersRound, CalendarDays, ChevronDown, ClipboardList, HardHat, Home, ListChecks, ListTodo, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type CopiaLocal, leerCopia } from './inspecciones/campo'
import { agruparPorCategoria } from './inspecciones/categorias'
import { ir, useRuta } from './ruta'
import type { Perfil } from './sesion'
import { useEscritorio } from './useEscritorio'
import { Logo } from './marca/Logo'

/**
 * Menú lateral (pedido del dueño, 29/10/2026): se abre desde las tres líneas de la barra y se desliza desde la izquierda. Trae Inicio,
 * Programa anual de SST e Inspecciones (con las cuatro inspecciones más usadas y «Ver todas»). Reemplaza esos botones de la barra.
 */
export function MenuLateral({ perfil, equipoSso, online, abierto, onCerrar }: { perfil: Perfil; equipoSso: boolean; online: boolean; abierto: boolean; onCerrar: () => void }) {
  // Los formatos, ordenados en subsecciones (Seguridad, Respuesta a emergencias y Salud) con motobomba y electrobomba juntas (09/11/2026).
  const [formatos, setFormatos] = useState<{ id: string; nombre: string }[]>([])
  // Inspecciones se despliega con la flecha; «Ver más» muestra el resto de los tipos en este mismo panel y «Ocultar» los vuelve a esconder.
  // Al elegir otra sección, todo se recoge (pedido del dueño, 05/11/2026).
  const [inspAbierto, setInspAbierto] = useState(() => location.hash.startsWith('#/inspecciones'))
  // En pantalla de escritorio el menú está siempre a la vista (fijo a la izquierda); en celular y tablet es un cajón que se abre.
  const escritorio = useEscritorio()
  const ruta = useRuta()
  // La página en la que está la persona se resalta en el menú (y se anuncia como «página actual»).
  const aqui = (activo: boolean) => (activo ? { className: 'activo', 'aria-current': 'page' as const } : {})
  const visible = abierto || escritorio

  // Los tipos de inspección del equipo; en el primer ingreso la copia de formatos tarda unos segundos en bajar.
  useEffect(() => {
    if (!visible || !equipoSso || !perfil.empresaId) return
    let vivo = true
    ;(async () => {
      let copia: CopiaLocal | undefined = await leerCopia(perfil.id, perfil.empresaId!)
      for (let k = 0; k < 6 && vivo && !copia?.formatos.length; k++) {
        await new Promise((r) => setTimeout(r, 2500))
        copia = await leerCopia(perfil.id, perfil.empresaId!)
      }
      if (vivo) setFormatos(copia?.formatos.map((f) => ({ id: f.plantilla.id, nombre: f.plantilla.nombre })) ?? [])
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
                  onClick={() => setInspAbierto((x) => !x)}>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>
              </div>
              {inspAbierto && (
                <ul id="menu-inspecciones" className="menu-sub">
                  {agruparPorCategoria(formatos).map(({ categoria, items }) => (
                    <li key={categoria.clave} className="menu-subseccion">
                      <span className="menu-sub-titulo">{categoria.nombre}</span>
                      {items.length ? (
                        <ul>
                          {items.map((f) => (
                            <li key={f.id}>
                              <button type="button" onClick={irSub(f.id === 'bombas' ? '/inspecciones/tipo/bombas' : `/inspecciones/tipo/${f.id}`)}>{f.nombre}</button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <small className="menu-sub-vacio">Próximamente</small>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {perfil.empresaId && ['admin_empresa', 'admin_sede', 'gestor'].includes(perfil.rolCodigo ?? '') && (
            <button type="button" onClick={ir_('/condiciones')} {...aqui(ruta[0] === 'condiciones')}>
              <ListChecks size={18} aria-hidden="true" /> Gestión de condiciones
            </button>
          )}
          {perfil.empresaId && ['admin_empresa', 'admin_sede', 'gestor'].includes(perfil.rolCodigo ?? '') && (
            <button type="button" onClick={ir_('/planes')} {...aqui(ruta[0] === 'planes')}>
              <ListTodo size={18} aria-hidden="true" /> Gestión de planes de acción
            </button>
          )}
          {perfil.empresaId && ['admin_empresa', 'admin_sede', 'gestor'].includes(perfil.rolCodigo ?? '') && (
            <button type="button" onClick={ir_('/epp')} {...aqui(ruta[0] === 'epp')}>
              <HardHat size={18} aria-hidden="true" /> Gestión de EPPs
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
