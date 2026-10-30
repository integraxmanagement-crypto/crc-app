// Sube a crc-dev (datos FICTICIOS) un Excel local con marcas a la copia del formato de la empresa A (pedido del dueño, 29/10/2026).
// El archivo vive solo en este equipo (Registros/ no se sube a GitHub ni a Drive).
// Uso: node pruebas/demo-subir-excel.mjs <código del formato: ipf, loto…> <archivo en Registros/>
import { readFileSync } from 'node:fs'
import { marcasDeExcel } from '../src/inspecciones/excel.ts'
import { ingresarComo } from './comun.mjs'

const [codigo, archivo] = process.argv.slice(2)
if (!codigo || !archivo) throw new Error('Uso: node pruebas/demo-subir-excel.mjs <código del formato> <archivo en Registros/>')
const { c, error } = await ingresarComo('ADMIN_A')
if (error) throw new Error(`ADMIN_A no pudo ingresar: ${error.message}`)
const emp = (await c.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const ipf = (await c.from('plantillas').select('id').eq('empresa_id', emp).eq('codigo', codigo).eq('vigente', true).single()).data
const bytes = new Uint8Array(readFileSync(new URL(`../Registros/${archivo}`, import.meta.url)))
const marcas = await marcasDeExcel(bytes)
const ruta = `${emp}/${ipf.id}-${Date.now()}.xlsx`
const sub = await c.storage.from('formatos-excel').upload(ruta, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
if (sub.error) throw new Error(`subir: ${sub.error.message}`)
const r = await c.rpc('registrar_excel', { p_plantilla: ipf.id, p_ruta: ruta, p_nombre: archivo, p_bytes: bytes.length, p_marcas: marcas })
if (r.error) throw new Error(`registrar: ${r.error.message}`)
console.log(`Excel de ${codigo} guardado con ${marcas.length} marca(s) (${bytes.length} bytes).`)
