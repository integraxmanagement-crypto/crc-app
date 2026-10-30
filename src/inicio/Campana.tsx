import { Bell, ListChecks, PenLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../empresas/datos'
import { useMenu } from '../hooks'
import { ir } from '../ruta'

/**
 * Hallazgos abiertos o en proceso que tengo a mi cargo (pedido del dueño, 29/10/2026: al asignar a alguien como
 * responsable de un hallazgo, le llega el aviso). Se calcula al consultar, sin tablas nuevas: mientras siga abierto
 * y a mi cargo, cuenta; al cerrarlo o reasignarlo, desaparece. Se revisa cada 2 minutos con señal.
 */
function useHallazgosAsignados(cuenta: string, online: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!online) return
    let vivo = true
    const leer = () =>
      db().from('hallazgos').select('id', { count: 'exact', head: true }).eq('responsable_id', cuenta).in('estado', ['abierto', 'en_proceso'])
        .then(({ count }) => vivo && setN(count ?? 0), () => {})
    void leer()
    const cada = setInterval(leer, 120_000)
    return () => {
      vivo = false
      clearInterval(cada)
    }
  }, [cuenta, online])
  return n
}

/**
 * Campana de avisos de la barra (revisión de diseño, obs. 8a). El círculo rojo cuenta lo que espera a la persona:
 * firmas pendientes y hallazgos asignados. Los eventos del PASST, los mensajes y el «sin leer» (obs. 8b, 8c y 8e)
 * esperan la decisión del dueño con Cowork, porque son alcance nuevo o necesitan tablas.
 */
export function Campana({ firmas, cuenta, online }: { firmas: number; cuenta: string; online: boolean }) {
  const { abierto, setAbierto, caja } = useMenu<HTMLDivElement>()
  const hallazgos = useHallazgosAsignados(cuenta, online)
  const total = firmas + hallazgos

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
          {hallazgos > 0 && (
            <button type="button" role="menuitem" onClick={elegir('/hallazgos')}>
              <ListChecks size={18} aria-hidden="true" /> Tienes {hallazgos} hallazgo(s) asignado(s) por cerrar
            </button>
          )}
          {firmas > 0 && (
            <button type="button" role="menuitem" onClick={elegir('/firmas')}>
              <PenLine size={18} aria-hidden="true" /> Tienes {firmas} firma(s) pendiente(s)
            </button>
          )}
          {total === 0 && <p className="campana-vacia">No tienes avisos.</p>}
        </div>
      )}
    </div>
  )
}
