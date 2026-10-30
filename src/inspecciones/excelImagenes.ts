// Imágenes de las firmas dentro del Excel de la organización (revisión del formato LOTO, 29/10/2026: decisión del dueño).
// En el Excel se escribe la marca {{firma.<rol>.imagen}} (o {{firma.<rol>#2.imagen}}) en la celda donde va la firma; si la
// celda está combinada, la imagen ocupa todo el bloque combinado (p. ej. E24:F26). La marca queda en blanco y la imagen
// se agrega como dibujo de la hoja, sin tocar lo demás del archivo. Sin imagen (firma en papel o pendiente) queda vacía.
// El logo de la empresa va igual con {{logo}}; si el Excel no tiene esa marca ni imágenes propias, se pone en el bloque
// combinado de la esquina superior izquierda (A1), si está vacío. Cada imagen se ajusta a su recuadro sin deformarse.
import { textoDe } from '../carga/xlsx.ts'
import type { Parte } from './excel.ts'

export const MARCA_IMAGEN = /\{\{\s*(logo|firma\.[^.#{}\s]+(?:#\d+)?\.imagen|foto\.[^.#{}\s]+#\d+)\s*\}\}/

type Ancla = { hoja: string; marca: string; c1: number; r1: number; c2: number; r2: number }

const columna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
const celda = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/)
  return m ? { c: columna(m[1]), r: Number(m[2]) - 1 } : null
}

/**
 * Dónde va cada imagen: las celdas con {{firma.…imagen}} o {{logo}} y su bloque combinado, si lo tiene. Con logoArriba,
 * si no hay marca {{logo}}, el logo va en el bloque de A1 de la primera hoja (si está vacío y la hoja no trae imágenes).
 */
export function anclasDeFirmas(lista: Parte[], logoArriba = false): Ancla[] {
  const dec = (p?: Parte) => (p ? new TextDecoder().decode(p.bytes) : '')
  const compartidos = [...dec(lista.find((p) => p.nombre === 'xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]))
  const anclas: Ancla[] = []
  for (const p of lista) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(p.nombre)) continue
    const xml = dec(p)
    const combinadas = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((m) => [celda(m[1])!, celda(m[2])!])
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, dentro = ''] = m
      const texto = /t="s"/.test(attrs) ? (compartidos[Number(dentro.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? '') : /t="inlineStr"/.test(attrs) ? textoDe(dentro) : ''
      const marca = texto.match(MARCA_IMAGEN)?.[1]
      if (!marca) continue
      const c = celda(ref)!
      const bloque = combinadas.find(([a, b]) => c.c >= a.c && c.c <= b.c && c.r >= a.r && c.r <= b.r)
      anclas.push({ hoja: p.nombre, marca, c1: bloque?.[0].c ?? c.c, r1: bloque?.[0].r ?? c.r, c2: bloque?.[1].c ?? c.c, r2: bloque?.[1].r ?? c.r })
    }
  }
  if (logoArriba && !anclas.some((a) => a.marca === 'logo')) {
    const hoja = 'xl/worksheets/sheet1.xml'
    const xml = dec(lista.find((p) => p.nombre === hoja))
    const conDibujo = /<drawing\b/.test(xml)
    const bloque = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((m) => [celda(m[1])!, celda(m[2])!]).find(([a]) => a.c === 0 && a.r === 0)
    const a1 = xml.match(/<c r="A1"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/)
    const vacia = !a1 || !/<v>|<is>/.test(a1[2] ?? '')
    if (xml && !conDibujo && bloque && vacia) anclas.push({ hoja, marca: 'logo', c1: 0, r1: 0, c2: bloque[1].c, r2: bloque[1].r })
  }
  return anclas
}

// Medidas de la hoja en píxeles (mismo cálculo que la vista para PDF): ancho de columna y alto de fila.
function medidas(xml: string) {
  const attr = (t: string, n: string) => t.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? null
  const formato = xml.match(/<sheetFormatPr\b[^>]*\/?>/)?.[0] ?? ''
  const anchoBase = Number(attr(formato, 'defaultColWidth') ?? Number(attr(formato, 'baseColWidth') ?? 8) + 0.71)
  const altoBase = Number(attr(formato, 'defaultRowHeight') ?? 15)
  const cols = [...xml.matchAll(/<col\b[^>]*\/>/g)].map((m) => ({ desde: Number(attr(m[0], 'min')) - 1, hasta: Number(attr(m[0], 'max')) - 1, w: Number(attr(m[0], 'width') ?? anchoBase) }))
  const filas = new Map([...xml.matchAll(/<row\b[^>]*>/g)].map((m) => [Number(attr(m[0], 'r')) - 1, Number(attr(m[0], 'ht') ?? altoBase)]))
  return {
    col: (c: number) => Math.round((cols.find((x) => c >= x.desde && c <= x.hasta)?.w ?? anchoBase) * 7 + 5),
    fila: (r: number) => Math.round((filas.get(r) ?? altoBase) * (96 / 72)),
  }
}

// Ancho y alto de un PNG (lo dicen sus bytes 16 a 23); null si no es PNG.
function tamanoPng(b: Uint8Array) {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  return { w: v.getUint32(16), h: v.getUint32(20) }
}

const EMU = 9525 // por píxel

/** Desde/hasta de una imagen centrada en su bloque y sin deformarse (si no se conoce su tamaño, llena el bloque). */
function posicion(a: Ancla, xml: string, imagen: Uint8Array) {
  const m = medidas(xml)
  const anchos = Array.from({ length: a.c2 - a.c1 + 1 }, (_, k) => m.col(a.c1 + k))
  const altos = Array.from({ length: a.r2 - a.r1 + 1 }, (_, k) => m.fila(a.r1 + k))
  const bw = anchos.reduce((x, y) => x + y, 0), bh = altos.reduce((x, y) => x + y, 0)
  const t = tamanoPng(imagen)
  const margen = 4
  const esc = t ? Math.min((bw - 2 * margen) / t.w, (bh - 2 * margen) / t.h) : 0
  const w = t ? t.w * esc : bw - 2 * margen, h = t ? t.h * esc : bh - 2 * margen
  const x0 = (bw - w) / 2, y0 = (bh - h) / 2
  // Un punto del bloque (en píxeles desde su esquina) como columna/fila y desplazamiento dentro de ella.
  const ubicar = (px: number, medidasDe: number[], inicio: number) => {
    let i = 0
    while (i < medidasDe.length - 1 && px >= medidasDe[i]) px -= medidasDe[i++]
    return { n: inicio + i, off: Math.max(0, Math.round(px * EMU)) }
  }
  return { desdeC: ubicar(x0, anchos, a.c1), desdeF: ubicar(y0, altos, a.r1), hastaC: ubicar(x0 + w, anchos, a.c1), hastaF: ubicar(y0 + h, altos, a.r1) }
}

const rels = (nombre: string) => nombre.replace(/([^/]+)$/, '_rels/$1.rels')
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const TIPO_DIBUJO = `${NS_R}/drawing`
const TIPO_IMAGEN = `${NS_R}/image`

/** Agrega las imágenes (PNG) en sus anclas. imagenes: marca → bytes PNG (las que no están quedan sin imagen). */
export function insertarImagenes(lista: Parte[], anclas: Ancla[], imagenes: Map<string, Uint8Array>): Parte[] {
  const usadas = anclas.filter((a) => imagenes.has(a.marca))
  if (!usadas.length) return lista
  const mapa = new Map(lista.map((p) => [p.nombre, new TextDecoder().decode(p.bytes)]))
  const binarios = new Map<string, Uint8Array>()
  let nImagen = 0
  let nDibujo = [...mapa.keys()].filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n)).length

  for (const hoja of new Set(usadas.map((a) => a.hoja))) {
    const relsHoja = rels(hoja)
    let rh = mapa.get(relsHoja) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    // ¿La hoja ya tiene dibujos (por ejemplo, el logo)? Se agregan ahí; si no, se crea uno.
    const existente = rh.match(new RegExp(`<Relationship [^>]*Type="${TIPO_DIBUJO}"[^>]*Target="([^"]+)"`)) ?? rh.match(new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Type="${TIPO_DIBUJO}"`))
    let dibujo: string
    if (existente) {
      dibujo = new URL(existente[1], `http://x/${hoja}`).pathname.slice(1)
    } else {
      dibujo = `xl/drawings/drawing${++nDibujo}.xml`
      mapa.set(dibujo, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></xdr:wsDr>`)
      const id = 'rIdCrcDibujo'
      rh = rh.replace('</Relationships>', `<Relationship Id="${id}" Type="${TIPO_DIBUJO}" Target="../drawings/${dibujo.split('/').pop()}"/></Relationships>`)
      mapa.set(relsHoja, rh)
      let xml = mapa.get(hoja)!
      if (!/xmlns:r=/.test(xml.slice(0, 600))) xml = xml.replace(/<worksheet\b/, `<worksheet xmlns:r="${NS_R}"`)
      // El dibujo va antes de estos elementos, según el orden que exige Excel; si no hay ninguno, al final.
      const despues = xml.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/)
      const etiqueta = `<drawing r:id="${id}"/>`
      xml = despues >= 0 ? xml.slice(0, despues) + etiqueta + xml.slice(despues) : xml.replace('</worksheet>', `${etiqueta}</worksheet>`)
      mapa.set(hoja, xml)
    }
    const relsDibujo = rels(dibujo)
    let rd = mapa.get(relsDibujo) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    let d = mapa.get(dibujo)!
    if (!/xmlns:r=/.test(d.slice(0, 800))) d = d.replace(/<xdr:wsDr\b/, `<xdr:wsDr xmlns:r="${NS_R}"`)
    if (!/xmlns:a=/.test(d.slice(0, 800))) d = d.replace(/<xdr:wsDr\b/, '<xdr:wsDr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"')
    let piezas = ''
    for (const a of usadas.filter((x) => x.hoja === hoja)) {
      const n = ++nImagen
      const media = `xl/media/crc_firma_${n}.png`
      binarios.set(media, imagenes.get(a.marca)!)
      const rid = `rIdCrcFirma${n}`
      rd = rd.replace('</Relationships>', `<Relationship Id="${rid}" Type="${TIPO_IMAGEN}" Target="../media/crc_firma_${n}.png"/></Relationships>`)
      // Centrada en su bloque y sin deformarse, con un margen pequeño para no pisar los bordes.
      const p = posicion(a, mapa.get(hoja)!, imagenes.get(a.marca)!)
      piezas += `<xdr:twoCellAnchor editAs="twoCell"><xdr:from><xdr:col>${p.desdeC.n}</xdr:col><xdr:colOff>${p.desdeC.off}</xdr:colOff><xdr:row>${p.desdeF.n}</xdr:row><xdr:rowOff>${p.desdeF.off}</xdr:rowOff></xdr:from>`
        + `<xdr:to><xdr:col>${p.hastaC.n}</xdr:col><xdr:colOff>${p.hastaC.off}</xdr:colOff><xdr:row>${p.hastaF.n}</xdr:row><xdr:rowOff>${p.hastaF.off}</xdr:rowOff></xdr:to>`
        + `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${5000 + n}" name="${a.marca === 'logo' ? 'Logo' : `Firma ${n}`}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
        + `<xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
        + `<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`
    }
    mapa.set(dibujo, d.replace('</xdr:wsDr>', `${piezas}</xdr:wsDr>`))
    mapa.set(relsDibujo, rd)
  }

  // Tipos de contenido: PNG y los dibujos nuevos.
  let tipos = mapa.get('[Content_Types].xml')!
  if (!/Extension="png"/i.test(tipos)) tipos = tipos.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  for (const n of mapa.keys())
    if (/^xl\/drawings\/drawing\d+\.xml$/.test(n) && !tipos.includes(`PartName="/${n}"`))
      tipos = tipos.replace('</Types>', `<Override PartName="/${n}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`)
  mapa.set('[Content_Types].xml', tipos)

  const originales = new Map(lista.map((p) => [p.nombre, p]))
  const salida: Parte[] = []
  for (const [nombre, texto] of mapa) {
    const o = originales.get(nombre)
    salida.push(o && new TextDecoder().decode(o.bytes) === texto ? o : { nombre, bytes: new TextEncoder().encode(texto) })
  }
  for (const [nombre, bytes] of binarios) salida.push({ nombre, bytes })
  // Las partes binarias originales (otras imágenes) no pasaron por texto: se devuelven tal cual.
  return salida.map((p) => (originales.get(p.nombre) && !/\.(xml|rels)$/.test(p.nombre) ? originales.get(p.nombre)! : p))
}
