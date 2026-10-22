import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const TIPOS_DOCUMENTO = [
  { codigo: 'dni', nombre: 'DNI', patron: /^[0-9]{8}$/, ayuda: '8 dígitos' },
  { codigo: 'ce', nombre: 'Carnet de extranjería', patron: /^[A-Z0-9]{6,12}$/, ayuda: '6 a 12 letras o números' },
  { codigo: 'pas', nombre: 'Pasaporte', patron: /^[A-Z0-9]{6,12}$/, ayuda: '6 a 12 letras o números' },
] as const

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['codigo']

export function normalizarDocumento(numero: string) {
  return numero.toUpperCase().replace(/[\s.-]/g, '')
}

export type Perfil = {
  id: string
  apellidosNombres: string
  numeroDocumento: string | null // no se guarda en el equipo; solo se conoce con señal
  debeCambiarContrasena: boolean
  esDueno: boolean
  empresa: string | null
  rol: string | null
  puesto: string | null
  area: string | null
}

export type Sesion =
  | { fase: 'cargando' }
  | { fase: 'fuera'; aviso?: string }
  | { fase: 'dentro'; perfil: Perfil }

const CLAVE_PERFIL = 'crc.perfil'

function guardarPerfil(perfil: Perfil | null) {
  try {
    if (perfil) localStorage.setItem(CLAVE_PERFIL, JSON.stringify({ ...perfil, numeroDocumento: null }))
    else localStorage.removeItem(CLAVE_PERFIL)
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando con señal.
  }
}

function perfilGuardado(id: string): Perfil | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_PERFIL) ?? 'null') as Perfil | null
    return p?.id === id ? p : null
  } catch {
    return null
  }
}

async function leerPerfil(id: string): Promise<Perfil | null> {
  if (!supabase) return null
  const [persona, vinculo, dueno] = await Promise.all([
    supabase.from('personas').select('apellidos_nombres, numero_documento, debe_cambiar_contrasena').eq('id', id).maybeSingle(),
    supabase
      .from('vinculos')
      .select('puesto, area, empresas(razon_social), roles(nombre)')
      .eq('persona_id', id)
      .eq('estado', 'activo')
      .maybeSingle(),
    supabase.from('duenos_plataforma').select('persona_id').eq('persona_id', id).maybeSingle(),
  ])
  if (persona.error || vinculo.error || dueno.error) throw new Error('sin respuesta')
  if (!persona.data) return null
  const v = vinculo.data as unknown as {
    puesto: string | null
    area: string | null
    empresas: { razon_social: string } | null
    roles: { nombre: string } | null
  } | null
  if (!v && !dueno.data) return null
  return {
    id,
    apellidosNombres: persona.data.apellidos_nombres,
    numeroDocumento: persona.data.numero_documento,
    debeCambiarContrasena: persona.data.debe_cambiar_contrasena,
    esDueno: Boolean(dueno.data),
    empresa: v?.empresas?.razon_social ?? null,
    rol: v?.roles?.nombre ?? null,
    puesto: v?.puesto ?? null,
    area: v?.area ?? null,
  }
}

const AVISO_INHABILITADA = 'Tu cuenta está inhabilitada. Consulta con el administrador de tu empresa.'

/** Estado de la sesión. Con señal, revisa en el servidor que la cuenta siga habilitada. */
export function useSesion(online: boolean) {
  const [sesion, setSesion] = useState<Sesion>(() => (supabase ? { fase: 'cargando' } : { fase: 'fuera' }))

  const cargar = useCallback(async (id: string) => {
    try {
      const perfil = await leerPerfil(id)
      if (!perfil) {
        await supabase?.auth.signOut({ scope: 'local' })
        guardarPerfil(null)
        setSesion({ fase: 'fuera', aviso: AVISO_INHABILITADA })
        return
      }
      guardarPerfil(perfil)
      setSesion({ fase: 'dentro', perfil })
    } catch {
      // Sin respuesta (p. ej. sin señal): se usa lo último que se supo de esta persona.
      const guardado = perfilGuardado(id)
      setSesion(guardado ? { fase: 'dentro', perfil: guardado } : { fase: 'fuera', aviso: 'Necesitas señal para ingresar.' })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      // Se deja correr aparte: Supabase recomienda no esperar otras consultas dentro de este aviso.
      setTimeout(() => {
        if (!s) {
          guardarPerfil(null)
          setSesion((antes) => (antes.fase === 'fuera' ? antes : { fase: 'fuera' }))
        } else if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
          void cargar(s.user.id)
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [cargar])

  // Al volver la señal: renueva el permiso. Si la persona fue cesada, el servidor lo niega y se cierra la sesión.
  const idDentro = sesion.fase === 'dentro' ? sesion.perfil.id : null
  useEffect(() => {
    if (!supabase || !online || !idDentro) return
    const id = idDentro
    let activo = true
    supabase.auth.refreshSession().then(async ({ error }) => {
      if (!activo) return
      if (error && error.name !== 'AuthRetryableFetchError') {
        await supabase?.auth.signOut({ scope: 'local' })
        guardarPerfil(null)
        setSesion({ fase: 'fuera', aviso: error.message.includes('inhabilitada') ? AVISO_INHABILITADA : 'Tu sesión terminó. Vuelve a ingresar.' })
      } else if (!error) {
        void cargar(id)
      }
    })
    return () => {
      activo = false
    }
  }, [online, idDentro, cargar])

  const recargar = useCallback(() => {
    if (sesion.fase === 'dentro') void cargar(sesion.perfil.id)
  }, [sesion, cargar])

  return { sesion, recargar }
}

/**
 * Ingresa con documento y contraseña a través de la función "ingresar" del servidor, que anota cada intento
 * y bloquea por un rato tras varios fallos. Devuelve un mensaje de error en lenguaje simple, o null si entró.
 * El servidor responde lo mismo si el documento no existe o si la contraseña está mal.
 */
export async function ingresar(tipo: TipoDocumento, numero: string, clave: string): Promise<string | null> {
  if (!supabase) return 'La app aún no está conectada a la base de datos.'
  if (!navigator.onLine) return 'Sin conexión. Necesitas señal para ingresar.'
  const { data, error } = await supabase.functions.invoke('ingresar', {
    body: { tipo_documento: tipo, numero_documento: normalizarDocumento(numero), contrasena: clave },
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = await error.context.json().catch(() => null)
      if (cuerpo?.error) return String(cuerpo.error)
    }
    return navigator.onLine ? 'No se pudo ingresar. Intenta de nuevo en unos minutos.' : 'Sin conexión. Necesitas señal para ingresar.'
  }
  const { error: errorSesion } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  return errorSesion ? 'No se pudo abrir la sesión. Intenta de nuevo.' : null
}

export async function salir() {
  guardarPerfil(null)
  await supabase?.auth.signOut({ scope: 'local' })
}

/** Cambia la contraseña en el servidor, que aplica las reglas de CRC. Devuelve un error en lenguaje simple, o null. */
export async function cambiarContrasena(actual: string, nueva: string): Promise<string | null> {
  if (!supabase) return 'La app aún no está conectada a la base de datos.'
  if (!navigator.onLine) return 'Sin conexión. Necesitas señal para cambiar tu contraseña.'
  const { data, error } = await supabase.functions.invoke('cambiar-contrasena', {
    body: { contrasena_actual: actual, contrasena_nueva: nueva },
  })
  if (!error) {
    // El cambio cierra todas las sesiones; el servidor entrega una nueva para este equipo.
    if (data?.access_token) await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
    return null
  }
  if (error instanceof FunctionsHttpError) {
    const cuerpo = await error.context.json().catch(() => null)
    if (cuerpo?.error) return String(cuerpo.error)
  }
  return 'No se pudo cambiar la contraseña. Intenta de nuevo.'
}

/** Revisión rápida en el equipo (la definitiva la hace el servidor). */
export function revisarContrasena(nueva: string, repetida: string, numeroDocumento: string | null): string | null {
  if (nueva.length < 8) return 'Debe tener al menos 8 caracteres.'
  if (nueva.length > 64) return 'Debe tener como máximo 64 caracteres.'
  const faltan = [
    [/[a-z]/.test(nueva), 'una minúscula'],
    [/[A-Z]/.test(nueva), 'una mayúscula'],
    [/[0-9]/.test(nueva), 'un número'],
    [/[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(nueva), 'un símbolo (por ejemplo - ! # ?)'],
  ]
    .filter(([cumple]) => !cumple)
    .map(([, texto]) => texto)
  if (faltan.length) return `Le falta: ${faltan.join(', ')}.`
  if (numeroDocumento && nueva.toUpperCase().includes(numeroDocumento)) return 'No puede contener tu número de documento.'
  if (nueva !== repetida) return 'Las dos contraseñas no coinciden.'
  return null
}
