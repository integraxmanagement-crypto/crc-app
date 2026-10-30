import { type ReactNode, useState } from 'react'
import { Aviso } from '../empresas/campos'
import { Ventana } from '../inspecciones/Ventana'

/**
 * Las secciones del inicio (pendientes del mes, atrasados y mis hallazgos) comparten diseño (pedido del dueño, 30/10/2026): el icono a la
 * izquierda, el nombre con su cantidad al lado y, al final a la derecha, «Ver detalle», que abre una ventana con la lista.
 */
export function SeccionResumen({ icono, titulo, etiqueta, cantidad, tono, vacio, online, sinSenal, cargando, error, tituloDetalle, children }: {
  icono: ReactNode
  titulo: string
  etiqueta: string
  cantidad: number | null
  tono: 'aviso' | 'mal' | 'ok'
  vacio: string
  online: boolean
  sinSenal: string
  cargando: boolean
  error: string | null
  tituloDetalle: string
  children: ReactNode
}) {
  const [abierta, setAbierta] = useState(false)
  return (
    <section className="pendientes resumen" aria-label={etiqueta}>
      <div className="resumen-cab">
        <span className="resumen-icono" aria-hidden="true">{icono}</span>
        <h2>{titulo}</h2>
        {cantidad != null && <span className={`chip chip-${tono}`}>{cantidad}</span>}
        {cantidad != null && cantidad > 0 && (
          <button className="btn-link resumen-ver" type="button" onClick={() => setAbierta(true)}>Ver detalle</button>
        )}
      </div>
      <Aviso>{error}</Aviso>
      {!online ? <p className="nota">{sinSenal}</p> : cargando ? !error && <p className="nota">Cargando…</p> : cantidad === 0 ? <p className="nota">{vacio}</p> : null}
      {abierta && (
        <Ventana titulo={tituloDetalle} onCerrar={() => setAbierta(false)}>
          {children}
        </Ventana>
      )}
    </section>
  )
}
