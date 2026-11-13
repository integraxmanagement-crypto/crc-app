/**
 * Tema de la plataforma (06/11/2026): «auto» sigue al dispositivo; «claro» y «oscuro» lo fuerzan.
 * La preferencia se guarda solo en este equipo. El atributo data-theme se pone en <html>; en «auto» no hay atributo
 * y manda la regla prefers-color-scheme del CSS.
 */
import { useEffect, useState } from 'react'

export type Tema = 'auto' | 'claro' | 'oscuro'
const CLAVE = 'crc-tema'

export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem(CLAVE)
    return v === 'claro' || v === 'oscuro' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

function colorBarra(t: Tema): string {
  const oscuro = t === 'oscuro' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return oscuro ? '#1a0f08' : '#2B1A0F'
}

export function aplicarTema(t: Tema) {
  const raiz = document.documentElement
  if (t === 'auto') raiz.removeAttribute('data-theme')
  else raiz.setAttribute('data-theme', t === 'claro' ? 'light' : 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colorBarra(t))
}

export function guardarTema(t: Tema) {
  try {
    if (t === 'auto') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, t)
  } catch {
    /* sin almacenamiento: el tema vale solo hasta cerrar la página */
  }
  aplicarTema(t)
}

/** Estado del tema para los botones; sincroniza la barra del navegador cuando cambia el tema del dispositivo. */
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(temaGuardado)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiar = () => aplicarTema(temaGuardado())
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return [
    tema,
    (t) => {
      guardarTema(t)
      setTema(t)
    },
  ]
}
