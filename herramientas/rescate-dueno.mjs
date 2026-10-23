// Herramienta de rescate (tarea 3.3, decisión 5A). SOLO para el día en que se pierde el secreto CRC_PIMIENTA
// y nadie puede ingresar, ni siquiera el dueño de la plataforma.
//
// Antes de usarla:
//   1. Crear un secreto CRC_PIMIENTA nuevo en el panel de Supabase (Edge Functions → Secrets).
//   2. Crear el archivo .env.rescate.local en esta carpeta del proyecto (está excluido de GitHub) con dos líneas:
//        SUPABASE_URL=<dirección del proyecto>
//        SUPABASE_CLAVE_SECRETA=<clave secreta del proyecto>
//      La clave secreta nunca va en el código, en la carpeta de control de Drive ni en el chat.
//
// Uso: node herramientas/rescate-dueno.mjs dni 12345678
//
// Le da una contraseña nueva SOLO a la cuenta del dueño indicado (la función se niega con cualquier otra).
// Luego el dueño ingresa a la app y usa «Restablecer en bloque» para las empresas.
import { existsSync, readFileSync } from 'node:fs'

const ARCHIVO = '.env.rescate.local'

function leerEnv(archivo) {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')),l.slice(l.indexOf('=') + 1).trim()]),
  )
}

const recordatorio = () => console.log(`
IMPORTANTE, al terminar:
  1. Borra el archivo ${ARCHIVO}.
  2. En el panel de Supabase (Project Settings → API Keys) crea una clave secreta nueva y elimina la que usaste.
  3. Guarda el secreto CRC_PIMIENTA nuevo en tu gestor de contraseñas (segunda copia fuera del equipo).`)

const [tipo, numero] = process.argv.slice(2)
const env = leerEnv(ARCHIVO)
if (!tipo || !numero) {
  console.log('Uso: node herramientas/rescate-dueno.mjs <tipo de documento> <número>   (ejemplo: dni 12345678)')
  process.exit(1)
}
if (!env.SUPABASE_URL || !env.SUPABASE_CLAVE_SECRETA) {
  console.log(`Falta el archivo ${ARCHIVO} con SUPABASE_URL y SUPABASE_CLAVE_SECRETA.`)
  process.exit(1)
}

const respuesta = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/dar-contrasena`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.SUPABASE_CLAVE_SECRETA}` },
  body: JSON.stringify({ tipo_documento: tipo, numero_documento: numero }),
})
const datos = await respuesta.json().catch(() => ({}))

if (!respuesta.ok) {
  console.log(`No se pudo: ${datos.error ?? respuesta.status}`)
  recordatorio()
  process.exit(1)
}

console.log(`
Contraseña nueva de ${datos.apellidos_nombres} (se muestra UNA sola vez; no se guarda en ningún archivo):

    ${datos.contrasena}

Ingresa a la app con tu documento y esta contraseña; te pedirá cambiarla.`)
recordatorio()
