// Reglas puras de la gestión de condiciones (05/11/2026). Sin red ni pantalla: se prueban con pruebas/condiciones.mjs.
// La base de datos vuelve a revisar todo; esto sirve para avisar rápido en pantalla y para calcular el estado.

export type TipoColumna = 'texto' | 'numero' | 'fecha' | 'lista' | 'multiple' | 'foto' | 'descripcion' | 'estado' | 'responsable_auto' | 'persona' | 'area'
export type Columna = {
  id: string
  clave: string
  nombre: string
  tipo: TipoColumna
  opciones: string[]
  obligatoria: boolean
  visible: boolean
  orden: number
  es_base: boolean
}
export type EstadoCondicion = 'pendiente' | 'atrasado' | 'dentro_plazo' | 'fuera_plazo'

export const NOMBRE_ESTADO_CONDICION: Record<EstadoCondicion, string> = {
  pendiente: 'Pendiente',
  atrasado: 'Atrasado',
  dentro_plazo: 'Realizado dentro de plazo',
  fuera_plazo: 'Realizado fuera de plazo',
}

/**
 * Estado de una condición. Sin fecha de cierre: «pendiente», o «atrasado» si la fecha programada ya pasó (el mismo día programado aún es pendiente).
 * Con fecha de cierre: «dentro de plazo» si se cerró hasta la fecha programada, «fuera de plazo» si después. Sin fecha programada, lo cerrado cuenta como dentro de plazo.
 * Las fechas son 'AAAA-MM-DD' y se comparan como texto.
 */
export function estadoDe(c: { fecha_programada: string | null; fecha_cierre: string | null }, hoy: string): EstadoCondicion {
  if (c.fecha_cierre) return c.fecha_programada && c.fecha_cierre > c.fecha_programada ? 'fuera_plazo' : 'dentro_plazo'
  return c.fecha_programada && c.fecha_programada < hoy ? 'atrasado' : 'pendiente'
}

/** Tipos que se pueden elegir al agregar una columna nueva. */
export const TIPOS_NUEVA: [TipoColumna, string][] = [
  ['texto', 'Letras (texto libre)'],
  ['numero', 'Números'],
  ['fecha', 'Fecha'],
  ['lista', 'Lista desplegable: una opción'],
  ['multiple', 'Lista desplegable: varias opciones'],
]
/** Columnas base cuyo tipo se puede cambiar (siempre a texto, lista o varias opciones). */
export const BASE_CAMBIA_TIPO = ['ubicacion', 'plan_accion', 'clasificacion', 'origen', 'motivo']
export const NOMBRE_TIPO: Record<TipoColumna, string> = {
  texto: 'Texto', numero: 'Número', fecha: 'Fecha', lista: 'Lista (una opción)', multiple: 'Lista (varias opciones)', foto: 'Foto',
  descripcion: 'Peligro y riesgo', estado: 'Automático', responsable_auto: 'Automático', persona: 'Persona de la empresa', area: 'Área de la empresa',
}

export const esAutomatica = (c: Pick<Columna, 'tipo'>) => c.tipo === 'estado' || c.tipo === 'responsable_auto'

/** Valor de una columna en una fila (las fechas clave están aparte de «datos»). */
export type Fila = { fecha_hallazgo: string; fecha_programada: string | null; fecha_cierre: string | null; datos: Record<string, unknown>; borrador?: boolean }
export function valorDe(f: Fila, clave: string): unknown {
  if (clave === 'fecha_hallazgo' || clave === 'fecha_programada' || clave === 'fecha_cierre') return f[clave]
  return f.datos[clave]
}

export function vacio(valor: unknown, tipo: TipoColumna): boolean {
  if (valor == null) return true
  if (tipo === 'descripcion') {
    const d = valor as { peligro?: string; riesgo?: string }
    return (d.peligro ?? '').trim().length < 3 || (d.riesgo ?? '').trim().length < 3
  }
  if (typeof valor === 'string') return valor.trim() === ''
  if (Array.isArray(valor)) return valor.length === 0
  return false
}

/** Lo que falta completar antes de guardar: las columnas visibles obligatorias (la descripción siempre pide peligro y riesgo). */
export function faltantes(columnas: Columna[], valores: Record<string, unknown>): string[] {
  return columnas
    .filter((c) => c.visible && !esAutomatica(c) && c.clave !== 'fecha_cierre' && (c.obligatoria || c.tipo === 'descripcion') && vacio(valores[c.clave], c.tipo))
    .map((c) => (c.tipo === 'descripcion' ? 'Descripción: peligro observado y riesgo asociado' : c.nombre))
}

/** Texto para mostrar un valor en la tabla. */
export function textoDe(valor: unknown, tipo: TipoColumna): string {
  if (valor == null || valor === '') return ''
  if (tipo === 'descripcion') {
    const d = valor as { peligro?: string; riesgo?: string }
    return `Peligro: ${d.peligro ?? ''} · Riesgo: ${d.riesgo ?? ''}`
  }
  if (Array.isArray(valor)) return valor.join(', ')
  return String(valor)
}

// ───────────── Tarjetas del encabezado ─────────────
export type Tarjeta = { id: string; sede_id: string; titulo: string; columna: string; operador: 'borrador' | 'vacia' | 'igual' | 'distinto'; valor: string | null; fija: boolean; orden: number }

/** Valor de una columna de una fila, como texto, para comparar con una tarjeta (el estado se calcula; las personas se comparan por nombre). */
export function valorComparable(f: Fila, c: Columna | undefined, hoy: string): string {
  if (!c) return ''
  if (c.tipo === 'estado') return estadoDe(f, hoy)
  if (c.tipo === 'responsable_auto') return String(f.datos.creado_por_nombre ?? '')
  if (c.tipo === 'persona') return String(f.datos[`${c.clave}_nombre`] ?? '')
  return textoDe(valorDe(f, c.clave), c.tipo)
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** ¿La fila cuenta en esta tarjeta? */
export function cumpleTarjeta(t: Pick<Tarjeta, 'columna' | 'operador' | 'valor'>, f: Fila, columnas: Columna[], hoy: string): boolean {
  if (t.operador === 'borrador') return Boolean(f.borrador)
  const v = norm(valorComparable(f, columnas.find((c) => c.clave === t.columna), hoy))
  if (t.operador === 'vacia') return v === ''
  const w = norm(t.valor ?? '')
  return t.operador === 'igual' ? v === w : v !== w
}

// ───────────── Las dos matrices: condiciones y planes de acción ─────────────
export type Matriz = 'condiciones' | 'planes'
/** Textos de cada matriz (la pantalla es la misma; cambian las palabras). */
export const TEXTOS: Record<Matriz, { titulo: string; subtitulo: string; una: string; unas: string; nueva: string; ruta: string; menu: string }> = {
  condiciones: { titulo: 'Gestión de condiciones', subtitulo: 'Matriz de condiciones de la sede: cárgalas, dales plazo y sigue su cierre.', una: 'condición', unas: 'condiciones', nueva: 'Nueva condición', ruta: '/condiciones', menu: 'Gestión de condiciones' },
  planes: { titulo: 'Gestión de planes de acción', subtitulo: 'Matriz de planes de acción de la sede: llegan solos de las inspecciones y también puedes cargarlos; sigue su cierre.', una: 'plan de acción', unas: 'planes de acción', nueva: 'Nuevo plan de acción', ruta: '/planes', menu: 'Gestión de planes de acción' },
}
/** Columnas de persona que se llenan solas con quien carga. */
export const RESPONSABLE_QUE_CARGA = ['resp_inspeccion', 'resp_acr']
