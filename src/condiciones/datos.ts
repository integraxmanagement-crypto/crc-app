// Gestión de condiciones (05/11/2026): lectura con las reglas RLS de la sede y escritura solo con las acciones de la base de datos.
import { conLimite, db, mensaje, rpc } from '../empresas/datos'
import { solicitarCambio } from '../solicitudes/datos'
import type { Columna, Fila } from './reglas'

export type Condicion = Fila & {
  id: string
  sede_id: string
  creado_por: string
  creado_por_nombre: string
  creado_en: string
}
export type CambioColumnas =
  | { operacion: 'agregar'; nombre: string; tipo: string; opciones?: string[]; obligatoria?: boolean }
  | { operacion: 'modificar'; clave: string; nombre?: string; tipo?: string; opciones?: string[]; obligatoria?: boolean }
  | { operacion: 'ocultar' | 'mostrar' | 'eliminar'; clave: string }

async function leer<T>(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(mensaje(error))
  return data as T
}

/** Crea las columnas base de la sede si es la primera vez y devuelve la configuración. */
export async function leerColumnas(sedeId: string): Promise<Columna[]> {
  await rpc<void>('preparar_condiciones', { p_sede: sedeId })
  return leer<Columna[]>(conLimite(db().from('condiciones_columnas').select('id, clave, nombre, tipo, opciones, obligatoria, visible, orden, es_base').eq('sede_id', sedeId).order('orden')))
}
export const listarCondiciones = (sedeId: string) =>
  leer<Condicion[]>(conLimite(db().from('condiciones').select('id, sede_id, fecha_hallazgo, fecha_programada, fecha_cierre, datos, creado_por, creado_por_nombre, creado_en').eq('sede_id', sedeId).order('fecha_hallazgo', { ascending: false }).order('creado_en', { ascending: false }).limit(1000)))
export const personasDeSede = (sedeId: string) => rpc<{ id: string; nombre: string }[]>('personas_de_sede', { p_sede: sedeId })

export const guardarCondicion = (id: string, sedeId: string, datos: Record<string, unknown>) => rpc<string>('guardar_condicion', { p_id: id, p_sede: sedeId, p_datos: datos })

/** Sube la foto de evidencia al almacén privado «condiciones» (necesita señal). Devuelve la ruta para guardarla en la condición. */
export async function subirFotoCondicion(empresaId: string, condicionId: string, foto: Blob): Promise<string> {
  const ruta = `${empresaId}/${condicionId}-${crypto.randomUUID().slice(0, 8)}.jpg`
  const { error } = await db().storage.from('condiciones').upload(ruta, foto, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(mensaje(error))
  return ruta
}
/** Enlace temporal (10 minutos) para ver una foto de condición. */
export async function enlaceFotoCondicion(ruta: string) {
  const { data, error } = await db().storage.from('condiciones').createSignedUrl(ruta, 600)
  if (error) throw new Error(mensaje(error))
  return data.signedUrl
}

/** El administrador cambia las columnas directo. */
export const cambiarColumnas = (sedeId: string, cambio: CambioColumnas) => rpc<void>('cambiar_columnas_condiciones', { p_sede: sedeId, p_cambio: cambio })
/** El gestor propone el cambio; un administrador lo aprueba o lo deniega desde «Solicitudes». */
export const proponerCambioColumnas = (sedeId: string, cambio: CambioColumnas, motivo: string) => solicitarCambio('cambio_columnas_condiciones', sedeId, cambio as unknown as Record<string, unknown>, motivo)
/** ¿Ya hay una propuesta de columnas esperando respuesta en esta sede? */
export async function propuestasPendientes(sedeId: string): Promise<number> {
  const { count } = await db().from('solicitudes_cambio').select('id', { count: 'exact', head: true }).eq('tipo', 'cambio_columnas_condiciones').eq('objetivo_id', sedeId).eq('estado', 'pendiente')
  return count ?? 0
}
