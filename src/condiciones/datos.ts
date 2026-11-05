// Gestión de condiciones (05/11/2026): lectura con las reglas RLS de la sede y escritura solo con las acciones de la base de datos.
import { SIN_RESPUESTA, conLimite, db, mensaje, rpc } from '../empresas/datos'
import { solicitarCambio } from '../solicitudes/datos'
import type { Columna, Fila, Tarjeta } from './reglas'
import { type Pendiente, leerFoto, marcarErrorPendiente, quitarPendiente, todosLosPendientes } from './local'

export type Condicion = Fila & {
  id: string
  sede_id: string
  creado_por: string
  creado_por_nombre: string
  creado_en: string
  borrador: boolean
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
  leer<Condicion[]>(conLimite(db().from('condiciones').select('id, sede_id, fecha_hallazgo, fecha_programada, fecha_cierre, datos, creado_por, creado_por_nombre, creado_en, borrador').eq('sede_id', sedeId).order('fecha_hallazgo', { ascending: false }).order('creado_en', { ascending: false }).limit(1000)))
export const personasDeSede = (sedeId: string) => rpc<{ id: string; nombre: string }[]>('personas_de_sede', { p_sede: sedeId })

export const guardarCondicion = (id: string, sedeId: string, datos: Record<string, unknown>, borrador = false) =>
  rpc<string>('guardar_condicion', { p_id: id, p_sede: sedeId, p_datos: datos, p_borrador: borrador })

/** Pone la fecha de cierre de una condición ya completa. */
export const validarCierre = (id: string, fecha: string) => rpc<void>('validar_cierre_condicion', { p_id: id, p_fecha: fecha })

export const leerTarjetas = (sedeId: string) =>
  leer<Tarjeta[]>(conLimite(db().from('condiciones_tarjetas').select('id, sede_id, titulo, columna, operador, valor, fija, orden').eq('sede_id', sedeId).order('orden')))
export const guardarTarjeta = (sedeId: string, id: string | null, t: { titulo: string; columna: string; operador: string; valor: string | null }) =>
  rpc<string>('guardar_tarjeta_condicion', { p_sede: sedeId, p_id: id, p_titulo: t.titulo, p_columna: t.columna, p_operador: t.operador, p_valor: t.valor })
export const quitarTarjeta = (id: string) => rpc<void>('quitar_tarjeta_condicion', { p_id: id })

/** ¿Es un fallo de señal (conviene reintentar luego) y no un rechazo del servidor? */
export const esFalloDeRed = (e: unknown) => !navigator.onLine || (e as Error)?.message === SIN_RESPUESTA

/**
 * Envía las condiciones cargadas en este equipo. Las completas quedan grabadas; las incompletas quedan como borrador en el servidor.
 * Se detiene al primer fallo de señal; un rechazo del servidor deja la condición en el equipo con su motivo.
 */
export async function enviarPendientes(cuenta: string): Promise<{ enviadas: number; rechazadas: number }> {
  let enviadas = 0, rechazadas = 0
  for (const p of await todosLosPendientes(cuenta)) {
    try {
      const valores = { ...p.valores }
      for (const [clave, fid] of Object.entries(p.fotos)) {
        const blob = await leerFoto(fid)
        if (blob) valores[clave] = await subirFotoCondicion(p.empresa_id, p.id, blob)
      }
      await guardarCondicion(p.id, p.sede_id, valores, true)
      await quitarPendiente(p)
      enviadas++
    } catch (e) {
      if (esFalloDeRed(e)) break
      rechazadas++
      await marcarErrorPendiente(p as Pendiente, (e as Error).message)
    }
  }
  return { enviadas, rechazadas }
}

/** Sube la foto de evidencia al almacén privado «condiciones» (necesita señal). Devuelve la ruta para guardarla en la condición. */
export async function subirFotoCondicion(empresaId: string, condicionId: string, foto: Blob): Promise<string> {
  const ruta = `${empresaId}/${condicionId}-${crypto.randomUUID().slice(0, 8)}.jpg`
  const { error } = await db().storage.from('condiciones').upload(ruta, foto, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(mensaje(error))
  return ruta
}
/** Enlace temporal (10 minutos) para ver una foto de condición. */
export async function enlaceFotoCondicion(ruta: string) {
  // Las fotos que vienen de una inspección (IPF) siguen en el almacén de evidencias.
  const desdeInspeccion = ruta.startsWith('evidencias:')
  const { data, error } = await db().storage.from(desdeInspeccion ? 'evidencias' : 'condiciones').createSignedUrl(desdeInspeccion ? ruta.slice('evidencias:'.length) : ruta, 600)
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

/** Una condición abierta de la matriz, tal como se trae al IPF. */
export type CondicionAbierta = {
  id: string
  fecha_hallazgo: string
  peligro: string | null
  riesgo: string | null
  plan_accion: string | null
  responsable: string | null
  fecha_programada: string | null
  evidencia: string | null
  area: string | null
  ubicacion: string | null
  estado: 'pendiente' | 'atrasado'
}
/** Condiciones pendientes o atrasadas, a la fecha de la inspección, de un área (y ubicación si se da). Lo puede pedir quien registra inspecciones. */
export const condicionesAbiertasIpf = (sedeId: string, fecha: string, unidadId: string | null, ubicacionId: string | null) =>
  rpc<CondicionAbierta[]>('condiciones_abiertas_ipf', { p_sede: sedeId, p_fecha: fecha, p_unidad: unidadId, p_ubicacion: ubicacionId })
