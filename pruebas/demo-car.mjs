// Datos FICTICIOS, solo en crc-dev (pedido del dueño, 02/11/2026): deja listo el formato «Inspección de caseta de ataque rápido (CAR)» en la
// empresa A con la receta del Excel del dueño (copia publicada con código, versión y fecha), tres casetas de muestra, dos inspecciones y una
// actividad mensual en el PASST de muestra que lo vincula. Sube también el Excel con marcas (Registros/CAR_con_marcas_CRC.xlsx, solo en este equipo).
// Uso: node pruebas/demo-car.mjs   (se puede repetir: reusa lo que ya existe)
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { marcasDeExcel } from '../src/inspecciones/excel.ts'
import { PNG_FICTICIO, formatoDeEmpresa, ingresarComo, llamarFuncion } from './comun.mjs'

const { anio: ANIO } = semanaIso(new Date().toISOString().slice(0, 10))
const HOY = new Date().toISOString().slice(0, 10)
const sha = (b) => createHash('sha256').update(b).digest('hex')
const { c, error } = await ingresarComo('ADMIN_A')
if (error) throw new Error(`ADMIN_A no pudo ingresar: ${error.message}`)
const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}
const emp = (await c.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const f = await formatoDeEmpresa(c, emp, 'car', `${ANIO}-03-09`)

// Si la base tiene una versión más nueva, la copia de la empresa se publica de nuevo con ella.
const canon = (o) => JSON.stringify(o, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const baseV = (await c.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', 'car').single()).data.versiones.find((v) => v.estado === 'vigente')
if (canon(baseV.receta) !== canon(f.version.receta)) {
  const borrador = falla(await c.rpc('nuevo_borrador', { p_plantilla: f.id }), 'nuevo borrador')
  const actual = (await c.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borrador).single()).data
  falla(await c.rpc('guardar_borrador', { p_version: borrador, p_datos: { receta: baseV.receta, ...actual, logo: 'positivo' } }), 'guardar borrador')
  falla(await c.rpc('publicar_version', { p_version: borrador }), 'publicar')
  console.log('Versión nueva publicada en la copia de la empresa.')
}
const pl = (await c.from('plantillas').select('tipo_activo_id').eq('id', f.id).single()).data
const v = (await c.from('plantillas_versiones').select('id, receta').eq('plantilla_id', f.id).eq('estado', 'vigente').single()).data
console.log(`Formato de CAR de la empresa: ${f.id}`)

// Tres casetas de muestra.
const sede = (await c.from('sedes').select('id').eq('empresa_id', emp).order('creado_en').limit(1)).data[0].id
const area = (await c.from('unidades').select('id').eq('empresa_id', emp).eq('nivel', 'area').eq('vigente', true).order('nombre').limit(1)).data?.[0]?.id ?? null
const ubic = (await c.from('ubicaciones').select('id').eq('empresa_id', emp).eq('sede_id', sede).limit(1)).data?.[0]?.id ?? null
const existentes = (await c.from('activos').select('codigo').eq('empresa_id', emp).eq('tipo_id', pl.tipo_activo_id)).data ?? []
for (const codigo of ['CAR-001', 'CAR-002', 'CAR-003']) {
  if (existentes.some((x) => x.codigo === codigo)) continue
  falla(await c.rpc('guardar_activo', { p_empresa: emp, p_id: null, p_datos: { tipo_id: pl.tipo_activo_id, codigo, sede_id: sede, unidad_id: area, ubicacion_id: ubic, datos: {} } }), `caseta ${codigo}`)
  console.log(`Caseta ${codigo} creada.`)
}

// Dos inspecciones del mes (una con un material faltante), solo si la empresa aún no tiene inspecciones de este formato.
const gestor = (await ingresarComo('GESTOR_A')).c
const gestorId = (await gestor.auth.getUser()).data.user.id
const hechas = (await c.from('inspecciones').select('id', { count: 'exact', head: true }).eq('empresa_id', emp).in('version_id', ((await c.from('plantillas_versiones').select('id').eq('plantilla_id', f.id)).data ?? []).map((x) => x.id))).count
if (!hechas) {
  const casetas = (await c.from('activos').select('id, codigo, numero, subtipo, datos, dotacion').eq('empresa_id', emp).eq('tipo_id', pl.tipo_activo_id).order('codigo')).data
  const todoSi = Object.fromEntries(v.receta.secciones.flatMap((s) => s.puntos.map((q) => [q.clave, { valor: 'si' }])))
  for (const [i, a] of casetas.slice(0, 2).entries()) {
    const id = randomUUID()
    const rutaFirma = `${emp}/${id}/firma-${gestorId}-inspector.png`
    const up = await gestor.storage.from('evidencias').upload(rutaFirma, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
    if (up.error) throw new Error(`firma: ${up.error.message}`)
    const r = await llamarFuncion(gestor, 'registrar-inspeccion', {
      modo: 'registrar', id, version_id: v.id, sede_id: sede, activo_id: a.id,
      activo_foto: { codigo: a.codigo, numero: a.numero, subtipo: a.subtipo, datos: a.datos, dotacion: a.dotacion },
      respuestas: { ...todoSi, ...(i === 1 ? { 'CAR-M02': { valor: 'no' } } : {}) }, observacion: i === 1 ? 'Falta una manguera de 1 1/2" (ficticio)' : null, fecha: HOY,
      iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(), dispositivo: 'Demo', archivos: [],
      firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', orden: 1, persona_id: gestorId }],
      mi_firma: { rol_clave: 'inspector', ruta: rutaFirma, bytes: PNG_FICTICIO.length },
    })
    if (r.estado !== 200) throw new Error(`inspección ${a.codigo}: ${r.estado} ${r.datos?.error ?? ''} ${JSON.stringify(r.datos?.faltan ?? '')}`)
  }
  console.log('Dos inspecciones de CAR registradas.')
}

// La frecuencia nace en el programa anual: una actividad mensual del PASST de muestra vincula el formato.
const P = (await c.from('passt_programas').select('id').eq('empresa_id', emp).eq('vigente', true).eq('anio', ANIO).ilike('nombre', 'PASST de muestra%').order('creado_en', { ascending: false }).limit(1)).data?.[0]
if (P) {
  const nodos = (await c.from('passt_nodos').select('id, tipo, texto, plantilla_id').eq('programa_id', P.id).eq('vigente', true)).data
  const secc = nodos.find((n) => n.tipo === 'seccion')
  const previa = nodos.find((n) => n.tipo === 'actividad' && n.texto.startsWith('Inspección de casetas (ficticia)'))
  falla(await c.rpc('guardar_nodo', { p_programa: P.id, p_id: previa?.id ?? null, p_datos: { tipo: 'actividad', padre_id: secc.id, texto: 'Inspección de casetas (ficticia)', plantilla_id: f.id, frecuencia: 'mensual', motivo: 'Ficticio' } }), 'actividad de CAR')
  console.log('Actividad de CAR en el PASST de muestra con frecuencia mensual.')
} else console.log('No hay un PASST de muestra activo: corre antes demo-inicio-passt.mjs para vincular el formato al programa.')

// El Excel del dueño con sus marcas.
const archivo = 'CAR_con_marcas_CRC.xlsx'
const bytes = new Uint8Array(readFileSync(new URL(`../Registros/${archivo}`, import.meta.url)))
const marcas = await marcasDeExcel(bytes)
const ruta = `${emp}/${f.id}-${Date.now()}.xlsx`
falla(await c.storage.from('formatos-excel').upload(ruta, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'subir el Excel')
falla(await c.rpc('registrar_excel', { p_plantilla: f.id, p_ruta: ruta, p_nombre: archivo, p_bytes: bytes.length, p_marcas: marcas }), 'registrar el Excel')
console.log(`Excel de CAR guardado con ${marcas.length} marca(s) (${bytes.length} bytes).`)
