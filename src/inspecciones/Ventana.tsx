import { X } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Ventana emergente. Con el teclado: al abrirse lleva el foco a su primer campo o botón, Tab y Mayús+Tab dan la vuelta dentro de ella
 * (no se sale hacia la pantalla de atrás), Escape la cierra y al cerrarse el foco vuelve al botón que la abrió (06/11/2026).
 */
export function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    const ventana = caja.current
    if (!ventana) return
    const quienAbrio = document.activeElement as HTMLElement | null
    const enfocables = () => [...ventana.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((e) => e.getClientRects().length > 0)
    const cuerpo = ventana.querySelector<HTMLElement>('.ventana-cuerpo')
    const primerCampo = cuerpo ? [...cuerpo.querySelectorAll<HTMLElement>(ENFOCABLES)].find((e) => e.getClientRects().length > 0) : undefined
    ;(primerCampo ?? enfocables()[0] ?? ventana).focus()

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrar.current()
        return
      }
      if (e.key !== 'Tab') return
      const lista = enfocables()
      if (!lista.length) {
        e.preventDefault()
        ventana.focus()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const dentro = ventana.contains(document.activeElement)
      if (e.shiftKey && (!dentro || document.activeElement === primero || document.activeElement === ventana)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) {
        e.preventDefault()
        primero.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      if (quienAbrio?.isConnected) quienAbrio.focus()
    }
  }, [])

  return createPortal(
    <div className="ventana-fondo no-imprimir" onClick={onCerrar}>
      <div ref={caja} className="ventana" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
