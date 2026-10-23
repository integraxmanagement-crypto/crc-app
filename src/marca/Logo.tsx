import { useEffect, useState } from 'react'

// Logo de CRC (tarea 2.1a). Los dos archivos SVG son el diseño del dueño y se usan tal cual, sin modificarlos.
// Se insertan dentro de la página (no como imagen) para elegir su versión clara u oscura según el FONDO de la app,
// y no según el modo oscuro del celular o de Windows. Cada uno se descarga aparte y una sola vez:
// el animado solo cuando se muestra la pantalla de ingreso.
type Tipo = 'animado' | 'estatico'

const cargar: Record<Tipo, () => Promise<{ default: string }>> = {
  animado: () => import('./crc-logo-animado.svg?raw'),
  estatico: () => import('./crc-logo-estatico.svg?raw'),
}
const yaCargado: Partial<Record<Tipo, string>> = {}

export const TEXTO_LOGO = 'CRC · Centinel Risk Control'

/**
 * fondo 'claro': versión con letras oscuras (sobre blanco). fondo 'oscuro': versión con letras claras (sobre azul).
 * La animación se detiene sola si la persona activó «reducir movimiento» (lo trae el propio SVG).
 */
export function Logo({ animado = false, fondo, className = '' }: { animado?: boolean; fondo: 'claro' | 'oscuro'; className?: string }) {
  const tipo: Tipo = animado ? 'animado' : 'estatico'
  const [svg, setSvg] = useState<string | null>(yaCargado[tipo] ?? null)

  useEffect(() => {
    if (svg) return
    let vigente = true
    cargar[tipo]().then((m) => {
      yaCargado[tipo] = m.default
      if (vigente) setSvg(m.default)
    })
    return () => {
      vigente = false
    }
  }, [tipo, svg])

  // Solo se ajustan atributos de la etiqueta principal: la clase de tema y que el lector de pantalla use el texto de afuera.
  const html = svg
    ?.replace('class="crc-logo"', `class="crc-logo ${fondo === 'oscuro' ? 'dark' : 'light'}"`)
    .replace('role="img" aria-labelledby="crc-t"', 'aria-hidden="true" focusable="false"')

  return (
    <span
      className={`logo ${className}`}
      role="img"
      aria-label={TEXTO_LOGO}
      dangerouslySetInnerHTML={html ? { __html: html } : undefined}
    />
  )
}
