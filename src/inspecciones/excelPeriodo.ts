// Excel por período (tarea 3.4-D, opción A aprobada por el dueño el 27/10/2026): varias inspecciones de un mismo
// formato, sede y período en el Excel de la organización, con UNA FILA POR EQUIPO.
// En el Excel se escribe una «fila modelo» con marcas {{fila.…}} (por ejemplo {{fila.item}}, {{fila.activo_codigo}},
// {{fila.EXT-01.si}}, {{fila.resultado}}). CRC la repite por cada equipo, en orden de código:
//  · primero usa las filas vacías que ya tiene dibujadas el formato debajo de la fila modelo;
//  · si faltan, agrega filas antes de lo que sigue (firmas, notas) y lo corre hacia abajo, con sus celdas
//    combinadas, validaciones, imágenes y área de impresión.
// Las demás marcas ({{razon_social}}, {{periodo}}, {{avance}}…) se llenan una sola vez. Sin librerías, en el equipo.
import { crearZip, escaparXml, textoDe, textoXml } from '../carga/xlsx.ts'
import { type DatosHoja, type Parte, partes, reemplazarMarcas, valoresDe } from './excel.ts'

const MARCA_FILA = /\{\{\s*fila\.([^{}]+?)\s*\}\}/g
const RE_FILA = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
const RE_CELDA = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g

type Celda = { col: string; attrs: string; dentro: string | null }
type Fila = { attrs: string; celdas: Map<string, Celda> }

const atributo = (attrs: string, nombre: string) => attrs.match(new RegExp(`\\s${nombre}="([^"]*)"`))?.[1] ?? null
const conAtributo = (attrs: string, nombre: string, valor: string) =>
  new RegExp(`\\s${nombre}="`).test(attrs) ? attrs.replace(new RegExp(`(\\s${nombre}=")[^"]*"`), `$1${valor}"`) : `${attrs} ${nombre}="${valor}"`
const numeroColumna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0)

/** Corre hacia abajo (en `d`) las filas desde la fila `desde` en referencias como A21, $B$30 o A21:C40. */
const correrRefs = (texto: string, desde: number, d: number) =>
  texto.replace(/(\$?[A-Z]{1,3}\$?)(\d+)\b/g, (todo, col: string, fila: string) => (Number(fila) >= desde ? `${col}${Number(fila) + d}` : todo))

function leerFilas(xml: string): Map<number, Fila> {
  const filas = new Map<number, Fila>()
  const datos = xml.match(/<sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/)?.[1] ?? ''
  for (const [, attrs, dentro] of datos.matchAll(RE_FILA)) {
    const celdas = new Map<string, Celda>()
    for (const [, a, d] of (dentro ?? '').matchAll(RE_CELDA)) {
      const col = (atributo(a, 'r') ?? '').match(/^([A-Z]+)/)?.[1]
      if (col) celdas.set(col, { col, attrs: a, dentro: d ?? null })
    }
    filas.set(Number(atributo(attrs, 'r')), { attrs, celdas })
  }
  return filas
}

function textoCelda(c: Celda, compartidos: string[]): string {
  const t = atributo(c.attrs, 't')
  if (!c.dentro) return ''
  if (t === 'inlineStr') return textoDe(c.dentro)
  const v = c.dentro.match(/<v>([\s\S]*?)<\/v>/)?.[1]
  if (v == null) return ''
  return t === 's' ? (compartidos[Number(v)] ?? '') : textoXml(v)
}
const filaConDatos = (f: Fila, compartidos: string[]) => [...f.celdas.values()].some((c) => textoCelda(c, compartidos).trim() !== '' || /<f[\s>]/.test(c.dentro ?? ''))

function escribirFilas(xml: string, filas: Map<number, Fila>) {
  const cuerpo = [...filas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, f]) => {
      const celdas = [...f.celdas.values()]
        .sort((a, b) => numeroColumna(a.col) - numeroColumna(b.col))
        .map((c) => {
          const attrs = conAtributo(c.attrs, 'r', `${c.col}${n}`)
          return c.dentro == null ? `<c${attrs}/>` : `<c${attrs}>${c.dentro}</c>`
        })
        .join('')
      return `<row${conAtributo(f.attrs, 'r', String(n))}>${celdas}</row>`
    })
    .join('')
  return xml.replace(/<sheetData\b[^>]*?(?:\/>|>[\s\S]*?<\/sheetData>)/, `<sheetData>${cuerpo}</sheetData>`)
}

export type ResultadoPeriodo = { bytes: Uint8Array; filas: number; usadasDelFormato: number; agregadas: number; hoja: string | null }

/**
 * Llena el Excel con una fila por elemento de `filas` (cada uno da el valor de sus marcas {{fila.X}} sin el «fila.»),
 * y el resto de las marcas con `general`. Si el Excel no tiene fila modelo, solo llena las marcas generales.
 */
export async function llenarExcelPeriodo(archivo: Uint8Array, general: (marca: string) => string | null, filas: ((marca: string) => string | null)[]): Promise<ResultadoPeriodo> {
  const lista = await partes(archivo)
  const leer = (nombre: string) => {
    const p = lista.find((x) => x.nombre === nombre)
    return p ? new TextDecoder().decode(p.bytes) : null
  }
  const escribir = (nombre: string, texto: string) => {
    const p = lista.find((x) => x.nombre === nombre)
    if (p) p.bytes = new TextEncoder().encode(texto)
  }
  const sst = leer('xl/sharedStrings.xml') ?? ''
  const compartidos = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, d]) => textoDe(d))

  // 1. La hoja y la fila modelo.
  let hoja: string | null = null
  let filasHoja = new Map<number, Fila>()
  let modelo = 0
  for (const p of lista.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x.nombre))) {
    const f = leerFilas(new TextDecoder().decode(p.bytes))
    const n = [...f.entries()].find(([, fila]) => [...fila.celdas.values()].some((c) => /\{\{\s*fila\./.test(textoCelda(c, compartidos))))?.[0]
    if (n) {
      hoja = p.nombre
      filasHoja = f
      modelo = n
      break
    }
  }
  if (!hoja) return { bytes: crearZip(reemplazarMarcas(lista, (m) => (m.startsWith('fila.') ? '' : general(m)))), filas: 0, usadasDelFormato: 0, agregadas: 0, hoja: null }

  // 2. Cuántas filas dibujadas y vacías hay debajo (las de la tabla del formato). Se detiene en la primera fila con
  //    datos (firmas, notas) o en una fila sin dibujar (el espacio antes del pie se respeta). Si debajo no hay nada,
  //    hay espacio sin límite.
  const ultima = Math.max(...filasHoja.keys())
  let capacidad = 1
  while (true) {
    const n = modelo + capacidad
    if (n > ultima) {
      capacidad = Number.POSITIVE_INFINITY
      break
    }
    const f = filasHoja.get(n)
    if (!f || !f.celdas.size || filaConDatos(f, compartidos)) break
    capacidad++
  }
  const total = Math.max(1, filas.length)
  const agregadas = Number.isFinite(capacidad) && total > capacidad ? total - capacidad : 0

  let xml = leer(hoja)!
  const plantillaFila = filasHoja.get(modelo)!
  // Celdas combinadas de la fila modelo (se repiten en cada fila nueva).
  const combinadasModelo = [...xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/g)]
    .filter(([, , f1, , f2]) => Number(f1) === modelo && Number(f2) === modelo)
    .map(([, c1, , c2]) => [c1, c2] as const)

  // 3. Si faltan filas: se corre hacia abajo todo lo que está debajo del espacio del formato.
  if (agregadas > 0) {
    const desde = modelo + capacidad
    const corridas = new Map<number, Fila>()
    for (const [n, f] of filasHoja) corridas.set(n >= desde ? n + agregadas : n, f)
    filasHoja = corridas
    xml = xml
      .replace(/(<mergeCell ref=")([^"]+)(")/g, (_, a, ref: string, b) => `${a}${correrRefs(ref, desde, agregadas)}${b}`)
      .replace(/(<dimension ref=")([^"]+)(")/, (_, a, ref: string, b) => `${a}${correrRefs(ref, desde, agregadas)}${b}`)
      .replace(/(\ssqref=")([^"]+)(")/g, (_, a, ref: string, b) => `${a}${correrRefs(ref, desde, agregadas)}${b}`)
      .replace(/(<hyperlink\b[^>]*\sref=")([^"]+)(")/g, (_, a, ref: string, b) => `${a}${correrRefs(ref, desde, agregadas)}${b}`)
    // Imágenes (logos, sellos) ancladas debajo: se corren igual. En el dibujo las filas empiezan en 0.
    const rels = leer(hoja.replace('worksheets/', 'worksheets/_rels/') + '.rels') ?? ''
    for (const m of rels.matchAll(/Type="[^"]*\/drawing"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/drawing"/g)) {
      const nombre = `xl/${(m[1] ?? m[2]).replace(/^\.\.\//, '')}`
      const dibujo = leer(nombre)
      if (dibujo) escribir(nombre, dibujo.replace(/<xdr:row>(\d+)<\/xdr:row>/g, (todo, f: string) => (Number(f) + 1 >= desde ? `<xdr:row>${Number(f) + agregadas}</xdr:row>` : todo)))
    }
    // Área de impresión y nombres definidos de esta hoja.
    const libro = leer('xl/workbook.xml')
    const rid = (leer('xl/_rels/workbook.xml.rels') ?? '').match(new RegExp(`Id="([^"]+)"[^>]*Target="(?:/xl/)?${hoja.slice(3)}"|Target="(?:/xl/)?${hoja.slice(3)}"[^>]*Id="([^"]+)"`))
    const idHoja = rid?.[1] ?? rid?.[2]
    const nombreHoja = idHoja ? libro?.match(new RegExp(`<sheet [^>]*name="([^"]+)"[^>]*r:id="${idHoja}"`))?.[1] : null
    if (libro && nombreHoja)
      escribir('xl/workbook.xml', libro.replace(/(<definedName\b[^>]*>)([\s\S]*?)(<\/definedName>)/g, (todo, a, dentro: string, b) =>
        textoXml(dentro).includes(textoXml(nombreHoja)) ? `${a}${correrRefs(dentro, desde, agregadas)}${b}` : todo))
  }

  // 4. Una fila por equipo.
  const combinadasNuevas: string[] = []
  const existentes = [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map(([, r]) => r)
  for (let k = 0; k < total; k++) {
    const n = modelo + k
    const valor = filas[k]
    const destino = filasHoja.get(n) ?? { attrs: plantillaFila.attrs, celdas: new Map() }
    const celdas = new Map(destino.celdas)
    for (const c of plantillaFila.celdas.values()) {
      const texto = textoCelda(c, compartidos)
      if (!/\{\{\s*fila\./.test(texto)) {
        if (k > 0 && !celdas.has(c.col)) celdas.set(c.col, { ...c })
        continue
      }
      const lleno = texto.replace(MARCA_FILA, (_, m: string) => (valor ? (valor(m) ?? '') : ''))
      const attrs = c.attrs.replace(/\st="[^"]*"/, '')
      celdas.set(c.col, lleno
        ? { col: c.col, attrs: `${attrs} t="inlineStr"`, dentro: `<is><t xml:space="preserve">${escaparXml(lleno)}</t></is>` }
        : { col: c.col, attrs, dentro: null })
    }
    filasHoja.set(n, { attrs: destino.attrs, celdas })
    if (k > 0)
      for (const [c1, c2] of combinadasModelo) {
        const ref = `${c1}${n}:${c2}${n}`
        const choca = existentes.some((r) => {
          const m = r.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
          return m && Number(m[2]) <= n && n <= Number(m[4]) && numeroColumna(m[1]) <= numeroColumna(c2) && numeroColumna(c1) <= numeroColumna(m[3])
        })
        if (!choca) combinadasNuevas.push(ref)
      }
  }
  xml = escribirFilas(xml, filasHoja)
  if (combinadasNuevas.length) {
    const nuevas = combinadasNuevas.map((r) => `<mergeCell ref="${r}"/>`).join('')
    xml = /<mergeCells\b/.test(xml)
      ? xml.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/, (_, d: string) => {
          const todas = d + nuevas
          return `<mergeCells count="${(todas.match(/<mergeCell\b/g) ?? []).length}">${todas}</mergeCells>`
        })
      : xml.replace('</sheetData>', `</sheetData><mergeCells count="${combinadasNuevas.length}">${nuevas}</mergeCells>`)
  }
  escribir(hoja, xml)

  // 5. Las marcas generales (encabezado, período, avance). Las {{fila.…}} que quedaran sueltas, en blanco.
  const final: Parte[] = reemplazarMarcas(lista, (m) => (m.startsWith('fila.') ? '' : general(m)))
  return {
    bytes: crearZip(final),
    filas: total,
    usadasDelFormato: Number.isFinite(capacidad) ? Math.min(total, capacidad) : total,
    agregadas,
    hoja: nombreHojaDe(hoja),
  }
}

const nombreHojaDe = (parte: string) => parte.replace(/^xl\/worksheets\//, '')

// ───────────────────────── Valores del período ─────────────────────────

export type EquipoPeriodo = { codigo: string; datos: Record<string, string | number | null>; inspeccion: DatosHoja | null }

/** Valores de cada fila: los de su inspección (las mismas marcas que en una inspección) o «No inspeccionado». */
export function valoresFilas(equipos: EquipoPeriodo[]): ((marca: string) => string | null)[] {
  return equipos.map((e, k) => {
    const deInspeccion = e.inspeccion ? valoresDe(e.inspeccion) : null
    return (marca) => {
      if (marca === 'item') return String(k + 1)
      if (marca === 'estado') return e.inspeccion ? 'Inspeccionado' : 'No inspeccionado'
      if (deInspeccion) return deInspeccion(marca)
      if (marca === 'activo_codigo') return e.codigo
      if (marca === 'resultado') return 'No inspeccionado'
      if (marca.startsWith('activo.')) {
        const v = e.datos[marca.slice(7)]
        return v == null ? '' : /^\d{4}-\d{2}$/.test(String(v)) ? `${String(v).slice(5)}/${String(v).slice(0, 4)}` : String(v)
      }
      return ''
    }
  })
}

/** Marcas generales del período, además de las de la empresa y del formato. */
export function valoresGenerales(base: (marca: string) => string | null, periodo: { etiqueta: string; desde: string; hasta: string }, avance: { hechos: number; total: number | null }) {
  const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
  const extra: Record<string, string> = {
    periodo: periodo.etiqueta.split(' · ')[0],
    desde: fecha(periodo.desde),
    hasta: fecha(periodo.hasta),
    inspeccionados: String(avance.hechos),
    total: avance.total == null ? '' : String(avance.total),
    avance: avance.total ? `${avance.hechos} de ${avance.total} (${Math.round((100 * avance.hechos) / avance.total)} %)` : String(avance.hechos),
  }
  return (marca: string) => (marca in extra ? extra[marca] : base(marca))
}
