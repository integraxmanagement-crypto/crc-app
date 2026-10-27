// Memoria interna del equipo para trabajar sin señal (tarea 3.4-C). Envoltorio propio sobre IndexedDB, sin librerías
// (decisión del dueño, 26/10/2026). Lo que se guarda aquí sobrevive a cerrar la app o apagar el celular.
// Almacenes:
//  · datos     → copia local de formatos, activos, listas y personas de la empresa (para llenar sin señal)
//  · borradores→ inspecciones a medio llenar (solo viven en el equipo: decisión del dueño)
//  · cola      → inspecciones cerradas que esperan enviarse al servidor
//  · archivos  → fotos y firmas (y el Excel de cada formato), como archivos
// Todo lleva la cuenta de su dueño: si otra persona ingresa en el mismo equipo, no ve ni envía lo ajeno.

const NOMBRE = 'crc-campo'
const VERSION = 1
export type Almacen = 'datos' | 'borradores' | 'cola' | 'archivos'

let abierta: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  abierta ??= new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(NOMBRE, VERSION)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      for (const a of ['datos', 'borradores', 'cola', 'archivos'] as Almacen[])
        if (!db.objectStoreNames.contains(a)) db.createObjectStore(a, { keyPath: 'id' })
    }
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => {
      abierta = null
      rechazar(new Error('Este equipo no permite guardar datos de la app (memoria interna no disponible).'))
    }
  })
  return abierta
}

function hacer<T>(almacen: Almacen, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolver, rechazar) => {
        const t = db.transaction(almacen, modo)
        let pedido: IDBRequest | void
        try {
          pedido = fn(t.objectStore(almacen))
        } catch (e) {
          rechazar(e)
          return
        }
        t.oncomplete = () => resolver((pedido ? pedido.result : undefined) as T)
        t.onerror = () => rechazar(t.error ?? new Error('No se pudo guardar en el equipo.'))
        t.onabort = () => rechazar(t.error ?? new Error('No se pudo guardar en el equipo (¿falta espacio?).'))
      }),
  )
}

export const leer = <T>(almacen: Almacen, id: string) => hacer<T | undefined>(almacen, 'readonly', (s) => s.get(id))
export const guardar = <T extends { id: string }>(almacen: Almacen, valor: T) => hacer<void>(almacen, 'readwrite', (s) => void s.put(valor))
export const borrar = (almacen: Almacen, id: string) => hacer<void>(almacen, 'readwrite', (s) => void s.delete(id))
export const todos = <T>(almacen: Almacen) => hacer<T[]>(almacen, 'readonly', (s) => s.getAll())

/** Pide al navegador que no borre la memoria de la app aunque falte espacio. Devuelve si lo concedió. */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}

/** Espacio usado y disponible en el equipo (aproximado), para avisar si se está llenando. */
export async function espacioEquipo(): Promise<{ usado: number; total: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    return e?.quota ? { usado: e.usage ?? 0, total: e.quota } : null
  } catch {
    return null
  }
}
