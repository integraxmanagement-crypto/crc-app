// Datos FICTICIOS, solo en crc-dev (pedido del dueño, 29/10/2026): deja la copia del formato de extintores de la empresa A con la receta
// de 16 puntos del paquete del dueño (si todavía tiene la anterior) y sube su Excel con marcas (node pruebas/demo-subir-excel.mjs extintores …).
// Uso: node pruebas/demo-extintores.mjs
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { formatoDeEmpresa, ingresarComo } from './comun.mjs'

const { anio: ANIO } = semanaIso(new Date().toISOString().slice(0, 10))
const { c, error } = await ingresarComo('ADMIN_A')
if (error) throw new Error(`ADMIN_A no pudo ingresar: ${error.message}`)
const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}
const emp = (await c.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const f = await formatoDeEmpresa(c, emp, 'extintores', `${ANIO}-01-15`)
if (f.version.receta.secciones[0].puntos.length !== 16 || f.version.receta.firmas.length !== 0 || !f.version.receta.secciones[0].puntos[0].valor_defecto || !f.version.receta.secciones[0].puntos[8].pide_accion) {
  const base = (await c.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', 'extintores').single()).data.versiones.find((v) => v.estado === 'vigente')
  const borrador = falla(await c.rpc('nuevo_borrador', { p_plantilla: f.id }), 'nuevo borrador')
  const actual = (await c.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borrador).single()).data
  falla(await c.rpc('guardar_borrador', { p_version: borrador, p_datos: { receta: base.receta, ...actual, logo: 'positivo' } }), 'guardar borrador')
  falla(await c.rpc('publicar_version', { p_version: borrador }), 'publicar')
  console.log('Versión nueva de extintores publicada en la copia de la empresa.')
}
console.log(`Formato de extintores de la empresa: ${f.id}`)

// La frecuencia nace en el programa anual (pedido del dueño, 29/10/2026): una actividad del PASST de muestra vincula el formato,
// con la frecuencia de la variable FRECUENCIA (semanal por defecto). Uso: FRECUENCIA=mensual node pruebas/demo-extintores.mjs
const frecuencia = process.env.FRECUENCIA ?? 'semanal'
const P = (await c.from('passt_programas').select('id').eq('empresa_id', emp).eq('vigente', true).eq('anio', ANIO).ilike('nombre', 'PASST de muestra%').order('creado_en', { ascending: false }).limit(1)).data?.[0]
if (!P) throw new Error('No hay un PASST de muestra activo: corre antes demo-inicio-passt.mjs')
const nodos = (await c.from('passt_nodos').select('id, tipo, texto, plantilla_id').eq('programa_id', P.id).eq('vigente', true)).data
const sec = nodos.find((n) => n.tipo === 'seccion')
const previa = nodos.find((n) => n.tipo === 'actividad' && n.texto.startsWith('Inspección de extintores (ficticia)'))
const datos = { tipo: 'actividad', padre_id: sec.id, texto: 'Inspección de extintores (ficticia)', plantilla_id: f.id, frecuencia, motivo: 'Ficticio' }
falla(await c.rpc('guardar_nodo', { p_programa: P.id, p_id: previa?.id ?? null, p_datos: datos }), 'actividad de extintores')
console.log(`Actividad de extintores en el PASST de muestra con frecuencia ${frecuencia}.`)

// El sistema DACI (dispositivos de alarma): su copia con los críticos que piden responsable y fecha de levantamiento.
const daci = await formatoDeEmpresa(c, emp, 'daci', `${ANIO}-01-15`)
if (!JSON.stringify(daci.version.receta).includes('"pide_accion":true')) {
  const baseD = (await c.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', 'daci').single()).data.versiones.find((v) => v.estado === 'vigente')
  const borradorD = falla(await c.rpc('nuevo_borrador', { p_plantilla: daci.id }), 'nuevo borrador DACI')
  const actualD = (await c.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borradorD).single()).data
  falla(await c.rpc('guardar_borrador', { p_version: borradorD, p_datos: { receta: baseD.receta, ...actualD, logo: 'positivo' } }), 'guardar borrador DACI')
  falla(await c.rpc('publicar_version', { p_version: borradorD }), 'publicar DACI')
  console.log('Versión nueva del DACI publicada en la copia de la empresa.')
}
