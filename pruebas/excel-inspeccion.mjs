// Prueba del Excel de la organización (tarea 3.4-C): marcas {{…}}, llenado de una copia por inspección y que el
// resto del archivo (imágenes, estilos) no cambie. No usa la base de datos: todo es FICTICIO y corre en la computadora.
// También deja un Excel ficticio de ejemplo (formato de extintores) en pruebas/excel/ para probarlo en la app.
// Uso: node pruebas/excel-inspeccion.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { crearZip, descomprimir, entradasZip, escaparXml, leerHoja } from '../src/carga/xlsx.ts'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { llenarExcel, marcasDeExcel, marcasDesconocidas, valoresDe } from '../src/inspecciones/excel.ts'
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
const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'extintores').receta
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
comprobar('Los estilos (bordes) no cambian', new TextDecoder().decode(partes.get('xl/styles.xml')) === estilos)
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
