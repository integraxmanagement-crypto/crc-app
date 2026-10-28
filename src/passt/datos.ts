// Programa anual de SST (tarea 3.4-E). Se lee con las reglas RLS (lo ven el administrador y el gestor) y se escribe
// solo con las acciones de la base de datos, que revisan los permisos por dentro.
import { conLimite, db, mensaje, rpc } from '../empresas/datos'
import type { NodoBase } from './numeracion'

export type Programa = {
  id: string
  empresa_id: string
  sede_id: string | null
  anio: number
  nombre: string
  codigo_formato: string | null
  version_formato: string | null
  fecha_aprobacion: string | null
  meta_cumplimiento: number
  estado: 'borrador' | 'aprobado'
  aprobado_por: string | null
  aprobado_en: string | null
  vigente: boolean
  actualizado_en: string
  sedes: { nombre: string } | null
}
export type Nodo = NodoBase & {
  programa_id: string
  texto: string
  recursos: string | null
  responsable_id: string | null
  meta_pct: number | null
  observaciones: string | null
  plantilla_id: string | null
}
export type Meta = { id: string; nodo_id: string; orden: number; texto: string; indicador: string | null }
export type Semana = {
  id: string
  actividad_id: string
  semana: number
  programada: boolean
  manual: boolean
  manual_comentario: string | null
  manual_foto_ruta: string | null
  manual_por: string | null
  manual_en: string | null
}
export type Ejecucion = { actividad_id: string; semana: number; inspecciones: number; ultima: string }
export type HallazgosActividad = { actividad_id: string; abiertos: number; vencidos: number }
export type Responsable = { persona_id: string; apellidos_nombres: string; rol: string }
export type Cambio = { id: number; nodo_id: string | null; cambio: string; detalle: Record<string, unknown> | null; motivo: string | null; hecho_por: string | null; hecho_en: string }

async function leer<T>(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw new Error(mensaje(error))
  return data as T
}

export const listarProgramas = (empresaId: string) =>
  leer<Programa[]>(conLimite(db().from('passt_programas').select('*, sedes(nombre)').eq('empresa_id', empresaId).order('anio', { ascending: false }).order('nombre')))

/** Todo lo de un programa de una vez: encabezado, árbol, metas, semanas, ejecución por inspecciones e historial. */
export async function leerPrograma(id: string) {
  const [programa, nodos, metas, semanas, ejecucion, hallazgos, historial] = await Promise.all([
    leer<Programa>(db().from('passt_programas').select('*, sedes(nombre)').eq('id', id).single()),
    leer<Nodo[]>(db().from('passt_nodos').select('*').eq('programa_id', id)),
    leer<Meta[]>(db().from('passt_metas').select('id, nodo_id, orden, texto, indicador, passt_nodos!inner(programa_id)').eq('passt_nodos.programa_id', id).order('orden')),
    leer<Semana[]>(db().from('passt_semanas').select('*, passt_nodos!inner(programa_id)').eq('passt_nodos.programa_id', id)),
    rpc<Ejecucion[]>('passt_ejecucion', { p_programa: id }),
    rpc<HallazgosActividad[]>('passt_hallazgos', { p_programa: id }),
    leer<Cambio[]>(db().from('passt_historial').select('id, nodo_id, cambio, detalle, motivo, hecho_por, hecho_en').eq('programa_id', id).order('id', { ascending: false }).limit(200)),
  ])
  return { programa, nodos, metas, semanas, ejecucion, hallazgos, historial }
}
export type DatosPrograma = Awaited<ReturnType<typeof leerPrograma>>

export const responsables = (empresaId: string) => rpc<Responsable[]>('passt_responsables', { p_empresa: empresaId })
export const trabajadores = (empresaId: string) => rpc<number | null>('passt_trabajadores', { p_empresa: empresaId })
export const formatosDeEmpresa = (empresaId: string) =>
  leer<{ id: string; nombre: string; vigente: boolean }[]>(db().from('plantillas').select('id, nombre, vigente').eq('empresa_id', empresaId).order('nombre'))

export const crearPrograma = (empresaId: string, datos: { anio: number; sede_id: string | null; nombre: string }) =>
  rpc<string>('crear_programa', { p_empresa: empresaId, p_datos: datos })
export const duplicarPrograma = (id: string, datos: { anio: number; sede_id: string | null; nombre: string }) =>
  rpc<string>('duplicar_programa', { p_id: id, p_datos: datos })
export const guardarPrograma = (id: string, datos: Record<string, unknown>) => rpc<void>('guardar_programa', { p_id: id, p_datos: datos })
export const aprobarPrograma = (id: string) => rpc<void>('aprobar_programa', { p_id: id })
export const cambiarVigenciaPrograma = (id: string, vigente: boolean) => rpc<void>('cambiar_vigencia_programa', { p_id: id, p_vigente: vigente })
export const guardarNodo = (programa: string, id: string | null, datos: Record<string, unknown>) =>
  rpc<string>('guardar_nodo', { p_programa: programa, p_id: id, p_datos: datos })
export const moverNodo = (id: string, datos: { direccion?: 'subir' | 'bajar'; padre_id?: string; motivo?: string }) => rpc<void>('mover_nodo', { p_id: id, p_datos: datos })
export const bajaNodo = (id: string, motivo: string | null) => rpc<void>('baja_nodo', { p_id: id, p_motivo: motivo })
export const guardarMetas = (nodo: string, metas: { texto: string; indicador: string }[], motivo: string | null) =>
  rpc<void>('guardar_metas', { p_nodo: nodo, p_metas: metas, p_motivo: motivo })
export const programarSemana = (actividad: string, semana: number, programada: boolean, motivo: string | null) =>
  rpc<void>('programar_semana', { p_actividad: actividad, p_semana: semana, p_programada: programada, p_motivo: motivo })

/** Marca a mano una semana como ejecutada (con foto opcional, que se sube antes al almacén privado) o quita la marca. */
export async function marcarSemana(n: Pick<Nodo, 'id'> & { empresa_id: string }, semana: number, ejecutada: boolean, comentario: string | null, foto: Blob | null) {
  let ruta: string | null = null
  if (ejecutada && foto) {
    ruta = `${n.empresa_id}/${n.id}/passt-${semana}-${crypto.randomUUID().slice(0, 8)}.jpg`
    const { error } = await db().storage.from('evidencias').upload(ruta, foto, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(mensaje(error))
  }
  await rpc<void>('marcar_semana', { p_actividad: n.id, p_semana: semana, p_ejecutada: ejecutada, p_comentario: comentario, p_foto_ruta: ruta, p_foto_bytes: foto?.size ?? null })
}

export const NOMBRE_TIPO: Record<Nodo['tipo'], string> = {
  objetivo_general: 'Objetivo general',
  objetivo_especifico: 'Objetivo específico',
  seccion: 'Sección',
  actividad: 'Actividad',
}
export const HIJO_DE: Partial<Record<Nodo['tipo'], Nodo['tipo']>> = { objetivo_general: 'objetivo_especifico', objetivo_especifico: 'seccion', seccion: 'actividad' }
