// Ingreso con registro de intentos y bloqueo temporal (opción B, aprobada el 22/10/2026).
// Toda verificación de contraseña de CRC pasa por aquí: el ingreso y el cambio de contraseña.
import type { Session } from 'npm:@supabase/supabase-js@2.118.0'
import { MENSAJE_MANTENIMIENTO, candadoListo, claveParaSupabase } from './candado.ts'
import { clienteAdmin, clienteIngreso, correoInterno } from './http.ts'

export const MENSAJE_GENERICO = 'Documento o contraseña incorrectos.'

export type Resultado =
  | { tipo: 'exito'; sesion: Session }
  | { tipo: 'fallo' | 'bloqueado' | 'inhabilitada' | 'limite' | 'error'; estado: number; mensaje: string }

/**
 * Dirección de internet de quien llama, según la pasa la plataforma de Supabase. La plataforma REEMPLAZA este encabezado:
 * un valor inventado por quien llama no llega aquí (probado el 05/11/2026, pruebas/revision-funciones.mjs, punto 1).
 */
export function ipDe(req: Request): string | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip && ip.length <= 64 ? ip : null
}

/** Anota el resultado real de un intento ya reservado. */
async function cerrar(id: number, resultado: string) {
  await clienteAdmin().rpc('cerrar_intento', { p_id: id, p_resultado: resultado })
}

export async function intentarIngreso(tipo: string, numero: string, contrasena: string, ip: string | null): Promise<Resultado> {
  if (!candadoListo) return { tipo: 'error', estado: 503, mensaje: MENSAJE_MANTENIMIENTO }
  const admin = clienteAdmin()

  // El intento se RESERVA en la base de datos antes de probar la contraseña, de uno en uno por documento y por dirección
  // (análisis de seguridad del 12/11/2026): muchos pedidos enviados a la vez ya no pasan todos antes del primer fallo anotado.
  // Mientras no se anota el resultado real, la reserva cuenta como fallo. Si la reserva falla, no se prueba ninguna contraseña.
  const { data: reserva, error: errorReserva } = await admin.rpc('reservar_intento', { p_tipo: tipo, p_numero: numero, p_ip: ip })
  if (errorReserva || !reserva) return { tipo: 'error', estado: 502, mensaje: 'No se pudo ingresar. Intenta de nuevo en unos minutos.' }
  if (reserva.hasta) {
    const minutos = Math.max(1, Math.ceil((new Date(reserva.hasta).getTime() - Date.now()) / 60_000))
    return {
      tipo: 'bloqueado', estado: 429,
      mensaje: `Demasiados intentos fallidos. Por seguridad, espera ${minutos} minuto${minutos === 1 ? '' : 's'} e intenta de nuevo.`,
    }
  }
  const intento = reserva.id as number

  const auth = clienteIngreso(ip).auth
  const email = correoInterno(tipo, numero)
  let { data, error } = await auth.signInWithPassword({ email, password: await claveParaSupabase(contrasena) })

  // Cuenta creada antes del candado: se prueba la contraseña tal cual y, si es correcta, se le pone el candado.
  if (error?.code === 'invalid_credentials') {
    const { data: persona } = await admin.from('personas').select('id, clave_con_candado')
      .eq('tipo_documento', tipo).eq('numero_documento', numero).maybeSingle()
    if (persona && !persona.clave_con_candado) {
      ;({ data, error } = await auth.signInWithPassword({ email, password: contrasena }))
      if (!error && data.session) {
        await admin.auth.admin.updateUserById(persona.id, { password: await claveParaSupabase(contrasena) })
        await admin.from('personas').update({ clave_con_candado: true }).eq('id', persona.id)
        // Cambiar la contraseña cierra las sesiones de la cuenta: se ingresa de nuevo, ya con candado.
        ;({ data, error } = await auth.signInWithPassword({ email, password: await claveParaSupabase(contrasena) }))
      }
    }
  }

  if (!error && data.session) {
    await cerrar(intento, 'exito')
    return { tipo: 'exito', sesion: data.session }
  }
  if (error?.code === 'invalid_credentials') {
    await cerrar(intento, 'fallo')
    return { tipo: 'fallo', estado: 400, mensaje: MENSAJE_GENERICO }
  }
  if (error?.status === 429) {
    await cerrar(intento, 'limite_supabase')
    return { tipo: 'limite', estado: 429, mensaje: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }
  }
  if (error?.message.includes('inhabilitada')) {
    await cerrar(intento, 'inhabilitada')
    return { tipo: 'inhabilitada', estado: 403, mensaje: error.message }
  }
  await cerrar(intento, 'error')
  return { tipo: 'error', estado: 502, mensaje: 'No se pudo ingresar. Intenta de nuevo en unos minutos.' }
}
