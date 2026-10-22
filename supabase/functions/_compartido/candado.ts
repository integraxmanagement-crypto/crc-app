// Candado de servidor (aprobado el 22/10/2026). Supabase no guarda la contraseña que escribe la persona,
// sino una versión transformada con un secreto (CRC_PIMIENTA) que solo conocen estas funciones.
// Quien intente ingresar directo a Supabase, saltándose "ingresar", no puede acertar ni con la contraseña correcta.
// ⚠️ Si el secreto se pierde o cambia, ninguna contraseña funcionará: hay que guardar una copia segura.

const SECRETO = Deno.env.get('CRC_PIMIENTA') ?? ''

/** false si falta el secreto: las funciones se detienen antes que guardar contraseñas sin candado. */
export const candadoListo = SECRETO.length >= 32

export const MENSAJE_MANTENIMIENTO = 'El ingreso está en mantenimiento. Intenta de nuevo más tarde.'

let llave: Promise<CryptoKey> | null = null

/** Versión de la contraseña que se guarda en Supabase (HMAC-SHA256 con el secreto del servidor). */
export async function claveParaSupabase(contrasena: string): Promise<string> {
  if (!candadoListo) throw new Error('Falta el secreto CRC_PIMIENTA')
  llave ??= crypto.subtle.importKey('raw', new TextEncoder().encode(SECRETO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', await llave, new TextEncoder().encode(contrasena)))
  const texto = btoa(String.fromCharCode(...firma)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  // El prefijo fijo cumple los requisitos del panel de Supabase (minúscula, mayúscula, número y símbolo).
  return `Cr1-${texto}`
}
