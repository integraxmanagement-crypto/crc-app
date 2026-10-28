// Seguimiento de hallazgos (tarea 3.4-D, parte 2). Se leen con las reglas RLS: el administrador y el gestor ven todos
// los de su empresa; el usuario, solo los que tiene asignados. Se escribe solo con las acciones de la base de datos.
import { conLimite, db, mensaje, rpc } from '../empresas/datos'

export type EstadoHallazgo = 'abierto' | 'en_proceso' | 'cerrado' | 'anulado'
export type Hallazgo = {
  id: string
  empresa_id: string
  inspeccion_id: string
  plantilla_id: string
  sede_id: string
  activo_id: string | null
  origen: 'no_cumple' | 'fuera_rango' | 'vencido' | 'fila'
  clave: string | null
  fila: number | null
  texto: string
  accion: string | null
  responsable_id: string | null
  plazo: string | null
  estado: EstadoHallazgo
  creado_en: string
  cerrado_en: string | null
  cerrado_por: string | null
  cierre_comentario: string | null
  cierre_foto_ruta: string | null
  anulado_motivo: string | null
  inspeccion_numero: number | null
  activo_codigo: string | null
  plantillas: { nombre: string } | null
  sedes: { nombre: string } | null
}
export type CambioHallazgo = { id: number; cambio: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; comentario: string | null; hecho_por: string | null; hecho_en: string }

export const NOMBRE_ESTADO_HALLAZGO: Record<EstadoHallazgo, string> = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado', anulado: 'Anulado' }
export const NOMBRE_CAMBIO: Record<string, string> = {
  creado: 'Nació con la inspección',
  asignado: 'Responsable, plazo o acción',
  en_proceso: 'Pasó a «en proceso»',
  cerrado: 'Cerrado',
  reabierto: 'Reabierto',
  anulado: 'Anulado',
}

async function leer<T>(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(mensaje(error))
  return data as T
}

// El usuario no ve la inspección: el número y el código del equipo vienen en el propio hallazgo.
const CAMPOS = '*, plantillas(nombre), sedes(nombre)'
export const listarHallazgos = (empresaId: string) =>
  leer<Hallazgo[]>(conLimite(db().from('hallazgos').select(CAMPOS).eq('empresa_id', empresaId).order('creado_en', { ascending: false }).limit(500)))
export const historialHallazgo = (id: string) =>
  leer<CambioHallazgo[]>(db().from('hallazgos_historial').select('id, cambio, antes, despues, comentario, hecho_por, hecho_en').eq('hallazgo_id', id).order('id', { ascending: false }))

export const gestionarHallazgo = (id: string, datos: { responsable_id: string | null; plazo: string | null; accion: string | null }) =>
  rpc<void>('gestionar_hallazgo', { p_id: id, p_datos: datos })
export const hallazgoEnProceso = (id: string) => rpc<void>('hallazgo_en_proceso', { p_id: id })
export const reabrirHallazgo = (id: string, motivo: string) => rpc<void>('reabrir_hallazgo', { p_id: id, p_motivo: motivo })

/** Cierra con comentario y, si hay, la foto de evidencia (se sube antes al almacén privado). Necesita señal. */
export async function cerrarHallazgo(h: Hallazgo, comentario: string, foto: Blob | null) {
  let ruta: string | null = null
  if (foto) {
    ruta = `${h.empresa_id}/${h.inspeccion_id}/cierre-${h.id}-${crypto.randomUUID().slice(0, 8)}.jpg`
    const { error } = await db().storage.from('evidencias').upload(ruta, foto, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(mensaje(error))
  }
  await rpc<void>('cerrar_hallazgo', { p_id: h.id, p_comentario: comentario, p_foto_ruta: ruta, p_foto_bytes: foto?.size ?? null })
}

/** Vencido: con plazo pasado y todavía abierto o en proceso. */
export const vencido = (h: Pick<Hallazgo, 'estado' | 'plazo'>, hoy: string) => (h.estado === 'abierto' || h.estado === 'en_proceso') && Boolean(h.plazo && h.plazo < hoy)
