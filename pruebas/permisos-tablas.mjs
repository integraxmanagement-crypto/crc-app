// Comprueba que NINGUNA tabla de public deje escribir directo (insertar, modificar o borrar) a una persona sin sesión (anon)
// ni a una con sesión (authenticated). Las escrituras solo pasan por las funciones del servidor.
// «permission denied» = la tabla no tiene el permiso (correcto). Cualquier otro rechazo (por ejemplo, de las reglas por fila)
// significa que la tabla SÍ tiene el permiso concedido y solo la protege la regla: se marca como falla.
// Las modificaciones y borrados usan un filtro que no coincide con ninguna fila (id es nulo), así que aunque falle no tocan datos.
// Uso: node pruebas/permisos-tablas.mjs   (también lo corren separacion-sedes.mjs y empresas.mjs)
import { readFileSync, readdirSync } from 'node:fs'
import { cliente, comprobar, ingresarComo, resumen } from './comun.mjs'

// Las tablas se sacan de las migraciones (Supabase no deja listar el esquema con la clave pública). Así una tabla nueva entra sola.
function tablasDeMigraciones() {
  const nombres = new Set()
  for (const f of readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql'))) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8')
    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)) nombres.add(m[1].toLowerCase())
    for (const m of sql.matchAll(/drop table (?:if exists )?(?:public\.)?(\w+)/gi)) nombres.delete(m[1].toLowerCase())
  }
  return [...nombres].sort()
}

// Intenta modificar con distintas columnas: algunas tablas no dejan tocar «id» (es automática) y ese error sale antes de revisar el permiso.
async function modificar(c, t) {
  let ultimo = null
  for (const col of ['id', 'creado_en', 'actualizado_en', 'empresa_id', 'persona_id']) {
    const r = await c.from(t).update({ [col]: null }).is(col, null)
    ultimo = r
    if (r.error?.code !== '428C9' && r.error?.code !== '42703' && r.error?.code !== 'PGRST204') return r
  }
  return ultimo
}

async function borrar(c, t) {
  let ultimo = null
  for (const col of ['id', 'persona_id', 'empresa_id', 'codigo', 'rol']) {
    const r = await c.from(t).delete().is(col, null)
    ultimo = r
    if (r.error?.code !== '42703') return r
  }
  return ultimo
}

export async function revisarPermisosTablas() {
  const tablas = tablasDeMigraciones()
  comprobar('Se encontraron las tablas de public en las migraciones', tablas.length > 20, `${tablas.length} tablas`)
  const sesiones = { anon: cliente(), authenticated: (await ingresarComo('ADMIN_A')).c }
  const mal = []
  for (const [quien, c] of Object.entries(sesiones)) {
    for (const t of tablas) {
      const intentos = {
        insertar: await c.from(t).insert({}),
        modificar: await modificar(c, t),
        borrar: await borrar(c, t),
      }
      for (const [accion, r] of Object.entries(intentos)) {
        const sinPermiso = /permission denied/i.test(r.error?.message ?? '')
        if (r.error?.code === 'PGRST205') continue // la tabla ya no existe en public
        // Una tabla sin columna «id» responde con error de columna: ahí el permiso lo prueba el intento de insertar.
        const sinColumna = accion !== 'insertar' && ['42703', 'PGRST204', '428C9'].includes(r.error?.code)
        if (!sinPermiso && !sinColumna) mal.push(`${quien} puede ${accion} en ${t} (${r.error?.code ?? 'sin error'}: ${r.error?.message ?? ''})`)
      }
    }
  }
  comprobar('Ninguna tabla de public deja escribir directo a anon ni a authenticated', mal.length === 0, mal.slice(0, 5).join(' | '))
}

if (process.argv[1]?.endsWith('permisos-tablas.mjs')) {
  await revisarPermisosTablas()
  process.exit(resumen() ? 1 : 0)
}
