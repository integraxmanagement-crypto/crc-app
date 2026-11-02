// Sede activa (etapa 1 del punto 2): la sede que la persona eligió en el selector de la barra. Vacío = todas sus sedes.
// Solo filtra lo que se ve en pantalla; lo que cada persona puede ver o tocar lo decide siempre la base de datos.
import { useSyncExternalStore } from 'react'

const CLAVE = 'crc.sede'
let actual = ''
try {
  actual = localStorage.getItem(CLAVE) ?? ''
} catch {
  // Sin almacenamiento: la elección vale hasta cerrar la app.
}
const oyentes = new Set<() => void>()

export const sedeActiva = () => actual

export function elegirSede(id: string) {
  if (id === actual) return
  actual = id
  try {
    if (id) localStorage.setItem(CLAVE, id)
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento.
  }
  oyentes.forEach((f) => f())
}

/** Si la sede guardada ya no es de esta cuenta (otra cuenta en el mismo equipo, o le quitaron la sede), se vuelve a «todas». */
export function validarSede(permitidas: string[]) {
  if (actual && !permitidas.includes(actual)) elegirSede('')
}

export const useSedeActiva = () => useSyncExternalStore((f) => (oyentes.add(f), () => void oyentes.delete(f)), () => actual)

/** Agrega el filtro de la sede activa a una consulta de Supabase sobre una tabla con `sede_id`. */
export function conSede<Q>(consulta: Q): Q {
  return actual ? (consulta as unknown as { eq: (columna: string, valor: string) => Q }).eq('sede_id', actual) : consulta
}
