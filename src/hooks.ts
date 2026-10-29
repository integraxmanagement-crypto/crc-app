import { type RefObject, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type DbState = 'checking' | 'ok' | 'offline' | 'error' | 'unconfigured'

/** Comprueba la conexión con la base de datos leyendo la tabla de prueba. */
export function useDatabase(online: boolean): DbState {
  const [result, setResult] = useState<'ok' | 'error' | null>(null)

  useEffect(() => {
    if (!supabase || !online) return
    let active = true
    supabase
      .from('prueba_conexion')
      .select('id', { head: true, count: 'exact' })
      .then(({ error }) => {
        if (active) setResult(error ? 'error' : 'ok')
      })
    return () => {
      active = false
    }
  }, [online])

  if (!supabase) return 'unconfigured'
  if (!online) return 'offline'
  return result ?? 'checking'
}

/** Indica si el equipo tiene conexión a internet, y cambia en vivo. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export type InstallState = 'installed' | 'available' | 'ios' | 'manual'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Gestiona la instalación de la app en el celular o la computadora. */
export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const state: InstallState = installed ? 'installed' : prompt ? 'available' : isIos ? 'ios' : 'manual'

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return { state, install }
}

/** Menú desplegable de la barra (perfil, campana): se cierra al tocar fuera o con la tecla Escape. */
export function useMenu<T extends HTMLElement>(): { abierto: boolean; setAbierto: (v: boolean | ((a: boolean) => boolean)) => void; caja: RefObject<T | null> } {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<T>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])
  return { abierto, setAbierto, caja }
}
