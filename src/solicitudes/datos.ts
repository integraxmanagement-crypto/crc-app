// Solicitudes de cambio del gestor (etapas 2 y 3 del punto 2, 03/11/2026): anular o corregir inspecciones, cambiar el programa anual aprobado
// y publicar o retirar un formato (estas últimas, sin sede: solo las decide el administrador general).
// El gestor pide; un administrador de su sede (o el general) aprueba o deniega. Lo que el gestor hace directo con su facultad llega como «comunicada».
// Se lee con las reglas de la base de datos; se escribe solo con sus funciones, que revisan quién puede qué.
import { corregirInspeccion } from '../inspecciones/datos'
import { db, mensaje, rpc } from '../empresas/datos'

export type TipoSolicitud = 'anular_inspeccion' | 'corregir_inspeccion' | 'cambio_programa' | 'publicar_formato' | 'retirar_formato'
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'denegada' | 'comunicada'

export type Solicitud = {
  id: string
  empresa_id: string
  sede_id: string | null
  tipo: TipoSolicitud
  estado: EstadoSolicitud
  objetivo_id: string
  titulo: string
  motivo: string
  datos: Record<string, unknown>
  solicitado_por: string
  solicitado_en: string
  resuelto_por: string | null
  resuelto_en: string | null
  comentario_resolucion: string | null
  visto_solicitante: boolean
  vistos: string[]
}

export const NOMBRE_ESTADO: Record<EstadoSolicitud, string> = { pendiente: 'Por resolver', aprobada: 'Aprobada', denegada: 'Denegada', comunicada: 'Comunicación' }

export async function listarSolicitudes(): Promise<Solicitud[]> {
  const { data, error } = await db().from('solicitudes_cambio').select('*').order('solicitado_en', { ascending: false }).limit(200)
  if (error) throw new Error(mensaje(error))
  return (data ?? []) as Solicitud[]
}

export async function nombresDe(ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)].filter(Boolean)
  if (!unicos.length) return new Map()
  const { data } = await db().from('personas').select('id, apellidos_nombres').in('id', unicos)
  return new Map((data ?? []).map((p) => [p.id as string, p.apellidos_nombres as string]))
}

/** El gestor pide un cambio. `datos` depende del tipo (ver la base de datos: solicitar_cambio). */
export const solicitarCambio = (tipo: TipoSolicitud, objetivo: string, datos: Record<string, unknown>, motivo: string) =>
  rpc<string>('solicitar_cambio', { p_tipo: tipo, p_objetivo: objetivo, p_datos: datos, p_motivo: motivo })

export const resolverSolicitud = (id: string, aprobar: boolean, comentario: string | null) =>
  rpc<void>('resolver_solicitud', { p_id: id, p_aprobar: aprobar, p_comentario: comentario })

/** ¿Ya hay una solicitud de este tipo esperando respuesta sobre este borrador o formato? */
export async function hayPendiente(tipo: TipoSolicitud, objetivo: string): Promise<boolean> {
  const { count } = await db().from('solicitudes_cambio').select('id', { count: 'exact', head: true }).eq('tipo', tipo).eq('objetivo_id', objetivo).eq('estado', 'pendiente')
  return (count ?? 0) > 0
}

export const marcarSolicitudVista =(id: string) => rpc<void>('marcar_solicitud_vista', { p_id: id })

/**
 * Aprobar una corrección: primero se aplica con la ruta de siempre (el servidor valida con el motor de reglas y la corrección queda hecha por
 * quien aprueba, con el motivo del gestor) y después se aprueba la solicitud. Si la validación falla, la solicitud sigue pendiente.
 */
export async function aprobarSolicitud(s: Solicitud, comentario: string | null) {
  if (s.tipo === 'corregir_inspeccion') {
    const d = s.datos as { edicion: number; respuestas: Record<string, never>; filas?: Record<string, never[]>; observacion?: string | null }
    await corregirInspeccion({ id: s.objetivo_id, edicion: d.edicion, motivo: s.motivo, respuestas: d.respuestas, filas: d.filas ?? {}, observacion: d.observacion ?? null })
  }
  await resolverSolicitud(s.id, true, comentario)
}

/** Cuántas cosas esperan a esta cuenta: por resolver y comunicaciones sin ver (administrador), respuestas sin leer (gestor). */
export async function contarSolicitudes(cuenta: string, resuelve: boolean): Promise<number> {
  const mias = db().from('solicitudes_cambio').select('id', { count: 'exact', head: true }).eq('solicitado_por', cuenta).in('estado', ['aprobada', 'denegada']).eq('visto_solicitante', false)
  const [m, p, c] = await Promise.all([
    mias,
    resuelve ? db().from('solicitudes_cambio').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').neq('solicitado_por', cuenta) : Promise.resolve({ count: 0 }),
    resuelve ? db().from('solicitudes_cambio').select('id', { count: 'exact', head: true }).eq('estado', 'comunicada').not('vistos', 'cs', `{${cuenta}}`) : Promise.resolve({ count: 0 }),
  ])
  return (m.count ?? 0) + (p.count ?? 0) + (c.count ?? 0)
}
