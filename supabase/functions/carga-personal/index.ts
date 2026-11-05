// Carga de personal desde Excel (tarea 3.6). La app lee el Excel en el equipo y envía solo los datos de las filas;
// el archivo nunca llega aquí ni se guarda.
//  · modo «revisar»: vista previa, no graba nada (paso 4).
//  · modo «grabar»: vuelve a revisar todo y graba todo o nada (paso 5).
// Quién puede: el administrador de la empresa (solo la suya) y el dueño de la plataforma (cualquier empresa).
// Lo decide la base de datos (puedo_crear_cuenta), no este archivo.
// Sedes (etapa 1 del punto 2): la carga es de una o varias sedes elegidas (deben ser de quien carga); todas las cuentas nuevas reciben esas sedes.
import { MENSAJE_MANTENIMIENTO, candadoListo, claveParaSupabase } from '../_compartido/candado.ts'
import { generarContrasenaInicial } from '../_compartido/contrasenas.ts'
import { clienteAdmin, clienteComo, correoInterno, leerJson, quienLlama, responder } from '../_compartido/http.ts'
import { FILAS_MAXIMAS, type Fila, type Revisada, revisar } from './revision.ts'

const MAXIMO_CUERPO = 400_000 // 300 filas caben con holgura
const A_LA_VEZ = 5 // cuentas que se crean al mismo tiempo

const TIPO_INTERNO: Record<string, string> = { DNI: 'dni', CE: 'ce', PAS: 'pas' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  if (!candadoListo) return responder(req, 503, { error: MENSAJE_MANTENIMIENTO })

  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  const d = await leerJson(req, MAXIMO_CUERPO)
  if (!d) return responder(req, 400, { error: 'Datos no válidos o demasiado grandes' })
  const empresaId = typeof d.empresa_id === 'string' ? d.empresa_id : ''
  const filas = Array.isArray(d.filas) ? (d.filas as Fila[]) : null
  if (!empresaId || !filas) return responder(req, 400, { error: 'Faltan la empresa o las filas' })
  if (!filas.length) return responder(req, 400, { error: 'El Excel no tiene personas' })
  if (filas.length > FILAS_MAXIMAS) return responder(req, 400, { error: `Máximo ${FILAS_MAXIMAS} personas por archivo` })

  const admin = clienteAdmin()
  const comoLlamada = clienteComo(llamada.token)
  // Sedes de la carga: las elegidas; si no, la única sede de la empresa o la única sede de quien carga.
  let sedes = Array.isArray(d.sedes) ? d.sedes.filter((x): x is string => typeof x === 'string') : []
  if (!sedes.length) {
    const { data: todas } = await admin.from('sedes').select('id').eq('empresa_id', empresaId).eq('activa', true)
    if (todas?.length === 1) sedes = [todas[0].id as string]
    else {
      const { data: yo } = await comoLlamada.from('vinculos').select('id').eq('persona_id', llamada.usuario.id).eq('estado', 'activo').maybeSingle()
      const { data: mias } = yo ? await comoLlamada.from('vinculos_sedes').select('sede_id').eq('vinculo_id', yo.id) : { data: [] }
      if (mias?.length === 1) sedes = [mias[0].sede_id as string]
    }
  }

  // ¿Puede quien llama cargar personal en esta empresa y en estas sedes? (administrador de esa empresa, administrador de sede o dueño de la plataforma)
  const permiso = await comoLlamada.rpc('puedo_crear_cuenta', { p_empresa: empresaId, p_rol: 'usuario', p_sedes: sedes })
  if (permiso.error || permiso.data !== true) return responder(req, 403, { error: 'No autorizado' })
  if (d.modo === 'grabar' && !sedes.length) return responder(req, 400, { error: 'Elige la sede de esta carga' })

  // Sedes de quien carga: null si ve toda la empresa (dueño de la plataforma o administrador general).
  // Sirve para no mostrar nombres de personas de otras sedes en la vista previa.
  let misSedes: Set<string> | null = null
  const { data: dueno } = await admin.from('duenos_plataforma').select('persona_id').eq('persona_id', llamada.usuario.id).maybeSingle()
  if (!dueno) {
    const { data: yo } = await admin.from('vinculos').select('id, rol').eq('persona_id', llamada.usuario.id).eq('estado', 'activo').maybeSingle()
    if (yo?.rol !== 'admin_empresa') {
      const { data: mias } = yo ? await admin.from('vinculos_sedes').select('sede_id').eq('vinculo_id', yo.id) : { data: [] }
      misSedes = new Set((mias ?? []).map((s) => s.sede_id as string))
    }
  }

  const resultado = await revisar(admin, empresaId, filas, sedes, misSedes)

  if (d.modo === 'revisar') return responder(req, 200, resultado)
  if (d.modo !== 'grabar') return responder(req, 400, { error: 'Modo no válido' })

  // ── Grabar: todo o nada ──
  // Se graba lo que dice ESTA revisión (hecha recién en el servidor), no lo que diga el navegador.
  if (resultado.filas.some((f) => f.estado === 'error' || f.estado === 'falta_lista')) {
    return responder(req, 409, { error: 'Hay filas con problemas. Revisa de nuevo antes de grabar.', revision: resultado })
  }
  const marcadas = new Set(Array.isArray(d.reactivar) ? d.reactivar.filter((n): n is number => typeof n === 'number') : [])
  const nuevas = resultado.filas.filter((f) => f.estado === 'nueva')
  const altas = resultado.filas.filter((f) => f.estado === 'alta_cuenta_existente')
  const actualizar = resultado.filas.filter((f) => f.estado === 'actualizar')
  const reactivar = resultado.filas.filter((f) => f.estado === 'reactivar' && marcadas.has(f.fila))
  // Lista completa (decisión 9): quienes no aparecen quedan «por revisar». La lista la arma ESTA revisión.
  const listaCompleta = d.lista_completa === true
  const porRevisar = listaCompleta ? resultado.noAparecen.map((p) => p.vinculo_id) : []
  const quitarMarca = resultado.filas.filter((f) => f.porRevisar).length
  if (!nuevas.length && !altas.length && !actualizar.length && !reactivar.length && !porRevisar.length && !quitarMarca) {
    return responder(req, 400, { error: 'No hay nada que grabar: todas las personas ya están al día.' })
  }

  // 1. Cuentas de acceso de las personas nuevas, cada una con su contraseña inicial al azar.
  const creadas: { fila: Revisada; id: string; contrasena: string }[] = []
  const deshacer = () => Promise.all(creadas.map((c) => admin.auth.admin.deleteUser(c.id)))
  let fallo: Revisada | null = null
  for (let i = 0; i < nuevas.length && !fallo; i += A_LA_VEZ) {
    await Promise.all(nuevas.slice(i, i + A_LA_VEZ).map(async (f) => {
      const tipo = TIPO_INTERNO[f.tipo]
      const contrasena = generarContrasenaInicial(f.numero)
      const r = await admin.auth.admin.createUser({
        email: correoInterno(tipo, f.numero), password: await claveParaSupabase(contrasena), email_confirm: true,
      })
      if (r.error || !r.data.user) fallo ??= f
      else creadas.push({ fila: f, id: r.data.user.id, contrasena })
    }))
  }
  if (fallo) {
    await deshacer()
    return responder(req, 500, { error: `No se pudo crear la cuenta de la fila ${fallo.fila}. No se grabó nada; intenta de nuevo.` })
  }

  // 2. Personas y vínculos en una sola transacción de la base de datos.
  const datosVinculo = (f: Revisada) => ({ fila: f.fila, fecha: f.fecha, rol: f.rol, puesto_id: f.puesto_id, unidad_id: f.unidad_id })
  const grabado = await admin.rpc('grabar_carga', {
    p_empresa: empresaId,
    p_por: llamada.usuario.id,
    p_datos: {
      filas: resultado.filas.length,
      sin_cambios: resultado.filas.filter((f) => f.estado === 'sin_cambios').length,
      lista_completa: listaCompleta,
      sedes,
      presentes: resultado.filas.filter((f) => f.vinculo_id && f.estado !== 'reactivar').map((f) => f.vinculo_id),
      por_revisar: porRevisar,
      nuevas: creadas.map((c) => ({ ...datosVinculo(c.fila), persona_id: c.id, tipo: TIPO_INTERNO[c.fila.tipo], numero: c.fila.numero, nombres: c.fila.nombres })),
      altas: altas.map((f) => ({ ...datosVinculo(f), persona_id: f.persona_id })),
      actualizar: actualizar.map((f) => ({ ...datosVinculo(f), vinculo_id: f.vinculo_id, nombres: f.nombres })),
      reactivar: reactivar.map((f) => ({ ...datosVinculo(f), vinculo_id: f.vinculo_id })),
    },
  })
  if (grabado.error) {
    await deshacer()
    const simple = grabado.error.code === '22023' && grabado.error.message
    return responder(req, 400, {
      error: simple
        ? `${grabado.error.message}. No se grabó nada.`
        : 'Los datos cambiaron mientras tanto o algo falló. No se grabó nada: revisa de nuevo e intenta otra vez.',
    })
  }

  // 3. Las contraseñas iniciales se devuelven UNA sola vez, para la hoja de entrega. No se guardan en ningún lado.
  creadas.sort((a, b) => a.fila.fila - b.fila.fila)
  return responder(req, 200, {
    carga_id: grabado.data,
    resumen: {
      nuevas: creadas.length, altas: altas.length, actualizadas: actualizar.length, reactivadas: reactivar.length, por_revisar: porRevisar.length,
    },
    entregas: creadas.map((c) => ({
      fila: c.fila.fila, tipo: c.fila.tipo, numero: c.fila.numero, apellidos_nombres: c.fila.nombres, rol: c.fila.rol, contrasena: c.contrasena,
    })),
  })
})
