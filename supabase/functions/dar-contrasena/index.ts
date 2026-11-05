// Da una contraseña nueva (tarea 3.3, decisión 2A). Tres formas:
//  · Individual: { persona_id }. El administrador, a gestores y usuarios de SU empresa; el dueño, a cualquiera.
//    La regla la decide la base de datos (puedo_dar_contrasena), no este archivo.
//  · En bloque: { empresa_id, roles: [...] }. El dueño (cualquier empresa) y los administradores general y de sede
//    (solo su empresa y las personas que la forma individual les deja: puedo_dar_contrasena).
//  · Rescate: { tipo_documento, numero_documento } con la clave privada en lugar de una sesión.
//    Solo para cuentas de dueños de la plataforma; la usa herramientas/rescate-dueno.mjs desde la computadora.
// Siempre: 12 caracteres al azar mostrados una sola vez, cambio obligatorio al ingresar, sesiones cerradas
// y una fila en contrasenas_dadas (sin la contraseña).
import { MENSAJE_MANTENIMIENTO, candadoListo, claveParaSupabase } from '../_compartido/candado.ts'
import { generarContrasenaInicial } from '../_compartido/contrasenas.ts'
import {
  clienteAdmin, clienteComo, esClavePrivada, leerJson, normalizarDocumento, quienLlama, responder,
} from '../_compartido/http.ts'

const ROLES = ['admin_empresa', 'admin_sede', 'gestor', 'usuario_gestor', 'usuario']
const MAXIMO_EN_BLOQUE = 300
const A_LA_VEZ = 5

type Modo = 'individual' | 'en_bloque' | 'rescate'
const admin = clienteAdmin()

/** Cambia la contraseña de una persona y deja todo anotado. Devuelve la contraseña nueva o null si falló. */
async function darContrasena(personaId: string, numero: string, vinculoId: string | null, dadoPor: string | null, modo: Modo) {
  const contrasena = generarContrasenaInicial(numero)
  const cambio = await admin.auth.admin.updateUserById(personaId, { password: await claveParaSupabase(contrasena) })
  if (cambio.error) return null
  const registro = await admin.rpc('registrar_contrasena_dada', {
    p_persona: personaId, p_vinculo: vinculoId, p_dado_por: dadoPor, p_modo: modo,
  })
  return registro.error ? null : contrasena
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  if (!candadoListo) return responder(req, 503, { error: MENSAJE_MANTENIMIENTO })

  const d = await leerJson(req)
  if (!d) return responder(req, 400, { error: 'Datos no válidos' })

  // ── Rescate: con la clave privada, solo para cuentas de dueños de la plataforma ──
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (esClavePrivada(token)) {
    const tipo = typeof d.tipo_documento === 'string' ? d.tipo_documento.trim().toLowerCase() : ''
    const numero = normalizarDocumento(d.numero_documento)
    const { data: persona } = await admin.from('personas').select('id, apellidos_nombres')
      .eq('tipo_documento', tipo).eq('numero_documento', numero).maybeSingle()
    const { data: dueno } = persona
      ? await admin.from('duenos_plataforma').select('persona_id').eq('persona_id', persona.id).maybeSingle()
      : { data: null }
    if (!persona || !dueno) return responder(req, 403, { error: 'No autorizado' })
    const contrasena = await darContrasena(persona.id, numero, null, null, 'rescate')
    if (!contrasena) return responder(req, 500, { error: 'No se pudo cambiar la contraseña' })
    return responder(req, 200, { apellidos_nombres: persona.apellidos_nombres, contrasena })
  }

  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  // ── Individual ──
  if (typeof d.persona_id === 'string') {
    const permiso = await clienteComo(llamada.token).rpc('puedo_dar_contrasena', { p_persona: d.persona_id })
    if (permiso.error || !permiso.data) return responder(req, 403, { error: 'No autorizado' })
    const { data: persona } = await admin.from('personas').select('id, numero_documento, apellidos_nombres')
      .eq('id', d.persona_id).single()
    if (!persona) return responder(req, 403, { error: 'No autorizado' })
    const contrasena = await darContrasena(persona.id, persona.numero_documento, permiso.data, llamada.usuario.id, 'individual')
    if (!contrasena) return responder(req, 500, { error: 'No se pudo cambiar la contraseña' })
    return responder(req, 200, { apellidos_nombres: persona.apellidos_nombres, contrasena })
  }

  // ── En bloque ──
  // El dueño de la plataforma: cualquier empresa activa. El administrador general y el de sede (decisión del dueño,
  // 05/11/2026): solo su empresa, y de cada persona decide la misma regla que la forma individual
  // (puedo_dar_contrasena: roles que puede asignar, sus sedes, nunca a sí mismo). Gestores y usuarios gestores no
  // tienen el permiso «cuentas.contrasena» (ni como facultad): reciben 403.
  if (typeof d.empresa_id === 'string' && Array.isArray(d.roles)) {
    const como = clienteComo(llamada.token)
    const { data: dueno } = await admin.from('duenos_plataforma').select('persona_id')
      .eq('persona_id', llamada.usuario.id).maybeSingle()
    const roles = d.roles.filter((r): r is string => typeof r === 'string' && ROLES.includes(r))
    if (!roles.length) return responder(req, 403, { error: 'No autorizado' })
    if (!dueno) {
      const { data: permisos } = await como.rpc('mis_permisos')
      const { data: yo } = await admin.from('vinculos').select('empresa_id')
        .eq('persona_id', llamada.usuario.id).eq('estado', 'activo').maybeSingle()
      if (!Array.isArray(permisos) || !permisos.includes('cuentas.contrasena') || !yo || yo.empresa_id !== d.empresa_id) {
        return responder(req, 403, { error: 'No autorizado' })
      }
    }

    const { data: empresa } = await admin.from('empresas').select('estado').eq('id', d.empresa_id).maybeSingle()
    if (!empresa || empresa.estado !== 'activa') return responder(req, 400, { error: 'La empresa no está activa' })

    const { data: candidatos, error } = await admin.from('vinculos')
      .select('id, rol, persona_id, personas!inner(tipo_documento, numero_documento, apellidos_nombres)')
      .eq('empresa_id', d.empresa_id).eq('estado', 'activo').in('rol', roles).neq('persona_id', llamada.usuario.id)
    if (error) return responder(req, 500, { error: 'No se pudo leer la lista de personas' })

    // Solo quedan las personas a las que quien llama puede dar contraseña (misma regla que la forma individual).
    const vinculos: NonNullable<typeof candidatos> = []
    const lista = candidatos ?? []
    for (let i = 0; i < lista.length; i += A_LA_VEZ * 2) {
      const tanda = lista.slice(i, i + A_LA_VEZ * 2)
      const respuestas = await Promise.all(tanda.map((v) => como.rpc('puedo_dar_contrasena', { p_persona: v.persona_id })))
      tanda.forEach((v, k) => { if (!respuestas[k].error && respuestas[k].data === v.id) vinculos.push(v) })
    }
    if (!vinculos.length) return responder(req, 200, { resultados: [] })
    if (vinculos.length > MAXIMO_EN_BLOQUE) {
      return responder(req, 400, { error: `Son ${vinculos.length} cuentas; el máximo por vez es ${MAXIMO_EN_BLOQUE}. Elige menos roles.` })
    }

    const resultados: Record<string, unknown>[] = []
    for (let i = 0; i < vinculos.length; i += A_LA_VEZ) {
      await Promise.all(vinculos.slice(i, i + A_LA_VEZ).map(async (v) => {
        const p = v.personas as unknown as { tipo_documento: string; numero_documento: string; apellidos_nombres: string }
        const contrasena = await darContrasena(v.persona_id, p.numero_documento, v.id, llamada.usuario.id, 'en_bloque')
        resultados.push({
          persona_id: v.persona_id, rol: v.rol, apellidos_nombres: p.apellidos_nombres,
          tipo_documento: p.tipo_documento, numero_documento: p.numero_documento, contrasena,
        })
      }))
    }
    resultados.sort((a, b) => String(a.apellidos_nombres).localeCompare(String(b.apellidos_nombres), 'es'))
    return responder(req, 200, { resultados })
  }

  return responder(req, 400, { error: 'Indica a quién darle la contraseña nueva' })
})
