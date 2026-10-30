// Prueba del Excel de la organización (tarea 3.4-C): marcas {{…}}, llenado de una copia por inspección y que el
// resto del archivo (imágenes, estilos) no cambie. No usa la base de datos: todo es FICTICIO y corre en la computadora.
// También deja un Excel ficticio de ejemplo (formato de extintores) en pruebas/excel/ para probarlo en la app.
// Uso: node pruebas/excel-inspeccion.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { crearZip, descomprimir, entradasZip, escaparXml, leerHoja } from '../src/carga/xlsx.ts'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { gruposDe, llenarExcel, marcasDeExcel, marcasDesconocidas, partes as partesDe, valoresDe } from '../src/inspecciones/excel.ts'
import { llenarExcelPeriodo, valoresFilas, valoresGenerales } from '../src/inspecciones/excelPeriodo.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}

// ───── Excel ficticio con el «diseño» de un formato de organización (inventado: no copia ningún formato real) ─────
const raiz = 'http://schemas.openxmlformats.org'
const LOGO = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256) // «imagen» ficticia: bytes que no deben cambiar
const filasHoja = [
  ['{{razon_social}}', 'RUC: {{ruc}}', 'Código: {{codigo_formato}} · Versión: {{version_formato}}'],
  ['{{nombre_formato}}', 'Aprobado: {{fecha_aprobacion}}', 'N.º {{numero_inspeccion}}'],
  ['Fecha: {{fecha}} {{hora}}', 'Sede: {{sede}}', 'Inspector: {{inspector}}'],
  ['Extintor: {{activo_codigo}}', 'Próximo mantenimiento: {{activo.proximo_mantenimiento}}', 'Capacidad: {{activo.capacidad}}'],
  ['Punto', 'Sí', 'No', 'N/A', 'Observación'],
  ...['EXT-01', 'EXT-02', 'EXT-03', 'EXT-04', 'EXT-05', 'EXT-06', 'EXT-07', 'EXT-08', 'EXT-09', 'EXT-10', 'EXT-11', 'EXT-12', 'EXT-13'].map((k) => [
    k, `{{${k}.si}}`, `{{${k}.no}}`, `{{${k}.na}}`, `{{${k}.obs}}`,
  ]),
  ['Resultado: {{resultado}}', 'Observación general: {{observacion}}'],
  ['Inspector: {{firma.inspector.nombre}}', 'Cargo: {{firma.inspector.cargo}}', 'Firma: ____________', 'Fecha: {{firma.inspector.fecha}}'],
]
const textos = [...new Set(filasHoja.flat())]
const indice = new Map(textos.map((t, i) => [t, i]))
const letra = (n) => String.fromCharCode(65 + n)
const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${raiz}/spreadsheetml/2006/main"><sheetData>${filasHoja
  .map((f, r) => `<row r="${r + 1}">${f.map((t, c) => `<c r="${letra(c)}${r + 1}" t="s" s="1"><v>${indice.get(t)}</v></c>`).join('')}</row>`)
  .join('')}<row r="${filasHoja.length + 1}"><c r="A${filasHoja.length + 1}" t="inlineStr"><is><t>Dirección: {{domicilio}}</t></is></c><c r="B${filasHoja.length + 1}"><v>42</v></c></row></sheetData></worksheet>`
// Una marca partida en dos tramos con formato distinto (como queda a veces al editar en Excel).
const compartidos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${raiz}/spreadsheetml/2006/main" count="${textos.length + 1}" uniqueCount="${textos.length + 1}">${textos
  .map((t) => `<si><t xml:space="preserve">${escaparXml(t)}</t></si>`)
  .join('')}<si><r><rPr><b/></rPr><t>Actividad: {{activ</t></r><r><t>idad}}</t></r></si></sst>`
const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${raiz}/spreadsheetml/2006/main"><fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf borderId="1" applyBorder="1"/></cellXfs></styleSheet>`
const original = crearZip([
  { nombre: '[Content_Types].xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${raiz}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
  { nombre: '_rels/.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
  { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><sheets><sheet name="Inspección" sheetId="1" r:id="rId1"/></sheets></workbook>` },
  { nombre: 'xl/_rels/workbook.xml.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${raiz}/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="${raiz}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
  { nombre: 'xl/styles.xml', texto: estilos },
  { nombre: 'xl/sharedStrings.xml', texto: compartidos },
  { nombre: 'xl/worksheets/sheet1.xml', texto: hoja },
  { nombre: 'xl/media/logo.png', bytes: LOGO },
])
mkdirSync('pruebas/excel', { recursive: true })
writeFileSync('pruebas/excel/CRC_formato_extintores_FICTICIO_v01.xlsx', original)

// ───── Inspección ficticia ─────
// La hoja de prueba tiene una firma de «inspector»; el formato real de extintores ya no pide firmas, así que se le agrega aquí.
const receta = { ...PLANTILLAS_BASE.find((p) => p.codigo === 'extintores').receta, firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }] }
const respuestas = Object.fromEntries(receta.secciones[0].puntos.map((p) => [p.clave, { valor: 'si' }]))
respuestas['EXT-03'] = { valor: 'no', obs: 'Manómetro en zona roja' }
respuestas['EXT-05'] = { valor: 'na' }
const PERSONAS = { 'p-1': { nombre: 'Prueba Ficticia, Ana', puesto: 'Supervisora SSO (ficticio)' } }
const datos = {
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123 · Lima', actividad: 'Actividad de prueba' },
  formato: { nombre: 'Inspección de extintores', codigo_formato: 'FIC-EXT-01', version_formato: '02', fecha_aprobacion: '2026-01-15' },
  receta, numero: 17, fecha: '2026-10-26', hora: '09:40', sede: 'Sede ficticia', area: null, ubicacion: 'Almacén', inspector: 'Prueba Ficticia, Ana',
  resultado: 'No conforme', puntaje: 92, observacion: 'Cambiar manómetro & revisar <sello>',
  activo: { codigo: 'EXT-INS-001', datos: { proximo_mantenimiento: '2027-03', capacidad: 6 } },
  respuestas, filas: {},
  firmantes: [{ rol_clave: 'inspector', nombre: PERSONAS['p-1'].nombre, cargo: PERSONAS['p-1'].puesto, fecha: null }],
  persona: (id) => PERSONAS[id]?.nombre ?? null,
}

seccion('Marcas del Excel')
const marcas = await marcasDeExcel(original)
comprobar('Encuentra las marcas de los textos compartidos', marcas.includes('razon_social') && marcas.includes('EXT-13.na'))
comprobar('Encuentra la marca escrita directo en la celda', marcas.includes('domicilio'))
comprobar('Encuentra la marca partida en dos tramos de formato', marcas.includes('actividad'))
comprobar('Cuenta todas las marcas sin repetir', marcas.length === new Set(marcas).size && marcas.length === 13 * 4 + 21, `${marcas.length}`)
comprobar('Reconoce todas las marcas de este formato', marcasDesconocidas(marcas, receta).length === 0, marcasDesconocidas(marcas, receta).join(', '))
comprobar('Avisa las marcas que no existen', JSON.stringify(marcasDesconocidas(['EXT-99', 'firma.supervisor.nombre', 'EXT-01.si', 'activo.lo_que_sea', 'nada.raro'], receta)) === JSON.stringify(['EXT-99', 'firma.supervisor.nombre', 'nada.raro']))

seccion('Valores de una inspección')
const v = valoresDe(datos)
comprobar('Datos de la empresa y del formato', v('razon_social') === datos.empresa.razon_social && v('codigo_formato') === 'FIC-EXT-01' && v('fecha_aprobacion') === '15/01/2026')
comprobar('Fecha en día/mes/año y número de inspección', v('fecha') === '26/10/2026' && v('numero_inspeccion') === '17')
comprobar('Respuesta √ / X / N/A', v('EXT-01') === '√' && v('EXT-03') === 'X' && v('EXT-05') === 'N/A')
comprobar('«X» solo en la columna que toca', v('EXT-03.no') === 'X' && v('EXT-03.si') === '' && v('EXT-05.na') === 'X' && v('EXT-01.si') === 'X')
comprobar('Observación del punto', v('EXT-03.obs') === 'Manómetro en zona roja')
comprobar('Dato del activo (mes como mes/año)', v('activo.proximo_mantenimiento') === '03/2027' && v('activo.capacidad') === '6')
comprobar('Firmante: nombre y cargo; la fecha queda en blanco (se firma a mano)', v('firma.inspector.nombre') === 'Prueba Ficticia, Ana' && v('firma.inspector.cargo') === PERSONAS['p-1'].puesto && v('firma.inspector.fecha') === '')
comprobar('Segundo firmante que no existe: en blanco', v('firma.inspector#2.nombre') === '')
comprobar('Marca desconocida: sin valor', v('EXT-99') === null && v('no_existe') === null)
comprobar('Puntaje con %', v('puntaje') === '92 %')

// Bloque repetible (IPF): {{CLAVE#n}}
const ipf = PLANTILLAS_BASE.find((p) => p.codigo === 'ipf').receta
const rep = ipf.secciones.find((s) => s.repetible)
const persona = rep.puntos.find((p) => p.tipo === 'persona')
const texto = rep.puntos.find((p) => p.tipo === 'texto' || p.tipo === 'texto_largo')
const vIpf = valoresDe({ ...datos, receta: ipf, respuestas: {}, filas: { [rep.clave]: [{ [texto.clave]: { valor: 'Cable expuesto' }, [persona.clave]: { valor: 'p-1' } }] } })
comprobar('Fila 1 de un bloque repetible', vIpf(`${texto.clave}#1`) === 'Cable expuesto')
comprobar('Persona de la fila: su nombre, no su código', vIpf(`${persona.clave}#1`) === 'Prueba Ficticia, Ana')
comprobar('Fila que no existe: en blanco', vIpf(`${texto.clave}#2`) === '')

// Opción marcada con «X» en su casilla (revisión del formato LOTO: tipo de bloqueo Individual / Grupal).
const loto = PLANTILLAS_BASE.find((p) => p.codigo === 'loto').receta
const vLoto = valoresDe({ ...datos, receta: loto, respuestas: { 'LOTO-D02': { valor: 'Grupal' } } })
comprobar('«X» en la casilla de la opción elegida y en blanco en la otra', vLoto('LOTO-D02=Grupal') === 'X' && vLoto('LOTO-D02=Individual') === '')
comprobar('La opción se compara sin tildes ni mayúsculas', vLoto('LOTO-D02= grupal ') === 'X')
comprobar('Reconoce la marca de opción y avisa si el punto no existe', marcasDesconocidas(['LOTO-D02=Individual', 'LOTO-99=Grupal'], loto).join() === 'LOTO-99=Grupal')

seccion('Copia llena del Excel')
const lleno = await llenarExcel(original, v)
const partes = new Map()
for (const e of entradasZip(lleno)) {
  const crudo = lleno.subarray(e.inicio, e.inicio + e.comprimido)
  partes.set(e.nombre, e.metodo === 8 ? await descomprimir(crudo) : crudo)
}
const sst = new TextDecoder().decode(partes.get('xl/sharedStrings.xml'))
const sheet = new TextDecoder().decode(partes.get('xl/worksheets/sheet1.xml'))
comprobar('No queda ninguna marca {{…}}', !sst.includes('{{') && !sheet.includes('{{'))
comprobar('Los textos especiales quedan bien escritos (& < >)', sst.includes('Cambiar manómetro &amp; revisar &lt;sello&gt;'))
comprobar('La marca partida en dos tramos también se llena', sst.includes('Actividad: Actividad de prueba'))
comprobar('La marca escrita en la celda se llena', sheet.includes('Dirección: Av. Inventada 123 · Lima'))
comprobar('La «imagen» del archivo no cambia', partes.get('xl/media/logo.png').length === LOGO.length && partes.get('xl/media/logo.png').every((b, i) => b === LOGO[i]))
// El ajuste de texto agrega formatos al final (celdas con texto largo); los bordes y las fuentes del formato no cambian.
comprobar('Los estilos (bordes) no cambian', new TextDecoder().decode(partes.get('xl/styles.xml')).includes(estilos.match(/<borders[\s\S]*<\/borders>/)[0]))
comprobar('Las celdas que no son marcas no cambian', sheet.includes('<c r="B21"><v>42</v></c>'))
comprobar('Están todas las partes del archivo', partes.size === 8)
const leida = await leerHoja(lleno.buffer.slice(lleno.byteOffset, lleno.byteOffset + lleno.byteLength), 'Inspección')
const fila = (n) => leida.filas.get(n) ?? []
comprobar('Se vuelve a abrir como Excel: encabezado', fila(1)[0] === 'Empresa Ficticia A S.A.C.' && fila(1)[2] === 'Código: FIC-EXT-01 · Versión: 02', JSON.stringify(fila(1)))
comprobar('Se vuelve a abrir como Excel: fila del punto con «X» en «No»', JSON.stringify(fila(8)) === JSON.stringify(['EXT-03', '', 'X', '', 'Manómetro en zona roja']), JSON.stringify(fila(8)))
comprobar('Se vuelve a abrir como Excel: firmante', fila(20)[0] === 'Inspector: Prueba Ficticia, Ana', JSON.stringify(fila(20)))

seccion('Archivos no válidos')
const rechaza = async (b) => marcasDeExcel(b).then(() => false, () => true)
comprobar('Rechaza un archivo que no es Excel', await rechaza(new TextEncoder().encode('esto no es un excel')))
comprobar('Rechaza un ZIP sin libro de Excel', await rechaza(crearZip([{ nombre: 'hola.txt', texto: 'hola' }])))
// Solo .xlsx sin macros (decisión del dueño, 27/10/2026).
const conPartes = (extra) => crearZip([
  { nombre: '[Content_Types].xml', texto: extra.tipos ?? '<Types/>' },
  { nombre: 'xl/workbook.xml', texto: '<workbook/>' },
  ...(extra.vba ? [{ nombre: 'xl/vbaProject.bin', bytes: new Uint8Array([1, 2, 3]) }] : []),
])
comprobar('Rechaza un Excel con macros (trae vbaProject.bin)', await rechaza(conPartes({ vba: true })))
comprobar('Rechaza un libro que se declara «con macros» (.xlsm renombrado)', await rechaza(conPartes({ tipos: '<Types><Override ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>' })))
comprobar('Acepta un .xlsx normal sin macros', !(await rechaza(conPartes({}))))

// ───── Excel por período: una fila por equipo (3.4-D, opción A) ─────
seccion('Excel por período: una fila por equipo')
const celdaI = (ref, t, s = 1) => `<c r="${ref}" t="inlineStr" s="${s}"><is><t>${escaparXml(t)}</t></is></c>`
const vacia = (ref) => `<c r="${ref}" s="1"/>`
const hojaPeriodo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><dimension ref="A1:E12"/><sheetData>` +
  `<row r="1">${celdaI('A1', '{{razon_social}} · {{nombre_formato}}')}${celdaI('D1', 'Período: {{periodo}}')}</row>` +
  `<row r="2">${celdaI('A2', 'Sede: {{sede}}')}${celdaI('D2', 'Avance: {{avance}}')}</row>` +
  `<row r="4">${celdaI('A4', 'Ítem')}${celdaI('B4', 'Código')}${celdaI('C4', 'Resultado')}${celdaI('D4', 'Fecha')}${celdaI('E4', 'Observación')}</row>` +
  `<row r="5" ht="18" customHeight="1">${celdaI('A5', '{{fila.item}}')}${celdaI('B5', '{{fila.activo_codigo}}')}${celdaI('C5', '{{fila.resultado}}')}${celdaI('D5', '{{fila.fecha}}')}${celdaI('E5', '{{fila.EXT-03.obs}}')}</row>` +
  [6, 7, 8].map((n) => `<row r="${n}" ht="18" customHeight="1">${['A', 'B', 'C', 'D', 'E'].map((c) => vacia(`${c}${n}`)).join('')}</row>`).join('') +
  `<row r="10">${celdaI('A10', 'Firma del inspector: ________')}</row><row r="12">${celdaI('A12', 'Nota al pie')}</row>` +
  `</sheetData><mergeCells count="3"><mergeCell ref="D5:E5"/><mergeCell ref="D6:E6"/><mergeCell ref="A10:C10"/></mergeCells>` +
  `<dataValidations count="1"><dataValidation type="list" sqref="C5:C8"><formula1>"a,b"</formula1></dataValidation></dataValidations><drawing r:id="rId1"/></worksheet>`
const dibujo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>0</xdr:row></xdr:from><xdr:to><xdr:col>1</xdr:col><xdr:row>1</xdr:row></xdr:to></xdr:twoCellAnchor><xdr:twoCellAnchor><xdr:from><xdr:col>3</xdr:col><xdr:row>9</xdr:row></xdr:from><xdr:to><xdr:col>4</xdr:col><xdr:row>10</xdr:row></xdr:to></xdr:twoCellAnchor></xdr:wsDr>`
const libroPeriodo = (hoja) => crearZip([
  { nombre: '[Content_Types].xml', texto: '<Types/>' },
  { nombre: 'xl/workbook.xml', texto: `<workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><sheets><sheet name="Ronda" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">Ronda!$A$1:$E$12</definedName></definedNames></workbook>` },
  { nombre: 'xl/_rels/workbook.xml.rels', texto: `<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
  { nombre: 'xl/worksheets/sheet1.xml', texto: hoja },
  { nombre: 'xl/worksheets/_rels/sheet1.xml.rels', texto: `<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>` },
  { nombre: 'xl/drawings/drawing1.xml', texto: dibujo },
])
const ronda = libroPeriodo(hojaPeriodo)
const inspeccionDe = (codigo, valor, obs) => ({ ...datos, numero: 1, fecha: '2026-10-20', activo: { codigo, datos: {} }, respuestas: { ...respuestas, 'EXT-03': { valor, obs } } })
const codigoN = (k) => `EXT-${String(k + 1).padStart(3, '0')}`
const equipos = (n) => Array.from({ length: n }, (_, k) => ({ codigo: codigoN(k), datos: {}, inspeccion: k % 3 === 2 ? null : inspeccionDe(codigoN(k), k === 1 ? 'no' : 'si', k === 1 ? 'Sin manómetro (ficticio)' : null) }))
const periodo = { etiqueta: 'Octubre 2026 · 28/09/2026 al 01/11/2026', desde: '2026-09-28', hasta: '2026-11-01' }
const abrir = async (bytes) => {
  const p = new Map()
  for (const e of entradasZip(bytes)) {
    const crudo = bytes.subarray(e.inicio, e.inicio + e.comprimido)
    p.set(e.nombre, new TextDecoder().decode(e.metodo === 8 ? await descomprimir(crudo) : crudo))
  }
  const h = await leerHoja(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'Ronda')
  return { p, fila: (n) => h.filas.get(n) ?? [] }
}
const sinBytes = (r) => JSON.stringify({ ...r, bytes: undefined })

const r3 = await llenarExcelPeriodo(ronda, valoresGenerales(valoresDe(datos), periodo, { hechos: 2, total: 3 }), valoresFilas(equipos(3)))
const x3 = await abrir(r3.bytes)
comprobar('3 equipos caben en las filas dibujadas: no se agregan filas', r3.filas === 3 && r3.agregadas === 0 && r3.usadasDelFormato === 3, sinBytes(r3))
comprobar('Fila 1: ítem, código, resultado y fecha', JSON.stringify(x3.fila(5).slice(0, 4)) === JSON.stringify(['1', 'EXT-001', 'No conforme', '20/10/2026']), JSON.stringify(x3.fila(5)))
comprobar('Fila 2: la observación del punto', x3.fila(6)[4] === 'Sin manómetro (ficticio)', JSON.stringify(x3.fila(6)))
comprobar('Equipo sin inspección: «No inspeccionado»', x3.fila(7)[1] === 'EXT-003' && x3.fila(7)[2] === 'No inspeccionado', JSON.stringify(x3.fila(7)))
comprobar('Encabezado: período y avance', x3.fila(1)[3] === 'Período: Octubre 2026' && x3.fila(2)[3] === 'Avance: 2 de 3 (67 %)', JSON.stringify([x3.fila(1), x3.fila(2)]))
comprobar('Las filas dibujadas que sobran se quitan: el pie sube y queda justo después del último equipo', x3.fila(9)[0] === 'Firma del inspector: ________' && x3.fila(10).every((c) => !c), JSON.stringify([x3.fila(9), x3.fila(10)]))
comprobar('No queda ninguna marca', ![...x3.p.values()].some((t) => t.includes('{{')))
comprobar('La fila 3 recibe la celda combinada de la fila modelo', x3.p.get('xl/worksheets/sheet1.xml').includes('<mergeCell ref="D7:E7"/>'))
comprobar('Las filas mantienen su estilo (bordes)', /<c r="B7" s="1" t="inlineStr">/.test(x3.p.get('xl/worksheets/sheet1.xml')))

const r6 = await llenarExcelPeriodo(ronda, valoresGenerales(valoresDe(datos), periodo, { hechos: 4, total: 6 }), valoresFilas(equipos(6)))
const x6 = await abrir(r6.bytes)
const h6 = x6.p.get('xl/worksheets/sheet1.xml')
comprobar('6 equipos: usa las 4 filas del formato y agrega 2', r6.agregadas === 2 && r6.usadasDelFormato === 4, sinBytes(r6))
comprobar('Las 6 filas en orden, la 6.ª en la fila 10', x6.fila(10)[1] === 'EXT-006' && x6.fila(9)[1] === 'EXT-005', JSON.stringify([x6.fila(9), x6.fila(10)]))
comprobar('El pie de firmas baja 2 filas (de la 10 a la 12)', x6.fila(12)[0] === 'Firma del inspector: ________' && x6.fila(14)[0] === 'Nota al pie', JSON.stringify([x6.fila(12), x6.fila(14)]))
comprobar('La celda combinada del pie baja con él', h6.includes('<mergeCell ref="A12:C12"/>') && !h6.includes('A10:C10'))
comprobar('Las filas nuevas reciben la celda combinada de la fila modelo', h6.includes('<mergeCell ref="D9:E9"/>') && h6.includes('<mergeCell ref="D10:E10"/>'))
const d6 = x6.p.get('xl/drawings/drawing1.xml')
comprobar('La imagen del pie baja con él; la del encabezado no', d6.includes('<xdr:row>11</xdr:row>') && d6.includes('<xdr:row>0</xdr:row>'), d6)
comprobar('El área de impresión se agranda', x6.p.get('xl/workbook.xml').includes('Ronda!$A$1:$E$14'))
comprobar('El tamaño de la hoja se actualiza', h6.includes('<dimension ref="A1:E14"/>'))
comprobar('Las filas nuevas copian la altura de la fila modelo', /<row r="10"[^>]*ht="18"/.test(h6), h6.match(/<row r="10"[^>]*>/)?.[0])

const r0 = await llenarExcelPeriodo(ronda, valoresGenerales(valoresDe(datos), periodo, { hechos: 0, total: 0 }), [])
const x0 = await abrir(r0.bytes)
comprobar('Sin equipos: la fila modelo queda en blanco y sin marcas', !x0.fila(5).some((c) => typeof c === 'string' && c.trim()) && ![...x0.p.values()].some((t) => t.includes('{{')), JSON.stringify(x0.fila(5)))
const sinModelo = await llenarExcelPeriodo(original, valoresGenerales(valoresDe(datos), periodo, { hechos: 1, total: 1 }), valoresFilas(equipos(3)))
comprobar('Un Excel sin fila modelo solo llena las marcas generales', sinModelo.hoja === null && sinModelo.filas === 0)

seccion('Firma como imagen dentro del Excel')
// Mismo Excel, con la marca {{firma.inspector.imagen}} en la celda «Firma: ____________» combinada en un bloque de 2×2.
const conFirma = crearZip((await partesDe(original)).map((x) => {
  let t = new TextDecoder().decode(x.bytes)
  if (x.nombre === 'xl/sharedStrings.xml') t = t.replace('Firma: ____________', 'Firma: {{firma.inspector.imagen}}')
  if (x.nombre === 'xl/worksheets/sheet1.xml') t = t.replace('</sheetData>', '</sheetData><mergeCells count="1"><mergeCell ref="C20:D21"/></mergeCells>')
  return x.nombre.endsWith('.png') ? x : { nombre: x.nombre, texto: t }
}))
comprobar('Reconoce la marca de la imagen de la firma', (await marcasDeExcel(conFirma)).includes('firma.inspector.imagen') && marcasDesconocidas(['firma.inspector.imagen'], receta).length === 0)
const firmaPng = Uint8Array.from({ length: 120 }, (_, i) => (i * 11) % 256)
const conImagen = await llenarExcel(conFirma, valoresDe(datos), new Map([['firma.inspector.imagen', firmaPng]]))
const piezas = new Map((await partesDe(conImagen)).map((x) => [x.nombre, x]))
const textoParte = (n) => new TextDecoder().decode(piezas.get(n)?.bytes ?? new Uint8Array())
comprobar('La imagen de la firma va dentro del archivo, sin cambios', [...piezas.values()].some((x) => /^xl\/media\/crc_firma_\d+\.png$/.test(x.nombre) && x.bytes.length === 120 && x.bytes.every((b, i) => b === firmaPng[i])))
comprobar('La hoja enlaza un dibujo y el dibujo, la imagen', /<drawing r:id="[^"]+"\/>/.test(textoParte('xl/worksheets/sheet1.xml')) && /crc_firma_1\.png/.test(textoParte('xl/drawings/_rels/drawing1.xml.rels')))
comprobar('La firma queda dentro del bloque combinado (C20:D21)', /<xdr:from><xdr:col>2<\/xdr:col>.*<xdr:row>19<\/xdr:row>.*<xdr:to><xdr:col>3<\/xdr:col>.*<xdr:row>20<\/xdr:row>/.test(textoParte('xl/drawings/drawing1.xml')))

// Logo de la empresa y firmas sin deformarse (revisión de diseño, 29/10/2026). PNG ficticio de 400×100 (solo el encabezado
// importa para el tamaño).
const pngDe = (w, h) => {
  const b = new Uint8Array(64)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, w)
  new DataView(b.buffer).setUint32(20, h)
  return b
}
const conLogoArriba = crearZip((await partesDe(original)).map((x) => {
  let t = new TextDecoder().decode(x.bytes)
  if (x.nombre === 'xl/worksheets/sheet1.xml') t = t.replace('<c r="A1" t="s" s="1"><v>0</v></c>', '').replace('</sheetData>', '</sheetData><mergeCells count="1"><mergeCell ref="A1:B3"/></mergeCells>')
  return x.nombre.endsWith('.png') ? x : { nombre: x.nombre, texto: t }
}))
const conLogo = new Map((await partesDe(await llenarExcel(conLogoArriba, valoresDe(datos), new Map([['logo', pngDe(400, 100)]])))).map((x) => [x.nombre, x]))
const dibujoLogo = new TextDecoder().decode(conLogo.get('xl/drawings/drawing1.xml')?.bytes ?? new Uint8Array())
comprobar('Sin marca {{logo}}, el logo va en el bloque de arriba a la izquierda (A1:B3)', /name="Logo"/.test(dibujoLogo) && /<xdr:from><xdr:col>0<\/xdr:col>.*<xdr:row>0<\/xdr:row>/.test(dibujoLogo))
const desde = dibujoLogo.match(/<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)/)
const hasta = dibujoLogo.match(/<xdr:to><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)/)
comprobar('El logo queda dentro de su bloque', Boolean(desde && hasta) && Number(hasta[1]) <= 1 && Number(hasta[3]) <= 2)
const sinBloque = new Map((await partesDe(await llenarExcel(original, valoresDe(datos), new Map([['logo', pngDe(400, 100)]])))).map((x) => [x.nombre, x]))
comprobar('Si A1 tiene texto o no hay bloque, no se tapa nada con el logo', ![...sinBloque.keys()].some((n) => n.includes('crc_firma')))

// Fotos de evidencia dentro de una fila repetible (IPF): {{foto.CLAVE#n}} en la celda de la foto.
const conFoto = crearZip((await partesDe(original)).map((x) => {
  let t = new TextDecoder().decode(x.bytes)
  if (x.nombre === 'xl/sharedStrings.xml') t = t.replace('Firma: ____________', 'Foto: {{foto.IPF-C03#1}}')
  if (x.nombre === 'xl/worksheets/sheet1.xml') t = t.replace('</sheetData>', '</sheetData><mergeCells count="1"><mergeCell ref="C20:D21"/></mergeCells>')
  return x.nombre.endsWith('.png') ? x : { nombre: x.nombre, texto: t }
}))
comprobar('La marca de foto de una fila se reconoce como imagen y queda en blanco', (await marcasDeExcel(conFoto)).includes('foto.IPF-C03#1')
  && valoresDe(datos)('foto.IPF-C03#1') === '' && marcasDesconocidas(['foto.IPF-C03#1'], PLANTILLAS_BASE.find((x) => x.nombre.includes('seguridad'))?.receta ?? receta).length <= 1)
const conFotoLlena = new Map((await partesDe(await llenarExcel(conFoto, valoresDe(datos), new Map([['foto.IPF-C03#1', pngDe(300, 200)]])))).map((x) => [x.nombre, x]))
comprobar('La foto de la fila va como imagen en su celda', [...conFotoLlena.keys()].some((n) => /^xl\/media\/crc_firma_\d+\.png$/.test(n)))

comprobar('Declara el dibujo y el PNG en los tipos de contenido', textoParte('[Content_Types].xml').includes('/xl/drawings/drawing1.xml') && /Extension="png"/i.test(textoParte('[Content_Types].xml')))
comprobar('La marca de la imagen queda en blanco y el logo no cambia', !textoParte('xl/sharedStrings.xml').includes('{{') && piezas.get('xl/media/logo.png')?.bytes.every((b, i) => b === LOGO[i]))
const sinImagen = new Map((await partesDe(await llenarExcel(conFirma, valoresDe(datos), new Map()))).map((x) => [x.nombre, x]))
comprobar('Sin firma hecha en CRC (en papel), no agrega imagen', ![...sinImagen.keys()].some((n) => n.includes('crc_firma')))

seccion('Filas que se repiten según la inspección (condiciones y firmantes)')
{
  const ipfR = PLANTILLAS_BASE.find((x) => x.codigo === 'ipf').receta
  const celdaT = (ref, t, s = 1) => `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${escaparXml(t)}</t></is></c>`
  const hojaRep = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${raiz}/spreadsheetml/2006/main"><dimension ref="A1:D8"/><cols><col min="1" max="1" width="4" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="4" width="10" customWidth="1"/></cols><sheetData>`
    + `<row r="1">${celdaT('A1', 'No')}${celdaT('B1', 'Detalle')}${celdaT('C1', 'Acción')}</row>`
    + `<row r="2" ht="20" customHeight="1">${celdaT('A2', '{{#}}')}${celdaT('B2', '{{IPF-C01#1}}\n{{IPF-C02#1}}')}${celdaT('C2', '{{IPF-C04#1}}')}<c r="D2" s="1"><v>5</v></c></row>`
    + `<row r="3">${celdaT('A3', '2')}${celdaT('B3', '{{IPF-C01#2}}')}${celdaT('C3', '{{IPF-C04#2}}')}</row>`
    + `<row r="4">${celdaT('A4', 'RESPONSABLES')}</row>`
    + `<row r="5">${celdaT('A5', '{{firma.inspectores.nombre}}')}${celdaT('C5', '{{firma.inspectores.cargo}}')}</row>`
    + `<row r="6">${celdaT('A6', '{{firma.inspectores#2.nombre}}')}${celdaT('C6', '{{firma.inspectores#2.cargo}}')}</row>`
    + `<row r="7"/>`
    + `<row r="8">${celdaT('A8', 'Fin del formato')}</row>`
    + `</sheetData><mergeCells count="2"><mergeCell ref="B2:B2"/><mergeCell ref="A8:D8"/></mergeCells></worksheet>`
  const libroRep = crearZip([
    { nombre: '[Content_Types].xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${raiz}/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>` },
    { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><sheets><sheet name="IPF" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">IPF!$A$1:$D$8</definedName></definedNames></workbook>` },
    { nombre: 'xl/styles.xml', texto: estilos },
    { nombre: 'xl/worksheets/sheet1.xml', texto: hojaRep },
  ])
  const llenarRep = async (nCond, firmantes, extra = {}) => {
    const d = {
      ...datos, receta: ipfR, respuestas: { 'IPF-01': { valor: nCond ? 'si' : 'no' } },
      filas: { condiciones: Array.from({ length: nCond }, (_, i) => ({ 'IPF-C01': { valor: `Peligro ${i + 1}` }, 'IPF-C02': { valor: `Riesgo ${i + 1}` }, 'IPF-C04': { valor: `Acción ${i + 1} ` + 'larga '.repeat(extra.largo ?? 0) } })) },
      firmantes: firmantes.map((n, i) => ({ rol_clave: 'inspectores', nombre: n, cargo: `Cargo ${i + 1}`, fecha: null })),
    }
    const zip = await llenarExcel(libroRep, valoresDe(d), undefined, gruposDe(d))
    const ps = new Map((await partesDe(zip)).map((x) => [x.nombre, new TextDecoder().decode(x.bytes)]))
    const xml = ps.get('xl/worksheets/sheet1.xml')
    return { xml, ps, filas: [...xml.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1])), textos: (n) => [...xml.matchAll(new RegExp(`<c r="[A-Z]+${n}"[^>]*>(?:<is><t[^>]*>([^<]*)</t></is>)?`, 'g'))].map((m) => m[1]).filter(Boolean) }
  }
  const unaC = await llenarRep(1, ['Ana'])
  comprobar('Una sola condición: una sola fila de condiciones (la segunda del formato se quita)', unaC.filas.join() === '1,2,3,4,5,6' && unaC.textos(2).includes('1') && unaC.textos(2).some((t) => t.includes('Peligro 1')), unaC.filas.join())
  comprobar('Un solo firmante: una sola fila de firma y sin fila vacía', !unaC.xml.includes('{{') && unaC.textos(4).includes('Ana') && !unaC.textos(5).some((t) => t.includes('Cargo 2')))
  comprobar('Lo que sigue baja o sube con las filas (celda combinada final)', unaC.xml.includes('<mergeCell ref="A6:D6"/>') && unaC.xml.includes('<dimension ref="A1:D6"/>') && unaC.ps.get('xl/workbook.xml').includes('$D$6'), unaC.xml.match(/<mergeCells[\s\S]*?<\/mergeCells>/)?.[0])
  const tresC = await llenarRep(3, ['Ana', 'Beto'])
  comprobar('Tres condiciones: tres filas numeradas 1, 2 y 3', tresC.filas.slice(0, 5).join() === '1,2,3,4,5' && ['1', '2', '3'].every((n, i) => tresC.textos(i + 2).includes(n)) && tresC.textos(4).some((t) => t.includes('Peligro 3')))
  comprobar('Dos firmantes: dos filas, cada una con su nombre y su cargo', tresC.textos(6).includes('Ana') && tresC.textos(7).includes('Beto') && tresC.textos(7).includes('Cargo 2'), tresC.filas.join())
  comprobar('El pie baja las filas que se agregaron', tresC.xml.includes('<mergeCell ref="A9:D9"/>') && tresC.ps.get('xl/workbook.xml').includes('$D$9'), tresC.xml.match(/<mergeCells[\s\S]*?<\/mergeCells>/)?.[0])
  const sinC = await llenarRep(0, ['Ana'])
  comprobar('Sin condiciones: una sola fila que dice «Sin observaciones»', sinC.textos(2).some((t) => t.includes('Sin observaciones')) && !sinC.xml.includes('Peligro'))
  const largo = await llenarRep(1, ['Ana'], { largo: 30 })
  comprobar('Si el texto no cabe, la fila crece y la celda ajusta el texto', Number(largo.xml.match(/<row r="2"[^>]*\sht="([\d.]+)"/)?.[1]) > 20 && /wrapText="1"/.test(largo.ps.get('xl/styles.xml')), `${largo.xml.match(/<row r="2"[^>]*>/)?.[0]} ${largo.ps.get('xl/styles.xml').match(/<cellXfs[\s\S]*<\/cellXfs>/)?.[0]}`)
  const corto = await llenarRep(1, ['Ana'])
  comprobar('Si el texto cabe, la altura de la fila no cambia', Number(corto.xml.match(/<row r="2"[^>]*\sht="([\d.]+)"/)?.[1]) <= 40)
}

const r = resumen()
const lineas = [
  '# Pruebas del Excel de la organización (tarea 3.4-C)',
  '',
  `Fecha: ${new Date().toISOString()} · Datos: FICTICIOS, sin base de datos · **${r.ok} de ${r.total} correctas**`,
  '',
  'Ejemplo ficticio generado: `pruebas/excel/CRC_formato_extintores_FICTICIO_v01.xlsx` (diseño inventado; no copia formatos reales).',
  '',
]
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/excel-inspeccion.md', lineas.join('\n'))
process.exit(r.ok === r.total ? 0 : 1)
