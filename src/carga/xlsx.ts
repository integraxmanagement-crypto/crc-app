// Lector y escritor mínimos de archivos Excel (.xlsx) para la carga de personal (tarea 3.6, decisión 3A).
// Sin librerías: un .xlsx es un archivo comprimido (ZIP) con textos XML adentro, y el navegador ya sabe
// descomprimir. El archivo se lee en la memoria del equipo y nunca se sube ni se guarda (Ley 29733).
// No usa nada propio del navegador fuera de lo estándar, así también se puede probar en la computadora.

export const TAMANO_MAXIMO = 1024 * 1024 // 1 MB (decisión 5A)
const DESCOMPRIMIDO_MAXIMO = 30 * 1024 * 1024 // defensa contra archivos «bomba» que se inflan al abrirse

export class ErrorExcel extends Error {}

// ───────────────────────── ZIP: lectura ─────────────────────────

export type Entrada = { nombre: string; metodo: number; inicio: number; comprimido: number; tamano: number }

export function entradasZip(b: Uint8Array): Entrada[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  // Fin del directorio central: firma 0x06054b50, buscando desde el final.
  let fin = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fin = i
      break
    }
  }
  if (fin < 0) throw new ErrorExcel('El archivo no es un Excel .xlsx válido.')
  const total = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const entradas: Entrada[] = []
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new ErrorExcel('El archivo está dañado.')
    const metodo = v.getUint16(p + 10, true)
    const comprimido = v.getUint32(p + 20, true)
    const tamano = v.getUint32(p + 24, true)
    const largoNombre = v.getUint16(p + 28, true)
    const extra = v.getUint16(p + 30, true)
    const comentario = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nombre = new TextDecoder().decode(b.subarray(p + 46, p + 46 + largoNombre))
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    entradas.push({ nombre, metodo, inicio, comprimido, tamano })
    p += 46 + largoNombre + extra + comentario
  }
  return entradas
}

export async function descomprimir(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}

/** Abre el .xlsx y devuelve sus archivos XML como texto. */
async function abrirZip(b: Uint8Array): Promise<Map<string, string>> {
  const archivos = new Map<string, string>()
  let acumulado = 0
  for (const e of entradasZip(b)) {
    if (!e.nombre.endsWith('.xml') && !e.nombre.endsWith('.rels')) continue
    acumulado += e.tamano
    if (acumulado > DESCOMPRIMIDO_MAXIMO) throw new ErrorExcel('El archivo es demasiado grande por dentro.')
    const crudo = b.subarray(e.inicio, e.inicio + e.comprimido)
    let datos: Uint8Array
    if (e.metodo === 0) datos = crudo
    else if (e.metodo === 8) datos = await descomprimir(crudo)
    else throw new ErrorExcel('El archivo usa una compresión que CRC no conoce. Guárdalo de nuevo como .xlsx.')
    archivos.set(e.nombre.replace(/^\//, ''), new TextDecoder().decode(datos))
  }
  return archivos
}

// ───────────────────────── XML: lo justo ─────────────────────────

export function textoXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const l = e.toLowerCase()
    if (l === 'amp') return '&'
    if (l === 'lt') return '<'
    if (l === 'gt') return '>'
    if (l === 'quot') return '"'
    if (l === 'apos') return "'"
    return String.fromCodePoint(l.startsWith('#x') ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10))
  })
}

function atributo(etiqueta: string, nombre: string): string | null {
  const m = etiqueta.match(new RegExp(`\\s${nombre}="([^"]*)"`))
  return m ? textoXml(m[1]) : null
}

/** Todo el texto de los <t> de un bloque, sin la «guía fonética» (<rPh>) que agregan algunos Excel. */
export function textoDe(bloque: string): string {
  const sinFonetica = bloque.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  return [...sinFonetica.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => textoXml(m[1])).join('')
}

// ───────────────────────── Excel: lectura ─────────────────────────

export type Celda = string | number | boolean | null
export type Hoja = { nombre: string; filas: Map<number, Celda[]>; fechas1904: boolean; columnasNumero: Set<string> }

function columnaANumero(letras: string): number {
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Lee una hoja del .xlsx. Busca la hoja con ese nombre; si no existe, usa la primera.
 * Si hay fórmulas, toma el último valor que Excel calculó y guardó.
 */
export async function leerHoja(archivo: ArrayBuffer, nombreHoja: string): Promise<Hoja> {
  const b = new Uint8Array(archivo)
  if (b.length > TAMANO_MAXIMO) throw new ErrorExcel('El archivo pesa más de 1 MB. Divide la lista en varios archivos.')
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    throw new ErrorExcel('Es un Excel antiguo (.xls). Ábrelo y guárdalo como «Libro de Excel (.xlsx)».')
  }
  if (b[0] !== 0x50 || b[1] !== 0x4b) throw new ErrorExcel('El archivo no es un Excel .xlsx. Usa la plantilla de CRC.')

  const x = await abrirZip(b)
  const libro = x.get('xl/workbook.xml')
  if (!libro) throw new ErrorExcel('El archivo no es un Excel .xlsx válido.')
  const fechas1904 = /<workbookPr\b[^>]*\sdate1904="(1|true)"/.test(libro)

  const hojas = [...libro.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => ({ nombre: atributo(m[0], 'name') ?? '', rid: atributo(m[0], 'r:id') }))
  if (!hojas.length) throw new ErrorExcel('El Excel no tiene hojas.')
  const normal = (s: string) => s.trim().toLowerCase()
  const elegida = hojas.find((h) => normal(h.nombre) === normal(nombreHoja)) ?? hojas[0]

  const rels = x.get('xl/_rels/workbook.xml.rels') ?? ''
  const rel = [...rels.matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => m[0]).find((r) => atributo(r, 'Id') === elegida.rid)
  let destino = rel ? atributo(rel, 'Target') ?? '' : ''
  destino = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`
  const hojaXml = x.get(destino.replace(/\/\.\//g, '/'))
  if (!hojaXml) throw new ErrorExcel('No se pudo abrir la hoja del Excel.')

  const compartidos = [...(x.get('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]))

  const filas = new Map<number, Celda[]>()
  const columnasNumero = new Set<string>() // celdas guardadas como número (por ejemplo «A2»), para avisar de ceros perdidos
  for (const f of hojaXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const nFila = Number(atributo(` ${f[1]}`, 'r'))
    const valores: Celda[] = []
    let siguiente = 0
    for (const c of (f[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const etiqueta = ` ${c[1]}`
      const ref = atributo(etiqueta, 'r')
      const col = ref ? columnaANumero(ref.replace(/\d+/g, '')) : siguiente
      siguiente = col + 1
      const tipo = atributo(etiqueta, 't')
      const interior = c[2] ?? ''
      const v = interior.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let valor: Celda = null
      if (tipo === 's') valor = v != null ? compartidos[Number(v)] ?? '' : null
      else if (tipo === 'inlineStr') valor = textoDe(interior.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '')
      else if (tipo === 'str') valor = v != null ? textoXml(v) : null
      else if (tipo === 'b') valor = v === '1'
      else if (tipo === 'e') valor = null
      else if (v != null) {
        valor = Number(v)
        if (ref) columnasNumero.add(ref)
      }
      valores[col] = valor
    }
    if (Number.isFinite(nFila)) filas.set(nFila, valores)
  }
  return { nombre: elegida.nombre, filas, fechas1904, columnasNumero }
}

/** Convierte un número de fecha de Excel a «aaaa-mm-dd» (sistema 1900, o 1904 en algunos Mac). */
export function fechaDeExcel(serial: number, fechas1904 = false): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null
  const dias = Math.floor(serial) + (fechas1904 ? 1462 : 0)
  // Excel cuenta el 29/02/1900, que no existió: por eso la base es el 30/12/1899.
  const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000)
  return d.toISOString().slice(0, 10)
}

// ───────────────────────── ZIP y Excel: escritura (plantilla) ─────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(d: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of d) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Arma un ZIP sin comprimir (suficiente para una plantilla de pocos KB). Cada archivo va como texto o como bytes. */
export function crearZip(archivos: ({ nombre: string; texto: string } | { nombre: string; bytes: Uint8Array })[]): Uint8Array {
  const partes: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let posicion = 0
  for (const a of archivos) {
    const nombre = new TextEncoder().encode(a.nombre)
    const datos = 'bytes' in a ? a.bytes : new TextEncoder().encode(a.texto)
    const crc = crc32(datos)
    const local = new Uint8Array(30 + nombre.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // nombres en UTF-8
    lv.setUint32(14, crc, true)
    lv.setUint32(18, datos.length, true)
    lv.setUint32(22, datos.length, true)
    lv.setUint16(26, nombre.length, true)
    local.set(nombre, 30)
    const central = new Uint8Array(46 + nombre.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, datos.length, true)
    cv.setUint32(24, datos.length, true)
    cv.setUint16(28, nombre.length, true)
    cv.setUint32(42, posicion, true)
    central.set(nombre, 46)
    partes.push(local, datos)
    centrales.push(central)
    posicion += local.length + datos.length
  }
  const tamanoCentral = centrales.reduce((s, c) => s + c.length, 0)
  const fin = new Uint8Array(22)
  const fv = new DataView(fin.buffer)
  fv.setUint32(0, 0x06054b50, true)
  fv.setUint16(8, archivos.length, true)
  fv.setUint16(10, archivos.length, true)
  fv.setUint32(12, tamanoCentral, true)
  fv.setUint32(16, posicion, true)
  const total = new Uint8Array(posicion + tamanoCentral + 22)
  let p = 0
  for (const parte of [...partes, ...centrales, fin]) {
    total.set(parte, p)
    p += parte.length
  }
  return total
}

export function escaparXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function letraColumna(n: number): string {
  let s = ''
  for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s
  return s
}
