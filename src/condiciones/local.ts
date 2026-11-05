// Gestión de condiciones sin señal (pedido del dueño, 05/11/2026): copia local de la matriz de cada sede para poder verla y cargar condiciones,
// y las condiciones cargadas en el equipo que esperan enviarse. Usa el almacén «datos» de la memoria interna (con un prefijo propio) y el
// almacén «archivos» para las fotos. Todo lleva la cuenta de su dueño.
import { borrar, guardar, leer, todos } from '../inspecciones/almacen'
import type { Unidad } from '../usuarios/datos'
import type { Condicion } from './datos'
import type { Columna, Tarjeta } from './reglas'

export type CacheSede = {
  id: string
  cuenta: string
  sede_id: string
  guardado_en: string
  columnas: Columna[]
  tarjetas: Tarjeta[]
  filas: Condicion[]
  personas: { id: string; nombre: string }[]
  unidades: Unidad[]
  empresa_id: string
}
/** Una condición cargada en este equipo que todavía no llegó al servidor. Sin señal siempre aparece como borrador. */
export type Pendiente = {
  id: string
  cuenta: string
  sede_id: string
  empresa_id: string
  valores: Record<string, unknown>
  /** clave de columna → identificador del archivo de la foto en el equipo */
  fotos: Record<string, string>
  creado_en: string
  error?: string
}

const idCache = (cuenta: string, sede: string) => `cond-cache:${cuenta}:${sede}`
const idPend = (id: string) => `cond-pend:${id}`
const idFoto = (id: string, clave: string) => `cond-foto:${id}:${clave}`

export const leerCache = (cuenta: string, sede: string) => leer<CacheSede>('datos', idCache(cuenta, sede)).catch(() => undefined)
export const guardarCache = (c: Omit<CacheSede, 'id'>) => guardar('datos', { ...c, id: idCache(c.cuenta, c.sede_id) }).catch(() => undefined)

export async function guardarPendiente(p: Omit<Pendiente, 'fotos'>, fotos: Record<string, Blob>) {
  const ids: Record<string, string> = {}
  for (const [clave, blob] of Object.entries(fotos)) {
    const fid = idFoto(p.id, clave)
    await guardar('archivos', { id: fid, cuenta: p.cuenta, blob })
    ids[clave] = fid
  }
  await guardar('datos', { ...p, fotos: ids, id: idPend(p.id) })
}
export async function pendientesDe(cuenta: string, sede: string): Promise<Pendiente[]> {
  try {
    return (await todos<Pendiente & { id: string }>('datos'))
      .filter((x) => x.id.startsWith('cond-pend:') && x.cuenta === cuenta && x.sede_id === sede)
      .map((x) => ({ ...x, id: x.id.slice('cond-pend:'.length) }))
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  } catch {
    return []
  }
}
export async function todosLosPendientes(cuenta: string): Promise<Pendiente[]> {
  try {
    return (await todos<Pendiente & { id: string }>('datos'))
      .filter((x) => x.id.startsWith('cond-pend:') && x.cuenta === cuenta)
      .map((x) => ({ ...x, id: x.id.slice('cond-pend:'.length) }))
  } catch {
    return []
  }
}
export async function leerFoto(id: string): Promise<Blob | null> {
  return (await leer<{ id: string; blob: Blob }>('archivos', id))?.blob ?? null
}
export async function quitarPendiente(p: Pendiente) {
  await borrar('datos', idPend(p.id))
  for (const fid of Object.values(p.fotos)) await borrar('archivos', fid)
}
export const marcarErrorPendiente = (p: Pendiente, error: string) => guardar('datos', { ...p, error, id: idPend(p.id) })
