// Conformidad del trabajador en la entrega de un EPP (Gestión de EPPs, 09/11/2026).
// El trabajador escribe su documento y su contraseña en el equipo del gestor; aquí se verifica con el MISMO ingreso de CRC
// (con su registro de intentos y su bloqueo de 15 minutos) y recién entonces la entrega queda con conformidad.
// Es una conformidad con usuario y contraseña, sin firma digital avanzada. No abre sesión en el equipo del gestor.
import { intentarIngreso, ipDe } from '../_compartido/ingreso.ts'
import { clienteAdmin, clienteComo, leerJson, normalizarDocumento, quienLlama, responder } from '../_compartido/http.ts'

const TIPOS = new Set(['dni', 'ce', 'pas'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ROLES = ['admin_empresa', 'admin_sede', 'gestor']
const admin = clienteAdmin()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  const d = await leerJson(req)
  const entrega = typeof d?.entrega_id === 'string' ? d.entrega_id : ''
  const tipo = typeof d?.tipo_documento === 'string' ? d.tipo_documento.toLowerCase() : ''
  const numero = normalizarDocumento(d?.numero_documento)
  const contrasena = typeof d?.contrasena === 'string' ? d.contrasena : ''
  if (!UUID.test(entrega) || !TIPOS.has(tipo) || !/^[A-Z0-9]{6,12}$/.test(numero) || !contrasena || contrasena.length > 128) {
    return responder(req, 400, { error: 'Escribe el documento y la contraseña del trabajador.' })
  }

  // Quien llama: gestor o administrador con vínculo activo, y la entrega es de su empresa y de una persona que puede atender.
  const { data: mio } = await admin.from('vinculos').select('empresa_id, rol').eq('persona_id', llamada.usuario.id).eq('estado', 'activo').maybeSingle()
  if (!mio || !ROLES.includes(mio.rol)) return responder(req, 403, { error: 'No autorizado' })
  const { data: visible } = await clienteComo(llamada.token).from('epp_entregas').select('id').eq('id', entrega).maybeSingle()
  if (!visible) return responder(req, 403, { error: 'No autorizado' })
  const { data: e } = await admin.from('epp_entregas').select('id, empresa_id, persona_id, conformidad_en').eq('id', entrega).maybeSingle()
  if (!e || e.empresa_id !== mio.empresa_id) return responder(req, 403, { error: 'No autorizado' })
  if (e.conformidad_en) return responder(req, 409, { error: 'Esta entrega ya tiene la conformidad del trabajador.' })

  // El documento escrito debe ser el del trabajador de la entrega (no se prueba ninguna contraseña si no lo es).
  const { data: persona } = await admin.from('personas').select('tipo_documento, numero_documento').eq('id', e.persona_id).single()
  if (!persona || persona.tipo_documento !== tipo || persona.numero_documento !== numero) {
    return responder(req, 422, { error: 'Ese documento no es del trabajador de esta entrega.' })
  }

  const r = await intentarIngreso(tipo, numero, contrasena, ipDe(req))
  if (r.tipo !== 'exito') return responder(req, r.estado, { error: r.mensaje })
  // La verificación abrió una sesión de servidor que no se usa: se cierra.
  await admin.auth.admin.signOut(r.sesion.access_token, 'local').catch(() => {})

  const marca = await admin.rpc('marcar_conformidad_epp', { p_entrega: entrega, p_persona: e.persona_id })
  if (marca.error || !marca.data) return responder(req, 409, { error: 'Esta entrega ya tiene la conformidad del trabajador.' })
  return responder(req, 200, { ok: true })
})
