// Cambia la contraseña de quien tiene la sesión abierta (tarea 3.1).
// Pide la contraseña actual (con el mismo registro y bloqueo que el ingreso), aplica las reglas de CRC
// en el servidor, cierra las sesiones en otros equipos y devuelve una sesión nueva para este.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { MENSAJE_MANTENIMIENTO, candadoListo, claveParaSupabase } from '../_compartido/candado.ts'
import { validarContrasena } from '../_compartido/contrasenas.ts'
import {
  CLAVE_PUBLICA, URL_SUPABASE, clienteAdmin, clienteIngreso, correoInterno, leerJson, quienLlama, responder,
} from '../_compartido/http.ts'
import { intentarIngreso, ipDe } from '../_compartido/ingreso.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  if (!candadoListo) return responder(req, 503, { error: MENSAJE_MANTENIMIENTO })

  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  const d = await leerJson(req)
  const actual = typeof d?.contrasena_actual === 'string' ? d.contrasena_actual : ''
  const nueva = typeof d?.contrasena_nueva === 'string' ? d.contrasena_nueva : ''
  if (!actual || !nueva) return responder(req, 400, { error: 'Escribe tu contraseña actual y la nueva' })

  const admin = clienteAdmin()
  const { data: persona } = await admin.from('personas').select('tipo_documento, numero_documento')
    .eq('id', llamada.usuario.id).maybeSingle()
  if (!persona) return responder(req, 403, { error: 'No autorizado' })

  const motivo = validarContrasena(nueva, persona.numero_documento)
  if (motivo) return responder(req, 400, { error: motivo, regla: true })
  if (nueva === actual) return responder(req, 400, { error: 'La nueva contraseña debe ser distinta de la actual', regla: true })

  // Comprueba la contraseña actual con un ingreso aparte, que se cierra enseguida.
  const prueba = await intentarIngreso(persona.tipo_documento, persona.numero_documento, actual, ipDe(req))
  if (prueba.tipo !== 'exito') {
    const mensaje = prueba.tipo === 'fallo' ? 'La contraseña actual no es correcta' : prueba.mensaje
    return responder(req, prueba.estado, { error: mensaje })
  }
  const temporal = createClient(URL_SUPABASE, CLAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } })
  await temporal.auth.setSession(prueba.sesion)
  await temporal.auth.signOut({ scope: 'local' })

  const cambio = await admin.auth.admin.updateUserById(llamada.usuario.id, { password: await claveParaSupabase(nueva) })
  if (cambio.error) return responder(req, 400, { error: 'No se pudo cambiar la contraseña. Intenta otra.' })
  await admin.from('personas').update({ clave_con_candado: true }).eq('id', llamada.usuario.id)
  await admin.rpc('marcar_contrasena_cambiada', { p_persona: llamada.usuario.id })

  // Cambiar la contraseña cierra TODAS las sesiones de la cuenta (también en otros equipos).
  // Se abre una nueva solo para este equipo, para que la persona no tenga que volver a ingresar.
  const nuevaSesion = await clienteIngreso(ipDe(req)).auth.signInWithPassword({
    email: correoInterno(persona.tipo_documento, persona.numero_documento), password: await claveParaSupabase(nueva),
  })
  if (nuevaSesion.error || !nuevaSesion.data.session) return responder(req, 200, { ok: true })
  const { access_token, refresh_token } = nuevaSesion.data.session
  return responder(req, 200, { ok: true, access_token, refresh_token })
})
