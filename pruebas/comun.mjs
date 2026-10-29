// Ayudas para las pruebas automáticas de CRC (tarea 3.1). Solo cuentas FICTICIAS.
// Lee la URL y la clave PÚBLICA de .env.local, y las contraseñas de prueba de .env.pruebas.local
// (ambos archivos están excluidos de GitHub). Nunca imprime contraseñas.
import { randomInt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function leerEnv(archivo) {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
}

const app = leerEnv('.env.local')
export const URL = app.VITE_SUPABASE_URL
export const CLAVE_PUBLICA = app.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL || !CLAVE_PUBLICA) throw new Error('Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY')

const ARCHIVO_CUENTAS = '.env.pruebas.local'
export const cuentas = leerEnv(ARCHIVO_CUENTAS)

/** Guarda (o reemplaza) una contraseña de prueba en el archivo local. */
export function guardarCuenta(nombre, documento, clave) {
  cuentas[`${nombre}_DOC`] = documento
  cuentas[`${nombre}_CLAVE`] = clave
  const lineas = ['# Cuentas FICTICIAS de prueba (tarea 3.1). Archivo local: NO se sube a GitHub (.gitignore: .env.*).']
  for (const [k, v] of Object.entries(cuentas)) lineas.push(`${k}=${v}`)
  writeFileSync(ARCHIVO_CUENTAS, lineas.join('\n') + '\n')
}

export function cliente() {
  return createClient(URL, CLAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function correoInterno(documento) {
  const [tipo, numero] = documento.split(':')
  return `${tipo}-${numero.toLowerCase()}@usuarios.crc.invalid`
}

/** Ingresa por la función "ingresar", igual que la app. Devuelve { c, error, estado }. */
export async function ingresarConDocumento(documento, clave) {
  const [tipo, numero] = documento.split(':')
  const r = await fetch(`${URL}/functions/v1/ingresar`, {
    method: 'POST',
    headers: { apikey: CLAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo_documento: tipo, numero_documento: numero, contrasena: clave }),
  })
  const datos = await r.json().catch(() => ({}))
  const c = cliente()
  if (!r.ok) {
    const code = r.status === 400 ? 'invalid_credentials' : undefined
    return { c, estado: r.status, error: { message: datos.error ?? `HTTP ${r.status}`, code } }
  }
  const { error } = await c.auth.setSession(datos)
  return { c, estado: r.status, error }
}

/** Ingresa como la cuenta guardada con ese nombre. Devuelve { c, error, estado }. */
export function ingresarComo(nombre, clave = cuentas[`${nombre}_CLAVE`]) {
  return ingresarConDocumento(cuentas[`${nombre}_DOC`], clave)
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

export async function llamarFuncion(c, nombre, cuerpo) {
  const { data, error } = await c.functions.invoke(nombre, { body: cuerpo })
  if (!error) return { estado: 200, datos: data }
  const datos = await error.context?.json?.().catch(() => null)
  return { estado: error.context?.status ?? 0, datos }
}

/** Contraseña fuerte al azar para las pruebas (no se muestra). */
export function claveFuerte() {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 14; i++) s += letras[randomInt(letras.length)]
  return `${s}-${randomInt(10, 99)}`
}

// ───── Registro de resultados ─────
export const resultados = []
export function comprobar(nombre, paso, detalle = '') {
  resultados.push({ nombre, paso, detalle })
  console.log(`${paso ? '✅ PASA ' : '❌ FALLA'}  ${nombre}${detalle ? `  (${detalle})` : ''}`)
}
export function resumen() {
  const fallas = resultados.filter((r) => !r.paso).length
  console.log(`\n${resultados.length - fallas} de ${resultados.length} pruebas pasaron.`)
  return fallas
}

/** Imagen PNG ficticia de 1×1 píxel, para probar la carga de logos. */
export const PNG_FICTICIO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

/**
 * Formato de la empresa copiado de un formato base de CRC, con versión publicada (revisión de diseño, obs. 12: una sola
 * copia por formato base). Si la empresa ya lo tiene publicado, se usa ese; si no, se copia y se publica con datos ficticios.
 */
export async function formatoDeEmpresa(c, empresa, codigo, fecha) {
  const base = (await c.from('plantillas').select('id').is('empresa_id', null).eq('codigo', codigo).single()).data.id
  const actual = (await c.from('plantillas').select('id, versiones:plantillas_versiones(id, estado, receta)').eq('empresa_id', empresa).eq('base_id', base).eq('vigente', true)).data?.[0]
  const vigente = actual?.versiones.find((v) => v.estado === 'vigente')
  if (vigente) return { loto: actual.id, id: actual.id, version: { id: vigente.id, receta: vigente.receta } }
  const id = actual?.id ?? (await c.rpc('copiar_plantilla', { p_empresa: empresa, p_origen: base })).data
  const v = (await c.from('plantillas_versiones').select('id, receta').eq('plantilla_id', id).eq('estado', 'borrador').single()).data
  await c.rpc('guardar_borrador', { p_version: v.id, p_datos: { receta: v.receta, codigo_formato: `FIC-${codigo.toUpperCase()}`, version_formato: '03', fecha_aprobacion: fecha, logo: 'positivo' } })
  const pub = await c.rpc('publicar_version', { p_version: v.id })
  if (pub.error) throw new Error(`No se pudo publicar ${codigo}: ${pub.error.message}`)
  return { loto: id, id, version: v }
}
