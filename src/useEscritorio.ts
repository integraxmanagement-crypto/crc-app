import { useSyncExternalStore } from 'react'

/** Ancho desde el cual el menú queda fijo a la izquierda (pantallas de escritorio). Debe coincidir con el punto de corte de gestion.css. */
export const ANCHO_ESCRITORIO = 1100
const CONSULTA = `(min-width: ${ANCHO_ESCRITORIO}px)`

/** ¿La pantalla es de escritorio? Se actualiza sola al girar el celular o cambiar el tamaño de la ventana. */
export function useEscritorio() {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(CONSULTA)
      m.addEventListener('change', avisar)
      return () => m.removeEventListener('change', avisar)
    },
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  )
}
