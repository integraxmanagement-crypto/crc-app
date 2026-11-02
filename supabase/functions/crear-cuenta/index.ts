// Crea la cuenta de una persona y su vínculo con una empresa (tarea 3.1).
// Quién puede: el dueño de la plataforma (cualquier rol) o el administrador de la empresa (gestores y usuarios
// de SU empresa). La regla la decide la base de datos (puedo_crear_cuenta), no este archivo.
// Si la persona ya existe sin vínculo activo (cambió de empresa), solo se crea el vínculo nuevo.
// Sedes (etapa 1 del punto 2): toda cuenta que no es administrador general nace con al menos una sede, y quien crea solo puede dar sedes que son suyas.
// Los administradores (general o de sede) solo los crea el dueño de la plataforma.
import { MENSAJE_MANTENIMIENTO, candadoListo, claveParaSupabase } from '../_compartido/candado.ts'
import { generarContrasenaInicial } from '../_compartido/contrasenas.ts'
import {
  clienteAdmin, clienteComo, correoInterno, leerJson, normalizarDocumento, quienLlama, responder,
} from '../_compartido/http.ts'

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null)

// Los rechazos de la base de datos por área o puesto (código 22023) ya vienen en lenguaje simple: se muestran tal cual.
const motivo = (e: { code?: string; message?: string } | null | undefined, porDefecto: string) =>
  e?.code === '22023' && e.message ? e.message : porDefecto

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  if (!candadoListo) return responder(req, 503, { error: MENSAJE_MANTENIMIENTO })

  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  const d = await leerJson(req)
  if (!d) return responder(req, 400, { error: 'Datos no válidos' })

  const empresaId = texto(d.empresa_id)
  const rol = texto(d.rol)
  const tipo = texto(d.tipo_documento)?.toLowerCase() ?? null
  const numero = normalizarDocumento(d.numero_documento)
  const nombres = texto(d.apellidos_nombres)
  const fechaIngreso = texto(d.fecha_ingreso)
  if (!empresaId || !rol || !tipo || !numero || !nombres || !fechaIngreso || !/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
    return responder(req, 400, { error: 'Faltan datos: empresa, rol, documento, apellidos y nombres, fecha de ingreso' })
  }

  const admin = clienteAdmin()
  const comoLlamada = clienteComo(llamada.token)

  // Sedes de la cuenta: las elegidas; si no se eligió ninguna, la única sede de la empresa o la única sede de quien crea.
  let sedes = Array.isArray(d.sedes) ? d.sedes.filter((x): x is string => typeof x === 'string') : []
  if (!sedes.length && rol !== 'admin_empresa') {
    const { data: todas } = await admin.from('sedes').select('id').eq('empresa_id', empresaId).eq('activa', true)
    if (todas?.length === 1) sedes = [todas[0].id as string]
    else {
      const { data: yo } = await comoLlamada.from('vinculos').select('id').eq('persona_id', llamada.usuario.id).eq('estado', 'activo').maybeSingle()
      const { data: mias } = yo ? await comoLlamada.from('vinculos_sedes').select('sede_id').eq('vinculo_id', yo.id) : { data: [] }
      if (mias?.length === 1) sedes = [mias[0].sede_id as string]
    }
  }
  if (!sedes.length && rol !== 'admin_empresa') return responder(req, 400, { error: 'Elige las sedes de la cuenta' })

  // 1. ¿Puede quien llama crear este rol en esta empresa y con estas sedes? Lo responde la base de datos, como esa persona.
  const permiso = await comoLlamada.rpc('puedo_crear_cuenta', { p_empresa: empresaId, p_rol: rol, p_sedes: sedes })
  if (permiso.error || permiso.data !== true) return responder(req, 403, { error: 'No autorizado' })

  const { data: tipoDoc } = await admin.from('tipos_documento').select('patron').eq('codigo', tipo).maybeSingle()
  if (!tipoDoc || !new RegExp(tipoDoc.patron).test(numero)) {
    return responder(req, 400, { error: 'Número de documento no válido para ese tipo' })
  }

  // La unidad (área o subárea, tarea 3.6) se puede enviar por su identificador; si no, se busca por el texto del área.
  const vinculo = {
    empresa_id: empresaId, rol, fecha_ingreso: fechaIngreso,
    puesto: texto(d.puesto), area: texto(d.area), unidad_id: texto(d.unidad_id), creado_por: llamada.usuario.id,
  }

  // 2. ¿La persona ya existe? (cambió de empresa: se conserva su cuenta y su historial)
  const { data: existente } = await admin.from('personas').select('id')
    .eq('tipo_documento', tipo).eq('numero_documento', numero).maybeSingle()

  if (existente) {
    const { data: activo } = await admin.from('vinculos').select('id')
      .eq('persona_id', existente.id).eq('estado', 'activo').maybeSingle()
    if (activo) return responder(req, 409, { error: 'Esta persona ya tiene un vínculo activo. Primero debe ser cesada allí.' })
    const nuevo = await admin.rpc('alta_vinculo', { p_datos: { ...vinculo, persona_id: existente.id, sedes } })
    if (nuevo.error) return responder(req, 400, { error: motivo(nuevo.error, 'No se pudo crear el vínculo') })
    return responder(req, 200, { persona_id: existente.id, vinculo_id: nuevo.data, cuenta_nueva: false })
  }

  // 3. Persona nueva: cuenta con contraseña inicial al azar, que se devuelve UNA sola vez.
  const contrasena = generarContrasenaInicial(numero)
  const creada = await admin.auth.admin.createUser({
    email: correoInterno(tipo, numero), password: await claveParaSupabase(contrasena), email_confirm: true,
  })
  if (creada.error || !creada.data.user) return responder(req, 400, { error: 'No se pudo crear la cuenta' })
  const personaId = creada.data.user.id

  const persona = await admin.from('personas').insert({
    id: personaId, tipo_documento: tipo, numero_documento: numero, apellidos_nombres: nombres,
    creado_por: llamada.usuario.id, clave_con_candado: true,
  })
  const nuevo = persona.error ? null : await admin.rpc('alta_vinculo', { p_datos: { ...vinculo, persona_id: personaId, sedes } })

  if (persona.error || !nuevo || nuevo.error) {
    // Deshace todo para no dejar cuentas a medias.
    if (!persona.error) await admin.from('personas').delete().eq('id', personaId)
    await admin.auth.admin.deleteUser(personaId)
    return responder(req, 400, { error: motivo(persona.error ?? nuevo?.error, 'No se pudo registrar a la persona. Revisa los datos.') })
  }

  return responder(req, 200, {
    persona_id: personaId, vinculo_id: nuevo.data, cuenta_nueva: true, contrasena_inicial: contrasena,
  })
})
