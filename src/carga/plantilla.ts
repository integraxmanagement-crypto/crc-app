// Plantilla Excel de carga de personal, armada para cada empresa (tarea 3.6, decisión 4A).
// Trae listas desplegables con los puestos y la estructura actual de la empresa, y una hoja de instrucciones.
// Si la empresa no usa subáreas o líneas, la columna no aparece.
import { COLUMNAS, FILAS_MAXIMAS, HOJA } from './lectura.ts'
import { crearZip, escaparXml, letraColumna } from './xlsx.ts'

export type DatosPlantilla = {
  empresa: string
  puestos: string[]
  gerencias: string[]
  areas: string[]
  subareas: string[] // vacío = la empresa no usa subáreas
}

const ULTIMA = FILAS_MAXIMAS + 1 // filas 2 a 301

function celdaTexto(ref: string, valor: string, estilo = 0) {
  return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

function hojaXml(filas: string[], extra = '', columnas = '', congelar = false) {
  const vista = congelar
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${vista}${columnas}<sheetData>${filas.join('')}</sheetData>${extra}</worksheet>`
}

/** Devuelve el archivo .xlsx listo para descargar. */
export function crearPlantilla(d: DatosPlantilla): Uint8Array {
  const conSubareas = d.subareas.length > 0
  const columnas = COLUMNAS.filter((c) => c.clave !== 'subarea' || conSubareas)
  const col = (clave: string) => letraColumna(columnas.findIndex((c) => c.clave === clave))

  // Hoja «Listas» (oculta): una columna por lista desplegable.
  const listas: [string, string[]][] = [
    ['tipo_documento', ['DNI', 'CE', 'PAS']],
    ['rol', ['gestor', 'usuario']],
    ['puesto', d.puestos],
    ['gerencia', d.gerencias],
    ['area', d.areas],
    ['subarea_o_linea', d.subareas],
  ]
  const largo = Math.max(...listas.map(([, v]) => v.length))
  const filasListas: string[] = []
  for (let f = 0; f <= largo; f++) {
    const celdas = listas
      .map(([titulo, valores], i) => (f === 0 ? celdaTexto(`${letraColumna(i)}1`, titulo, 1) : valores[f - 1] != null ? celdaTexto(`${letraColumna(i)}${f + 1}`, valores[f - 1]) : ''))
      .join('')
    filasListas.push(`<row r="${f + 1}">${celdas}</row>`)
  }
  const rango = (i: number, n: number) => `Listas!$${letraColumna(i)}$2:$${letraColumna(i)}$${n + 1}`

  // Validaciones: tipo y rol no admiten otra cosa; puestos y estructura avisan, pero dejan escribir uno nuevo
  // (la vista previa ofrecerá crearlo antes de seguir, decisión del dueño).
  const validaciones: string[] = []
  const validar = (clave: string, formula: string, estricta: boolean, aviso: string) => {
    const c = col(clave)
    validaciones.push(
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="${estricta ? 'stop' : 'information'}" errorTitle="CRC" error="${escaparXml(aviso)}" sqref="${c}2:${c}${ULTIMA}"><formula1>${formula}</formula1></dataValidation>`,
    )
  }
  validar('tipo', '"DNI,CE,PAS"', true, 'Elige DNI, CE (carnet de extranjería) o PAS (pasaporte).')
  validar('rol', '"gestor,usuario"', true, 'Solo «gestor» o «usuario». Los administradores los crea Integrax.')
  if (d.puestos.length) validar('puesto', rango(2, d.puestos.length), false, 'Ese puesto no está en la lista de la empresa. CRC te ofrecerá crearlo al cargar.')
  if (d.gerencias.length) validar('gerencia', rango(3, d.gerencias.length), false, 'Esa gerencia no está en la estructura de la empresa. CRC te ofrecerá crearla al cargar.')
  if (d.areas.length) validar('area', rango(4, d.areas.length), false, 'Esa área no está en la estructura de la empresa. CRC te ofrecerá crearla al cargar.')
  if (conSubareas) validar('subarea', rango(5, d.subareas.length), false, 'Esa subárea no está en la estructura. Si el área no tiene subáreas, deja la celda vacía.')

  // Hoja «Personal»: títulos en negrita; documento como texto (no pierde ceros) y fecha como fecha.
  const anchos = { tipo: 16, numero: 18, nombres: 38, fecha: 15, puesto: 30, gerencia: 24, area: 24, subarea: 22, rol: 12 } as Record<string, number>
  const estiloCol = (clave: string) => (clave === 'numero' ? 2 : clave === 'fecha' ? 3 : 0)
  const cols = `<cols>${columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${anchos[c.clave]}" customWidth="1"${estiloCol(c.clave) ? ` style="${estiloCol(c.clave)}"` : ''}/>`).join('')}</cols>`
  const titulos = `<row r="1">${columnas.map((c, i) => celdaTexto(`${letraColumna(i)}1`, c.titulo, 1)).join('')}</row>`
  const personal = hojaXml([titulos], `<dataValidations count="${validaciones.length}">${validaciones.join('')}</dataValidations>`, cols, true)

  const instrucciones = [
    `PLANTILLA DE CARGA DE PERSONAL · CRC · ${d.empresa}`,
    '',
    'Cómo se usa',
    '1. Llena solo la hoja «Personal»: una fila por persona, sin cambiar los títulos de la primera fila.',
    '2. tipo_documento: DNI, CE (carnet de extranjería) o PAS (pasaporte).',
    '3. numero_documento: se escribe tal cual. La columna ya está como texto, así no se pierden los ceros a la izquierda.',
    '4. apellidos_y_nombres: juntos, en una sola columna (por ejemplo «Quispe Ramos, Luis Alberto»).',
    '5. fecha_ingreso: día/mes/año.',
    '6. puesto, gerencia y área: elige de la lista. Si escribes uno nuevo, CRC te lo avisará y podrás crearlo antes de cargar.',
    conSubareas
      ? '7. subarea_o_linea: opcional. Si el área no tiene subáreas, deja la celda vacía o repite el área: CRC lo trata igual.'
      : '7. Esta empresa no usa subáreas o líneas: por eso esa columna no aparece.',
    '8. rol: «gestor» (equipo SSO) o «usuario» (trabajadores). Los administradores los crea únicamente Integrax.',
    '',
    `Máximo ${FILAS_MAXIMAS} personas y 1 MB por archivo. Guárdalo como .xlsx.`,
    'Al subirlo, CRC muestra primero una vista previa: no se guarda nada hasta que confirmes.',
    'Las personas que ya existen se reconocen por su tipo y número de documento: no se les cambia la contraseña.',
  ]
  const hojaInstr = hojaXml(
    instrucciones.map((t, i) => `<row r="${i + 1}">${t ? celdaTexto(`A${i + 1}`, t, i === 0 || t === 'Cómo se usa' ? 1 : 0) : ''}</row>`),
    '',
    '<cols><col min="1" max="1" width="120" customWidth="1"/></cols>',
  )

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3C5D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

  const raiz = 'http://schemas.openxmlformats.org'
  return crearZip([
    {
      nombre: '[Content_Types].xml',
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${raiz}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      nombre: '_rels/.rels',
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${HOJA}" sheetId="1" r:id="rId1"/><sheet name="Instrucciones" sheetId="2" r:id="rId2"/><sheet name="Listas" sheetId="3" state="hidden" r:id="rId3"/></sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="${raiz}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nombre: 'xl/styles.xml', texto: estilos },
    { nombre: 'xl/worksheets/sheet1.xml', texto: personal },
    { nombre: 'xl/worksheets/sheet2.xml', texto: hojaInstr },
    { nombre: 'xl/worksheets/sheet3.xml', texto: hojaXml(filasListas) },
  ])
}
