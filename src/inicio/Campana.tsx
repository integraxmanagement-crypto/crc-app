import { Bell, PenLine } from 'lucide-react'
import { useMenu } from '../hooks'
import { ir } from '../ruta'

/**
 * Campana de avisos de la barra (revisión de diseño, obs. 8a). El círculo rojo cuenta lo que espera a la persona.
 * Por ahora solo hay firmas pendientes: los eventos del PASST, los mensajes, las tareas delegadas y el «sin leer»
 * (obs. 8b a 8e) esperan la decisión del dueño con Cowork, porque son alcance nuevo o necesitan tablas.
 */
export function Campana({ firmas }: { firmas: number }) {
  const { abierto, setAbierto, caja } = useMenu<HTMLDivElement>()
  const total = firmas

  const elegir = (ruta: string) => () => {
    setAbierto(false)
    ir(ruta)
  }

  return (
    <div className="perfil-menu campana" ref={caja}>
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} title="Avisos" aria-label={total ? `Avisos: ${total} pendiente(s)` : 'Avisos'} onClick={() => setAbierto((a) => !a)}>
        <Bell size={18} aria-hidden="true" />
        {total > 0 && <span className="campana-numero">{total > 99 ? '99+' : total}</span>}
      </button>
      {abierto && (
        <div className="perfil-lista" role="menu">
          <p className="perfil-quien">
            <b>Avisos</b>
          </p>
          {firmas > 0 ? (
            <button type="button" role="menuitem" onClick={elegir('/firmas')}>
              <PenLine size={18} aria-hidden="true" /> Tienes {firmas} firma(s) pendiente(s)
            </button>
          ) : (
            <p className="campana-vacia">No tienes avisos.</p>
          )}
        </div>
      )}
    </div>
  )
}
