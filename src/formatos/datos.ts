// Datos de formatos de inspección, activos, ubicaciones y listas (tarea 3.4-B). Se lee con las reglas RLS de cada
// persona; se escribe solo con las acciones de la base de datos, que revisan los permisos por dentro.
import { conLimite, db, mensaje, rpc } from '../empresas/datos'
import type { CampoFicha, Frecuencia, Subtipo } from './base'
import type { Receta } from './receta'

export type EstadoVersion = 'borrador' | 'vigente' | 'retirada'
export type Logo = 'positivo' | 'negativo' | 'ninguno'

export type Plantilla = {
  id: string
  empresa_id: string | null
  base_id: string | null
  codigo: string | null
  nombre: string
  descripcion: string | null
  aplica_a: 'activo' | 'area'
  tipo_activo_id: string | null
  frecuencia: Frecuencia
  vigente: boolean
  actualizado_en: string
  versiones: { id: string; numero: number; estado: EstadoVersion }[]
  tipos_activo: { nombre: string } | null
}

export type Version = {
  id: string
  plantilla_id: string
  empresa_id: string | null
  numero: number
  estado: EstadoVersion
  codigo_formato: string | null
  version_formato: string | null
  fecha_aprobacion: string | null
  logo: Logo
  receta: Receta
  huella: string | null
  actualizado_en: string
  publicado_en: string | null
}

export type TipoActivo = {
  id: string
  empresa_id: string | null
  codigo: string
  nombre: string
  subtipos: Subtipo[]
  campos: CampoFicha[]
  dotacion: boolean
  base_id: string | null
  vigente: boolean
}

export type Lista = { id: string; empresa_id: string | null; codigo: string; nombre: string; valores: ValorLista[] }
export type ValorLista = { id: string; nombre: string; orden: number; vigente: boolean }

export type Ubicacion = { id: string; sede_id: string; unidad_id: string | null; nombre: string; vigente: boolean }

export type Activo = {
  id: string
  tipo_id: string
  numero: number
  codigo: string
  subtipo: string | null
  sede_id: string
  unidad_id: string | null
  ubicacion_id: string | null
  responsable_id: string | null
  datos: Record<string, string | number>
  dotacion: Record<string, number>
  estado: 'activo' | 'baja'
  fecha_baja: string | null
  motivo_baja: string | null
  actualizado_en: string
}

export const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  sin_frecuencia: 'Sin frecuencia fija',
}
export const NOMBRE_ESTADO: Record<EstadoVersion, string> = { borrador: 'Borrador', vigente: 'Vigente', retirada: 'Retirada' }

async function leer<T>(consulta: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await conLimite(consulta)
  if (error) throw new Error(mensaje(error))
  return data as T
}

// ───── Plantillas ─────
const CAMPOS_PLANTILLA = '*, versiones:plantillas_versiones(id, numero, estado), tipos_activo(nombre)'

/** Plantillas base de CRC (empresa vacía). */
export const listarPlantillasBase = () =>
  leer<Plantilla[]>(db().from('plantillas').select(CAMPOS_PLANTILLA).is('empresa_id', null).order('nombre'))

export const listarPlantillas = (empresaId: string) =>
  leer<Plantilla[]>(db().from('plantillas').select(CAMPOS_PLANTILLA).eq('empresa_id', empresaId).order('nombre'))

export async function leerPlantilla(id: string) {
  const [p, v] = await Promise.all([
    leer<Plantilla | null>(db().from('plantillas').select(CAMPOS_PLANTILLA).eq('id', id).maybeSingle()),
    leer<Version[]>(db().from('plantillas_versiones').select('*').eq('plantilla_id', id).order('numero', { ascending: false })),
  ])
  return { plantilla: p, versiones: v }
}

export const copiarPlantilla = (empresaId: string, origen: string) => rpc<string>('copiar_plantilla', { p_empresa: empresaId, p_origen: origen })
export const nuevaPlantilla = (empresaId: string, datos: { nombre: string; aplica_a: 'activo' | 'area'; tipo_activo_id: string | null; frecuencia: Frecuencia }) =>
  rpc<string>('nueva_plantilla', { p_empresa: empresaId, p_datos: datos })
export const guardarPlantilla = (id: string, datos: { nombre: string; descripcion: string | null; frecuencia: Frecuencia }) =>
  rpc<void>('guardar_plantilla', { p_plantilla: id, p_datos: datos })
export const cambiarVigenciaPlantilla = (id: string, vigente: boolean) =>
  rpc<void>('cambiar_vigencia_plantilla', { p_plantilla: id, p_vigente: vigente })
export const guardarBorrador = (
  versionId: string,
  datos: { codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null; logo: Logo; receta: Receta },
) => rpc<void>('guardar_borrador', { p_version: versionId, p_datos: datos })
export const nuevoBorrador = (plantillaId: string) => rpc<string>('nuevo_borrador', { p_plantilla: plantillaId })
export const publicarVersion = (versionId: string) => rpc<void>('publicar_version', { p_version: versionId })
export const descartarBorrador = (versionId: string) => rpc<void>('descartar_borrador', { p_version: versionId })

// ───── Tipos de activo, listas y ubicaciones ─────
export const listarTiposBase = () => leer<TipoActivo[]>(db().from('tipos_activo').select('*').is('empresa_id', null).order('nombre'))
export const listarTipos = (empresaId: string) =>
  leer<TipoActivo[]>(db().from('tipos_activo').select('*').eq('empresa_id', empresaId).order('nombre'))
export const activarTipo = (empresaId: string, tipoBase: string) =>
  rpc<string>('activar_tipo_activo', { p_empresa: empresaId, p_tipo_base: tipoBase })
export const guardarTipo = (empresaId: string, id: string | null, datos: { nombre: string; subtipos: Subtipo[] }) =>
  rpc<string>('guardar_tipo_activo', { p_empresa: empresaId, p_id: id, p_datos: datos })
export const cambiarVigenciaTipo = (id: string, vigente: boolean) => rpc<void>('cambiar_vigencia_tipo_activo', { p_id: id, p_vigente: vigente })

export async function listarListas(empresaId: string | null): Promise<Lista[]> {
  let q = db().from('listas').select('id, empresa_id, codigo, nombre, valores:listas_valores(id, nombre, orden, vigente)').order('nombre')
  q = empresaId ? q.eq('empresa_id', empresaId) : q.is('empresa_id', null)
  const listas = await leer<Lista[]>(q)
  for (const l of listas) l.valores.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
  return listas
}
export const crearLista = (empresaId: string, nombre: string) => rpc<string>('crear_lista', { p_empresa: empresaId, p_nombre: nombre })
export const copiarListaBase = (empresaId: string, codigo: string) => rpc<void>('copiar_lista_base', { p_empresa: empresaId, p_codigo: codigo })
export const guardarValorLista = (listaId: string | null, id: string | null, nombre: string) =>
  rpc<string>('guardar_valor_lista', { p_lista: listaId, p_id: id, p_nombre: nombre })
export const cambiarVigenciaValor = (id: string, vigente: boolean) => rpc<void>('cambiar_vigencia_valor_lista', { p_id: id, p_vigente: vigente })

export const listarUbicaciones = (empresaId: string) =>
  leer<Ubicacion[]>(db().from('ubicaciones').select('id, sede_id, unidad_id, nombre, vigente').eq('empresa_id', empresaId).order('nombre'))
export const guardarUbicacion = (empresaId: string, id: string | null, sede: string, unidad: string | null, nombre: string) =>
  rpc<string>('guardar_ubicacion', { p_empresa: empresaId, p_id: id, p_sede: sede, p_unidad: unidad, p_nombre: nombre })
export const cambiarVigenciaUbicacion = (id: string, vigente: boolean) => rpc<void>('cambiar_vigencia_ubicacion', { p_id: id, p_vigente: vigente })

// ───── Activos ─────
export const listarActivos = (empresaId: string, tipoId: string) =>
  leer<Activo[]>(db().from('activos').select('*').eq('empresa_id', empresaId).eq('tipo_id', tipoId).order('numero'))
export type DatosActivo = {
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
export const guardarActivo = (empresaId: string, id: string | null, datos: DatosActivo) =>
  rpc<string>('guardar_activo', { p_empresa: empresaId, p_id: id, p_datos: datos })
export const darBajaActivo = (id: string, fecha: string, motivo: string) => rpc<void>('dar_baja_activo', { p_id: id, p_fecha: fecha, p_motivo: motivo })
export const reactivarActivo = (id: string) => rpc<void>('reactivar_activo', { p_id: id })

export type CambioActivo = { id: number; accion: 'alta' | 'cambio' | 'baja' | 'reactivacion'; hecho_en: string; hecho_por: string | null }
export const historialActivo = (id: string) =>
  leer<CambioActivo[]>(db().from('activos_historial').select('id, accion, hecho_en, hecho_por').eq('activo_id', id).order('id', { ascending: false }).limit(20))

/** Personas activas de la empresa (para elegir responsables). El dueño usa la lista completa de vínculos. */
export type PersonaLista = { persona_id: string; apellidos_nombres: string; puesto: string | null }
export async function listarPersonas(empresaId: string, esDueno: boolean): Promise<PersonaLista[]> {
  if (!esDueno) return leer<PersonaLista[]>(db().rpc('personas_de_mi_empresa'))
  const filas = await leer<{ persona_id: string; puesto: string | null; personas: { apellidos_nombres: string } | null }[]>(
    db().from('vinculos').select('persona_id, puesto, personas(apellidos_nombres)').eq('empresa_id', empresaId).eq('estado', 'activo'),
  )
  return filas
    .map((f) => ({ persona_id: f.persona_id, puesto: f.puesto, apellidos_nombres: f.personas?.apellidos_nombres ?? '—' }))
    .sort((a, b) => a.apellidos_nombres.localeCompare(b.apellidos_nombres, 'es'))
}
