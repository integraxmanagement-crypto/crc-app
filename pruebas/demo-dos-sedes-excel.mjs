// Sube a la empresa DEMO (crc-dev, datos FICTICIOS) los mismos Excel con marcas del dueño que ya tiene la empresa A, para que
// «Generar Excel / PDF» funcione igual. Los archivos viven solo en este equipo (Registros/ no se sube a GitHub ni a Drive).
// Uso: node pruebas/demo-dos-sedes-excel.mjs   (se puede repetir: reemplaza el Excel de cada formato)
import { readFileSync } from 'node:fs'
import { marcasDeExcel } from '../src/inspecciones/excel.ts'
import { ingresarComo } from './comun.mjs'

const EXCEL = {
  daci: 'DACI_con_marcas_CRC.xlsx',
  electrobomba: 'ELECTROBOMBA_con_marcas_CRC.xlsx',
  extintores: 'EXTINTORES_con_marcas_CRC.xlsx',
  ipf: 'IPF_con_marcas_CRC.xlsx',
  loto: 'LOTO_con_marcas_CRC.xlsx',
  motobomba: 'MOTOBOMBA_con_marcas_CRC.xlsx',
}
const { c, error } = await ingresarComo('DEMO_GENERAL')
if (error) throw new Error(`DEMO_GENERAL no pudo ingresar: ${error.message}`)
const emp = (await c.from('empresas').select('id').eq('ruc', '20000000061').single()).data.id
for (const [codigo, archivo] of Object.entries(EXCEL)) {
  const base = (await c.from('plantillas').select('id').is('empresa_id', null).eq('codigo', codigo).single()).data.id
  const pl = (await c.from('plantillas').select('id').eq('empresa_id', emp).eq('base_id', base).eq('vigente', true).single()).data
  const bytes = new Uint8Array(readFileSync(new URL(`../Registros/${archivo}`, import.meta.url)))
  const marcas = await marcasDeExcel(bytes)
  const ruta = `${emp}/${pl.id}-${Date.now()}.xlsx`
  const sub = await c.storage.from('formatos-excel').upload(ruta, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  if (sub.error) throw new Error(`subir ${codigo}: ${sub.error.message}`)
  const r = await c.rpc('registrar_excel', { p_plantilla: pl.id, p_ruta: ruta, p_nombre: archivo, p_bytes: bytes.length, p_marcas: marcas })
  if (r.error) throw new Error(`registrar ${codigo}: ${r.error.message}`)
  console.log(`${codigo}: Excel guardado con ${marcas.length} marca(s).`)
}
