import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Ventana sobre la pantalla (se cierra con la X, con Escape o tocando fuera). */
export function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])
  return createPortal(
    <div className="ventana-fondo no-imprimir" onClick={onCerrar}>
      <div className="ventana" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="fila-entre">
          <h2>{titulo}</h2>
          <button className="btn-link" type="button" aria-label="Cerrar" onClick={onCerrar}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="ventana-cuerpo">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
