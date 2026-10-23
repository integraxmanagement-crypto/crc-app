import { useEffect, useRef, useState } from 'react'

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

// El archivo animado termina de dibujarse y rellenarse a los 4,6 s; el dueño pidió 3 s (22/10/2026).
// Se acelera desde aquí, sin tocar el archivo: el dibujo va más rápido y los pulsos de luz (que se repiten)
// mantienen su ritmo pero empiezan antes, para que sigan llegando justo después del dibujo.
const DIBUJO_ORIGINAL_MS = 4600
const DIBUJO_MS = 3000

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

  // Con «reducir movimiento» no hay animaciones y esto no hace nada.
  const caja = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!animado || !html || !caja.current) return
    for (const a of caja.current.getAnimations({ subtree: true })) {
      if (a.effect?.getTiming().iterations === Infinity) a.currentTime = Number(a.currentTime ?? 0) + (DIBUJO_ORIGINAL_MS - DIBUJO_MS)
      else a.playbackRate = DIBUJO_ORIGINAL_MS / DIBUJO_MS
    }
  }, [animado, html])

  return (
    <span
      ref={caja}
      className={`logo ${className}`}
      role="img"
      aria-label={TEXTO_LOGO}
      dangerouslySetInnerHTML={html ? { __html: html } : undefined}
    />
  )
}
