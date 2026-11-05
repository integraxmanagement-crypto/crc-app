// Reglas puras de la gestión de condiciones (05/11/2026). Sin red ni pantalla: se prueban con pruebas/condiciones.mjs.
// La base de datos vuelve a revisar todo; esto sirve para avisar rápido en pantalla y para calcular el estado.

export type TipoColumna = 'texto' | 'numero' | 'fecha' | 'lista' | 'multiple' | 'foto' | 'descripcion' | 'estado' | 'responsable_auto' | 'persona'
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
export const BASE_CAMBIA_TIPO = ['area', 'ubicacion', 'plan_accion', 'clasificacion', 'origen', 'motivo']
export const NOMBRE_TIPO: Record<TipoColumna, string> = {
  texto: 'Texto', numero: 'Número', fecha: 'Fecha', lista: 'Lista (una opción)', multiple: 'Lista (varias opciones)', foto: 'Foto',
  descripcion: 'Peligro y riesgo', estado: 'Automático', responsable_auto: 'Automático', persona: 'Persona de la sede',
}

export const esAutomatica = (c: Pick<Columna, 'tipo'>) => c.tipo === 'estado' || c.tipo === 'responsable_auto'

/** Valor de una columna en una fila (las fechas clave están aparte de «datos»). */
export type Fila = { fecha_hallazgo: string; fecha_programada: string | null; fecha_cierre: string | null; datos: Record<string, unknown> }
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
    .filter((c) => c.visible && !esAutomatica(c) && (c.obligatoria || c.tipo === 'descripcion') && vacio(valores[c.clave], c.tipo))
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
