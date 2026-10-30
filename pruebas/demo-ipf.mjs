// Datos FICTICIOS, solo en crc-dev (pedido del dueño, 29/10/2026): deja el formato de Inspección de Seguridad Ocupacional (IPF)
// disponible en «Nueva inspección» de la empresa A y lo agrega al PASST de muestra activo, con semanas programadas.
// Uso: node pruebas/demo-ipf.mjs   (se puede repetir: reusa el formato y la actividad si ya existen)
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { formatoDeEmpresa, ingresarComo } from './comun.mjs'

const { anio: ANIO, semana: SEM } = semanaIso(new Date().toISOString().slice(0, 10))
const { c, error } = await ingresarComo('ADMIN_A')
if (error) throw new Error(`ADMIN_A no pudo ingresar: ${error.message}`)
const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}
const emp = (await c.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const ipf = await formatoDeEmpresa(c, emp, 'ipf', `${ANIO}-01-15`)
// Si la copia de la empresa es de una versión anterior del formato base, se publica su versión nueva con la receta del base vigente.
if (!JSON.stringify(ipf.version.receta).includes('mostrar_si')) {
  const base = (await c.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', 'ipf').single()).data.versiones.find((v) => v.estado === 'vigente')
  const borrador = falla(await c.rpc('nuevo_borrador', { p_plantilla: ipf.id }), 'nuevo borrador')
  const actual = (await c.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borrador).single()).data
  falla(await c.rpc('guardar_borrador', { p_version: borrador, p_datos: { receta: base.receta, ...actual, logo: 'positivo' } }), 'guardar borrador')
  falla(await c.rpc('publicar_version', { p_version: borrador }), 'publicar')
  console.log('Versión nueva del IPF publicada en la copia de la empresa.')
}
console.log(`Formato IPF de la empresa: ${ipf.id}`)

const P = (await c.from('passt_programas').select('id, estado').eq('empresa_id', emp).eq('vigente', true).eq('anio', ANIO).ilike('nombre', 'PASST de muestra%').order('creado_en', { ascending: false }).limit(1)).data?.[0]
if (!P) throw new Error('No hay un PASST de muestra activo: corre antes demo-inicio-passt.mjs')
const nodos = (await c.from('passt_nodos').select('id, tipo, texto, plantilla_id, padre_id').eq('programa_id', P.id)).data
let a = nodos.find((n) => n.tipo === 'actividad' && n.plantilla_id === ipf.id)
if (!a) {
  const sec = nodos.find((n) => n.tipo === 'seccion')
  const gestor = (await ingresarComo('GESTOR_A')).c
  const gestorId = (await gestor.auth.getUser()).data.user.id
  const r = await c.rpc('guardar_nodo', { p_programa: P.id, p_id: null, p_datos: { tipo: 'actividad', padre_id: sec.id, texto: 'Inspección de seguridad ocupacional (ficticia)', responsable_id: gestorId, plantilla_id: ipf.id, motivo: 'Se agrega el formato IPF al programa de muestra (ficticio)' } })
  a = { id: falla(r, 'actividad') }
}
for (const d of [0, 2, 4]) {
  const w = SEM + d
  if (w < 1 || w > 52) continue
  const r = await c.rpc('programar_semana', { p_actividad: a.id, p_semana: w, p_programada: true, p_motivo: 'Ficticio' })
  if (r.error && !/ya/i.test(r.error.message)) throw new Error(`programar: ${r.error.message}`)
}
console.log('Listo: el IPF está en Nueva inspección y en el PASST de muestra.')
