// Convierte la hoja «Personal» del Excel en registros simples, uno por fila (tarea 3.6, paso 3).
// Aquí solo se LEE: las reglas (documento válido, repetidos, listas de la empresa…) se revisan en la vista previa.
import { type Celda, ErrorExcel, fechaDeExcel, leerHoja, letraColumna } from './xlsx.ts'

export const FILAS_MAXIMAS = 300 // decisión 5A
export const HOJA = 'Personal'

export type Clave = 'tipo' | 'numero' | 'nombres' | 'fecha' | 'puesto' | 'gerencia' | 'area' | 'subarea' | 'rol'

/** Columnas de la plantilla, en orden. Se aceptan variantes del título (con o sin tildes, espacios o guiones). */
export const COLUMNAS: { clave: Clave; titulo: string; otros: string[]; obligatoria: boolean }[] = [
  { clave: 'tipo', titulo: 'tipo_documento', otros: ['tipo de documento', 'tipo doc', 'tipo'], obligatoria: true },
  { clave: 'numero', titulo: 'numero_documento', otros: ['numero de documento', 'nro documento', 'documento', 'dni'], obligatoria: true },
  { clave: 'nombres', titulo: 'apellidos_y_nombres', otros: ['apellidos y nombres', 'nombres y apellidos', 'nombres'], obligatoria: true },
  { clave: 'fecha', titulo: 'fecha_ingreso', otros: ['fecha de ingreso', 'ingreso'], obligatoria: true },
  { clave: 'puesto', titulo: 'puesto', otros: ['cargo'], obligatoria: true },
  { clave: 'gerencia', titulo: 'gerencia', otros: [], obligatoria: true },
  { clave: 'area', titulo: 'area', otros: [], obligatoria: true },
  { clave: 'subarea', titulo: 'subarea_o_linea', otros: ['subarea', 'linea', 'subarea o linea', 'sub area'], obligatoria: false },
  { clave: 'rol', titulo: 'rol', otros: [], obligatoria: true },
]

export type Registro = {
  fila: number // número de fila en el Excel, para que la persona lo encuentre
  tipo: string
  numero: string
  numeroEraNumero: boolean // Excel lo guardó como número: pudo perder ceros a la izquierda
  nombres: string
  fecha: string | null // aaaa-mm-dd si es una fecha real
  fechaTexto: string // lo que venía escrito, para mostrarlo si no es válida
  puesto: string
  gerencia: string
  area: string
  subarea: string
  rol: string
}

export type Lectura = { hoja: string; registros: Registro[]; conSubareas: boolean }

const simple = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const texto = (c: Celda | undefined) => (c == null ? '' : String(c).replace(/\s+/g, ' ').trim())

/** «31/02/2022» → null; «5/3/2021» o «2021-03-05» → «2021-03-05». */
export function fechaDeTexto(t: string): string | null {
  const s = t.trim()
  let d: number, m: number, a: number
  let r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (r) {
    d = Number(r[1])
    m = Number(r[2])
    a = Number(r[3]) < 100 ? 2000 + Number(r[3]) : Number(r[3])
  } else if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    a = Number(r[1])
    m = Number(r[2])
    d = Number(r[3])
  } else return null
  const f = new Date(Date.UTC(a, m - 1, d))
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null
  return f.toISOString().slice(0, 10)
}

/** Lee el Excel y devuelve una fila por persona. Lanza ErrorExcel con un mensaje simple si no se puede. */
export async function leerPersonal(archivo: ArrayBuffer): Promise<Lectura> {
  const hoja = await leerHoja(archivo, HOJA)

  // La fila de títulos es la primera (de las 10 primeras) donde se reconocen al menos 3 columnas.
  const reconocer = (fila: Celda[]) => {
    const mapa = new Map<Clave, number>()
    fila.forEach((c, i) => {
      const t = simple(texto(c))
      const col = COLUMNAS.find((k) => k.titulo === t || k.otros.some((o) => simple(o) === t))
      if (col && !mapa.has(col.clave)) mapa.set(col.clave, i)
    })
    return mapa
  }
  const numeros = [...hoja.filas.keys()].sort((a, b) => a - b)
  let filaTitulos = -1
  let columnas = new Map<Clave, number>()
  for (const n of numeros.slice(0, 10)) {
    const m = reconocer(hoja.filas.get(n) ?? [])
    if (m.size >= 3) {
      filaTitulos = n
      columnas = m
      break
    }
  }
  if (filaTitulos < 0) throw new ErrorExcel(`No se encontró la fila de títulos en la hoja «${hoja.nombre}». Usa la plantilla de CRC.`)
  const faltan = COLUMNAS.filter((c) => c.obligatoria && !columnas.has(c.clave)).map((c) => c.titulo)
  if (faltan.length) throw new ErrorExcel(`Faltan columnas en el Excel: ${faltan.join(', ')}. Usa la plantilla de CRC.`)

  const valor = (fila: Celda[], clave: Clave) => {
    const i = columnas.get(clave)
    return i == null ? undefined : fila[i]
  }

  const registros: Registro[] = []
  for (const n of numeros) {
    if (n <= filaTitulos) continue
    const fila = hoja.filas.get(n) ?? []
    if (fila.every((c) => texto(c) === '')) continue // fila vacía: se ignora
    if (registros.length >= FILAS_MAXIMAS) {
      const total = numeros.filter((k) => k > filaTitulos && (hoja.filas.get(k) ?? []).some((c) => texto(c) !== '')).length
      throw new ErrorExcel(`El Excel tiene ${total} personas; el máximo por archivo es ${FILAS_MAXIMAS}. Divídelo en varios archivos.`)
    }
    const celdaFecha = valor(fila, 'fecha')
    const celdaNumero = valor(fila, 'numero')
    const colNumero = columnas.get('numero')
    registros.push({
      fila: n,
      tipo: texto(valor(fila, 'tipo')).toUpperCase(),
      numero: typeof celdaNumero === 'number' ? String(Math.round(celdaNumero)) : texto(celdaNumero),
      numeroEraNumero: colNumero != null && hoja.columnasNumero.has(`${letraColumna(colNumero)}${n}`),
      nombres: texto(valor(fila, 'nombres')),
      fecha: typeof celdaFecha === 'number' ? fechaDeExcel(celdaFecha, hoja.fechas1904) : fechaDeTexto(texto(celdaFecha)),
      fechaTexto: typeof celdaFecha === 'number' ? (fechaDeExcel(celdaFecha, hoja.fechas1904) ?? String(celdaFecha)) : texto(celdaFecha),
      puesto: texto(valor(fila, 'puesto')),
      gerencia: texto(valor(fila, 'gerencia')),
      area: texto(valor(fila, 'area')),
      subarea: texto(valor(fila, 'subarea')),
      rol: texto(valor(fila, 'rol')).toLowerCase(),
    })
  }
  if (!registros.length) throw new ErrorExcel('El Excel no tiene personas debajo de los títulos.')
  return { hoja: hoja.nombre, registros, conSubareas: columnas.has('subarea') }
}
