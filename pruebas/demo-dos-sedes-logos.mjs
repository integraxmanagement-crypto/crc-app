// Copia a la empresa DEMO (crc-dev, FICTICIA) los mismos logos que tiene la empresa A, para que los formatos (PDF y Excel) los muestren.
// Uso: node pruebas/demo-dos-sedes-logos.mjs   (se puede repetir)
import { ingresarComo } from './comun.mjs'

const { c: a, error: ea } = await ingresarComo('ADMIN_A')
if (ea) throw new Error(`ADMIN_A no pudo ingresar: ${ea.message}`)
const { c, error } = await ingresarComo('DEMO_GENERAL')
if (error) throw new Error(`DEMO_GENERAL no pudo ingresar: ${error.message}`)
const A = (await a.from('empresas').select('id, logo_positivo, logo_negativo').eq('ruc', '20000000010').single()).data
const D = (await c.from('empresas').select('id').eq('ruc', '20000000061').single()).data.id
const TIPOS = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' }
for (const tipo of ['positivo', 'negativo']) {
  const origen = A[`logo_${tipo}`]
  if (!origen) { console.log(`La empresa A no tiene logo ${tipo}.`); continue }
  const d = await a.storage.from('logos').download(origen)
  if (d.error) throw new Error(`bajar ${tipo}: ${d.error.message}`)
  const ext = origen.split('.').pop().toLowerCase()
  const ruta = `${D}/${tipo}.${ext}`
  const up = await c.storage.from('logos').upload(ruta, d.data, { contentType: TIPOS[ext] ?? 'image/png', upsert: true })
  if (up.error) throw new Error(`subir ${tipo}: ${up.error.message}`)
  const r = await c.rpc('registrar_logo', { p_empresa: D, p_tipo: tipo, p_ruta: ruta })
  if (r.error) throw new Error(`registrar ${tipo}: ${r.error.message}`)
  console.log(`Logo ${tipo} copiado (${d.data.size} bytes).`)
}
