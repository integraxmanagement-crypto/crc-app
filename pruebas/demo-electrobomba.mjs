// Datos FICTICIOS, solo en crc-dev (pedido del dueño, 29/10/2026): deja listo el formato «Inspección de electrobomba» en la empresa A
// (copia publicada con código, versión y fecha), tres electrobombas de muestra (con sus fichas técnicas) y una actividad semanal en el PASST de muestra que lo vincula.
// El Excel del dueño con marcas se sube aparte: node pruebas/demo-subir-excel.mjs electrobomba ELECTROBOMBA_con_marcas_CRC.xlsx
// Uso: node pruebas/demo-electrobomba.mjs
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
const f = await formatoDeEmpresa(c, emp, 'electrobomba', `${ANIO}-07-01`)
console.log(`Formato de electrobomba de la empresa: ${f.id}`)

// Si la base tiene una versión más nueva (p. ej. críticos con acción), la copia de la empresa se publica de nuevo con ella.
const canon = (o) => JSON.stringify(o, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const baseV = (await c.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', 'electrobomba').single()).data.versiones.find((v) => v.estado === 'vigente')
if (canon(baseV.receta) !== canon(f.version.receta)) {
  const borrador = falla(await c.rpc('nuevo_borrador', { p_plantilla: f.id }), 'nuevo borrador')
  const actual = (await c.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borrador).single()).data
  falla(await c.rpc('guardar_borrador', { p_version: borrador, p_datos: { receta: baseV.receta, ...actual, logo: 'positivo' } }), 'guardar borrador')
  falla(await c.rpc('publicar_version', { p_version: borrador }), 'publicar')
  console.log('Versión nueva publicada en la copia de la empresa.')
}

const plantilla = (await c.from('plantillas').select('tipo_activo_id').eq('id', f.id).single()).data
const sede = (await c.from('sedes').select('id').eq('empresa_id', emp).order('creado_en').limit(1)).data[0].id
const area = (await c.from('unidades').select('id').eq('empresa_id', emp).eq('nivel', 'area').eq('vigente', true).order('nombre').limit(1)).data?.[0]?.id ?? null
const ubic = (await c.from('ubicaciones').select('id').eq('empresa_id', emp).eq('sede_id', sede).limit(1)).data?.[0]?.id ?? null
const personas = (await c.from('personas').select('id').eq('empresa_id', emp).limit(1)).data?.[0]?.id ?? null
const ficha = (c) => Object.fromEntries(['principal', 'jockey'].flatMap((q) => [['marca', q === 'principal' ? 'Weg' : 'Pedrollo'], ['potencia', q === 'principal' ? '30 HP' : '2 HP'], ['caudal', q === 'principal' ? '25 L/s' : '1.5 L/s'], ['presion_nominal', '100 psi'], ['arranque_parada', q === 'principal' ? 'Arranque 80 psi / Parada manual' : 'Arranque 90 psi / Parada 110 psi'], ['alimentacion', 'Trifásico 220 V / 3550 RPM']].map(([k, v]) => [`${q}_${k}`, `${v} (${c})`])))
const existentes = (await c.from('activos').select('codigo').eq('empresa_id', emp).eq('tipo_id', plantilla.tipo_activo_id)).data ?? []
for (const codigo of ['EB-001', 'EB-002', 'EB-003']) {
  if (existentes.some((x) => x.codigo === codigo)) continue
  falla(await c.rpc('guardar_activo', { p_empresa: emp, p_id: null, p_datos: { tipo_id: plantilla.tipo_activo_id, codigo, sede_id: sede, unidad_id: area, ubicacion_id: ubic, responsable_id: personas, datos: ficha(codigo) } }), `electrobomba ${codigo}`)
  console.log(`Electrobomba ${codigo} creada.`)
}

// La frecuencia nace en el programa anual (decisión del dueño): una actividad semanal del PASST de muestra vincula el formato.
const frecuencia = process.env.FRECUENCIA ?? 'semanal'
const P = (await c.from('passt_programas').select('id').eq('empresa_id', emp).eq('vigente', true).eq('anio', ANIO).ilike('nombre', 'PASST de muestra%').order('creado_en', { ascending: false }).limit(1)).data?.[0]
if (!P) throw new Error('No hay un PASST de muestra activo: corre antes demo-inicio-passt.mjs')
const nodos = (await c.from('passt_nodos').select('id, tipo, texto, plantilla_id').eq('programa_id', P.id).eq('vigente', true)).data
const sec = nodos.find((n) => n.tipo === 'seccion')
const previa = nodos.find((n) => n.tipo === 'actividad' && n.texto.startsWith('Inspección de electrobomba (ficticia)'))
falla(await c.rpc('guardar_nodo', { p_programa: P.id, p_id: previa?.id ?? null, p_datos: { tipo: 'actividad', padre_id: sec.id, texto: 'Inspección de electrobomba (ficticia)', plantilla_id: f.id, frecuencia, motivo: 'Ficticio' } }), 'actividad de electrobomba')
console.log(`Actividad de electrobomba en el PASST de muestra con frecuencia ${frecuencia}.`)
