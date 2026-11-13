import { useEffect, useState } from 'react'
import logoClaro from './zenda-logo-claro.webp'
import logoOscuro from './zenda-logo-oscuro.webp'

// Logo de Zenda.ia (versión para Machu Picchu Foods, 13/11/2026).
// - Estático: dos imágenes con fondo transparente; la de letras crema va sobre fondos oscuros y la de letras cacao sobre claros.
// - Animado (pantalla de ingreso): el SVG del dueño, insertado en la página para elegir su versión por el FONDO de la app
//   y no por el modo oscuro del dispositivo. Se descarga aparte y solo cuando se muestra el ingreso.
export const TEXTO_LOGO = 'Zenda.ia'

const PROPORCION = { claro: 1500 / 528, oscuro: 1438 / 486, animado: 1680 / 620 }
let svgCargado: string | null = null

/** fondo 'claro': letras cacao. fondo 'oscuro': letras crema. La animación se detiene sola con «reducir movimiento» (lo trae el SVG). */
export function Logo({ animado = false, fondo, className = '' }: { animado?: boolean; fondo: 'claro' | 'oscuro'; className?: string }) {
  const [svg, setSvg] = useState<string | null>(svgCargado)
  useEffect(() => {
    if (!animado || svg) return
    let vigente = true
    import('./zenda-logo-animado.svg?raw').then((m) => {
      svgCargado = m.default
      if (vigente) setSvg(m.default)
    })
    return () => {
      vigente = false
    }
  }, [animado, svg])

  if (animado) {
    const html = svg
      ?.replace('class="zenda-logo"', `class="zenda-logo ${fondo === 'oscuro' ? 'dark' : 'light'}"`)
      .replace('role="img" aria-labelledby="zn-t"', 'aria-hidden="true" focusable="false"')
    return (
      <span
        className={`logo ${className}`}
        style={{ aspectRatio: PROPORCION.animado }}
        role="img"
        aria-label={TEXTO_LOGO}
        dangerouslySetInnerHTML={html ? { __html: html } : undefined}
      />
    )
  }
  return (
    <span className={`logo ${className}`} style={{ aspectRatio: PROPORCION[fondo] }}>
      <img src={fondo === 'oscuro' ? logoOscuro : logoClaro} alt={TEXTO_LOGO} decoding="async" draggable={false} />
    </span>
  )
}
