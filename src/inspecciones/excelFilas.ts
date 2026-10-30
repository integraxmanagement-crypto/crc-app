// Filas que se repiten en el Excel de la organización según lo que hay en la inspección (pedido del dueño, 29/10/2026):
// si se encontró una sola condición insegura, sale una sola fila; si fueron tres, tres; si no hubo, una sola que dice
// «Sin observaciones». Igual con los firmantes: un nombre, una fila; dos, dos filas.
//
// En el Excel se dibuja UNA fila modelo con las marcas de la primera fila ({{IPF-C01#1}}, {{foto.IPF-C03#1}},
// {{firma.inspectores.nombre}}…) y, si se quiere, {{#}} para el número de orden (1, 2, 3…). CRC la repite las veces que
// hagan falta y corre hacia abajo todo lo que sigue (celdas combinadas, área de impresión, imágenes). Las filas del
// formato que traían las marcas de la segunda en adelante ({{IPF-C01#2}}…) se quitan: se vuelven a armar desde el modelo.
// Una fila con marcas de más de un grupo (por ejemplo, tres firmantes de distinto rol lado a lado) no se repite.
import { escaparXml, textoDe } from '../carga/xlsx.ts'
import type { Parte } from './excel.ts'

export type Grupos = {
  grupoDe: (marca: string) => { grupo: string; n: number } | null // a qué grupo repetible pertenece una marca y su número de fila
  cuantas: (grupo: string) => number // filas que hay que dibujar (mínimo una)
  reescribir: (marca: string, k: number) => string // la marca de la fila k (1, 2, 3…)
}

const MARCA = /\{\{\s*([^{}]+?)\s*\}\}/g
const RE_FILA = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
const RE_CELDA = /<c\b([^>]*?)(\/>|>[\s\S]*?<\/c>)/g

const atributo = (attrs: string, nombre: string) => attrs.match(new RegExp(`\\s${nombre}="([^"]*)"`))?.[1] ?? null
const hoja = (nombre: string) => /^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)

type Celda = { attrs: string; fin: string; texto: string | null } // texto: null si no es de texto
type FilaXml = { n: number; attrs: string; celdas: Celda[] }

function leerCelda(attrs: string, resto: string, compartidos: string[]): Celda {
  const t = atributo(attrs, 't')
  let texto: string | null = null
  if (t === 'inlineStr') texto = textoDe(resto)
  else if (t === 's') texto = compartidos[Number(resto.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? ''
  return { attrs, fin: resto, texto }
}

/** Marcas de una fila por grupo: Map(grupo → números de fila que aparecen). */
function gruposDeFila(f: FilaXml, grupos: Grupos) {
  const salida = new Map<string, number[]>()
  for (const c of f.celdas)
    for (const [, m] of (c.texto ?? '').matchAll(MARCA)) {
      const g = grupos.grupoDe(m)
      if (g) salida.set(g.grupo, [...(salida.get(g.grupo) ?? []), g.n])
    }
  return salida
}

const celdaEn = (c: Celda, r: number) => c.attrs.replace(/(\sr=")[A-Z]+\d+"/, (_, a: string) => `${a}${(atributo(c.attrs, 'r') ?? '').replace(/\d+$/, String(r))}"`)

function textoFila(f: FilaXml, n: number, grupos: Grupos, k: number) {
  const celdas = f.celdas.map((c) => {
    const attrs = celdaEn(c, n)
    if (c.texto == null) return `<c${attrs}${c.fin}`
    // El texto (compartido o escrito en la celda) se escribe en la celda, ya con las marcas de la fila k.
    const texto = c.texto.replace(MARCA, (_, m: string) => (m === '#' ? String(k) : `{{${grupos.reescribir(m, k)}}}`))
    const sinTipo = attrs.replace(/\st="[^"]*"/, '')
    return `<c${sinTipo} t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`
  })
  return `<row${f.attrs.replace(/(\sr=")\d+"/, `$1${n}"`)}>${celdas.join('')}</row>`
}

/** Cambia en una referencia (A21, $B$30, A21:C40) las filas con la función dada. */
const mapearRefs = (texto: string, f: (fila: number) => number) =>
  texto.replace(/(\$?[A-Z]{1,3}\$?)(\d+)\b/g, (_, col: string, fila: string) => `${col}${f(Number(fila))}`)

/**
 * Repite las filas modelo del Excel (ver arriba). Devuelve las mismas partes con las hojas cambiadas; si ninguna hoja
 * tiene filas modelo, devuelve la lista tal cual.
 */
export function repetirFilas(lista: Parte[], grupos: Grupos): Parte[] {
  const dec = (p: Parte) => new TextDecoder().decode(p.bytes)
  const compartidos = [...dec(lista.find((p) => p.nombre === 'xl/sharedStrings.xml') ?? { nombre: '', bytes: new Uint8Array() }).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, d]) => textoDe(d))
  const nuevas = new Map<string, string>()
  const desplazos = new Map<string, (fila: number) => number>()

  for (const p of lista.filter((x) => hoja(x.nombre))) {
    const xml = dec(p)
    const datos = xml.match(/<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/)
    if (!datos?.[1]) continue
    const filas: FilaXml[] = [...datos[1].matchAll(RE_FILA)].map(([, attrs, dentro]) => ({
      n: Number(atributo(attrs, 'r')),
      attrs,
      celdas: [...(dentro ?? '').matchAll(RE_CELDA)].map(([, a, resto]) => leerCelda(a, resto, compartidos)),
    }))
    // Qué filas son modelo (todas las marcas de un solo grupo y de la fila 1) y cuáles sobran (solo de la 2 en adelante).
    const modelo = new Map<number, string>()
    const modeloDe = new Set<string>()
    const sobran = new Map<number, string>()
    for (const f of filas) {
      const g = gruposDeFila(f, grupos)
      if (g.size !== 1) continue
      const [grupo, ns] = [...g.entries()][0]
      if (ns.every((n) => n === 1)) {
        modelo.set(f.n, grupo)
        modeloDe.add(grupo)
      } else if (ns.every((n) => n >= 2)) sobran.set(f.n, grupo)
    }
    for (const [n, g] of [...sobran]) if (!modeloDe.has(g)) sobran.delete(n)
    if (!modelo.size && !sobran.size) continue

    const copias = new Map([...modelo].map(([n, g]) => [n, Math.max(1, grupos.cuantas(g))]))
    // Corrimiento de las filas que siguen: cada modelo agrega (copias − 1) y cada fila sobrante resta una.
    const corrimiento = (fila: number) => {
      let d = 0
      for (const [n, c] of copias) if (n < fila) d += c - 1
      for (const n of sobran.keys()) if (n < fila) d -= 1
      return d
    }
    const nuevaFila = (n: number) => n + corrimiento(n)
    desplazos.set(p.nombre, nuevaFila)

    const cuerpoFinal: string[] = []
    for (const f of filas) {
      if (sobran.has(f.n)) continue
      if (!modelo.has(f.n)) {
        const n = nuevaFila(f.n)
        cuerpoFinal.push(`<row${f.attrs.replace(/(\sr=")\d+"/, `$1${n}"`)}>${f.celdas.map((c) => `<c${celdaEn(c, n)}${c.fin}`).join('')}</row>`)
        continue
      }
      for (let k = 1; k <= copias.get(f.n)!; k++) cuerpoFinal.push(textoFila(f, nuevaFila(f.n) + k - 1, grupos, k))
    }

    let nuevo = xml.replace(/<sheetData\b[^>]*?(?:\/>|>[\s\S]*?<\/sheetData>)/, () => `<sheetData>${cuerpoFinal.join('')}</sheetData>`)

    // Celdas combinadas: las de una fila modelo se repiten; las de filas sobrantes se quitan; las demás se corren.
    const todas = [...nuevo.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/g)]
    const combinadas: string[] = []
    for (const [, c1, f1, c2, f2] of todas) {
      const a = Number(f1), b = Number(f2)
      if (a === b && sobran.has(a)) continue
      if (a === b && modelo.has(a)) {
        for (let k = 0; k < copias.get(a)!; k++) combinadas.push(`${c1}${nuevaFila(a) + k}:${c2}${nuevaFila(a) + k}`)
        continue
      }
      combinadas.push(`${c1}${nuevaFila(a)}:${c2}${nuevaFila(b)}`)
    }
    const celdasCombinadas = combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')
    nuevo = /<mergeCells\b/.test(nuevo)
      ? nuevo.replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, () => `<mergeCells count="${combinadas.length}">${celdasCombinadas}</mergeCells>`)
      : nuevo
    nuevo = nuevo
      .replace(/(<dimension ref=")([^"]+)(")/, (_, a, ref: string, b) => `${a}${mapearRefs(ref, nuevaFila)}${b}`)
      .replace(/(\ssqref=")([^"]+)(")/g, (_, a, ref: string, b) => `${a}${mapearRefs(ref, nuevaFila)}${b}`)
      .replace(/(<hyperlink\b[^>]*\sref=")([^"]+)(")/g, (_, a, ref: string, b) => `${a}${mapearRefs(ref, nuevaFila)}${b}`)
    nuevas.set(p.nombre, nuevo)
  }
  if (!nuevas.size) return lista

  // Imágenes ya dibujadas en la hoja (logo, sellos): las que están debajo de una fila repetida se corren igual.
  for (const [nombreHoja, nuevaFila] of desplazos) {
    const rels = lista.find((x) => x.nombre === nombreHoja.replace('worksheets/', 'worksheets/_rels/') + '.rels')
    if (!rels) continue
    for (const m of dec(rels).matchAll(/Type="[^"]*\/drawing"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/drawing"/g)) {
      const nombre = `xl/${(m[1] ?? m[2]).replace(/^\.\.\//, '')}`
      const d = lista.find((x) => x.nombre === nombre)
      if (d) nuevas.set(nombre, dec(d).replace(/<xdr:row>(\d+)<\/xdr:row>/g, (_, f: string) => `<xdr:row>${nuevaFila(Number(f) + 1) - 1}</xdr:row>`))
    }
  }
  // Área de impresión y nombres definidos (solo si el libro tiene una hoja cambiada y los nombres la mencionan).
  const libro = lista.find((x) => x.nombre === 'xl/workbook.xml')
  if (libro && desplazos.size === 1) {
    const [nuevaFila] = [...desplazos.values()]
    nuevas.set('xl/workbook.xml', dec(libro).replace(/(<definedName\b[^>]*>)([\s\S]*?)(<\/definedName>)/g, (_, a, dentro: string, b) => `${a}${mapearRefs(dentro, nuevaFila)}${b}`))
  }
  return lista.map((p) => (nuevas.has(p.nombre) ? { nombre: p.nombre, bytes: new TextEncoder().encode(nuevas.get(p.nombre)!) } : p))
}
