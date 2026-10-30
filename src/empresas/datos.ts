// Datos de empresas (tarea 3.2). Se lee con las reglas RLS de cada persona;
// se escribe solo con las acciones de la base de datos, que revisan los permisos.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type Empresa = {
  id: string
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  domicilio_direccion: string | null
  domicilio_distrito: string | null
  domicilio_provincia: string | null
  domicilio_departamento: string | null
  ciiu_codigo: string | null
  actividad_texto: string | null
  estado: 'activa' | 'suspendida'
  plan: 'gratuito' | 'pago'
  logo_positivo: string | null
  logo_negativo: string | null
  es_prueba: boolean
  trabajadores_modo: 'automatico' | 'manual'
  trabajadores_manual: number | null
  actualizado_en: string
  catalogo_ciiu: { descripcion: string } | null
}

export type Sede = {
  id: string
  nombre: string
  direccion: string
  distrito: string
  provincia: string
  departamento: string
  activa: boolean
}

export type TipoContacto = 'representante_legal' | 'administrador' | 'respaldo'
export type Contacto = { nombre: string; telefono: string; correo: string }
export type Contactos = Partial<Record<TipoContacto, Contacto>>

export type Administrador = {
  id: string
  estado: string
  puesto: string | null
  personas: { apellidos_nombres: string; tipo_documento: string; numero_documento: string } | null
}

export type Ciiu = { codigo: string; descripcion: string }

/** Campos de la ficha que se envían al guardar (los nombres coinciden con la base de datos). */
export type Ficha = Pick<
  Empresa,
  | 'ruc'
  | 'razon_social'
  | 'nombre_comercial'
  | 'domicilio_direccion'
  | 'domicilio_distrito'
  | 'domicilio_provincia'
  | 'domicilio_departamento'
  | 'ciiu_codigo'
  | 'actividad_texto'
  | 'plan'
  | 'es_prueba'
>

export type DatosSede = Omit<Sede, 'id' | 'activa'>

export function db() {
  if (!supabase) throw new Error('La app aún no está conectada a la base de datos.')
  return supabase
}

// Cuando el servidor no contesta, el navegador da mensajes en inglés como «TypeError: Failed to fetch».
const FALLA_DE_RED = /failed to fetch|networkerror|load failed|network request failed/i
export const SIN_RESPUESTA = 'No hubo respuesta del servidor. Revisa tu señal y reintenta.'

/** Mensaje en lenguaje simple a partir de un error de Supabase. */
export function mensaje(error: { message?: string; code?: string } | null): string {
  if (!error) return ''
  if (!navigator.onLine) return 'Sin conexión. Necesitas señal para guardar.'
  if (FALLA_DE_RED.test(error.message ?? '')) return SIN_RESPUESTA
  if (error.code === '42501' || error.message === 'No autorizado') return 'No tienes permiso para hacer esto.'
  return error.message || 'No se pudo completar. Intenta de nuevo.'
}

export async function rpc<T>(nombre: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(nombre, args)
  if (error) throw new Error(mensaje(error))
  return data as T
}

// ───── RUC (la base de datos hace la misma revisión) ─────
export function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)[0-9]{9}$/.test(ruc)) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((s, p, i) => s + p * Number(ruc[i]), 0)
  let digito = 11 - (suma % 11)
  if (digito === 10) digito = 0
  if (digito === 11) digito = 1
  return digito === Number(ruc[10])
}

// ───── Lectura ─────
const CAMPOS_EMPRESA = '*, catalogo_ciiu(descripcion)'

export async function listarEmpresas(): Promise<Empresa[]> {
  const { data, error } = await conLimite(db().from('empresas').select(CAMPOS_EMPRESA).order('razon_social'))
  if (error) throw new Error(mensaje(error))
  return data as Empresa[]
}

/** Si la base de datos no responde a tiempo, se avisa en vez de quedarse cargando para siempre. */
export function conLimite<T>(promesa: PromiseLike<T>, ms = 15000): Promise<T> {
  return Promise.race([
    Promise.resolve(promesa),
    new Promise<T>((_, rechazar) => setTimeout(() => rechazar(new Error('La respuesta tarda demasiado. Revisa tu señal y reintenta.')), ms)),
  ])
}

export async function leerEmpresa(id: string) {
  const [empresa, sedes, contactos] = await conLimite(Promise.all([
    db().from('empresas').select(CAMPOS_EMPRESA).eq('id', id).maybeSingle(),
    db().from('sedes').select('id, nombre, direccion, distrito, provincia, departamento, activa').eq('empresa_id', id).order('creado_en'),
    db().from('empresas_contactos').select('tipo, nombre, telefono, correo').eq('empresa_id', id),
  ]))
  const error = empresa.error || sedes.error || contactos.error
  if (error) throw new Error(mensaje(error))
  const porTipo: Contactos = {}
  for (const c of contactos.data ?? []) porTipo[c.tipo as TipoContacto] = { nombre: c.nombre, telefono: c.telefono, correo: c.correo }
  return { empresa: empresa.data as Empresa | null, sedes: (sedes.data ?? []) as Sede[], contactos: porTipo }
}

/** Administradores de la empresa (solo los ve quien tiene permiso: el dueño o el propio administrador). */
export async function listarAdministradores(empresaId: string): Promise<Administrador[]> {
  const { data, error } = await db()
    .from('vinculos')
    .select('id, estado, puesto, personas(apellidos_nombres, tipo_documento, numero_documento)')
    .eq('empresa_id', empresaId)
    .eq('rol', 'admin_empresa')
    .order('creado_en')
  if (error) throw new Error(mensaje(error))
  return data as unknown as Administrador[]
}

export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function buscarCiiu(texto: string): Promise<Ciiu[]> {
  const q = normalizar(texto)
  if (q.length < 2) return []
  let consulta = db().from('catalogo_ciiu').select('codigo, descripcion').eq('seleccionable', true).order('codigo').limit(25)
  consulta = /^[0-9]+$/.test(q) ? consulta.like('codigo', `${q}%`) : consulta.ilike('busqueda', `%${q.replace(/[%_]/g, '')}%`)
  const { data, error } = await consulta
  if (error) throw new Error(mensaje(error))
  return data
}

// ───── Escritura (acciones de la base de datos) ─────
export const crearEmpresa = (ficha: Ficha, sede: DatosSede) => rpc<string>('crear_empresa', { p_ficha: ficha, p_sede: sede })
export const actualizarEmpresa = (id: string, ficha: Ficha) => rpc<void>('actualizar_empresa', { p_empresa: id, p_ficha: ficha })
export const cambiarEstadoEmpresa = (id: string, estado: Empresa['estado']) =>
  rpc<void>('cambiar_estado_empresa', { p_empresa: id, p_estado: estado })
export const guardarSede = (empresaId: string, sedeId: string | null, datos: DatosSede) =>
  rpc<string>('guardar_sede', { p_empresa: empresaId, p_sede: sedeId, p_datos: datos })
export const cambiarEstadoSede = (sedeId: string, activa: boolean) => rpc<void>('cambiar_estado_sede', { p_sede: sedeId, p_activa: activa })
export const guardarContactos = (empresaId: string, contactos: Contactos) =>
  rpc<void>('guardar_contactos', { p_empresa: empresaId, p_datos: contactos })

// ───── Logos ─────
export const TIPOS_LOGO: Record<string, 'png' | 'jpg' | 'webp'> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
export const TAMANO_MAXIMO_LOGO = 1024 * 1024

/** Revisa que el archivo sea de verdad una imagen PNG, JPG o WebP (no solo por su nombre) y que pese ≤ 1 MB. */
export async function revisarLogo(archivo: File): Promise<string | null> {
  if (!TIPOS_LOGO[archivo.type]) return 'Usa una imagen PNG, JPG o WebP.'
  if (archivo.size > TAMANO_MAXIMO_LOGO) return 'La imagen pesa más de 1 MB. Reduce su tamaño e intenta de nuevo.'
  const b = new Uint8Array(await archivo.slice(0, 12).arrayBuffer())
  const esPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const esJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const esWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45
  const coincide = { png: esPng, jpg: esJpg, webp: esWebp }[TIPOS_LOGO[archivo.type]]
  if (!coincide) return 'El archivo no parece una imagen válida.'
  return null
}

export async function subirLogo(empresaId: string, tipo: 'positivo' | 'negativo', archivo: File, rutaAnterior: string | null) {
  const ruta = `${empresaId}/${tipo}.${TIPOS_LOGO[archivo.type]}`
  const { error } = await db().storage.from('logos').upload(ruta, archivo, { upsert: true, contentType: archivo.type, cacheControl: '60' })
  if (error) throw new Error(error.message.includes('size') ? 'La imagen pesa más de 1 MB.' : mensaje(error))
  await rpc<void>('registrar_logo', { p_empresa: empresaId, p_tipo: tipo, p_ruta: ruta })
  // Si antes había otro formato (p. ej. .jpg y ahora .png), se borra el archivo anterior.
  if (rutaAnterior && rutaAnterior !== ruta) await db().storage.from('logos').remove([rutaAnterior])
}

export async function quitarLogoNegativo(empresaId: string, ruta: string) {
  await rpc<void>('registrar_logo', { p_empresa: empresaId, p_tipo: 'negativo', p_ruta: null })
  await db().storage.from('logos').remove([ruta])
}

/** Descarga el logo (el almacén es privado) y devuelve una dirección temporal para mostrarlo. */
export async function verLogo(ruta: string): Promise<string | null> {
  const { data, error } = await db().storage.from('logos').download(ruta)
  if (error || !data) return null
  return URL.createObjectURL(data)
}

// ───── Primer administrador (función del servidor crear-cuenta de la 3.1) ─────
export type DatosAdministrador = {
  tipo_documento: string
  numero_documento: string
  apellidos_nombres: string
  fecha_ingreso: string
  puesto: string | null // nombre tal como está en la lista de la empresa
  unidad_id: string | null // área o subárea de la estructura de la empresa (tarea 3.6)
}

export const crearAdministrador = (empresaId: string, datos: DatosAdministrador) =>
  invocar<{ cuenta_nueva: boolean; contrasena_inicial?: string }>('crear-cuenta', { ...datos, empresa_id: empresaId, rol: 'admin_empresa' })

/** Llama a una función del servidor y traduce su error a lenguaje simple. */
export async function invocar<T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke(nombre, { body: cuerpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const respuesta = await error.context.json().catch(() => null)
      if (respuesta?.error) throw new Error(respuesta.error === 'No autorizado' ? 'No tienes permiso para hacer esto.' : String(respuesta.error))
    }
    throw new Error(navigator.onLine ? SIN_RESPUESTA : 'Sin conexión. Necesitas señal para hacer esto.')
  }
  return data as T
}
