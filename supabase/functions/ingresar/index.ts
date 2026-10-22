// Ingreso a CRC con tipo de documento, número y contraseña (tarea 3.1).
// Anota cada intento y bloquea por 15 minutos tras 5 fallos con el mismo documento.
import { MENSAJE_GENERICO, intentarIngreso, ipDe } from '../_compartido/ingreso.ts'
import { leerJson, normalizarDocumento, responder } from '../_compartido/http.ts'

const TIPOS = new Set(['dni', 'ce', 'pas'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })

  const d = await leerJson(req)
  const tipo = typeof d?.tipo_documento === 'string' ? d.tipo_documento.toLowerCase() : ''
  const numero = normalizarDocumento(d?.numero_documento)
  const contrasena = typeof d?.contrasena === 'string' ? d.contrasena : ''
  if (!TIPOS.has(tipo) || !/^[A-Z0-9]{6,12}$/.test(numero) || !contrasena || contrasena.length > 128) {
    return responder(req, 400, { error: MENSAJE_GENERICO })
  }

  const r = await intentarIngreso(tipo, numero, contrasena, ipDe(req))
  if (r.tipo !== 'exito') return responder(req, r.estado, { error: r.mensaje })
  // Solo se devuelve lo que la app necesita para abrir la sesión.
  return responder(req, 200, { access_token: r.sesion.access_token, refresh_token: r.sesion.refresh_token })
})
