// Excel del Programa anual de SST con el diseño del modelo del dueño (pedido del 29/10/2026): título, código, versión y
// fecha de aprobación arriba a la derecha, «DATOS DEL EMPLEADOR», columnas Actividad, Responsable y P/E, una columna por
// semana ISO agrupadas por mes, Avance (# y %), Meta y Observaciones; objetivo general, objetivos específicos con recursos y
// metas, secciones y actividades con su fila P (programado) y E (ejecutado); totales por mes y pie de firmas.
// Se arma desde cero con el zip propio de CRC (sin librerías) y también sirve para el PDF (se dibuja con vistaDeExcel).
import { crearZip, escaparXml, letraColumna } from '../carga/xlsx.ts'
import { semanasConMes } from '../inspecciones/periodos.ts'
import { estadosPorActividad, promedioDe, textoPct, totalGeneral, totalesActividad, totalesPorMes } from './calculo.ts'
import type { DatosPrograma } from './datos.ts'
import { numerar } from './numeracion.ts'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// Estilos (índices en cellXfs)
const E = { normal: 0, titulo: 1, etiqueta: 2, cabecera: 3, centro: 4, texto: 5, banda: 6, programado: 7, ejecutado: 8, objetivo: 9, mini: 10 } as const

const estilosXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}">
<fonts count="5">
<font><sz val="10"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="9"/><name val="Calibri"/></font>
<font><sz val="9"/><name val="Calibri"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="6">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2EC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0B3C5D"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1BA39C"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F6"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF7B8A96"/></left><right style="thin"><color rgb="FF7B8A96"/></right><top style="thin"><color rgb="FF7B8A96"/></top><bottom style="thin"><color rgb="FF7B8A96"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>
</cellXfs>
</styleSheet>`

type Empresa = { razon_social: string; ruc: string; domicilio: string; actividad: string } | null

/**
 * Arma el .xlsx del programa. logo (PNG) opcional: va arriba a la izquierda, en el bloque combinado A1:B3.
 * Devuelve los bytes del archivo y la marca {{logo}} lista para insertar la imagen (ver excelImagenes.ts).
 */
export function excelPasst(d: DatosPrograma, empresa: Empresa, nTrabajadores: number | null, nombre: (id: string | null) => string, hoy: string): Uint8Array {
  const p = d.programa
  // Por semana: una columna por semana ISO; por mes: una columna por mes (en la primera semana de ese mes).
  const todas = semanasConMes(p.anio)
  const porMesSeg = p.seguimiento === 'mes'
  const semanas = porMesSeg ? MESES.map((_, k) => todas.find((x) => x.mes === k + 1)).filter((x): x is NonNullable<typeof x> => Boolean(x)) : todas
  const arbol = numerar(d.nodos)
  const estados = estadosPorActividad(d.semanas, d.ejecucion, p.anio, hoy, p.seguimiento)
  const actividades = arbol.filter((n) => n.tipo === 'actividad')
  const porMes = totalesPorMes(estados, actividades.map((a) => a.id), p.anio)

  const S0 = 4 // primera columna de semanas (E)
  const SF = S0 + semanas.length - 1
  const cAv = SF + 1, cPct = SF + 2, cMeta = SF + 3, cObs = SF + 4 // columnas finales
  const ULT = cObs

  const filas = new Map<number, Map<number, string>>()
  const altos = new Map<number, number>()
  const unidas: string[] = []
  const ref = (c: number, r: number) => `${letraColumna(c)}${r + 1}`
  const pon = (r: number, c: number, texto: string | number, estilo: number) => {
    const fila = filas.get(r) ?? new Map<number, string>()
    const t = typeof texto === 'number' ? `<c r="${ref(c, r)}" s="${estilo}"><v>${texto}</v></c>` : texto === '' ? `<c r="${ref(c, r)}" s="${estilo}"/>`
      : `<c r="${ref(c, r)}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`
    fila.set(c, t)
    filas.set(r, fila)
  }
  /** Bloque combinado: el texto en su esquina y el mismo estilo (con bordes) en el resto. */
  const bloque = (r1: number, c1: number, r2: number, c2: number, texto: string | number, estilo: number) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) pon(r, c, r === r1 && c === c1 ? texto : '', estilo)
    if (r1 !== r2 || c1 !== c2) unidas.push(`${ref(c1, r1)}:${ref(c2, r2)}`)
  }
  const fechaPe = (f: string | null) => (f ? f.split('-').reverse().join('/') : '')

  // Encabezado: logo (marca), título y código / versión / fecha de aprobación.
  bloque(0, 0, 2, 1, '{{logo}}', E.etiqueta)
  bloque(0, 2, 2, cAv - 1, `PROGRAMA ANUAL DE SEGURIDAD Y SALUD EN EL TRABAJO ${p.anio}`, E.titulo)
  for (const [k, [et, v]] of ([['CÓDIGO:', p.codigo_formato], ['VERSIÓN:', p.version_formato], ['FECHA DE APROB.', fechaPe(p.fecha_aprobacion)]] as const).entries()) {
    bloque(k, cAv, k, cPct, et, E.etiqueta)
    bloque(k, cMeta, k, cObs, v ?? '', E.centro)
    altos.set(k, 18.75)
  }
  bloque(4, 0, 4, ULT, 'DATOS DEL EMPLEADOR:', E.banda)
  const t = ULT + 1 - 1 // columnas totales = ULT + 1
  const ancho = Math.floor(t / 5)
  const campos: [string, string][] = [
    ['RAZÓN SOCIAL: ', empresa?.razon_social ?? ''], ['RUC: ', empresa?.ruc ?? ''], ['DOMICILIO: ', empresa?.domicilio ?? ''],
    ['ACTIVIDAD ECONÓMICA: ', empresa?.actividad ?? ''], ['N° DE TRABAJADORES: ', nTrabajadores == null ? '' : String(nTrabajadores)],
  ]
  campos.forEach(([et, v], k) => bloque(5, k * ancho + (k ? 1 : 0), 5, k === 4 ? ULT : (k + 1) * ancho, `${et}${v}`, E.etiqueta))
  altos.set(5, 30)

  // Encabezados de columnas: meses y semanas.
  bloque(7, 0, 8, 1, 'ACTIVIDAD', E.cabecera)
  bloque(7, 2, 8, 2, 'Responsable', E.cabecera)
  bloque(7, 3, 8, 3, 'P/E', E.cabecera)
  bloque(7, cAv, 7, cPct, 'Avance', E.cabecera)
  pon(8, cAv, '#', E.cabecera)
  pon(8, cPct, '%', E.cabecera)
  bloque(7, cMeta, 8, cMeta, 'Meta', E.cabecera)
  bloque(7, cObs, 8, cObs, 'Observaciones', E.cabecera)
  for (let m = 1; m <= 12; m++) {
    const cols = semanas.map((s, k) => ({ ...s, k })).filter((s) => s.mes === m)
    if (cols.length) bloque(7, S0 + cols[0].k, porMesSeg ? 8 : 7, S0 + cols[cols.length - 1].k, MESES[m - 1], E.cabecera)
  }
  if (!porMesSeg) semanas.forEach((s, k) => pon(8, S0 + k, s.semana, E.cabecera))

  // Árbol: objetivo general, objetivos específicos (recursos y metas), secciones y actividades (filas P y E).
  let r = 9
  for (const [pos, n] of arbol.entries()) {
    // % y meta del objetivo o la estrategia: el promedio de sus actividades.
    const pr = promedioDe(arbol, pos, estados)
    const textoPr = (x: number | null) => (x == null ? '—' : `${x} %`)
    if (n.tipo === 'objetivo_general') {
      bloque(r, 0, r, ULT, `OBJETIVO GENERAL ${p.anio}: ${n.texto}`, E.banda)
      altos.set(r++, 20)
    } else if (n.tipo === 'objetivo_especifico') {
      bloque(r, 0, r, cAv, `Objetivo Específico ${n.numero}: ${n.texto}`, E.banda)
      pon(r, cPct, textoPr(pr.pct), E.banda); pon(r, cMeta, textoPr(pr.meta), E.banda); pon(r, cObs, '', E.banda)
      altos.set(r++, 20)
      bloque(r++, 0, r - 1, ULT, `Recursos: ${n.recursos ?? ''}`, E.texto)
      for (const m of d.metas.filter((x) => x.nodo_id === n.id)) {
        bloque(r, 0, r, 7, `Meta ${m.orden}: ${m.texto}`, E.texto)
        bloque(r++, 8, r - 1, ULT, `Indicador: ${m.indicador ?? ''}`, E.texto)
      }
    } else if (n.tipo === 'seccion') {
      bloque(r, 0, r, cAv, `${n.numero}  ${n.texto}`, E.objetivo)
      pon(r, cPct, textoPr(pr.pct), E.objetivo); pon(r, cMeta, textoPr(pr.meta), E.objetivo); pon(r++, cObs, '', E.objetivo)
    } else {
      const tot = totalesActividad(estados.get(n.id))
      pon(r, 0, n.numero, E.centro); pon(r + 1, 0, '', E.centro); unidas.push(`${ref(0, r)}:${ref(0, r + 1)}`)
      bloque(r, 1, r + 1, 1, n.texto, E.texto)
      bloque(r, 2, r + 1, 2, nombre(n.responsable_id), E.texto)
      pon(r, 3, 'P', E.centro); pon(r + 1, 3, 'E', E.centro)
      semanas.forEach((s, k) => {
        const e = estados.get(n.id)?.get(s.semana)
        pon(r, S0 + k, e?.programada ? 'P' : '', e?.programada ? E.programado : E.centro)
        pon(r + 1, S0 + k, e?.ejecutada ? 'E' : '', e?.ejecutada ? E.ejecutado : E.centro)
      })
      pon(r, cAv, tot.programadas, E.centro); pon(r + 1, cAv, tot.ejecutadas, E.centro)
      bloque(r, cPct, r + 1, cPct, textoPct(tot), E.centro)
      bloque(r, cMeta, r + 1, cMeta, `${Number(n.meta_pct ?? 100)} %`, E.centro)
      bloque(r, cObs, r + 1, cObs, n.observaciones ?? '', E.texto)
      altos.set(r, 17); altos.set(r + 1, 17)
      r += 2
    }
  }

  // Totales por mes y % de cumplimiento contra la meta.
  r += 1
  const resumen: [string, (k: number) => string | number][] = [
    ['Programadas', (k) => porMes[k].programadas], ['Ejecutadas', (k) => porMes[k].ejecutadas], [`% de cumplimiento (meta ${Number(p.meta_cumplimiento)} %)`, (k) => textoPct(porMes[k])],
  ]
  const general = totalGeneral(porMes)
  const generales = [String(general.programadas), `${general.ejecutadas}${general.fuera ? `+${general.fuera}` : ''}`, `${textoPct(general)} · meta ${Number(p.meta_cumplimiento)} %`]
  for (const [et, valor] of resumen) {
    bloque(r, 0, r, 3, et, E.etiqueta)
    bloque(r, cAv, r, cMeta, generales[resumen.findIndex((x) => x[0] === et)], E.centro)
    for (let m = 1; m <= 12; m++) {
      const cols = semanas.map((s, k) => ({ ...s, k })).filter((s) => s.mes === m)
      if (cols.length) bloque(r, S0 + cols[0].k, r, S0 + cols[cols.length - 1].k, valor(m - 1), E.centro)
    }
    r++
  }

  // Pie de firmas (en blanco, se firma a mano).
  r += 1
  bloque(r, 0, r, 3, 'Cargo', E.cabecera)
  bloque(r, 4, r, 30, 'Nombre y apellidos', E.cabecera)
  bloque(r++, 31, r - 1, ULT, 'Firma', E.cabecera)
  for (const c of ['Jefe de Seguridad y Salud Ocupacional', 'Gerente de planta', 'Gerente general', 'Miembro del Comité SST', 'Presidente del Comité SST']) {
    bloque(r, 0, r, 3, c, E.texto)
    bloque(r, 4, r, 30, '', E.texto)
    bloque(r, 31, r, ULT, '', E.texto)
    altos.set(r++, 26)
  }

  const cols = `<cols><col min="1" max="1" width="7" customWidth="1"/><col min="2" max="2" width="46" customWidth="1"/><col min="3" max="3" width="20" customWidth="1"/><col min="4" max="4" width="5" customWidth="1"/>`
    + `<col min="${S0 + 1}" max="${SF + 1}" width="${porMesSeg ? 9 : 3.6}" customWidth="1"/><col min="${cAv + 1}" max="${cAv + 1}" width="6" customWidth="1"/><col min="${cPct + 1}" max="${cPct + 1}" width="8" customWidth="1"/>`
    + `<col min="${cMeta + 1}" max="${cMeta + 1}" width="8" customWidth="1"/><col min="${cObs + 1}" max="${cObs + 1}" width="28" customWidth="1"/></cols>`
  const datos = [...filas.keys()].sort((a, b) => a - b).map((k) => {
    const celdas = [...filas.get(k)!.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x).join('')
    const alto = altos.get(k)
    return `<row r="${k + 1}"${alto ? ` ht="${alto}" customHeight="1"` : ''}>${celdas}</row>`
  }).join('')
  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${datos}</sheetData>`
    + `<mergeCells count="${unidas.length}">${unidas.map((u) => `<mergeCell ref="${u}"/>`).join('')}</mergeCells>`
    + `<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
  return crearZip([
    { nombre: '[Content_Types].xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: '_rels/.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets><sheet name="Programa anual SST" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', texto: estilosXml },
    { nombre: 'xl/worksheets/sheet1.xml', texto: hoja },
  ])
}

