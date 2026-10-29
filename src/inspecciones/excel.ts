// Excel de cada organización (tarea 3.4-C, decisión del dueño 26/10/2026): la organización sube su propio formato en
// Excel con marcas {{…}} donde van los datos, y CRC llena una copia por inspección, con las firmas hechas en CRC
// como imágenes (revisión LOTO, 29/10/2026); quien firmó en papel firma a mano sobre la hoja impresa.
// Sin librerías: se cambian los textos de las celdas dentro del archivo y se vuelve a armar.
// Lo que no es una marca no se toca (logos, bordes, combinaciones, anchos). No usa nada propio del navegador,
// así también se prueba en la computadora (pruebas/excel.mjs).
//
// Marcas disponibles (la lista completa está en 05_Formatos_Inspeccion):
//   Empresa:    {{razon_social}} {{ruc}} {{domicilio}} {{actividad}}
//   Formato:    {{nombre_formato}} {{codigo_formato}} {{version_formato}} {{fecha_aprobacion}}
//   Inspección: {{numero_inspeccion}} {{fecha}} {{hora}} {{sede}} {{area}} {{ubicacion}} {{inspector}}
//               {{resultado}} {{puntaje}} {{observacion}}
//   Activo:     {{activo_codigo}} {{activo.<dato>}} (p. ej. {{activo.capacidad}})
//   Puntos:     {{CLAVE}} respuesta · {{CLAVE.si}} {{CLAVE.no}} {{CLAVE.na}} una «X» en la columna que toca
//               {{CLAVE.obs}} {{CLAVE.accion}} {{CLAVE.responsable}} {{CLAVE.plazo}}
//               {{CLAVE=opción}} una «X» si la respuesta es esa opción (p. ej. {{LOTO-D02=Individual}} y {{LOTO-D02=Grupal}})
//   Filas:      {{CLAVE#1}}, {{CLAVE#2}}… el punto CLAVE de la fila 1, 2… de un bloque repetible
//   Firmas:     {{firma.<rol>.nombre}} {{firma.<rol>.cargo}} {{firma.<rol>.fecha}} (con dos firmantes: {{firma.<rol>#2.nombre}})
//               {{firma.<rol>.imagen}} la imagen de la firma en esa celda o en su bloque combinado (ver excelImagenes.ts)
import { ErrorExcel, crearZip, descomprimir, entradasZip, escaparXml, textoDe } from '../carga/xlsx.ts'
import type { Fila, Respuesta, Valor } from '../formatos/motor.ts'
import { type Punto, type Receta, todosLosPuntos } from '../formatos/receta.ts'
import { anclasDeFirmas, insertarImagenes } from './excelImagenes.ts'

export const EXCEL_MAX_BYTES = 1024 * 1024
const MARCA = /\{\{\s*([^{}]+?)\s*\}\}/g
const DESCOMPRIMIDO_MAXIMO = 30 * 1024 * 1024

export type Parte = { nombre: string; bytes: Uint8Array }

/** Abre el .xlsx (sin macros) y devuelve cada archivo de adentro, descomprimido. */
export async function partes(archivo: Uint8Array): Promise<Parte[]> {
  const lista: Parte[] = []
  let total = 0
  for (const e of entradasZip(archivo)) {
    if (e.nombre.endsWith('/')) continue
    total += e.tamano
    if (total > DESCOMPRIMIDO_MAXIMO) throw new ErrorExcel('El archivo es demasiado grande por dentro.')
    const crudo = archivo.subarray(e.inicio, e.inicio + e.comprimido)
    if (e.metodo === 0) lista.push({ nombre: e.nombre, bytes: crudo })
    else if (e.metodo === 8) lista.push({ nombre: e.nombre, bytes: await descomprimir(crudo) })
    else throw new ErrorExcel('El archivo usa una compresión que CRC no conoce. Guárdalo de nuevo como .xlsx.')
  }
  if (!lista.some((p) => p.nombre === 'xl/workbook.xml')) throw new ErrorExcel('El archivo no es un Excel .xlsx válido.')
  // Solo .xlsx sin macros (decisión del dueño, 27/10/2026): un libro con macros trae vbaProject.bin o se declara «macroEnabled».
  const tipos = new TextDecoder().decode(lista.find((p) => p.nombre === '[Content_Types].xml')?.bytes ?? new Uint8Array())
  if (lista.some((p) => /vbaProject\.bin$|vbaData\.xml$/i.test(p.nombre)) || /macroEnabled/i.test(tipos))
    throw new ErrorExcel('El Excel tiene macros. Guárdalo como «Libro de Excel (.xlsx)», sin macros, y súbelo de nuevo.')
  return lista
}

/** Archivos de texto donde puede haber marcas: los textos compartidos y las hojas (textos escritos en la celda). */
const conTexto = (nombre: string) => nombre === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)

// Un texto de celda: <si>…</si> en los compartidos o <is>…</is> dentro de una celda de la hoja.
const BLOQUE = /<(si|is)>([\s\S]*?)<\/\1>/g

/** Marcas {{…}} que tiene el Excel (para mostrarlas al subirlo y avisar si alguna no existe). */
export async function marcasDeExcel(archivo: Uint8Array): Promise<string[]> {
  const encontradas = new Set<string>()
  for (const p of await partes(archivo)) {
    if (!conTexto(p.nombre)) continue
    const xml = new TextDecoder().decode(p.bytes)
    for (const [, , dentro] of xml.matchAll(BLOQUE)) for (const [, m] of textoDe(dentro).matchAll(MARCA)) encontradas.add(m)
  }
  return [...encontradas].sort()
}

/**
 * Copia del Excel con cada marca cambiada por su valor (las marcas sin valor quedan en blanco). Con imagenes
 * (marca {{firma.<rol>.imagen}} → PNG), las firmas van como imágenes en su celda.
 */
export async function llenarExcel(archivo: Uint8Array, valor: (marca: string) => string | null, imagenes?: Map<string, Uint8Array>): Promise<Uint8Array> {
  const lista = await partes(archivo)
  const anclas = imagenes?.size ? anclasDeFirmas(lista) : []
  const llenas = reemplazarMarcas(lista, valor)
  return crearZip(anclas.length ? insertarImagenes(llenas, anclas, imagenes!) : llenas)
}

/** Cambia las marcas de los textos de celda por su valor, en los textos compartidos y en las hojas. */
export function reemplazarMarcas(lista: Parte[], valor: (marca: string) => string | null): Parte[] {
  return lista.map((p) => {
    if (!conTexto(p.nombre)) return p
    const xml = new TextDecoder().decode(p.bytes)
    const nuevo = xml.replace(BLOQUE, (todo, etiqueta: string, dentro: string) => {
      const texto = textoDe(dentro)
      if (!texto.includes('{{')) return todo
      const lleno = texto.replace(MARCA, (_, m: string) => valor(m) ?? '')
      return `<${etiqueta}><t xml:space="preserve">${escaparXml(lleno)}</t></${etiqueta}>`
    })
    return { nombre: p.nombre, bytes: new TextEncoder().encode(nuevo) }
  })
}

// ───────────────────────── Valores de una inspección ─────────────────────────

/** Para comparar opciones sin tildes, mayúsculas ni espacios de más. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export type DatosHoja = {
  empresa: { razon_social: string; ruc: string; domicilio: string; actividad: string }
  formato: { nombre: string; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null }
  receta: Receta
  numero: number | null
  fecha: string // AAAA-MM-DD
  hora: string | null // HH:MM
  sede: string | null
  area: string | null
  ubicacion: string | null
  inspector: string | null
  resultado: string | null
  puntaje: number | null
  observacion: string | null
  activo: { codigo: string; datos: Record<string, Valor> } | null
  respuestas: Record<string, Respuesta>
  filas: Record<string, Fila[]>
  firmantes: { rol_clave: string; nombre: string; cargo: string | null; fecha: string | null }[]
  persona: (id: string) => string | null // nombre de una persona de la empresa (tipo «persona»)
}

const fechaPeru = (f: string | null | undefined) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : (f ?? ''))
const MARCAS_CUMPLE: Record<string, string> = { si: '√', no: 'X', na: 'N/A' }

function textoRespuesta(p: Punto | undefined, r: Respuesta | undefined, d: DatosHoja): string {
  const v = r?.valor
  if (v == null || v === '') return ''
  if (p?.tipo === 'cumple') return MARCAS_CUMPLE[String(v)] ?? String(v)
  if (p?.tipo === 'si_no') return v === 'si' ? 'Sí' : v === 'no' ? 'No' : String(v)
  if (p?.tipo === 'fecha') return fechaPeru(String(v))
  if (p?.tipo === 'persona') return d.persona(String(v)) ?? String(v)
  if (p?.tipo === 'numero' && p.unidad) return `${v} ${p.unidad}`
  return String(v)
}

function parte(p: Punto | undefined, r: Respuesta | undefined, sub: string | undefined, d: DatosHoja): string {
  if (!sub) return textoRespuesta(p, r, d)
  if (sub === 'si' || sub === 'no' || sub === 'na') return r?.valor === sub ? 'X' : ''
  if (sub === 'obs') return r?.obs ?? ''
  if (sub === 'accion') return r?.accion?.texto ?? ''
  if (sub === 'responsable') return r?.accion?.responsable ? (d.persona(r.accion.responsable) ?? r.accion.responsable) : ''
  if (sub === 'plazo') return fechaPeru(r?.accion?.plazo)
  return ''
}

/** Valor de cada marca para una inspección. */
export function valoresDe(d: DatosHoja): (marca: string) => string | null {
  const puntos = new Map(todosLosPuntos(d.receta).map((x) => [x.punto.clave, x]))
  const fijos: Record<string, string | null> = {
    razon_social: d.empresa.razon_social,
    ruc: d.empresa.ruc,
    domicilio: d.empresa.domicilio,
    actividad: d.empresa.actividad,
    nombre_formato: d.formato.nombre,
    codigo_formato: d.formato.codigo_formato,
    version_formato: d.formato.version_formato,
    fecha_aprobacion: fechaPeru(d.formato.fecha_aprobacion),
    numero_inspeccion: d.numero != null ? String(d.numero) : '',
    fecha: fechaPeru(d.fecha),
    hora: d.hora,
    sede: d.sede,
    area: d.area,
    ubicacion: d.ubicacion,
    inspector: d.inspector,
    resultado: d.resultado ?? 'Realizado',
    puntaje: d.puntaje != null ? `${d.puntaje} %` : '',
    observacion: d.observacion,
    activo_codigo: d.activo?.codigo ?? '',
  }
  return (marca) => {
    if (marca in fijos) return fijos[marca] ?? ''
    if (marca.startsWith('activo.')) {
      const v = d.activo?.datos[marca.slice(7)]
      return v == null ? '' : /^\d{4}-\d{2}$/.test(String(v)) ? `${String(v).slice(5)}/${String(v).slice(0, 4)}` : String(v)
    }
    if (/^firma\.[^.#]+(?:#\d+)?\.imagen$/.test(marca)) return '' // la imagen se agrega aparte (excelImagenes.ts)
    const firma = marca.match(/^firma\.([^.#]+)(?:#(\d+))?\.(nombre|cargo|fecha)$/)
    if (firma) {
      const f = d.firmantes.filter((x) => x.rol_clave === firma[1])[Number(firma[2] ?? 1) - 1]
      if (!f) return ''
      return firma[3] === 'nombre' ? f.nombre : firma[3] === 'cargo' ? (f.cargo ?? '') : fechaPeru(f.fecha)
    }
    // «X» si la respuesta es esa opción (revisión del formato LOTO: tipo de bloqueo Individual / Grupal en dos casillas).
    const op = marca.match(/^([^.#=]+)(?:#(\d+))?=(.+)$/)
    if (op) {
      const x = puntos.get(op[1])
      if (!x) return null
      const r = op[2] ? (x.seccion.repetible ? d.filas[x.seccion.clave]?.[Number(op[2]) - 1]?.[op[1]] : undefined) : d.respuestas[op[1]]
      return r?.valor != null && normalizar(String(r.valor)) === normalizar(op[3]) ? 'X' : ''
    }
    const m = marca.match(/^([^.#]+)(?:#(\d+))?(?:\.(\w+))?$/)
    if (!m) return null
    const [, clave, n, sub] = m
    const x = puntos.get(clave)
    if (n) {
      if (!x?.seccion.repetible) return ''
      const fila = d.filas[x.seccion.clave]?.[Number(n) - 1]
      return fila ? parte(x.punto, fila[clave], sub, d) : ''
    }
    if (!x) return null
    return parte(x.punto, d.respuestas[clave], sub, d)
  }
}

/** Marcas del Excel que CRC no reconoce para esta receta (se avisan al subirlo; quedarán en blanco). */
export function marcasDesconocidas(marcas: string[], receta: Receta): string[] {
  const claves = new Set(todosLosPuntos(receta).map((x) => x.punto.clave))
  const roles = new Set(receta.firmas.map((f) => f.clave))
  const FIJAS = new Set(['razon_social', 'ruc', 'domicilio', 'actividad', 'nombre_formato', 'codigo_formato', 'version_formato', 'fecha_aprobacion',
    'numero_inspeccion', 'fecha', 'hora', 'sede', 'area', 'ubicacion', 'inspector', 'resultado', 'puntaje', 'observacion', 'activo_codigo'])
  return marcas.filter((m) => {
    if (FIJAS.has(m) || /^activo\.\w+$/.test(m)) return false
    const f = m.match(/^firma\.([^.#]+)(?:#\d+)?\.(nombre|cargo|fecha|imagen)$/)
    if (f) return !roles.has(f[1])
    const op = m.match(/^([^.#=]+)(?:#\d+)?=.+$/)
    if (op) return !claves.has(op[1])
    const p = m.match(/^([^.#]+)(?:#\d+)?(?:\.(si|no|na|obs|accion|responsable|plazo))?$/)
    return !p || !claves.has(p[1])
  })
}
