// Inspecciones en el equipo (tarea 3.4-C): copia local de lo necesario para llenar sin señal, borradores y cola de
// envío. Recorrido de una inspección:
//  1. nace en el equipo con un identificador único y se guarda sola a cada cambio (borrador);
//  2. al cerrarla pasa a la cola con sus fotos y firma;
//  3. con señal se suben primero las fotos y la firma, y después la inspección, a la función registrar-inspeccion,
//     que la graba todo o nada. Si llega dos veces responde «ya recibida»: nunca se duplica.
// Solo se borra de la cola cuando el servidor confirma. Si algo falla, se reintenta solo, cada vez con más espera.
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { db } from '../empresas/datos'
import type { CampoFicha, Frecuencia, Subtipo } from '../formatos/base'
import type { Respuesta, Fila } from '../formatos/motor'
import type { Receta } from '../formatos/receta'
import { borrar, guardar, leer, todos } from './almacen'

// ───────────────────────── Copia local ─────────────────────────

export type FormatoLocal = {
  plantilla: { id: string; nombre: string; aplica_a: 'activo' | 'area'; tipo_activo_id: string | null; frecuencia: Frecuencia }
  version: { id: string; numero: number; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null; logo: string; receta: Receta }
  excel: { ruta: string; nombre_archivo: string; marcas: string[] } | null
}
export type ActivoLocal = { id: string; tipo_id: string; numero: number; codigo: string; subtipo: string | null; sede_id: string; unidad_id: string | null; ubicacion_id: string | null; datos: Record<string, string | number>; dotacion: Record<string, number> }
export type CopiaLocal = {
  id: string // copia:<cuenta>:<empresa>
  cuenta: string
  empresa_id: string
  bajada_en: string
  empresa: { razon_social: string; ruc: string; domicilio: string; actividad: string; logo_positivo: string | null; logo_negativo: string | null }
  formatos: FormatoLocal[]
  tipos: { id: string; nombre: string; subtipos: Subtipo[]; campos: CampoFicha[] }[]
  activos: ActivoLocal[]
  sedes: { id: string; nombre: string }[]
  unidades: { id: string; nivel: string; padre_id: string | null; nombre: string; vigente: boolean }[]
  ubicaciones: { id: string; sede_id: string; unidad_id: string | null; nombre: string }[]
  listas: { codigo: string; valores: string[] }[]
  personas: { persona_id: string; apellidos_nombres: string; puesto: string | null }[]
}

const idCopia = (cuenta: string, empresa: string) => `copia:${cuenta}:${empresa}`
export const leerCopia = (cuenta: string, empresa: string) => leer<CopiaLocal>('datos', idCopia(cuenta, empresa))

async function guardarArchivo(id: string, cuenta: string, blob: Blob) {
  await guardar('archivos', { id, cuenta, blob })
}
export async function leerArchivo(id: string): Promise<Blob | null> {
  return (await leer<{ id: string; blob: Blob }>('archivos', id))?.blob ?? null
}

/** Baja del servidor todo lo necesario para inspeccionar sin señal (lo llama la app cada vez que hay señal). */
export async function bajarCopia(cuenta: string, empresa: string): Promise<CopiaLocal> {
  const c = db()
  const sel = (q: PromiseLike<{ data: unknown; error: { message: string } | null }>) =>
    Promise.resolve(q).then((r) => {
      if (r.error) throw new Error(r.error.message)
      return r.data as never
    })
  const [emp, plantillas, excel, tipos, activos, sedes, unidades, ubicaciones, listas, personas] = await Promise.all([
    sel(c.from('empresas').select('razon_social, ruc, domicilio_direccion, domicilio_distrito, domicilio_provincia, domicilio_departamento, actividad_texto, logo_positivo, logo_negativo').eq('id', empresa).single()),
    sel(c.from('plantillas').select('id, nombre, aplica_a, tipo_activo_id, frecuencia, vigente, versiones:plantillas_versiones(id, numero, estado, codigo_formato, version_formato, fecha_aprobacion, logo, receta)').eq('empresa_id', empresa).eq('vigente', true)),
    sel(c.from('plantillas_excel').select('plantilla_id, ruta, nombre_archivo, marcas').eq('empresa_id', empresa)),
    sel(c.from('tipos_activo').select('id, nombre, subtipos, campos').eq('empresa_id', empresa)),
    sel(c.from('activos').select('id, tipo_id, numero, codigo, subtipo, sede_id, unidad_id, ubicacion_id, datos, dotacion').eq('empresa_id', empresa).eq('estado', 'activo').order('numero')),
    sel(c.from('sedes').select('id, nombre').eq('empresa_id', empresa).eq('activa', true).order('nombre')),
    sel(c.from('unidades').select('id, nivel, padre_id, nombre, vigente').eq('empresa_id', empresa)),
    sel(c.from('ubicaciones').select('id, sede_id, unidad_id, nombre').eq('empresa_id', empresa).eq('vigente', true).order('nombre')),
    sel(c.from('listas').select('codigo, valores:listas_valores(nombre, orden, vigente)').eq('empresa_id', empresa)),
    sel(c.rpc('personas_de_mi_empresa')),
  ])
  type P = { id: string; nombre: string; aplica_a: 'activo' | 'area'; tipo_activo_id: string | null; frecuencia: Frecuencia; versiones: (FormatoLocal['version'] & { estado: string })[] }
  const e = emp as Record<string, string | null>
  const exs = excel as { plantilla_id: string; ruta: string; nombre_archivo: string; marcas: string[] }[]
  const copia: CopiaLocal = {
    id: idCopia(cuenta, empresa),
    cuenta,
    empresa_id: empresa,
    bajada_en: new Date().toISOString(),
    empresa: {
      razon_social: e.razon_social ?? '',
      ruc: e.ruc ?? '',
      domicilio: [e.domicilio_direccion, [e.domicilio_distrito, e.domicilio_provincia, e.domicilio_departamento].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
      actividad: e.actividad_texto ?? '',
      logo_positivo: e.logo_positivo,
      logo_negativo: e.logo_negativo,
    },
    formatos: (plantillas as P[]).flatMap((p) => {
      const v = p.versiones.find((x) => x.estado === 'vigente')
      if (!v) return []
      const x = exs.find((y) => y.plantilla_id === p.id)
      return [{
        plantilla: { id: p.id, nombre: p.nombre, aplica_a: p.aplica_a, tipo_activo_id: p.tipo_activo_id, frecuencia: p.frecuencia },
        version: { id: v.id, numero: v.numero, codigo_formato: v.codigo_formato, version_formato: v.version_formato, fecha_aprobacion: v.fecha_aprobacion, logo: v.logo, receta: v.receta },
        excel: x ? { ruta: x.ruta, nombre_archivo: x.nombre_archivo, marcas: x.marcas } : null,
      }]
    }).sort((a, b) => a.plantilla.nombre.localeCompare(b.plantilla.nombre, 'es')),
    tipos: tipos as CopiaLocal['tipos'],
    activos: activos as ActivoLocal[],
    sedes: sedes as CopiaLocal['sedes'],
    unidades: unidades as CopiaLocal['unidades'],
    ubicaciones: ubicaciones as CopiaLocal['ubicaciones'],
    listas: (listas as { codigo: string; valores: { nombre: string; orden: number; vigente: boolean }[] }[]).map((l) => ({
      codigo: l.codigo,
      valores: l.valores.filter((v) => v.vigente).sort((a, b) => a.orden - b.orden).map((v) => v.nombre),
    })),
    personas: personas as CopiaLocal['personas'],
  }
  await guardar('datos', copia)
  // El Excel de cada formato y los logos también quedan en el equipo (para armar la hoja sin señal).
  const bajar = async (bucket: string, ruta: string) => {
    if (await leer('archivos', `${bucket}:${ruta}`)) return
    const r = await c.storage.from(bucket).download(ruta)
    if (r.data) await guardarArchivo(`${bucket}:${ruta}`, cuenta, r.data)
  }
  await Promise.allSettled([
    ...copia.formatos.flatMap((f) => (f.excel ? [bajar('formatos-excel', f.excel.ruta)] : [])),
    ...[copia.empresa.logo_positivo, copia.empresa.logo_negativo].filter((x): x is string => Boolean(x)).map((r) => bajar('logos', r)),
  ])
  return copia
}

// ───────────────────────── Borradores ─────────────────────────

export type FotoLocal = { id: string; punto_clave: string; fila: number | null; bytes: number; tipo_mime: string; sha256: string }
export type Firmante = { rol_clave: string; rol_titulo: string; orden: number; persona_id?: string | null; externo_nombre?: string | null; externo_documento?: string | null }
export type Borrador = {
  id: string
  cuenta: string
  empresa_id: string
  plantilla_id: string
  version_id: string
  nombre_formato: string
  receta: Receta
  sede_id: string
  unidad_id: string | null
  ubicacion_id: string | null
  activo_id: string | null
  activo_foto: { codigo: string; numero: number; subtipo: string | null; datos: Record<string, string | number>; dotacion: Record<string, number>; tipo: string } | null
  respuestas: Record<string, Respuesta>
  filas: Record<string, Fila[]>
  observacion: string
  fecha: string
  iniciada_en: string
  fotos: FotoLocal[]
  firmantes: Firmante[]
  mi_firma: { rol_clave: string; archivo_id: string; bytes: number; firmado_en: string } | null
  actualizado_en: string
}

export const leerBorrador = (id: string) => leer<Borrador>('borradores', id)
export async function guardarBorrador(b: Borrador) {
  await guardar('borradores', { ...b, actualizado_en: new Date().toISOString() })
  avisar()
}
export async function misBorradores(cuenta: string) {
  return (await todos<Borrador>('borradores')).filter((b) => b.cuenta === cuenta).sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en))
}
/** Descarta un borrador y sus fotos (solo existen en este equipo). */
export async function descartarBorrador(b: Borrador) {
  for (const f of b.fotos) await borrar('archivos', f.id)
  if (b.mi_firma) await borrar('archivos', b.mi_firma.archivo_id)
  await borrar('borradores', b.id)
  avisar()
}
export async function guardarFoto(cuenta: string, id: string, blob: Blob) {
  await guardarArchivo(id, cuenta, blob)
}
export const quitarArchivo = (id: string) => borrar('archivos', id)

// ───────────────────────── Cola de envío ─────────────────────────

export type EstadoCola = 'pendiente' | 'enviando' | 'enviada' | 'rechazada'
export type EnCola = {
  id: string
  cuenta: string
  borrador: Borrador
  cerrada_en: string
  estado: EstadoCola
  error: string | null
  faltan?: string[]
  intentos: number
  proximo_intento: number
  subidos: string[] // fotos y firma que ya están en el servidor
  numero: number | null // número de la inspección en el servidor
}

/** Cierra la inspección: pasa del borrador a la cola (sus fotos siguen en el equipo hasta que lleguen). */
export async function cerrar(b: Borrador) {
  const item: EnCola = {
    id: b.id, cuenta: b.cuenta, borrador: { ...b, actualizado_en: new Date().toISOString() }, cerrada_en: new Date().toISOString(),
    estado: 'pendiente', error: null, intentos: 0, proximo_intento: 0, subidos: [], numero: null,
  }
  await guardar('cola', item)
  await borrar('borradores', b.id)
  avisar()
  void sincronizar(b.cuenta)
}

export async function miCola(cuenta: string) {
  return (await todos<EnCola>('cola')).filter((c) => c.cuenta === cuenta).sort((a, b) => b.cerrada_en.localeCompare(a.cerrada_en))
}

/** Una rechazada vuelve a ser borrador para corregirla y cerrarla otra vez. */
export async function volverABorrador(item: EnCola) {
  await guardar('borradores', { ...item.borrador, actualizado_en: new Date().toISOString() })
  await borrar('cola', item.id)
  avisar()
}

const ESPERAS = [30, 60, 120, 300, 900, 1800] // segundos entre reintentos
let enCurso: Promise<void> | null = null

/** Envía lo que esté en la cola. Nunca corre dos veces a la vez. */
export function sincronizar(cuenta: string, forzar = false): Promise<void> {
  enCurso ??= enviarCola(cuenta, forzar).finally(() => {
    enCurso = null
  })
  return enCurso
}

async function enviarCola(cuenta: string, forzar: boolean) {
  if (!navigator.onLine) return
  const ahora = Date.now()
  for (const item of await miCola(cuenta)) {
    if (item.estado === 'enviada' || item.estado === 'rechazada') continue
    if (!forzar && item.proximo_intento > ahora) continue
    await enviarUna(item)
  }
  // Las enviadas se guardan una semana como constancia en el equipo y luego se limpian.
  for (const item of await miCola(cuenta))
    if (item.estado === 'enviada' && Date.parse(item.cerrada_en) < ahora - 7 * 864e5) await borrar('cola', item.id)
}

async function subir(ruta: string, blob: Blob, tipo: string) {
  const { error } = await db().storage.from('evidencias').upload(ruta, blob, { contentType: tipo, upsert: false })
  // Si ya estaba (un intento anterior llegó pero no se anotó), no es un error: el servidor revisa su tamaño.
  if (error && !/exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) throw error
}

async function enviarUna(item: EnCola) {
  const b = item.borrador
  const marcar = async (cambios: Partial<EnCola>) => {
    Object.assign(item, cambios)
    await guardar('cola', item)
    avisar()
  }
  await marcar({ estado: 'enviando', error: null })
  try {
    // 1. Fotos y firma
    for (const f of b.fotos) {
      if (item.subidos.includes(f.id)) continue
      const blob = await leerArchivo(f.id)
      if (!blob) throw new Error('Una foto ya no está en el equipo.')
      await subir(`${b.empresa_id}/${b.id}/${f.id}.${extension(f.tipo_mime)}`, blob, f.tipo_mime)
      await marcar({ subidos: [...item.subidos, f.id] })
    }
    if (b.mi_firma && !item.subidos.includes(b.mi_firma.archivo_id)) {
      const blob = await leerArchivo(b.mi_firma.archivo_id)
      if (!blob) throw new Error('Tu firma ya no está en el equipo.')
      await subir(rutaMiFirma(b), blob, 'image/png')
      await marcar({ subidos: [...item.subidos, b.mi_firma.archivo_id] })
    }
    // 2. La inspección
    const { data, error } = await db().functions.invoke('registrar-inspeccion', { body: cuerpo(item) })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const estado = error.context.status as number
        const r = await error.context.json().catch(() => ({}))
        if (estado === 409 || estado >= 500) throw new Error(r.error ?? 'El servidor no pudo grabarla todavía.')
        if (estado === 401) return reintentar(item, 'Tu sesión venció: vuelve a ingresar para enviarla.')
        // 403 (por ejemplo, cuenta inhabilitada) o 422 (datos no válidos): no se reintenta sola.
        return marcar({ estado: 'rechazada', error: r.error ?? 'El servidor no la aceptó.', faltan: r.faltan })
      }
      throw error instanceof FunctionsFetchError ? new Error('Sin respuesta del servidor.') : error
    }
    await marcar({ estado: 'enviada', numero: data?.numero ?? null, error: null })
    for (const f of b.fotos) await borrar('archivos', f.id)
    if (b.mi_firma) await borrar('archivos', b.mi_firma.archivo_id)
  } catch (e) {
    await reintentar(item, (e as Error).message || 'No se pudo enviar.')
  }

  async function reintentar(it: EnCola, mensaje: string) {
    const espera = ESPERAS[Math.min(it.intentos, ESPERAS.length - 1)]
    await marcar({ estado: 'pendiente', error: mensaje, intentos: it.intentos + 1, proximo_intento: Date.now() + espera * 1000 })
  }
}

export const extension = (tipo: string) => ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' })[tipo] ?? 'jpg'
export const rutaMiFirma = (b: Borrador) => `${b.empresa_id}/${b.id}/firma-${b.cuenta}-${b.mi_firma?.rol_clave}.png`

function cuerpo(item: EnCola) {
  const b = item.borrador
  return {
    modo: 'registrar', id: b.id, version_id: b.version_id, sede_id: b.sede_id, unidad_id: b.unidad_id, ubicacion_id: b.ubicacion_id,
    activo_id: b.activo_id, activo_foto: b.activo_foto, respuestas: b.respuestas, filas: b.filas, observacion: b.observacion || null,
    fecha: b.fecha, iniciada_en_equipo: b.iniciada_en, cerrada_en_equipo: item.cerrada_en, dispositivo: navigator.userAgent.slice(0, 200),
    archivos: b.fotos.map((f) => ({ ...f, ruta: `${b.empresa_id}/${b.id}/${f.id}.${extension(f.tipo_mime)}` })),
    firmantes: b.firmantes,
    mi_firma: b.mi_firma ? { rol_clave: b.mi_firma.rol_clave, ruta: rutaMiFirma(b), bytes: b.mi_firma.bytes, firmado_en: b.mi_firma.firmado_en } : null,
  }
}

// ───────────────────────── Avisos a la pantalla ─────────────────────────

const oyentes = new Set<() => void>()
function avisar() {
  for (const o of oyentes) o()
}

/** Borradores y cola de esta cuenta, al día. */
export function useCampo(cuenta: string | null) {
  const [estado, setEstado] = useState<{ borradores: Borrador[]; cola: EnCola[] }>({ borradores: [], cola: [] })
  useEffect(() => {
    if (!cuenta) return
    let vivo = true
    const leerTodo = () =>
      void Promise.all([misBorradores(cuenta), miCola(cuenta)]).then(([borradores, cola]) => vivo && setEstado({ borradores, cola }), () => {})
    leerTodo()
    oyentes.add(leerTodo)
    return () => {
      vivo = false
      oyentes.delete(leerTodo)
    }
  }, [cuenta])
  return estado
}

/**
 * Mientras haya sesión: envía la cola al volver la señal, al abrir la app y cada minuto, y actualiza la copia local.
 * Lo usa App una sola vez.
 */
export function useSincronizacion(cuenta: string | null, empresa: string | null, online: boolean, equipoSso: boolean) {
  useEffect(() => {
    if (!cuenta || !online) return
    void sincronizar(cuenta, true)
    if (empresa && equipoSso) void bajarCopia(cuenta, empresa).catch(() => {})
    const cada = setInterval(() => void sincronizar(cuenta), 60_000)
    return () => clearInterval(cada)
  }, [cuenta, empresa, online, equipoSso])
}
