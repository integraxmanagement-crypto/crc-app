// Gestión de EPPs (09/11/2026): lecturas y llamadas al servidor. Quién puede lo decide la base de datos (RLS y funciones).
import { FunctionsHttpError } from '@supabase/supabase-js'
import { db, mensaje, rpc } from '../empresas/datos'
import { supabase } from '../supabase'

export type Trabajador = {
  vinculo_id: string
  persona_id: string
  apellidos_nombres: string
  tipo_documento: 'dni' | 'ce' | 'pas'
  numero_documento: string
  codigo_trabajador: string | null
  cargo: string | null
  area: string | null
}
export type Motivo = 'nuevo' | 'renovacion' | 'perdida'
export type EppCatalogo = { id: string; nombre: string; vida_meses: number | null; vigente: boolean }
export type Entrega = { id: string; epp_nombre: string; fecha_entrega: string; motivo: Motivo; fecha_renovacion: string | null; conformidad_en: string | null }
export type ConfigFormato = { codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null }

export const NOMBRE_DOC: Record<Trabajador['tipo_documento'], string> = { dni: 'DNI', ce: 'Carnet de extranjería', pas: 'Pasaporte' }
export const NOMBRE_MOTIVO: Record<Motivo, string> = { nuevo: 'Nuevo', renovacion: 'Renovación', perdida: 'Pérdida' }

export const buscarTrabajadores = (texto: string) => rpc<Trabajador[]>('buscar_trabajadores_epp', { p_texto: texto })
export const fijarCodigo = (vinculo: string, codigo: string) => rpc<void>('fijar_codigo_trabajador', { p_vinculo: vinculo, p_codigo: codigo })

export async function leerCatalogo(): Promise<EppCatalogo[]> {
  const { data, error } = await db().from('epp_catalogo').select('id, nombre, vida_meses, vigente').order('nombre')
  if (error) throw new Error(mensaje(error))
  return data as EppCatalogo[]
}
export const guardarCatalogo = (id: string | null, nombre: string, vida: number | null, vigente: boolean) =>
  rpc<string>('guardar_epp_catalogo', { p_id: id, p_nombre: nombre, p_vida_meses: vida, p_vigente: vigente })

export async function leerConfig(empresaId: string): Promise<ConfigFormato> {
  const { data, error } = await db().from('epp_config').select('codigo_formato, version_formato, fecha_aprobacion').eq('empresa_id', empresaId).maybeSingle()
  if (error) throw new Error(mensaje(error))
  return (data as ConfigFormato | null) ?? { codigo_formato: null, version_formato: null, fecha_aprobacion: null }
}
export const guardarConfig = (c: ConfigFormato) => rpc<void>('guardar_epp_config', { p_codigo: c.codigo_formato, p_version: c.version_formato, p_fecha: c.fecha_aprobacion || null })

export async function entregasDe(vinculo: string): Promise<Entrega[]> {
  const { data, error } = await db().from('epp_entregas').select('id, epp_nombre, fecha_entrega, motivo, fecha_renovacion, conformidad_en')
    .eq('vinculo_id', vinculo).order('fecha_entrega').order('creado_en')
  if (error) throw new Error(mensaje(error))
  return data as Entrega[]
}
export const registrarEntrega = (vinculo: string, epp: string, fecha: string, motivo: Motivo) =>
  rpc<string>('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: epp, p_fecha: fecha, p_motivo: motivo })
export const anularEntrega = (id: string) => rpc<void>('anular_entrega_epp', { p_entrega: id })

/** La conformidad del trabajador: su documento y su contraseña, verificados en el servidor. Devuelve un error en lenguaje simple, o null. */
export async function confirmarEntrega(entrega: string, tipo: string, numero: string, contrasena: string): Promise<string | null> {
  if (!supabase) return 'La app aún no está conectada a la base de datos.'
  if (!navigator.onLine) return 'Sin conexión. Necesitas señal para dar la conformidad.'
  const { error } = await supabase.functions.invoke('confirmar-entrega-epp', {
    body: { entrega_id: entrega, tipo_documento: tipo, numero_documento: numero, contrasena },
  })
  if (!error) return null
  if (error instanceof FunctionsHttpError) {
    const cuerpo = await error.context.json().catch(() => null)
    if (cuerpo?.error) return String(cuerpo.error)
  }
  return 'No se pudo confirmar. Intenta de nuevo en unos minutos.'
}
