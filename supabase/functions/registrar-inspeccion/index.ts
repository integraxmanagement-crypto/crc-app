// Recibe una inspección cerrada en el equipo (tarea 3.4-C), con o sin señal en el momento de llenarla.
//  · modo «registrar»: la graba una sola vez (si llega dos veces, responde «ya_recibida»).
//  · modo «corregir»: corrige una inspección cerrada, solo con señal, con motivo y deja el historial.
// El resultado, el puntaje y los hallazgos los vuelve a calcular AQUÍ el mismo motor de reglas que usa la app:
// lo que diga el equipo no cuenta. Quién puede grabar lo decide la base de datos (grabar_inspeccion).
import { clienteAdmin, leerJson, quienLlama, responder } from '../_compartido/http.ts'
import { type Respuesta, evaluar } from '../_compartido/formatos/motor.ts'
import type { Receta } from '../_compartido/formatos/receta.ts'

const MAXIMO_CUERPO = 600_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const DIEZ_MINUTOS = 10 * 60 * 1000
const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000

type Archivo = { id: string; punto_clave: string; fila: number | null; ruta: string; bytes: number; tipo_mime: string; sha256: string }
type Firmante = { rol_clave: string; rol_titulo?: string; orden?: number; persona_id?: string | null; externo_nombre?: string | null; externo_documento?: string | null }
type FotoActivo = { codigo: string; numero: number; subtipo: string | null; datos: Record<string, unknown>; dotacion: Record<string, unknown>; tipo: string }

const admin = clienteAdmin()
const mismo = (a: unknown, b: unknown) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b))
function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar((v as Record<string, unknown>)[k])]))
  return v
}

/** Mensaje y código HTTP a partir de un error de la base de datos. */
function errorBase(req: Request, e: { message?: string; code?: string }) {
  if (e.code === '42501') return responder(req, 403, { error: e.message === 'No autorizado' ? 'No autorizado' : e.message })
  if (e.code === '22023' || e.code === '40001') return responder(req, 422, { error: e.message })
  return responder(req, 500, { error: 'No se pudo grabar. Intenta de nuevo.' })
}

/** Cuenta las fotos que de verdad llegaron, por punto (y por fila en los bloques repetibles). */
function contarFotos(respuestas: Record<string, Respuesta>, filas: Record<string, Record<string, Respuesta>[]>, archivos: Archivo[]) {
  for (const r of Object.values(respuestas)) if (r) r.fotos = 0
  for (const lista of Object.values(filas)) for (const fila of lista) for (const r of Object.values(fila)) if (r) r.fotos = 0
  for (const a of archivos) {
    if (a.fila == null) {
      respuestas[a.punto_clave] ??= { valor: null }
      respuestas[a.punto_clave].fotos = (respuestas[a.punto_clave].fotos ?? 0) + 1
    } else {
      for (const lista of Object.values(filas)) {
        const fila = lista[a.fila]
        if (!fila) continue
        fila[a.punto_clave] ??= { valor: null }
        fila[a.punto_clave].fotos = (fila[a.punto_clave].fotos ?? 0) + 1
      }
    }
  }
}

/** Los firmantes designados cubren las firmas obligatorias de la receta (externos solo donde se permiten). */
function revisarFirmantes(receta: Receta, firmantes: Firmante[]): string | null {
  for (const f of firmantes) {
    const rol = receta.firmas.find((x) => x.clave === f.rol_clave)
    if (!rol) return 'Hay un firmante para una firma que el formato no tiene.'
    if (!f.persona_id && !rol.externo) return `«${rol.titulo}»: este formato no permite firmantes externos.`
    if (f.persona_id && !UUID.test(f.persona_id)) return 'Firmante no válido.'
    if (!f.persona_id && (String(f.externo_nombre ?? '').trim().length < 3)) return `«${rol.titulo}»: escribe el nombre del firmante externo.`
    // Del externo se guardan nombre y documento, marcado como externo (decisión del dueño, 27/10/2026).
    if (!f.persona_id && !/^[A-Za-z0-9-]{4,20}$/.test(String(f.externo_documento ?? '').trim())) return `«${rol.titulo}»: escribe el documento del firmante externo.`
  }
  for (const rol of receta.firmas.filter((x) => x.obligatoria)) {
    const n = firmantes.filter((f) => f.rol_clave === rol.clave).length
    if (n < rol.minimo) return `«${rol.titulo}»: faltan firmantes (mínimo ${rol.minimo}).`
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })
  const d = await leerJson(req, MAXIMO_CUERPO)
  if (!d) return responder(req, 400, { error: 'Datos no válidos o demasiado grandes' })
  const por = llamada.usuario.id
  const respuestas = (d.respuestas && typeof d.respuestas === 'object' ? d.respuestas : {}) as Record<string, Respuesta>
  const filas = (d.filas && typeof d.filas === 'object' ? d.filas : {}) as Record<string, Record<string, Respuesta>[]>
  const observacion = typeof d.observacion === 'string' ? d.observacion.slice(0, 4000) : null

  // ───── Corregir una inspección cerrada ─────
  if (d.modo === 'corregir') {
    if (typeof d.id !== 'string' || !UUID.test(d.id)) return responder(req, 400, { error: 'Falta la inspección' })
    const { data: i } = await admin.from('inspecciones').select('id, version_id, fecha, activo_foto, empresa_id').eq('id', d.id).maybeSingle()
    if (!i) return responder(req, 403, { error: 'No autorizado' })
    const { data: v } = await admin.from('plantillas_versiones').select('receta').eq('id', i.version_id).single()
    const { data: archivos } = await admin.from('archivos').select('punto_clave, fila').eq('inspeccion_id', i.id)
    contarFotos(respuestas, filas, (archivos ?? []) as Archivo[])
    const foto = i.activo_foto as FotoActivo | null
    const ev = evaluar(v!.receta as Receta, { respuestas, filas, observacion, activo: foto ? { subtipo: foto.subtipo, datos: foto.datos as Record<string, string | number | null> } : null, fecha: i.fecha })
    if (ev.faltan.length) return responder(req, 422, { error: 'Faltan datos para cerrar la inspección', faltan: ev.faltan })
    const r = await admin.rpc('corregir_inspeccion', {
      p_por: por,
      p_datos: { id: i.id, edicion: d.edicion, motivo: d.motivo, respuestas, filas, observacion, resultado: ev.resultado, puntaje: ev.puntaje, hallazgos: ev.hallazgos, vencidos: ev.vencidos },
    })
    if (r.error) return errorBase(req, r.error)
    return responder(req, 200, r.data)
  }

  // ───── Registrar ─────
  const id = String(d.id ?? '')
  const versionId = String(d.version_id ?? '')
  const fecha = String(d.fecha ?? '')
  const cerradaEn = Date.parse(String(d.cerrada_en_equipo ?? ''))
  if (!UUID.test(id) || !UUID.test(versionId) || !FECHA.test(fecha) || Number.isNaN(cerradaEn))
    return responder(req, 400, { error: 'Faltan datos de la inspección' })

  // Reenvío: la base de datos responde «ya_recibida» sin grabar nada (y revisa que sea de la misma cuenta).
  const { data: existe } = await admin.from('inspecciones').select('id').eq('id', id).maybeSingle()
  if (existe) {
    const r = await admin.rpc('grabar_inspeccion', { p_por: por, p_datos: { id } })
    return r.error ? errorBase(req, r.error) : responder(req, 200, r.data)
  }

  const { data: version } = await admin.from('plantillas_versiones').select('id, plantilla_id, empresa_id, receta').eq('id', versionId).maybeSingle()
  if (!version || !version.empresa_id) return responder(req, 422, { error: 'El formato no existe' })
  const receta = version.receta as Receta
  const empresa = version.empresa_id as string
  const avisos: string[] = []

  // Datos del activo con que se hizo (caso d): se aceptan si coinciden con los actuales o con una versión anterior real.
  let activoFoto: FotoActivo | null = null
  if (typeof d.activo_id === 'string' && UUID.test(d.activo_id)) {
    const { data: a } = await admin.from('activos').select('id, codigo, numero, subtipo, datos, dotacion, tipos_activo(nombre)').eq('id', d.activo_id).maybeSingle()
    if (a) {
      const actual: FotoActivo = {
        codigo: a.codigo, numero: a.numero, subtipo: a.subtipo, datos: a.datos, dotacion: a.dotacion,
        tipo: (a.tipos_activo as unknown as { nombre: string } | null)?.nombre ?? '',
      }
      const enviada = (d.activo_foto ?? null) as FotoActivo | null
      const clave = (f: FotoActivo | Record<string, unknown>) => ({ codigo: f.codigo, subtipo: f.subtipo ?? null, datos: f.datos ?? {}, dotacion: f.dotacion ?? {} })
      if (enviada && !mismo(clave(enviada), clave(actual))) {
        const { data: hist } = await admin.from('activos_historial').select('despues').eq('activo_id', a.id)
        const real = (hist ?? []).some((h) => mismo(clave(enviada), clave(h.despues as Record<string, unknown>)))
        activoFoto = real ? { ...actual, ...clave(enviada) } as FotoActivo : actual
        avisos.push(real ? 'activo_cambio' : 'activo_datos_actuales')
      } else activoFoto = actual
    }
  }

  // Hora del equipo (caso g): se guarda la del equipo y la del servidor; si una no cuadra, queda marcada.
  const ahora = Date.now()
  if (cerradaEn > ahora + DIEZ_MINUTOS) avisos.push('hora_equipo_adelantada')
  if (cerradaEn < ahora - TREINTA_DIAS) avisos.push('enviada_mas_de_30_dias_despues')

  // Fotos: deben estar ya en el almacén, en la carpeta de esta inspección, con el tamaño indicado.
  const archivos = (Array.isArray(d.archivos) ? d.archivos : []) as Archivo[]
  if (archivos.length > 200) return responder(req, 422, { error: 'Demasiadas fotos en una inspección (máximo 200)' })
  const carpeta = `${empresa}/${id}`
  const { data: enAlmacen, error: errAlm } = await admin.storage.from('evidencias').list(carpeta, { limit: 1000 })
  if (errAlm) return responder(req, 500, { error: 'No se pudo revisar las fotos. Intenta de nuevo.' })
  const tamanos = new Map((enAlmacen ?? []).map((o) => [`${carpeta}/${o.name}`, Number((o.metadata as Record<string, unknown> | null)?.size ?? -1)]))
  for (const a of archivos) {
    if (!UUID.test(String(a.id)) || tamanos.get(a.ruta) !== a.bytes) return responder(req, 409, { error: 'Falta subir una foto. Se reintentará.', reintentar: true })
  }
  const miFirma = (d.mi_firma && typeof d.mi_firma === 'object' ? d.mi_firma : null) as { rol_clave: string; ruta: string; bytes: number; firmado_en?: string } | null
  if (miFirma && tamanos.get(miFirma.ruta) !== miFirma.bytes) return responder(req, 409, { error: 'Falta subir tu firma. Se reintentará.', reintentar: true })

  // Firmantes y cálculo con el motor de reglas.
  const firmantes = (Array.isArray(d.firmantes) ? d.firmantes : []) as Firmante[]
  const problemaFirmas = revisarFirmantes(receta, firmantes)
  if (problemaFirmas) return responder(req, 422, { error: problemaFirmas })
  contarFotos(respuestas, filas, archivos)
  const ev = evaluar(receta, {
    respuestas, filas, observacion,
    activo: activoFoto ? { subtipo: activoFoto.subtipo, datos: activoFoto.datos as Record<string, string | number | null> } : null,
    fecha,
  })
  if (ev.faltan.length) return responder(req, 422, { error: 'Faltan datos para cerrar la inspección', faltan: ev.faltan })

  const r = await admin.rpc('grabar_inspeccion', {
    p_por: por,
    p_datos: {
      id, plantilla_id: version.plantilla_id, version_id: version.id, sede_id: d.sede_id, unidad_id: d.unidad_id ?? null,
      ubicacion_id: d.ubicacion_id ?? null, activo_id: d.activo_id ?? null, activo_foto: activoFoto, respuestas, filas, observacion,
      fecha, iniciada_en_equipo: d.iniciada_en_equipo ?? null, cerrada_en_equipo: new Date(cerradaEn).toISOString(),
      dispositivo: typeof d.dispositivo === 'string' ? d.dispositivo.slice(0, 200) : null,
      resultado: ev.resultado, puntaje: ev.puntaje, hallazgos: ev.hallazgos, vencidos: ev.vencidos, avisos,
      archivos, firmantes, mi_firma: miFirma,
    },
  })
  if (r.error) return errorBase(req, r.error)
  return responder(req, 200, r.data)
})
