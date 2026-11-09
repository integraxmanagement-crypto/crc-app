// Subsecciones de las inspecciones (pedido del dueño, 09/11/2026): Seguridad, Respuesta a emergencias y Salud.
// Cada formato cae en una subsección por su nombre; motobomba y electrobomba van juntas en un solo ítem, «Inspección de bomba».
import { esBombaIncendio } from './BombasIncendio'

export type Categoria = 'seguridad' | 'emergencias' | 'salud' | 'otras'

export const CATEGORIAS: { clave: Categoria; nombre: string; vacio: string }[] = [
  { clave: 'seguridad', nombre: 'Seguridad', vacio: 'Todavía no hay inspecciones de seguridad.' },
  { clave: 'emergencias', nombre: 'Respuesta a emergencias', vacio: 'Todavía no hay inspecciones de respuesta a emergencias.' },
  { clave: 'salud', nombre: 'Salud', vacio: 'Todavía no hay inspecciones de salud. Se irán agregando.' },
  { clave: 'otras', nombre: 'Otras inspecciones', vacio: '' },
]

/** La subsección de un formato, por su nombre: IPF y LOTO son de seguridad; caseta, extintores, DACI y bomba, de respuesta a emergencias. */
export function categoriaDe(nombre: string): Categoria {
  if (/seguridad ocupacional|\(IPF\)|bloqueo|\(LOTO\)/i.test(nombre)) return 'seguridad'
  if (/caseta|extintor|DACI|alarma contra incendio|bomba/i.test(nombre)) return 'emergencias'
  if (/salud|ergonom|ocupacional.*salud/i.test(nombre)) return 'salud'
  return 'otras'
}

export type ItemTipo = { id: string; nombre: string }

/** Los formatos agrupados por subsección, con motobomba y electrobomba juntas como «Inspección de bomba» (id «bombas»). */
export function agruparPorCategoria(formatos: ItemTipo[]): { categoria: (typeof CATEGORIAS)[number]; items: ItemTipo[] }[] {
  const sueltos = formatos.filter((f) => !esBombaIncendio(f.nombre))
  const items = [...sueltos, ...(formatos.some((f) => esBombaIncendio(f.nombre)) ? [{ id: 'bombas', nombre: 'Inspección de bomba' }] : [])]
  items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return CATEGORIAS.map((categoria) => ({ categoria, items: items.filter((f) => categoriaDe(f.nombre) === categoria.clave) }))
    .filter((g) => g.categoria.clave !== 'otras' || g.items.length > 0)
}
