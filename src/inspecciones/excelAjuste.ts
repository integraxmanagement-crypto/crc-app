// Ajuste de las celdas llenas del Excel de la organización (pedido del dueño, 29/10/2026): si el texto que se escribe no
// cabe en la celda, la celda se ajusta (el texto pasa a varias líneas y la fila crece) en vez de salir recortado.
// Solo se tocan las celdas que tenían una marca {{…}}; lo demás del formato queda igual. Las filas nunca se achican.
// El tamaño del texto se calcula de forma aproximada (ancho medio de una letra según su fuente), con un poco de holgura.
import { textoDe } from '../carga/xlsx.ts'
import type { Parte } from './excel.ts'

const MARCA = /\{\{\s*[^{}]+?\s*\}\}/
const hoja = (nombre: string) => /^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)
const attr = (t: string, n: string) => t.match(new RegExp(`\\s${n}="([^"]*)"`))?.[1] ?? null
const columna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
const dec = (p?: Parte) => (p ? new TextDecoder().decode(p.bytes) : '')

/** Referencias de las celdas con marcas, por hoja (se leen antes de llenar el Excel). */
export function celdasConMarcas(lista: Parte[]): Map<string, Set<string>> {
  const compartidos = [...dec(lista.find((p) => p.nombre === 'xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]))
  const salida = new Map<string, Set<string>>()
  for (const p of lista.filter((x) => hoja(x.nombre))) {
    const refs = new Set<string>()
    for (const [, a, resto] of dec(p).matchAll(/<c\b([^>]*?)(\/>|>[\s\S]*?<\/c>)/g)) {
      const t = attr(a, 't')
      const texto = t === 'inlineStr' ? textoDe(resto) : t === 's' ? (compartidos[Number(resto.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? '') : ''
      if (MARCA.test(texto)) refs.add(attr(a, 'r') ?? '')
    }
    salida.set(p.nombre, refs)
  }
  return salida
}

type Letra = { pt: number; negrita: boolean; ancho: number } // ancho medio de una letra, en píxeles

function leerEstilos(xml: string) {
  const fuentes = [...(xml.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? '').matchAll(/<font\b[^>]*?(?:\/>|>[\s\S]*?<\/font>)/g)].map(([f]) => {
    const pt = Number(f.match(/<sz\b[^>]*\sval="([\d.]+)"/)?.[1] ?? 11)
    const negrita = /<b\b(?![^>]*val="(?:0|false)")/.test(f)
    const arial = /<name\b[^>]*\sval="(?:Arial|Verdana|Tahoma)/i.test(f)
    return { pt, negrita, ancho: pt * (96 / 72) * (arial ? 0.56 : 0.52) * (negrita ? 1.08 : 1) } satisfies Letra
  })
  const bloque = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  const xfs = [...(bloque?.[1] ?? '').matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(([x]) => x)
  return { fuentes, xfs, hay: Boolean(bloque) }
}

/** Una copia del formato de celda `s` con el ajuste de texto activado (se agrega al final y se reutiliza). */
function conAjuste(xfs: string[], s: number, ya: Map<number, number>) {
  const hecho = ya.get(s)
  if (hecho != null) return hecho
  let x = xfs[s] ?? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  if (/<alignment\b/.test(x)) x = x.replace(/<alignment\b([^>]*?)(\/?)>/, (_, a: string, c: string) => `<alignment${/\swrapText=/.test(a) ? a.replace(/(\swrapText=")[^"]*"/, '$11"') : `${a} wrapText="1"`}${c}>`)
  else if (/\/>$/.test(x)) x = x.replace(/\/>$/, '><alignment wrapText="1"/></xf>')
  else x = x.replace(/<\/xf>$/, '<alignment wrapText="1"/></xf>')
  x = /\sapplyAlignment=/.test(x) ? x.replace(/(\sapplyAlignment=")[^"]*"/, '$11"') : x.replace(/^<xf\b/, '<xf applyAlignment="1"')
  xfs.push(x)
  ya.set(s, xfs.length - 1)
  return xfs.length - 1
}

/** Líneas que ocupa un texto en un ancho dado (corta por palabras, como lo hace Excel). */
function lineas(texto: string, anchoPx: number, letra: number) {
  const porLinea = Math.max(1, Math.floor(anchoPx / letra))
  let total = 0
  for (const parrafo of texto.split(/\r?\n/)) {
    let actual = 0
    let n = 1
    for (const palabra of parrafo.split(/ +/)) {
      let largo = palabra.length
      if (actual > 0 && actual + 1 + largo > porLinea) {
        n++
        actual = 0
      }
      while (largo > porLinea) {
        n++
        largo -= porLinea
      }
      actual += (actual > 0 ? 1 : 0) + largo
    }
    total += n
  }
  return total
}

/** Ajusta las celdas llenas que tenían marcas: texto en varias líneas y filas más altas cuando hace falta. */
export function ajustarCeldas(lista: Parte[], marcadas: Map<string, Set<string>>): Parte[] {
  const stylesParte = lista.find((p) => p.nombre === 'xl/styles.xml')
  if (!stylesParte) return lista
  const estilosXml = dec(stylesParte)
  const { fuentes, xfs, hay } = leerEstilos(estilosXml)
  if (!hay) return lista
  const compartidos = [...dec(lista.find((p) => p.nombre === 'xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]))
  const nuevos = new Map<string, string>()
  const ya = new Map<number, number>()
  const xfsOriginales = xfs.length

  for (const p of lista.filter((x) => hoja(x.nombre))) {
    const refs = marcadas.get(p.nombre)
    if (!refs?.size) continue
    let xml = dec(p)
    const formato = xml.match(/<sheetFormatPr\b[^>]*\/?>/)?.[0] ?? ''
    const anchoBase = Number(attr(formato, 'defaultColWidth') ?? Number(attr(formato, 'baseColWidth') ?? 8) + 0.71)
    const altoBase = Number(attr(formato, 'defaultRowHeight') ?? 15)
    const cols = [...xml.matchAll(/<col\b[^>]*\/>/g)].map((m) => ({ d: Number(attr(m[0], 'min')) - 1, h: Number(attr(m[0], 'max')) - 1, w: Number(attr(m[0], 'width') ?? anchoBase) }))
    const ancho = (c: number) => Math.round((cols.find((x) => c >= x.d && c <= x.h)?.w ?? anchoBase) * 7 + 5)
    const altos = new Map([...xml.matchAll(/<row\b[^>]*>/g)].map((m) => [Number(attr(m[0], 'r')) - 1, Number(attr(m[0], 'ht') ?? altoBase)]))
    const combinadas = [...xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map((m) => ({ c1: columna(m[1]), r1: Number(m[2]) - 1, c2: columna(m[3]), r2: Number(m[4]) - 1 }))
    const nuevoAlto = new Map<number, number>()
    const ajustes = new Map<string, number>() // celda → formato nuevo

    xml = xml.replace(/<c\b([^>]*?)(\/>|>[\s\S]*?<\/c>)/g, (todo, a: string, resto: string) => {
      const ref = attr(a, 'r') ?? ''
      if (!refs.has(ref)) return todo
      const t = attr(a, 't')
      const texto = (t === 'inlineStr' ? textoDe(resto) : t === 's' ? (compartidos[Number(resto.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? '') : '').trim()
      if (!texto) return todo
      const m = ref.match(/^([A-Z]+)(\d+)$/)
      if (!m) return todo
      const c = columna(m[1]), r = Number(m[2]) - 1
      const bloque = combinadas.find((x) => c >= x.c1 && c <= x.c2 && r >= x.r1 && r <= x.r2) ?? { c1: c, r1: r, c2: c, r2: r }
      let anchoPx = 0
      for (let i = bloque.c1; i <= bloque.c2; i++) anchoPx += ancho(i)
      let altoPt = 0
      for (let i = bloque.r1; i <= bloque.r2; i++) altoPt += nuevoAlto.get(i) ?? altos.get(i) ?? altoBase
      const s = Number(attr(a, 's') ?? 0)
      const letra = fuentes[Number(attr(xfs[s] ?? '', 'fontId') ?? 0)] ?? fuentes[0] ?? { pt: 11, negrita: false, ancho: 7 }
      const n = lineas(texto, anchoPx - 8, letra.ancho)
      if (n <= 1) return todo
      const necesario = Math.ceil(n * letra.pt * 1.28 + 4)
      if (necesario > altoPt) nuevoAlto.set(bloque.r2, (nuevoAlto.get(bloque.r2) ?? altos.get(bloque.r2) ?? altoBase) + (necesario - altoPt))
      if (!ajustes.has(ref)) ajustes.set(ref, conAjuste(xfs, s, ya))
      return `<c${/\ss="/.test(a) ? a.replace(/(\ss=")\d+"/, `$1${ajustes.get(ref)}"`) : `${a} s="${ajustes.get(ref)}"`}${resto}`
    })

    if (nuevoAlto.size)
      xml = xml.replace(/<row\b([^>]*?)(\/?>)/g, (todo, a: string, fin: string) => {
        const alto = nuevoAlto.get(Number(attr(a, 'r')) - 1)
        if (alto == null) return todo
        const sinAlto = a.replace(/\sht="[^"]*"/, '').replace(/\scustomHeight="[^"]*"/, '')
        return `<row${sinAlto} ht="${Math.round(alto * 100) / 100}" customHeight="1"${fin}`
      })
    nuevos.set(p.nombre, xml)
  }
  if (!nuevos.size) return lista

  if (xfs.length > xfsOriginales) {
    nuevos.set('xl/styles.xml', estilosXml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/, () => `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`))
  }
  return lista.map((p) => (nuevos.has(p.nombre) ? { nombre: p.nombre, bytes: new TextEncoder().encode(nuevos.get(p.nombre)!) } : p))
}

