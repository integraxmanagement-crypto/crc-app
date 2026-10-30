// Excel de cada organización (tarea 3.4-C, decisión del dueño 26/10/2026): la organización sube su propio formato en
// Excel con marcas {{…}} donde van los datos, y CRC llena una copia por inspección, con las firmas hechas en CRC
// como imágenes (revisión LOTO, 29/10/2026); quien firmó en papel firma a mano sobre la hoja impresa.
// Sin librerías: se cambian los textos de las celdas dentro del archivo y se vuelve a armar.
// Lo que no es una marca no se toca (logos, bordes, combinaciones, anchos). No usa nada propio del navegador,
// así también se prueba en la computadora (pruebas/excel.mjs).
//
// Marcas disponibles (la lista completa está en 05_Formatos_Inspeccion):
//   Empresa:    {{razon_social}} {{ruc}} {{domicilio}} {{actividad}} {{trabajadores}} (N.º de trabajadores de la empresa)
//   Formato:    {{nombre_formato}} {{codigo_formato}} {{version_formato}} {{fecha_aprobacion}}
//   Inspección: {{numero_inspeccion}} {{fecha}} {{hora}} {{sede}} {{area}} {{ubicacion}} {{inspector}}
//               {{resultado}} {{puntaje}} {{observacion}}
//   Activo:     {{activo_codigo}} {{activo.<dato>}} (p. ej. {{activo.capacidad}})
//   Puntos:     {{CLAVE}} respuesta · {{CLAVE.si}} {{CLAVE.no}} {{CLAVE.na}} una «X» en la columna que toca
//               {{CLAVE.obs}} {{CLAVE.accion}} {{CLAVE.responsable}} {{CLAVE.plazo}}
//               {{CLAVE=opción}} una «X» si la respuesta es esa opción (p. ej. {{LOTO-D02=Individual}} y {{LOTO-D02=Grupal}})
//   Filas:      {{CLAVE#1}}, {{CLAVE#2}}… el punto CLAVE de la fila 1, 2… de un bloque repetible
//   Firmas:     {{firma.<rol>.nombre}} {{firma.<rol>.cargo}} {{firma.<rol>.fecha}} (con dos firmantes: {{firma.<rol>#2.nombre}})
//   Fotos:      {{foto.CLAVE#1}} la primera foto del punto CLAVE en la fila 1 de un bloque repetible (como imagen, igual que las firmas)
//               {{firma.<rol>.imagen}} la imagen de la firma en esa celda o en su bloque combinado (ver excelImagenes.ts)
//   Logo:       {{logo}} el logo de la empresa (sin la marca, va en el bloque de A1 si está vacío)
import { ErrorExcel, crearZip, descomprimir, entradasZip, escaparXml, textoDe } from '../carga/xlsx.ts'
import { type Fila, type Respuesta, type Valor, repetibleActivo } from '../formatos/motor.ts'
import { type Punto, type Receta, todosLosPuntos } from '../formatos/receta.ts'
import { ajustarCeldas, celdasConMarcas } from './excelAjuste.ts'
import { type Grupos, repetirFilas } from './excelFilas.ts'
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
export async function llenarExcel(archivo: Uint8Array, valor: (marca: string) => string | null, imagenes?: Map<string, Uint8Array>, grupos?: Grupos): Promise<Uint8Array> {
  // 1. Las filas modelo se repiten las veces que haga falta; 2. se anotan las celdas con marcas; 3. se llenan; 4. se ajusta lo que no cabe.
  const lista = grupos ? repetirFilas(await partes(archivo), grupos) : await partes(archivo)
  const marcadas = celdasConMarcas(lista)
  const anclas = imagenes?.size ? anclasDeFirmas(lista, imagenes.has('logo')) : []
  const llenas = ajustarCeldas(reemplazarMarcas(lista, valor), marcadas)
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
  empresa: { razon_social: string; ruc: string; domicilio: string; actividad: string; trabajadores?: number | null }
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

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Un dato de la ficha del activo: {{activo.<dato>}} (los meses AAAA-MM salen MM/AAAA) o {{activo.<dato>.mes_texto}} («Marzo 2027»).
 */
export function datoDeActivo(datos: Record<string, Valor>, marca: string): string {
  const [dato, formato] = marca.slice(7).split('.')
  const v = datos[dato]
  if (v == null) return ''
  const mes = String(v).match(/^(\d{4})-(\d{2})$/)
  if (mes && formato === 'mes_texto') return `${MESES[Number(mes[2]) - 1] ?? ''} ${mes[1]}`.trim()
  return mes ? `${mes[2]}/${mes[1]}` : String(v)
}

/** Valor de cada marca para una inspección. */
export function valoresDe(d: DatosHoja): (marca: string) => string | null {
  const puntos = new Map(todosLosPuntos(d.receta).map((x) => [x.punto.clave, x]))
  const fijos: Record<string, string | null> = {
    razon_social: d.empresa.razon_social,
    ruc: d.empresa.ruc,
    domicilio: d.empresa.domicilio,
    actividad: d.empresa.actividad,
    trabajadores: d.empresa.trabajadores == null ? '' : String(d.empresa.trabajadores),
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
    estado_final: !d.resultado ? '' : /^no conforme/i.test(d.resultado) ? 'No conforme' : d.resultado, // «Conforme» o «No conforme», sin el motivo
    puntaje: d.puntaje != null ? `${d.puntaje} %` : '',
    observacion: d.observacion,
    activo_codigo: d.activo?.codigo ?? '',
    logo: '', // la imagen del logo se agrega aparte (excelImagenes.ts)
    '#': '', // el número de orden de una fila repetida lo pone excelFilas.ts
  }
  return (marca) => {
    if (marca in fijos) return fijos[marca] ?? ''
    if (marca.startsWith('activo.')) return datoDeActivo(d.activo?.datos ?? {}, marca)
    if (/^firma\.[^.#]+(?:#\d+)?\.imagen$/.test(marca) || /^foto\.[^.#]+#\d+$/.test(marca)) return '' // la imagen se agrega aparte (excelImagenes.ts)
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
    // {{resumen.<sección>}}: todos los criterios de una sección en una celda, uno por línea («1: √», «2: X»); vacío si la inspección no tiene esa sección.
    const resumen = marca.match(/^resumen\.(\w+)$/)
    if (resumen) {
      const sec = d.receta.secciones.find((x) => x.clave === resumen[1])
      return (sec?.puntos ?? []).flatMap((p, i) => { const v = textoRespuesta(p, d.respuestas[p.clave], d); return v ? [`${i + 1}: ${v}`] : [] }).join('\n')
    }
    const m = marca.match(/^([^.#]+)(?:#(\d+))?(?:\.(\w+))?$/)
    if (!m) return null
    const [, clave, n, sub] = m
    const x = puntos.get(clave)
    if (n) {
      if (!x?.seccion.repetible) return ''
      const fila = d.filas[x.seccion.clave]?.[Number(n) - 1]
      if (fila) return parte(x.punto, fila[clave], sub, d)
      // Sin ninguna condición encontrada, la primera fila dice «Sin observaciones» (pedido del dueño, 29/10/2026).
      const hay = repetibleActivo(x.seccion, d.respuestas) ? (d.filas[x.seccion.clave]?.length ?? 0) : 0
      return n === '1' && !sub && !hay && clave === x.seccion.puntos[0]?.clave ? 'Sin observaciones' : ''
    }
    if (!x) return null
    return parte(x.punto, d.respuestas[clave], sub, d)
  }
}

/**
 * Filas que se repiten según la inspección: una por cada condición encontrada (bloque repetible) y una por cada firmante
 * del mismo rol. Siempre hay al menos una. Ver excelFilas.ts.
 */
export function gruposDe(d: DatosHoja): Grupos {
  const puntos = new Map(todosLosPuntos(d.receta).map((x) => [x.punto.clave, x]))
  const grupoDe = (marca: string) => {
    const f = marca.match(/^firma\.([^.#]+)(?:#(\d+))?\.(?:nombre|cargo|fecha|imagen)$/)
    if (f) return { grupo: `firma:${f[1]}`, n: Number(f[2] ?? 1) }
    const clave = marca.match(/^foto\.([^.#]+)#(\d+)$/) ?? marca.match(/^([^.#=]+)#(\d+)/)
    const x = clave && puntos.get(clave[1])
    return x && x.seccion.repetible ? { grupo: `fila:${x.seccion.clave}`, n: Number(clave[2]) } : null
  }
  return {
    grupoDe,
    cuantas: (grupo) => {
      const [tipo, clave] = [grupo.slice(0, grupo.indexOf(':')), grupo.slice(grupo.indexOf(':') + 1)]
      if (tipo === 'firma') return d.firmantes.filter((x) => x.rol_clave === clave).length
      const seccion = d.receta.secciones.find((s) => s.clave === clave)
      return seccion && repetibleActivo(seccion, d.respuestas) ? (d.filas[clave]?.length ?? 0) : 0
    },
    // La marca de la fila k: la primera firma va sin número ({{firma.rol.nombre}}), las demás con #k; los puntos, con #k.
    reescribir: (marca, k) => {
      const g = grupoDe(marca)
      if (!g) return marca
      if (g.grupo.startsWith('firma:')) return marca.replace(/^(firma\.[^.#]+)(?:#\d+)?/, (_, a: string) => (k === 1 ? a : `${a}#${k}`))
      return marca.replace(/^(foto\.[^.#]+|[^.#=]+)#\d+/, (_, a: string) => `${a}#${k}`)
    },
  }
}

/** Marcas del Excel que CRC no reconoce para esta receta (se avisan al subirlo; quedarán en blanco). */
export function marcasDesconocidas(marcas: string[], receta: Receta): string[] {
  const claves = new Set(todosLosPuntos(receta).map((x) => x.punto.clave))
  const roles = new Set(receta.firmas.map((f) => f.clave))
  const FIJAS = new Set(['razon_social', 'ruc', 'domicilio', 'actividad', 'trabajadores', 'nombre_formato', 'codigo_formato', 'version_formato', 'fecha_aprobacion',
    'numero_inspeccion', 'fecha', 'hora', 'sede', 'area', 'ubicacion', 'inspector', 'resultado', 'puntaje', 'observacion', 'activo_codigo', 'logo', '#', 'estado_final', 'tipo_dispositivo', 'fecha_inspeccion', 'periodo', 'desde', 'hasta', 'inspeccionados', 'total', 'avance'])
  return marcas.filter((m) => {
    if (FIJAS.has(m) || /^activo\.\w+(?:\.mes_texto)?$/.test(m) || m.startsWith('fila.') || /^resumen\.\w+$/.test(m) || /^firma\.registro\.(?:nombre|cargo|fecha|imagen)$/.test(m)) return false
    const f = m.match(/^firma\.([^.#]+)(?:#\d+)?\.(nombre|cargo|fecha|imagen)$/)
    if (f) return !roles.has(f[1])
    const ft = m.match(/^foto\.([^.#]+)#\d+$/)
    if (ft) return !claves.has(ft[1])
    const op = m.match(/^([^.#=]+)(?:#\d+)?=.+$/)
    if (op) return !claves.has(op[1])
    const p = m.match(/^([^.#]+)(?:#\d+)?(?:\.(si|no|na|obs|accion|responsable|plazo))?$/)
    return !p || !claves.has(p[1])
  })
}
