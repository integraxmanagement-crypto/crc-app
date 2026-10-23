// Piezas comunes de las funciones del servidor de CRC.
// La clave privada solo existe aquí, dentro de Supabase; nunca llega al navegador.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0'

export const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!

// Claves nuevas (sb_publishable_ / sb_secret_). Las antiguas (anon / service_role) dejan de funcionar
// a fines de 2026 según Supabase; se usan solo si las nuevas no estuvieran disponibles.
function claveNueva(variable: string): string | undefined {
  try {
    return JSON.parse(Deno.env.get(variable) ?? '{}').default
  } catch {
    return undefined
  }
}
export const CLAVE_PUBLICA = claveNueva('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY')!
const CLAVE_PRIVADA = claveNueva('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export const DOMINIO_INTERNO = 'usuarios.crc.invalid'

/** Identificador interno con forma de correo. La terminación .invalid nunca recibe mensajes. */
export function correoInterno(tipo: string, numero: string): string {
  return `${tipo}-${numero.toLowerCase()}@${DOMINIO_INTERNO}`
}

export function normalizarDocumento(numero: unknown): string {
  return String(numero ?? '').toUpperCase().replace(/[\s.-]/g, '')
}

// Desde dónde puede llamar un navegador: la app publicada o una copia de desarrollo en este equipo.
const APP_PUBLICADA = 'https://crc-app-phi.vercel.app'
const permitido = (origen: string) => origen === APP_PUBLICADA || /^http:\/\/localhost:\d{2,5}$/.test(origen)

function cabeceras(origen: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origen && permitido(origen) ? origen : APP_PUBLICADA,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function responder(req: Request, estado: number, cuerpo: unknown): Response {
  return new Response(estado === 204 ? null : JSON.stringify(cuerpo), { status: estado, headers: cabeceras(req.headers.get('Origin')) })
}

/**
 * ¿El texto es una de las claves privadas del proyecto? Solo lo usa la herramienta de rescate (tarea 3.3),
 * que se corre desde la computadora del dueño, nunca desde la app. Compara sin revelar cuánto coincide.
 */
export function esClavePrivada(texto: string): boolean {
  let todas: string[] = []
  try {
    todas = Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')).map(String)
  } catch { /* sin claves nuevas */ }
  const antigua = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (antigua) todas.push(antigua)
  const a = new TextEncoder().encode(texto)
  return texto.length > 20 && todas.some((clave) => {
    const b = new TextEncoder().encode(clave)
    if (a.length !== b.length) return false
    let diferencia = 0
    for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i]
    return diferencia === 0
  })
}

export function clienteAdmin(): SupabaseClient {
  return createClient(URL_SUPABASE, CLAVE_PRIVADA, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Cliente para verificar contraseñas. Pasa a Supabase la dirección de internet de la persona,
 * para que su límite de intentos sea por persona y no por servidor (requiere "IP Address Forwarding"
 * activado en el panel; si no lo está, Supabase ignora el dato).
 */
export function clienteIngreso(ip: string | null): SupabaseClient {
  return createClient(URL_SUPABASE, CLAVE_PRIVADA, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: ip ? { 'sb-forwarded-for': ip } : {} },
  })
}

/** Cliente que actúa COMO la persona que llama: RLS y permisos aplican igual que en la app. */
export function clienteComo(token: string): SupabaseClient {
  return createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/** Verifica la sesión de quien llama con Supabase. Devuelve null si no es válida. */
export async function quienLlama(req: Request): Promise<{ usuario: User; token: string } | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return null
  const { data, error } = await clienteAdmin().auth.getUser(token)
  if (error || !data.user) return null
  return { usuario: data.user, token }
}

export async function leerJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const texto = await req.text()
    if (texto.length > 10_000) return null
    const datos = JSON.parse(texto)
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null
  } catch {
    return null
  }
}
