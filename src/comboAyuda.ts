export type OpcionCombo = { id: string; texto: string; detalle?: string }

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Opciones que se parecen a lo escrito: primero las que empiezan igual, luego las que lo contienen (sin importar mayúsculas ni tildes). */
export function filtrarOpciones(opciones: OpcionCombo[], escrito: string, maximo = 30): OpcionCombo[] {
  const q = sinTildes(escrito)
  if (!q) return opciones.slice(0, maximo)
  const palabras = q.split(/\s+/)
  const con = opciones.map((o) => ({ o, t: sinTildes(`${o.texto} ${o.detalle ?? ''}`), t0: sinTildes(o.texto) })).filter((x) => palabras.every((p) => x.t.includes(p)))
  con.sort((a, b) => Number(b.t0.startsWith(q)) - Number(a.t0.startsWith(q)) || a.t0.localeCompare(b.t0, 'es'))
  return con.slice(0, maximo).map((x) => x.o)
}

