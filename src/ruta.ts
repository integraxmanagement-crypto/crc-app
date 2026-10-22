import { useEffect, useState } from 'react'

/**
 * Navegación mínima con la parte de la dirección que va después de "#" (por ejemplo #/empresas/123).
 * No necesita librerías y funciona igual instalada en el celular.
 */
export function useRuta(): string[] {
  const leer = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [partes, setPartes] = useState(leer)
  useEffect(() => {
    const cambio = () => {
      setPartes(leer())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  return partes
}

export function ir(ruta: string) {
  window.location.hash = ruta
}
