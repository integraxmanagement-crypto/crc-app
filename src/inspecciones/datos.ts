// Inspecciones ya recibidas por el servidor (tarea 3.4-C). Se leen con las reglas RLS de cada persona (las ven el
// administrador y el gestor; cada firmante, las suyas). Se escribe solo con las acciones de la base de datos o con
// la función registrar-inspeccion.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { conLimite, db, mensaje, rpc } from '../empresas/datos'
import type { Fila, Hallazgo, Respuesta } from '../formatos/motor'
import type { Receta } from '../formatos/receta'

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
