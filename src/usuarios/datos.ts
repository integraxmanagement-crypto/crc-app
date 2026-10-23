// Datos de usuarios, listas y registro de intentos (tarea 3.3). Se lee con las reglas RLS de cada persona;
// se escribe solo con las acciones de la base de datos y las funciones del servidor, que revisan los permisos.
import { conLimite, db, invocar, mensaje, rpc } from '../empresas/datos'

export type Rol = 'admin_empresa' | 'gestor' | 'usuario'
export const NOMBRE_ROL: Record<Rol, string> = { admin_empresa: 'Administrador', gestor: 'Gestor (equipo SSO)', usuario: 'Usuario' }

export type Cuenta = {
  id: string // vínculo
  persona_id: string
  rol: Rol
  estado: 'activo' | 'cesado'
  fecha_ingreso: string
  fecha_cese: string | null
  motivo_cese: string | null
  unidad_id: string | null
  puesto_id: string | null
  area: string | null // camino completo de su unidad, por ejemplo «Operaciones › Producción › Línea 1»
  puesto: string | null
  por_revisar_desde: string | null // no apareció en una carga con «lista completa» (tarea 3.6): confirmar cese o que sigue
  personas: { tipo_documento: string; numero_documento: string; apellidos_nombres: string; debe_cambiar_contrasena: boolean } | null
}

export type Item = { id: string; nombre: string; vigente: boolean }

// Estructura de la empresa (tarea 3.6): Gerencia → Área → Subárea o línea (opcional).
export type Nivel = 'gerencia' | 'area' | 'subarea'
export type Unidad = Item & { nivel: Nivel; padre_id: string | null }
export type Listas = { puestos: Item[]; unidades: Unidad[] }

export const NOMBRE_NIVEL: Record<Nivel, string> = { gerencia: 'Gerencia', area: 'Área', subarea: 'Subárea o línea' }

/** Camino de una unidad («Gerencia › Área › Subárea») y si está vigente junto con todas las de arriba. */
export function caminoUnidad(unidades: Unidad[], id: string): { ruta: string; vigente: boolean } {
  const partes: string[] = []
  let vigente = true
  for (let u = unidades.find((x) => x.id === id); u; u = unidades.find((x) => x.id === u!.padre_id)) {
    partes.unshift(u.nombre)
    vigente &&= u.vigente
  }
  return { ruta: partes.join(' › '), vigente }
}

/** Áreas y subáreas que se pueden asignar a una persona, con su camino, ordenadas. */
export function unidadesAsignables(unidades: Unidad[]): Item[] {
  return unidades
    .filter((u) => u.nivel !== 'gerencia')
    .map((u) => {
      const c = caminoUnidad(unidades, u.id)
      return { id: u.id, nombre: c.ruta, vigente: c.vigente }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export type Intento = {
  id: number
  tipo_documento: string
  numero_documento: string
  resultado: string
  ip: string | null
  creado_en: string
}

export const RESULTADOS: Record<string, string> = {
  exito: 'Ingreso correcto',
  fallo: 'Contraseña o documento incorrecto',
  bloqueado: 'Bloqueado por intentos',
  inhabilitada: 'Cuenta inhabilitada',
  limite_supabase: 'Límite de Supabase',
  error: 'Error del sistema',
}

export type ContrasenaDada = {
  id: number
  modo: 'individual' | 'en_bloque' | 'rescate'
  dado_en: string
  dado_por: string | null // vacío = herramienta de rescate
  persona: { apellidos_nombres: string } | null
  autor: { apellidos_nombres: string } | null
}

// ───── Cuentas ─────
export async function listarCuentas(empresaId: string): Promise<Cuenta[]> {
  const { data, error } = await conLimite(
    db()
      .from('vinculos')
      .select(
        'id, persona_id, rol, estado, fecha_ingreso, fecha_cese, motivo_cese, unidad_id, puesto_id, area, puesto, por_revisar_desde, ' +
          'personas(tipo_documento, numero_documento, apellidos_nombres, debe_cambiar_contrasena)',
      )
      .eq('empresa_id', empresaId),
  )
  if (error) throw new Error(mensaje(error))
  return (data as unknown as Cuenta[]).sort((a, b) =>
    (a.personas?.apellidos_nombres ?? '').localeCompare(b.personas?.apellidos_nombres ?? '', 'es'),
  )
}

export type DatosCuenta = {
  rol: Rol
  tipo_documento: string
  numero_documento: string
  apellidos_nombres: string
  fecha_ingreso: string
  puesto: string | null // nombre tal como está en la lista (crear-cuenta lo busca en la lista de la empresa)
  unidad_id: string | null // área o subárea elegida en la estructura de la empresa
}

export const crearCuenta = (empresaId: string, datos: DatosCuenta) =>
  invocar<{ cuenta_nueva: boolean; contrasena_inicial?: string }>('crear-cuenta', { ...datos, empresa_id: empresaId })

export const actualizarPersona = (vinculoId: string, datos: Record<string, string | null>) =>
  rpc<void>('actualizar_persona', { p_vinculo: vinculoId, p_datos: datos })
export const cesarCuenta = (vinculoId: string, fecha: string, motivo: string) =>
  rpc<void>('cesar_vinculo', { p_vinculo: vinculoId, p_fecha_cese: fecha, p_motivo: motivo })
export const reactivarCuenta = (vinculoId: string) => rpc<void>('reactivar_vinculo', { p_vinculo: vinculoId })
/** Quita la marca «por revisar»: la persona sigue en la empresa. (El cese se confirma con cesarCuenta.) */
export const confirmarSigue = (vinculoId: string) => rpc<void>('confirmar_sigue', { p_vinculo: vinculoId })

export const darContrasena = (personaId: string) =>
  invocar<{ apellidos_nombres: string; contrasena: string }>('dar-contrasena', { persona_id: personaId })

export type ResultadoBloque = {
  persona_id: string
  rol: Rol
  apellidos_nombres: string
  tipo_documento: string
  numero_documento: string
  contrasena: string | null
}
export const restablecerEnBloque = (empresaId: string, roles: Rol[]) =>
  invocar<{ resultados: ResultadoBloque[] }>('dar-contrasena', { empresa_id: empresaId, roles })

export async function listarContrasenasDadas(empresaId: string): Promise<ContrasenaDada[]> {
  const { data, error } = await db()
    .from('contrasenas_dadas')
    .select('id, modo, dado_en, dado_por, persona:personas!contrasenas_dadas_persona_id_fkey(apellidos_nombres), autor:personas!contrasenas_dadas_dado_por_fkey(apellidos_nombres)')
    .eq('empresa_id', empresaId)
    .order('dado_en', { ascending: false })
    .limit(20)
  if (error) throw new Error(mensaje(error))
  return data as unknown as ContrasenaDada[]
}

// ───── Estructura y puestos ─────
export async function leerListas(empresaId: string): Promise<Listas> {
  const [unidades, puestos] = await conLimite(
    Promise.all([
      db().from('unidades').select('id, nivel, padre_id, nombre, vigente').eq('empresa_id', empresaId).order('nombre'),
      db().from('puestos').select('id, nombre, vigente').eq('empresa_id', empresaId).order('nombre'),
    ]),
  )
  const error = unidades.error || puestos.error
  if (error) throw new Error(mensaje(error))
  return { unidades: unidades.data as Unidad[], puestos: puestos.data }
}

export const guardarPuesto = (empresaId: string, id: string | null, nombre: string) =>
  rpc<string>('guardar_item_lista', { p_lista: 'puestos', p_empresa: empresaId, p_id: id, p_nombre: nombre })
export const cambiarVigenciaPuesto = (id: string, vigente: boolean) =>
  rpc<void>('cambiar_vigencia_item_lista', { p_lista: 'puestos', p_id: id, p_vigente: vigente })
export const borrarPuesto = (id: string) => rpc<void>('borrar_item_lista', { p_lista: 'puestos', p_id: id })

/** Crea (id vacío) o renombra una gerencia, área o subárea. */
export const guardarUnidad = (empresaId: string, id: string | null, nivel: Nivel, padreId: string | null, nombre: string) =>
  rpc<string>('guardar_unidad', { p_empresa: empresaId, p_id: id, p_nivel: nivel, p_padre: padreId, p_nombre: nombre })
export const cambiarVigenciaUnidad = (id: string, vigente: boolean) =>
  rpc<void>('cambiar_vigencia_unidad', { p_id: id, p_vigente: vigente })
export const borrarUnidad = (id: string) => rpc<void>('borrar_unidad', { p_id: id })

// ───── Registro de intentos (solo el dueño de la plataforma lo puede leer) ─────
export type FiltroIntentos = { desde: string; hasta: string; resultado: string; documento: string }

export async function listarIntentos(f: FiltroIntentos): Promise<Intento[]> {
  let q = db().from('intentos_ingreso').select('id, tipo_documento, numero_documento, resultado, ip, creado_en')
  // Las fechas del filtro son días de Lima (UTC−5).
  if (f.desde) q = q.gte('creado_en', `${f.desde}T00:00:00-05:00`)
  if (f.hasta) q = q.lte('creado_en', `${f.hasta}T23:59:59.999-05:00`)
  if (f.resultado) q = q.eq('resultado', f.resultado)
  const doc = f.documento.toUpperCase().replace(/[\s.-]/g, '')
  if (doc) q = q.like('numero_documento', `%${doc.replace(/[%_]/g, '')}%`)
  const { data, error } = await conLimite(q.order('creado_en', { ascending: false }).limit(200))
  if (error) throw new Error(mensaje(error))
  return data
}
