// PDF idéntico al Excel de la organización (revisión del formato LOTO, 29/10/2026: decisión del dueño). El navegador no
// convierte un .xlsx a PDF, así que CRC lee la primera hoja del Excel ya lleno (con sus firmas) y la dibuja igual:
// anchos de columna, altos de fila, celdas combinadas, letras, rellenos, bordes, alineación, imágenes (logo y firmas)
// y orientación de la página. Desde ese dibujo la persona guarda el PDF con «Imprimir → Guardar como PDF».
// Lo poco común (formatos condicionales, gráficos, textos girados) no se dibuja. No usa nada propio del navegador.
import { textoDe } from '../carga/xlsx.ts'
import type { Parte } from './excel.ts'

export type Borde = { estilo: string; color: string } | null
export type Estilo = {
  negrita: boolean; cursiva: boolean; subrayado: boolean; tamano: number; fuente: string; color: string | null
  fondo: string | null; horizontal: string | null; vertical: string | null; ajustar: boolean
  izquierda: Borde; derecha: Borde; arriba: Borde; abajo: Borde
}
export type CeldaVista = { fila: number; col: number; filas: number; cols: number; texto: string; estilo: Estilo; numero: boolean }
export type ImagenVista = { x: number; y: number; ancho: number; alto: number; nombre: string }
export type VistaHoja = {
  anchos: number[] // px por columna (desde la primera del área)
  altos: number[] // px por fila
  celdas: CeldaVista[]
  imagenes: ImagenVista[] // posiciones en px desde la esquina del área
  horizontal: boolean
}

const PX_POR_PT = 96 / 72
const EMU_POR_PX = 9525
const columna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
const ref = (r: string) => {
  const m = r.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/)
  return m ? { c: columna(m[1]), r: Number(m[2]) - 1 } : null
}
const attr = (tag: string, nombre: string) => tag.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1] ?? null

// Paleta clásica de Excel para colores «indexed» (los primeros 64).
const INDEXADOS = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00',
  'FF00FF', '00FFFF', '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080',
  '0066CC', 'CCCCFF', '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC',
  'CC99FF', 'FFCC99', '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366',
  '333399', '333333']

function conTinte(hex: string, tinte: number) {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const t = c.map((v) => Math.round(tinte < 0 ? v * (1 + tinte) : v + (255 - v) * tinte))
  return t.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

function colorDe(tag: string | undefined, tema: string[]): string | null {
  if (!tag) return null
  const rgb = attr(tag, 'rgb')
  const tinte = Number(attr(tag, 'tint') ?? 0)
  let hex: string | null = null
  if (rgb) hex = rgb.slice(-6)
  else if (attr(tag, 'theme') != null) hex = tema[Number(attr(tag, 'theme'))] ?? null
  else if (attr(tag, 'indexed') != null) {
    const i = Number(attr(tag, 'indexed'))
    if (i === 64 || i === 65) return null // automático
    hex = INDEXADOS[i] ?? null
  }
  if (!hex) return null
  return `#${tinte ? conTinte(hex, tinte) : hex}`
}

function temaDe(xml: string): string[] {
  const esquema = xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/)?.[0] ?? ''
  const de = (n: string) => {
    const b = esquema.match(new RegExp(`<a:${n}>([\\s\\S]*?)</a:${n}>`))?.[1] ?? ''
    return b.match(/lastClr="([0-9A-Fa-f]{6})"/)?.[1] ?? b.match(/val="([0-9A-Fa-f]{6})"/)?.[1] ?? '000000'
  }
  // Orden de Excel: claro 1, oscuro 1, claro 2, oscuro 2, acentos 1 a 6, hipervínculos.
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(de)
}

function estilosDe(xml: string, tema: string[]): Estilo[] {
  const bloque = (n: string) => xml.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`))?.[1] ?? ''
  const fuentes = [...bloque('fonts').matchAll(/<font\b[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g)].map(([, f = '']) => ({
    negrita: /<b\s*\/>|<b\s+val="(1|true)"/.test(f), cursiva: /<i\s*\/>|<i\s+val="(1|true)"/.test(f), subrayado: /<u\b/.test(f),
    tamano: Number(f.match(/<sz val="([\d.]+)"/)?.[1] ?? 11), fuente: f.match(/<name val="([^"]+)"/)?.[1] ?? 'Calibri',
    color: colorDe(f.match(/<color\b[^>]*\/>/)?.[0], tema),
  }))
  const rellenos = [...bloque('fills').matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(([, f]) =>
    /patternType="(solid|gray\d+|darkGray|mediumGray|lightGray)"/.test(f) ? colorDe(f.match(/<fgColor\b[^>]*\/>/)?.[0], tema) : null)
  const lado = (b: string, n: string): Borde => {
    const m = b.match(new RegExp(`<${n}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${n}>)`))
    const estilo = m && attr(`<x${m[1]}>`, 'style')
    return estilo ? { estilo, color: colorDe(m[2]?.match(/<color\b[^>]*\/>/)?.[0], tema) ?? '#000000' } : null
  }
  const bordes = [...bloque('borders').matchAll(/<border\b[^>]*?(?:\/>|>([\s\S]*?)<\/border>)/g)].map(([, b = '']) => ({
    izquierda: lado(b, 'left'), derecha: lado(b, 'right'), arriba: lado(b, 'top'), abajo: lado(b, 'bottom'),
  }))
  return [...bloque('cellXfs').matchAll(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map(([, a, dentro = '']) => {
    const al = dentro.match(/<alignment\b[^>]*\/?>/)?.[0] ?? ''
    const f = fuentes[Number(attr(`<x${a}>`, 'fontId') ?? 0)] ?? fuentes[0]
    const b = bordes[Number(attr(`<x${a}>`, 'borderId') ?? 0)] ?? { izquierda: null, derecha: null, arriba: null, abajo: null }
    return {
      ...(f ?? { negrita: false, cursiva: false, subrayado: false, tamano: 11, fuente: 'Calibri', color: null }),
      fondo: rellenos[Number(attr(`<x${a}>`, 'fillId') ?? 0)] ?? null,
      horizontal: attr(al, 'horizontal'), vertical: attr(al, 'vertical'), ajustar: attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true',
      ...b,
    }
  })
}

/** Lee la primera hoja del Excel (ya lleno) y la deja lista para dibujar. medias: nombre de la parte → bytes de la imagen. */
export function vistaDeExcel(lista: Parte[]): { vista: VistaHoja; medias: Map<string, Uint8Array> } {
  const texto = (n: string) => {
    const p = lista.find((x) => x.nombre === n)
    return p ? new TextDecoder().decode(p.bytes) : ''
  }
  const libro = texto('xl/workbook.xml')
  const relsLibro = texto('xl/_rels/workbook.xml.rels')
  const primera = libro.match(/<sheet\b[^>]*\/>/)?.[0] ?? ''
  const rid = attr(primera, 'r:id')
  const destino = [...relsLibro.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => m[0]).find((t) => attr(t, 'Id') === rid)
  const hoja = destino ? new URL(attr(destino, 'Target')!, 'http://x/xl/workbook.xml').pathname.slice(1) : 'xl/worksheets/sheet1.xml'
  const xml = texto(hoja)
  const tema = temaDe(texto('xl/theme/theme1.xml'))
  const estilos = estilosDe(texto('xl/styles.xml'), tema)
  const compartidos = [...texto('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]))

  // Área a dibujar: el área de impresión si la hay; si no, todas las celdas usadas.
  const area = libro.match(/<definedName[^>]*name="_xlnm.Print_Area"[^>]*localSheetId="0"[^>]*>([^<]+)</)?.[1]
    ?? libro.match(/<definedName[^>]*name="_xlnm\.Print_Area"[^>]*>([^<]+)</)?.[1]
  const celdas: { r: number; c: number; s: number; texto: string; numero: boolean }[] = []
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, r, a, dentro = ''] = m
    const p = ref(r)!
    const t = attr(`<x${a}>`, 't')
    const v = dentro.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    const valor = t === 's' ? (compartidos[Number(v)] ?? '') : t === 'inlineStr' ? textoDe(dentro.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '') : t === 'b' ? (v === '1' ? 'VERDADERO' : 'FALSO') : (v ?? '')
    celdas.push({ r: p.r, c: p.c, s: Number(attr(`<x${a}>`, 's') ?? 0), texto: t === 'str' || t === 'e' ? (v ?? '') : valor, numero: !t && v != null })
  }
  const combinadas = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((m) => ({ a: ref(m[1])!, b: ref(m[2])! }))
  let c0 = 0, r0 = 0, c1 = 0, r1 = 0
  if (area) {
    const [x, y] = area.split('!').pop()!.split(':')
    const a = ref(x)!, b = ref(y ?? x)!
    ;[c0, r0, c1, r1] = [a.c, a.r, b.c, b.r]
  } else {
    const usadas = celdas.filter((x) => x.texto !== '' || x.s > 0)
    c1 = Math.max(0, ...usadas.map((x) => x.c), ...combinadas.map((m) => m.b.c))
    r1 = Math.max(0, ...usadas.map((x) => x.r), ...combinadas.map((m) => m.b.r))
  }

  // Anchos y altos: <col width> (en caracteres) y <row ht> (en puntos); por defecto los de la hoja.
  const formato = xml.match(/<sheetFormatPr\b[^>]*\/?>/)?.[0] ?? ''
  const anchoBase = Number(attr(formato, 'defaultColWidth') ?? (Number(attr(formato, 'baseColWidth') ?? 8) + 0.71))
  const altoBase = Number(attr(formato, 'defaultRowHeight') ?? 15)
  const aPx = (w: number) => Math.round(w * 7 + 5)
  const anchoCol = new Map<number, number>()
  for (const m of xml.matchAll(/<col\b[^>]*\/>/g)) {
    const desde = Number(attr(m[0], 'min')) - 1, hasta = Number(attr(m[0], 'max')) - 1
    const w = attr(m[0], 'hidden') === '1' ? 0 : aPx(Number(attr(m[0], 'width') ?? anchoBase))
    for (let c = desde; c <= Math.min(hasta, 200); c++) anchoCol.set(c, w)
  }
  const altoFila = new Map<number, number>()
  for (const m of xml.matchAll(/<row\b[^>]*>/g)) {
    const r = Number(attr(m[0], 'r')) - 1
    altoFila.set(r, attr(m[0], 'hidden') === '1' ? 0 : Math.round(Number(attr(m[0], 'ht') ?? altoBase) * PX_POR_PT))
  }
  const anchos = Array.from({ length: c1 - c0 + 1 }, (_, k) => anchoCol.get(c0 + k) ?? aPx(anchoBase))
  const altos = Array.from({ length: r1 - r0 + 1 }, (_, k) => altoFila.get(r0 + k) ?? Math.round(altoBase * PX_POR_PT))

  // Celdas a dibujar: cada combinada una vez (desde su esquina), y se saltan las que tapa.
  const tapadas = new Set<string>()
  const vacio = estilos[0] ?? ({} as Estilo)
  const porRef = new Map(celdas.map((x) => [`${x.r}:${x.c}`, x]))
  const salida: CeldaVista[] = []
  for (const m of combinadas) {
    if (m.a.r > r1 || m.a.c > c1 || m.b.r < r0 || m.b.c < c0) continue
    for (let r = m.a.r; r <= m.b.r; r++) for (let c = m.a.c; c <= m.b.c; c++) if (r !== m.a.r || c !== m.a.c) tapadas.add(`${r}:${c}`)
    const x = porRef.get(`${m.a.r}:${m.a.c}`)
    // El borde derecho e inferior de un bloque combinado lo llevan sus últimas celdas.
    const der = porRef.get(`${m.a.r}:${m.b.c}`), abj = porRef.get(`${m.b.r}:${m.a.c}`)
    const e = { ...(estilos[x?.s ?? 0] ?? vacio) }
    if (der && estilos[der.s]?.derecha) e.derecha = estilos[der.s].derecha
    if (abj && estilos[abj.s]?.abajo) e.abajo = estilos[abj.s].abajo
    salida.push({ fila: m.a.r - r0, col: m.a.c - c0, filas: m.b.r - m.a.r + 1, cols: m.b.c - m.a.c + 1, texto: x?.texto ?? '', estilo: e, numero: x?.numero ?? false })
  }
  for (const x of celdas) {
    const k = `${x.r}:${x.c}`
    if (tapadas.has(k) || x.r < r0 || x.r > r1 || x.c < c0 || x.c > c1) continue
    if (combinadas.some((m) => m.a.r === x.r && m.a.c === x.c)) continue
    salida.push({ fila: x.r - r0, col: x.c - c0, filas: 1, cols: 1, texto: x.texto, estilo: estilos[x.s] ?? vacio, numero: x.numero })
  }

  // Imágenes de la hoja (logo, firmas): posición por celdas + desplazamiento en EMU.
  const medias = new Map<string, Uint8Array>()
  const imagenes: ImagenVista[] = []
  const relsHoja = texto(hoja.replace(/([^/]+)$/, '_rels/$1.rels'))
  const relDibujo = [...relsHoja.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => m[0]).find((t) => /\/drawing$/.test(attr(t, 'Type') ?? ''))
  if (relDibujo) {
    const dibujo = new URL(attr(relDibujo, 'Target')!, `http://x/${hoja}`).pathname.slice(1)
    const d = texto(dibujo)
    const relsD = [...texto(dibujo.replace(/([^/]+)$/, '_rels/$1.rels')).matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => m[0])
    const xCol = (c: number, off: number) => anchos.slice(0, Math.max(0, c - c0)).reduce((a, b) => a + b, 0) + off / EMU_POR_PX
    const yFila = (r: number, off: number) => altos.slice(0, Math.max(0, r - r0)).reduce((a, b) => a + b, 0) + off / EMU_POR_PX
    for (const m of d.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
      const a = m[0]
      const emb = a.match(/r:embed="([^"]+)"/)?.[1]
      const rel = relsD.find((t) => attr(t, 'Id') === emb)
      if (!rel) continue
      const media = new URL(attr(rel, 'Target')!, `http://x/${dibujo}`).pathname.slice(1)
      const bytes = lista.find((p) => p.nombre === media)?.bytes
      if (!bytes) continue
      const punto = (n: string) => {
        const b = a.match(new RegExp(`<xdr:${n}>([\\s\\S]*?)</xdr:${n}>`))?.[1] ?? ''
        const num = (t: string) => Number(b.match(new RegExp(`<xdr:${t}>(-?\\d+)</xdr:${t}>`))?.[1] ?? 0)
        return { x: xCol(num('col'), num('colOff')), y: yFila(num('row'), num('rowOff')) }
      }
      const ext = a.match(/<xdr:ext cx="(\d+)" cy="(\d+)"/) ?? a.match(/<a:ext cx="(\d+)" cy="(\d+)"/)
      const desde = m[1] === 'absoluteAnchor' ? { x: Number(a.match(/<xdr:pos x="(\d+)"/)?.[1] ?? 0) / EMU_POR_PX, y: Number(a.match(/<xdr:pos [^>]*y="(\d+)"/)?.[1] ?? 0) / EMU_POR_PX } : punto('from')
      const hasta = m[1] === 'twoCellAnchor' ? punto('to') : { x: desde.x + Number(ext?.[1] ?? 0) / EMU_POR_PX, y: desde.y + Number(ext?.[2] ?? 0) / EMU_POR_PX }
      medias.set(media, bytes)
      imagenes.push({ x: desde.x, y: desde.y, ancho: Math.max(1, hasta.x - desde.x), alto: Math.max(1, hasta.y - desde.y), nombre: media })
    }
  }
  const pagina = xml.match(/<pageSetup\b[^>]*\/?>/)?.[0] ?? ''
  return { vista: { anchos, altos, celdas: salida, imagenes, horizontal: attr(pagina, 'orientation') === 'landscape' }, medias }
}
