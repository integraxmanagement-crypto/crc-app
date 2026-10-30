// Carga masiva de equipos (pedido del dueño, 29/10/2026): extintores y dispositivos del sistema DACI. Se descarga una plantilla Excel
// con las columnas que pide el tipo de activo (las obligatorias van marcadas con *), se llena y se sube. Antes de grabar nada se revisa
// toda la hoja: si alguna fila tiene un error (celda obligatoria vacía, dato que no está en la lista, código repetido…) se avisa fila por
// fila qué corregir y NO se carga ningún equipo. Sin librerías: usa el mismo lector y escritor de .xlsx de la carga de personal.
import { type Celda, ErrorExcel, crearZip, escaparXml, fechaDeExcel, leerHoja, letraColumna } from '../carga/xlsx.ts'
import { fechaDeTexto } from '../carga/lectura.ts'
import type { CampoFicha } from '../formatos/base.ts'

export const HOJA_EQUIPOS = 'Equipos'
export const FILAS_MAXIMAS_EQUIPOS = 300

export type ContextoCarga = {
  tipo: { id: string; nombre: string; subtipos: { codigo: string; nombre: string }[]; campos: CampoFicha[] }
  sedes: { id: string; nombre: string }[] // las activas
  unidades: { id: string; nombre: string; ruta: string }[] // áreas y subáreas vigentes, con su camino
  ubicaciones: { id: string; sede_id: string; unidad_id: string | null; nombre: string }[] // las vigentes
  personas: { persona_id: string; apellidos_nombres: string }[]
  listas: Record<string, string[]> // código de lista → valores vigentes
  codigosExistentes: string[] // los equipos de este tipo que ya existen
  exigirTodo: boolean // extintores: área, ubicación, responsable y los dos años son obligatorios
}

type Col = { clave: string; titulo: string; obligatoria: boolean; ancho: number; campo?: CampoFicha }
const OBLIGATORIOS_EXIGIDOS = ['anio_fabricacion', 'anio_prueba_hidrostatica']

// NFKD: «CO2» y «CO₂» cuentan igual; sin tildes, mayúsculas ni signos.
const simple = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const texto = (c: Celda | undefined) => (c == null ? '' : String(c).replace(/\s+/g, ' ').trim())

/** Las columnas de la plantilla, en orden, según el tipo de activo. */
export function columnasDe(ctx: ContextoCarga): Col[] {
  const cols: Col[] = [{ clave: 'codigo', titulo: 'Código', obligatoria: true, ancho: 16 }]
  if (ctx.sedes.length > 1) cols.push({ clave: 'sede', titulo: 'Sede', obligatoria: true, ancho: 22 })
  if (ctx.tipo.subtipos.length) cols.push({ clave: 'subtipo', titulo: 'Subtipo', obligatoria: true, ancho: 26 })
  cols.push({ clave: 'area', titulo: 'Área', obligatoria: ctx.exigirTodo, ancho: 28 })
  cols.push({ clave: 'ubicacion', titulo: 'Ubicación', obligatoria: ctx.exigirTodo, ancho: 26 })
  cols.push({ clave: 'responsable', titulo: 'Responsable', obligatoria: ctx.exigirTodo, ancho: 32 })
  for (const c of ctx.tipo.campos) {
    const calculado = Boolean(c.calcula && ctx.tipo.campos.some((x) => x.clave === c.calcula!.desde))
    const obligatoria = (c.obligatorio && !calculado) || (ctx.exigirTodo && OBLIGATORIOS_EXIGIDOS.includes(c.clave))
    cols.push({ clave: `campo.${c.clave}`, titulo: c.etiqueta, obligatoria, ancho: c.tipo === 'texto_largo' ? 36 : 22, campo: c })
  }
  return cols
}

const tituloColumna = (c: Col) => `${c.titulo}${c.obligatoria ? ' *' : ''}`

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

/** El .xlsx de la plantilla, listo para descargar: hoja «Equipos», instrucciones y las listas (ocultas) para elegir. */
export function crearPlantillaEquipos(ctx: ContextoCarga, empresa: string): Uint8Array {
  const cols = columnasDe(ctx)
  const ULTIMA = FILAS_MAXIMAS_EQUIPOS + 1
  // Listas desplegables: una columna de la hoja oculta «Listas» por cada una.
  const listas: { clave: string; valores: string[] }[] = []
  const agregar = (clave: string, valores: string[]) => valores.length && listas.push({ clave, valores })
  agregar('sede', ctx.sedes.map((s) => s.nombre))
  agregar('subtipo', ctx.tipo.subtipos.map((s) => s.nombre))
  agregar('area', ctx.unidades.map((u) => u.ruta))
  agregar('ubicacion', [...new Set(ctx.ubicaciones.map((u) => u.nombre))].sort((a, b) => a.localeCompare(b, 'es')))
  agregar('responsable', ctx.personas.map((p) => p.apellidos_nombres))
  for (const c of cols) if (c.campo?.tipo === 'lista' && c.campo.lista) agregar(c.clave, ctx.listas[c.campo.lista] ?? [])
  const largo = Math.max(1, ...listas.map((l) => l.valores.length))
  const filasListas: string[] = []
  for (let f = 0; f <= largo; f++) {
    const celdas = listas
      .map((l, i) => (f === 0 ? celdaTexto(`${letraColumna(i)}1`, l.clave, 1) : l.valores[f - 1] != null ? celdaTexto(`${letraColumna(i)}${f + 1}`, l.valores[f - 1]) : ''))
      .join('')
    filasListas.push(`<row r="${f + 1}">${celdas}</row>`)
  }
  const validaciones = cols.flatMap((c, i) => {
    const k = listas.findIndex((l) => l.clave === c.clave)
    if (k < 0) return []
    const letra = letraColumna(i)
    const n = listas[k].valores.length + 1
    const estricta = c.clave === 'subtipo' || c.campo?.tipo === 'lista'
    return [`<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="${estricta ? 'stop' : 'information'}" errorTitle="CRC" error="${escaparXml(`Elige un valor de la lista para «${c.titulo}».`)}" sqref="${letra}2:${letra}${ULTIMA}"><formula1>Listas!$${letraColumna(k)}$2:$${letraColumna(k)}$${n}</formula1></dataValidation>`]
  })
  const textoCols = new Set(['codigo'])
  const cabecera = `<row r="1">${cols.map((c, i) => celdaTexto(`${letraColumna(i)}1`, tituloColumna(c), 1)).join('')}</row>`
  const columnas = `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho}" customWidth="1"${textoCols.has(c.clave) ? ' style="2"' : ''}/>`).join('')}</cols>`
  const equipos = hojaXml([cabecera], validaciones.length ? `<dataValidations count="${validaciones.length}">${validaciones.join('')}</dataValidations>` : '', columnas, true)

  const obligatorias = cols.filter((c) => c.obligatoria).map((c) => c.titulo)
  const instrucciones = [
    `PLANTILLA DE CARGA DE EQUIPOS · ${ctx.tipo.nombre} · CRC · ${empresa}`,
    '',
    'Cómo se usa',
    `1. Llena solo la hoja «${HOJA_EQUIPOS}»: una fila por equipo, sin cambiar los títulos de la primera fila.`,
    `2. Las columnas con * son obligatorias: ${obligatorias.join(', ')}.`,
    '3. Donde hay lista (sede, área, ubicación, responsable, agente…), elige de la lista: si escribes algo distinto, CRC te avisará qué corregir.',
    '4. Los meses se escriben como mes/año (por ejemplo 03/2026). Los años, con 4 cifras (por ejemplo 2021).',
    ctx.tipo.campos.some((c) => c.calcula) ? '5. El próximo mantenimiento se calcula solo (+12 meses) si lo dejas vacío.' : '5. Si una columna no aplica a tu equipo, déjala vacía (solo si no lleva *).',
    '',
    `Máximo ${FILAS_MAXIMAS_EQUIPOS} equipos y 1 MB por archivo. Guárdalo como .xlsx.`,
    'Al subirlo, CRC revisa todo antes de cargar. Si hay errores, te dice en qué fila y qué corregir, y no se carga ningún equipo.',
  ]
  const hojaInstr = hojaXml(
    instrucciones.map((t, i) => `<row r="${i + 1}">${t ? celdaTexto(`A${i + 1}`, t, i === 0 || t === 'Cómo se usa' ? 1 : 0) : ''}</row>`),
    '',
    '<cols><col min="1" max="1" width="120" customWidth="1"/></cols>',
  )
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3C5D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
  const raiz = 'http://schemas.openxmlformats.org'
  const hoja = (n: number) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  return crearZip([
    { nombre: '[Content_Types].xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="${raiz}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hoja(1)}${hoja(2)}${hoja(3)}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: '_rels/.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${HOJA_EQUIPOS}" sheetId="1" r:id="rId1"/><sheet name="Instrucciones" sheetId="2" r:id="rId2"/><sheet name="Listas" sheetId="3" state="hidden" r:id="rId3"/></sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="${raiz}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', texto: estilos },
    { nombre: 'xl/worksheets/sheet1.xml', texto: equipos },
    { nombre: 'xl/worksheets/sheet2.xml', texto: hojaInstr },
    { nombre: 'xl/worksheets/sheet3.xml', texto: hojaXml(filasListas) },
  ])
}

// ───────────────────────── Lectura y revisión ─────────────────────────

export type DatosEquipo = {
  tipo_id: string
  codigo: string
  subtipo: string | null
  sede_id: string
  unidad_id: string | null
  ubicacion_id: string | null
  responsable_id: string | null
  datos: Record<string, string | number | null>
  dotacion: Record<string, number | null>
}
export type ErrorFila = { fila: number; mensaje: string }
export type Revision = { listos: { fila: number; datos: DatosEquipo }[]; errores: ErrorFila[]; filas: number }

function siguienteMes(mes: string, meses: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + meses, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** «03/2026», «2026-03», «15/03/2026» o una fecha de Excel → «2026-03»; null si no se entiende. */
function mesDe(c: Celda | undefined, fechas1904: boolean): string | null {
  if (c == null || c === '') return ''
  if (typeof c === 'number') return fechaDeExcel(c, fechas1904)?.slice(0, 7) ?? null
  const t = String(c).trim()
  let m = t.match(/^(\d{4})-(\d{1,2})$/)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`
  return fechaDeTexto(t)?.slice(0, 7) ?? null
}

const buscar = (valores: string[], escrito: string) => {
  const e = simple(escrito)
  return valores.find((v) => simple(v) === e) ?? null
}

/** Lee la hoja «Equipos» y revisa todas las filas. No graba nada. */
export async function revisarEquipos(archivo: ArrayBuffer, ctx: ContextoCarga): Promise<Revision> {
  const hoja = await leerHoja(archivo, HOJA_EQUIPOS)
  const cols = columnasDe(ctx)
  const numeros = [...hoja.filas.keys()].sort((a, b) => a - b)
  // La fila de títulos es la primera (de las 10 primeras) donde se reconocen al menos 2 columnas.
  const reconocer = (fila: Celda[]) => {
    const mapa = new Map<string, number>()
    fila.forEach((c, i) => {
      const t = simple(texto(c))
      const col = cols.find((k) => simple(k.titulo) === t || simple(k.clave.replace('campo.', '')) === t)
      if (col && !mapa.has(col.clave)) mapa.set(col.clave, i)
    })
    return mapa
  }
  let filaTitulos = -1
  let posiciones = new Map<string, number>()
  for (const n of numeros.slice(0, 10)) {
    const p = reconocer(hoja.filas.get(n) ?? [])
    if (p.size >= 2) {
      filaTitulos = n
      posiciones = p
      break
    }
  }
  if (filaTitulos < 0) throw new ErrorExcel('No se encontraron los títulos de las columnas. Usa la plantilla de CRC y no cambies la primera fila.')
  const faltan = cols.filter((c) => c.obligatoria && !posiciones.has(c.clave))
  if (faltan.length) throw new ErrorExcel(`Faltan columnas obligatorias en el Excel: ${faltan.map((c) => c.titulo).join(', ')}. Usa la plantilla de CRC.`)

  const filas = numeros.filter((n) => n > filaTitulos).filter((n) => (hoja.filas.get(n) ?? []).some((c) => texto(c) !== ''))
  if (!filas.length) throw new ErrorExcel('El Excel no tiene equipos: llena al menos una fila debajo de los títulos.')
  if (filas.length > FILAS_MAXIMAS_EQUIPOS) throw new ErrorExcel(`El Excel trae ${filas.length} equipos y el máximo es ${FILAS_MAXIMAS_EQUIPOS}. Divide la carga en varios archivos.`)

  const existentes = new Set(ctx.codigosExistentes.map((c) => c.toLowerCase()))
  const vistos = new Map<string, number>()
  const listos: Revision['listos'] = []
  const errores: ErrorFila[] = []

  for (const n of filas) {
    const fila = hoja.filas.get(n) ?? []
    const dato = (clave: string) => (posiciones.has(clave) ? fila[posiciones.get(clave)!] : undefined)
    const t = (clave: string) => texto(dato(clave))
    const problemas: string[] = []
    const mal = (m: string) => problemas.push(m)

    const codigo = t('codigo')
    if (!codigo) mal('falta el código')
    else if (codigo.length > 40) mal('el código es muy largo (máximo 40)')
    else if (existentes.has(codigo.toLowerCase())) mal(`ya existe un equipo con el código «${codigo}»`)
    else if (vistos.has(codigo.toLowerCase())) mal(`el código «${codigo}» está repetido (también en la fila ${vistos.get(codigo.toLowerCase())})`)
    if (codigo) vistos.set(codigo.toLowerCase(), vistos.get(codigo.toLowerCase()) ?? n)

    let sede = ctx.sedes.length === 1 ? ctx.sedes[0] : null
    if (ctx.sedes.length > 1) {
      const s = t('sede')
      if (!s) mal('falta la sede')
      else {
        const nombre = buscar(ctx.sedes.map((x) => x.nombre), s)
        sede = nombre ? (ctx.sedes.find((x) => x.nombre === nombre) ?? null) : null
        if (!sede) mal(`la sede «${s}» no existe (sedes: ${ctx.sedes.map((x) => x.nombre).join(', ')})`)
      }
    }

    let subtipo: string | null = null
    if (ctx.tipo.subtipos.length) {
      const s = t('subtipo')
      if (!s) mal('falta el subtipo')
      else {
        const encontrado = ctx.tipo.subtipos.find((x) => simple(x.nombre) === simple(s) || simple(x.codigo) === simple(s))
        if (!encontrado) mal(`el subtipo «${s}» no es válido (${ctx.tipo.subtipos.map((x) => x.nombre).join(', ')})`)
        else subtipo = encontrado.codigo
      }
    }

    let unidad: string | null = null
    const a = t('area')
    if (a) {
      const porRuta = ctx.unidades.filter((u) => simple(u.ruta) === simple(a))
      const porNombre = ctx.unidades.filter((u) => simple(u.nombre) === simple(a) || simple(u.ruta.split('›').pop() ?? '') === simple(a))
      const encontrados = porRuta.length ? porRuta : porNombre
      if (!encontrados.length) mal(`el área «${a}» no existe en la estructura de la empresa`)
      else if (encontrados.length > 1) mal(`el área «${a}» está en más de un lugar: escribe el camino completo (por ejemplo «${encontrados[0].ruta}»)`)
      else unidad = encontrados[0].id
    } else if (ctx.exigirTodo) mal('falta el área')

    let ubicacion: string | null = null
    const u = t('ubicacion')
    if (u) {
      const candidatas = ctx.ubicaciones.filter((x) => simple(x.nombre) === simple(u) && (!sede || x.sede_id === sede.id))
      const mejores = unidad ? candidatas.filter((x) => x.unidad_id === unidad) : []
      const elegidas = mejores.length ? mejores : candidatas
      if (!elegidas.length) mal(`la ubicación «${u}» no existe${sede ? ` en la sede ${sede.nombre}` : ''}`)
      else if (elegidas.length > 1) mal(`la ubicación «${u}» está repetida en la sede: ajusta su nombre en «Ubicaciones»`)
      else ubicacion = elegidas[0].id
    } else if (ctx.exigirTodo) mal('falta la ubicación')

    let responsable: string | null = null
    const r = t('responsable')
    if (r) {
      const p = ctx.personas.find((x) => simple(x.apellidos_nombres) === simple(r))
      if (!p) mal(`el responsable «${r}» no es una persona activa de la empresa`)
      else responsable = p.persona_id
    } else if (ctx.exigirTodo) mal('falta el responsable')

    const datos: DatosEquipo['datos'] = {}
    for (const c of cols.filter((x) => x.campo)) {
      const campo = c.campo!
      if (campo.solo_subtipos?.length && !(subtipo && campo.solo_subtipos.includes(subtipo))) continue
      const crudo = dato(c.clave)
      const vacio = texto(crudo) === ''
      if (vacio) {
        if (c.obligatoria) mal(`falta «${c.titulo}»`)
        continue
      }
      if (campo.tipo === 'numero') {
        const v = Number(texto(crudo).replace(',', '.'))
        if (!Number.isFinite(v) || v < 0) mal(`«${c.titulo}» debe ser un número (por ejemplo 6 o 2.5)`)
        else datos[campo.clave] = v
      } else if (campo.tipo === 'anio') {
        const v = Number(texto(crudo))
        if (!Number.isInteger(v) || v < 1900 || v > 2100) mal(`«${c.titulo}» debe ser un año de 4 cifras (por ejemplo 2021)`)
        else datos[campo.clave] = v
      } else if (campo.tipo === 'mes') {
        const m = mesDe(crudo, hoja.fechas1904)
        if (!m) mal(`«${c.titulo}» debe ser mes y año (por ejemplo 03/2026)`)
        else datos[campo.clave] = m
      } else if (campo.tipo === 'lista') {
        const valores = (campo.lista && ctx.listas[campo.lista]) || []
        const v = buscar(valores, texto(crudo))
        if (!v) mal(`«${c.titulo}»: «${texto(crudo)}» no está en la lista${valores.length ? ` (${valores.join(', ')})` : ''}`)
        else datos[campo.clave] = v
      } else datos[campo.clave] = texto(crudo).slice(0, 2000)
    }
    // El valor que se calcula solo (próximo mantenimiento = último + 12 meses) si quedó vacío.
    for (const c of ctx.tipo.campos)
      if (c.calcula && datos[c.clave] == null && typeof datos[c.calcula.desde] === 'string') datos[c.clave] = siguienteMes(datos[c.calcula.desde] as string, c.calcula.meses)

    if (problemas.length) errores.push({ fila: n, mensaje: problemas.join('; ') })
    else listos.push({ fila: n, datos: { tipo_id: ctx.tipo.id, codigo, subtipo, sede_id: sede!.id, unidad_id: unidad, ubicacion_id: ubicacion, responsable_id: responsable, datos, dotacion: {} } })
  }
  return { listos, errores, filas: filas.length }
}
