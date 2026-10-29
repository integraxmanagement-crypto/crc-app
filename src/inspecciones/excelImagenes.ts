// Imágenes de las firmas dentro del Excel de la organización (revisión del formato LOTO, 29/10/2026: decisión del dueño).
// En el Excel se escribe la marca {{firma.<rol>.imagen}} (o {{firma.<rol>#2.imagen}}) en la celda donde va la firma; si la
// celda está combinada, la imagen ocupa todo el bloque combinado (p. ej. E24:F26). La marca queda en blanco y la imagen
// se agrega como dibujo de la hoja, sin tocar lo demás del archivo. Sin imagen (firma en papel o pendiente) queda vacía.
import { textoDe } from '../carga/xlsx.ts'
import type { Parte } from './excel.ts'

export const MARCA_IMAGEN = /\{\{\s*(firma\.[^.#{}\s]+(?:#\d+)?\.imagen)\s*\}\}/

type Ancla = { hoja: string; marca: string; c1: number; r1: number; c2: number; r2: number }

const columna = (letras: string) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
const celda = (ref: string) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/)
  return m ? { c: columna(m[1]), r: Number(m[2]) - 1 } : null
}

/** Dónde va cada firma: las celdas con {{firma.…imagen}} y su bloque combinado, si lo tiene. */
export function anclasDeFirmas(lista: Parte[]): Ancla[] {
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
  return anclas
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
      // Un margen pequeño dentro del bloque (en EMU: 1 cm = 360000) para que la firma no pise los bordes.
      const m = 45720
      piezas += `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${a.c1}</xdr:col><xdr:colOff>${m}</xdr:colOff><xdr:row>${a.r1}</xdr:row><xdr:rowOff>${m}</xdr:rowOff></xdr:from>`
        + `<xdr:to><xdr:col>${a.c2 + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.r2 + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
        + `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${5000 + n}" name="Firma ${n}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
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
