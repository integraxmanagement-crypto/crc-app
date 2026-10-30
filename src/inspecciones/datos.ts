// Inspecciones ya recibidas por el servidor (tarea 3.4-C). Se leen con las reglas RLS de cada persona (las ven el
// administrador y el gestor; cada firmante, las suyas). Se escribe solo con las acciones de la base de datos o con
// la función registrar-inspeccion.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { conLimite, db, mensaje, rpc } from '../empresas/datos'
import type { Frecuencia } from '../formatos/base'
import type { Fila, Hallazgo, Respuesta } from '../formatos/motor'
import type { Receta } from '../formatos/receta'
import type { CopiaLocal } from './campo'

export type Inspeccion = {
  id: string
  empresa_id: string
  numero: number
  plantilla_id: string
  version_id: string
  sede_id: string
  unidad_id: string | null
  ubicacion_id: string | null
  activo_id: string | null
  activo_foto: { codigo: string; numero: number; subtipo: string | null; datos: Record<string, string | number>; dotacion: Record<string, number>; tipo: string } | null
  respuestas: Record<string, Respuesta>
  filas: Record<string, Fila[]>
  observacion: string | null
  resultado: string | null
  puntaje: number | null
  hallazgos: Hallazgo[]
  vencidos: string[]
  avisos: string[]
  fecha: string
  iniciada_en_equipo: string | null
  cerrada_en_equipo: string
  recibida_en: string
  inspector_id: string
  estado: 'cerrada' | 'anulada'
  motivo_anulacion: string | null
  anulada_en: string | null
  edicion: number
  huella: string
  plantillas: { nombre: string } | null
  sedes: { nombre: string } | null
}
export type FirmaServidor = {
  id: string
  inspeccion_id: string
  rol_clave: string
  rol_titulo: string
  orden: number
  persona_id: string | null
  externo_nombre: string | null
  externo_documento: string | null
  cargo: string | null // escrito a mano al llenar la inspección
  estado: 'pendiente' | 'firmada' | 'en_papel'
  imagen_ruta: string | null
  firmado_en: string | null
  edicion: number | null
}
export type ArchivoServidor = { id: string; punto_clave: string; fila: number | null; ruta: string; bytes: number }
export type Edicion = { id: number; edicion: number; motivo: string; hecho_en: string; hecho_por: string }

// Los nombres de las personas se toman de la lista de la empresa (personas_de_mi_empresa), no de estas tablas.
async function leer<T>(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(mensaje(error))
  return data as T
}

const RESUMEN = 'id, numero, plantilla_id, fecha, resultado, puntaje, hallazgos, estado, recibida_en, activo_foto, inspector_id, avisos, plantillas(nombre), sedes(nombre)'
export type ResumenInspeccion = Pick<Inspeccion, 'id' | 'numero' | 'plantilla_id' | 'fecha' | 'resultado' | 'puntaje' | 'hallazgos' | 'estado' | 'recibida_en' | 'activo_foto' | 'inspector_id' | 'avisos' | 'plantillas' | 'sedes'>

export const listarInspecciones = (empresaId: string) =>
  leer<ResumenInspeccion[]>(conLimite(db().from('inspecciones').select(RESUMEN).eq('empresa_id', empresaId).order('numero', { ascending: false }).limit(200)))

export async function detalleInspeccion(id: string) {
  const [i, firmas, archivos, ediciones] = await Promise.all([
    leer<Inspeccion & { plantillas_versiones: { receta: Receta; numero: number; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null; logo: string } | null; unidades: { nombre: string } | null; ubicaciones: { nombre: string } | null }>(
      db().from('inspecciones').select(`*, plantillas(nombre), sedes(nombre), unidades(nombre), ubicaciones(nombre), plantillas_versiones(receta, numero, codigo_formato, version_formato, fecha_aprobacion, logo)`).eq('id', id).single(),
    ),
    leer<FirmaServidor[]>(db().from('firmas').select('*').eq('inspeccion_id', id).order('rol_clave').order('orden')),
    leer<ArchivoServidor[]>(db().from('archivos').select('id, punto_clave, fila, ruta, bytes').eq('inspeccion_id', id)),
    leer<Edicion[]>(db().from('inspecciones_ediciones').select('id, edicion, motivo, hecho_en, hecho_por').eq('inspeccion_id', id).order('id', { ascending: false })),
  ])
  return { inspeccion: i, firmas, archivos, ediciones }
}

/** Firmas que esperan a esta persona (la ve aunque no tenga permiso de ver todas las inspecciones). */
export type FirmaPendiente = FirmaServidor & { inspecciones: { numero: number; fecha: string; estado: string; empresa_id: string; plantillas: { nombre: string } | null } | null }
export const misFirmasPendientes = (personaId: string) =>
  leer<FirmaPendiente[]>(db().from('firmas').select('*, inspecciones(numero, fecha, estado, empresa_id, plantillas(nombre))').eq('persona_id', personaId).eq('estado', 'pendiente'))

/** Enlace temporal (10 minutos) para ver una foto o firma del almacén privado. */
export async function enlaceEvidencia(ruta: string) {
  const { data, error } = await db().storage.from('evidencias').createSignedUrl(ruta, 600)
  if (error) throw new Error(mensaje(error))
  return data.signedUrl
}

export const anularInspeccion = (id: string, motivo: string) => rpc<void>('anular_inspeccion', { p_id: id, p_motivo: motivo })
export const marcarEnPapel = (firma: string) => rpc<void>('marcar_firma_en_papel', { p_firma: firma })

/** Firma desde la propia cuenta: sube la imagen y la registra. */
export async function firmar(f: FirmaServidor & { empresa_id?: string }, empresaId: string, png: Blob) {
  const ruta = `${empresaId}/${f.inspeccion_id}/firma-${f.persona_id}-${f.rol_clave}.png`
  const { error } = await db().storage.from('evidencias').upload(ruta, png, { contentType: 'image/png', upsert: false })
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(mensaje(error))
  await rpc<void>('firmar_inspeccion', { p_firma: f.id, p_ruta: ruta, p_bytes: png.size })
}

/** Corrige una inspección cerrada (solo con señal; el servidor recalcula y deja el historial). */
export async function corregirInspeccion(datos: { id: string; edicion: number; motivo: string; respuestas: Record<string, Respuesta>; filas: Record<string, Fila[]>; observacion: string | null }) {
  const { data, error } = await db().functions.invoke('registrar-inspeccion', { body: { modo: 'corregir', ...datos } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const r = await error.context.json().catch(() => ({}))
      throw new Error([r.error ?? 'No se pudo corregir.', ...(r.faltan ?? []).slice(0, 5)].join(' · '))
    }
    throw new Error(mensaje(error))
  }
  return data as { edicion: number }
}

export type Uso = { usado: number; tope: number | null; foto_max: number | null }
export async function usoAlmacenamiento(empresaId: string): Promise<Uso | null> {
  const filas = await rpc<Uso[]>('uso_almacenamiento', { p_empresa: empresaId })
  return filas[0] ?? null
}

export const NOMBRE_AVISO: Record<string, string> = {
  version_anterior: 'Se llenó con una versión del formato que ya fue reemplazada.',
  activo_de_baja: 'El activo estaba dado de baja al recibirla.',
  activo_cambio: 'Los datos del activo cambiaron después; se guardan los que había al inspeccionar.',
  activo_datos_actuales: 'Los datos del activo que traía no coinciden: se guardaron los actuales.',
  hora_equipo_adelantada: 'La hora del equipo estaba adelantada.',
  enviada_mas_de_30_dias_despues: 'Se envió más de 30 días después de cerrarla.',
}

// ───── Programación (tarea 3.4-D) ─────

/** Una fila del avance: un equipo con su última inspección del período (o, en formatos de área, una inspección). */
export type FilaAvance = {
  activo_id: string | null
  codigo: string | null
  numero: number | null
  subtipo: string | null
  ubicacion_id: string | null
  unidad_id: string | null
  inspeccion_id: string | null
  inspeccion_numero: number | null
  fecha: string | null
  resultado: string | null
  hallazgos: number
}
/** La última inspección cerrada de cada equipo de un formato (para «no operativos» y «última inspección» de extintores). */
export type UltimaInspeccion = { activo_id: string; fecha: string; numero: number; resultado: string | null; respuestas: Record<string, { valor?: unknown }> }
export async function ultimasInspecciones(plantillaId: string): Promise<Map<string, UltimaInspeccion>> {
  const filas = await leer<(UltimaInspeccion & { activo_id: string | null })[]>(
    db().from('inspecciones').select('activo_id, fecha, numero, resultado, respuestas').eq('plantilla_id', plantillaId).eq('estado', 'cerrada')
      .order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(3000),
  )
  const mapa = new Map<string, UltimaInspeccion>()
  for (const f of filas) if (f.activo_id && !mapa.has(f.activo_id)) mapa.set(f.activo_id, f as UltimaInspeccion)
  return mapa
}

/** Las inspecciones cerradas de un formato en un rango de fechas, con su área y ubicación (para «Ver por mes»). */
export type InspeccionDelMes = { id: string; numero: number; fecha: string; resultado: string | null; hallazgos: unknown[]; unidades: { nombre: string } | null; ubicaciones: { nombre: string } | null; activo_foto: { codigo: string } | null }
export const inspeccionesDelMes = (plantillaId: string, desde: string, hasta: string) =>
  leer<InspeccionDelMes[]>(
    db().from('inspecciones').select('id, numero, fecha, resultado, hallazgos, activo_foto, unidades(nombre), ubicaciones(nombre)').eq('plantilla_id', plantillaId).eq('estado', 'cerrada')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha').order('numero').limit(1000),
  )

/**
 * La frecuencia de cada formato, tal como está ahora en el servidor (pedido del dueño, 29/10/2026): un formato no tiene un período
 * propio; nace en la actividad del programa anual de SST que lo vincula (la más frecuente, si hay varias). Si ninguna actividad vigente
 * lo vincula con una frecuencia periódica, se usa la que traía el formato. La copia del equipo puede traer una vieja.
 */
const ORDEN_FRECUENCIA: Frecuencia[] = ['semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual']
export async function frecuenciasActuales(empresaId: string): Promise<Map<string, Frecuencia>> {
  const filas = await leer<{ id: string; frecuencia: Frecuencia }[]>(db().from('plantillas').select('id, frecuencia').eq('empresa_id', empresaId))
  const mapa = new Map(filas.map((f) => [f.id, f.frecuencia]))
  const actividades = await leer<{ plantilla_id: string; frecuencia: Frecuencia }[]>(
    db().from('passt_nodos').select('plantilla_id, frecuencia, passt_programas!inner(vigente)').eq('empresa_id', empresaId).eq('tipo', 'actividad').eq('vigente', true)
      .eq('passt_programas.vigente', true).not('frecuencia', 'is', null).not('plantilla_id', 'is', null),
  ).catch(() => [])
  const delPrograma = new Map<string, Frecuencia>()
  for (const x of actividades) {
    const actual = delPrograma.get(x.plantilla_id)
    if (!actual || ORDEN_FRECUENCIA.indexOf(x.frecuencia) < ORDEN_FRECUENCIA.indexOf(actual)) delPrograma.set(x.plantilla_id, x.frecuencia)
  }
  for (const [id, f] of delPrograma) mapa.set(id, f)
  return mapa
}

/** La copia del equipo con la frecuencia actual de cada formato (la copia guardada no cambia). */
export const conFrecuencias = (copia: CopiaLocal, m: Map<string, Frecuencia>): CopiaLocal => ({
  ...copia,
  formatos: copia.formatos.map((f) => (m.has(f.plantilla.id) ? { ...f, plantilla: { ...f.plantilla, frecuencia: m.get(f.plantilla.id)! } } : f)),
})

/** Las inspecciones cerradas con porcentaje de un formato (por su nombre, sin importar cuál copia), la más reciente primero. */
export type ResultadoInspeccion = { id: string; numero: number; fecha: string; puntaje: number; unidad_id: string | null; unidades: { nombre: string } | null }
export const resultadosDeFormato = (nombreFormato: string) =>
  leer<ResultadoInspeccion[]>(
    db().from('inspecciones').select('id, numero, fecha, puntaje, unidad_id, unidades(nombre), plantillas!inner(nombre)').eq('estado', 'cerrada').eq('plantillas.nombre', nombreFormato)
      .not('puntaje', 'is', null).order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(1000),
  )

export const avancePeriodo = (plantillaId: string, sedeId: string, desde: string, hasta: string) =>
  rpc<FilaAvance[]>('avance_periodo', { p_plantilla: plantillaId, p_sede: sedeId, p_desde: desde, p_hasta: hasta })

/** Las inspecciones completas (con la versión del formato que usó cada una), para el Excel del período. */
export type InspeccionCompleta = Inspeccion & {
  plantillas_versiones: { receta: Receta; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null } | null
  unidades: { nombre: string } | null
  ubicaciones: { nombre: string } | null
}
export async function inspeccionesCompletas(ids: string[]): Promise<InspeccionCompleta[]> {
  if (!ids.length) return []
  return leer<InspeccionCompleta[]>(
    db().from('inspecciones').select('*, plantillas(nombre), sedes(nombre), unidades(nombre), ubicaciones(nombre), plantillas_versiones(receta, codigo_formato, version_formato, fecha_aprobacion)').in('id', ids),
  )
}
