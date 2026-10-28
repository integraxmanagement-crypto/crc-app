// Numeración automática del programa anual (tarea 3.4-E, D-41): no se escribe ni se guarda, se calcula del orden.
// Objetivo específico 1 → sección 1.1 → actividad 1.1.1. Si se mueve o se da de baja algo, los números se recalculan
// solos: nunca se saltan ni se repiten (los errores del Excel de referencia no pueden pasar).

export type TipoNodo = 'objetivo_general' | 'objetivo_especifico' | 'seccion' | 'actividad'
export type NodoBase = { id: string; padre_id: string | null; tipo: TipoNodo; orden: number; vigente: boolean }
export type NodoNumerado<T extends NodoBase> = T & { numero: string; nivel: number }

/** Los elementos vigentes en orden de lectura (padre antes que sus hijos), cada uno con su número y su nivel. */
export function numerar<T extends NodoBase>(nodos: T[]): NodoNumerado<T>[] {
  const vigentes = nodos.filter((n) => n.vigente)
  const hijos = new Map<string | null, T[]>()
  for (const n of vigentes) hijos.set(n.padre_id, [...(hijos.get(n.padre_id) ?? []), n])
  for (const lista of hijos.values()) lista.sort((a, b) => a.orden - b.orden)
  const salida: NodoNumerado<T>[] = []
  const recorrer = (padre: string | null, prefijo: string, nivel: number) => {
    ;(hijos.get(padre) ?? []).forEach((n, k) => {
      const numero = n.tipo === 'objetivo_general' ? '' : prefijo ? `${prefijo}.${k + 1}` : String(k + 1)
      salida.push({ ...n, numero, nivel })
      recorrer(n.id, numero, nivel + 1)
    })
  }
  recorrer(null, '', 0)
  return salida
}
