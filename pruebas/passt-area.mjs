// Prueba del área en las actividades del PASST (revisión del formato LOTO, 29/10/2026). Solo datos FICTICIOS de crc-dev.
// Estrategia «Eficacia LOTO» con una actividad por área: cada una queda ejecutada solo con una inspección LOTO de su área
// (o de una subárea) en la semana programada. Uso: node pruebas/passt-area.mjs   (crea un programa y 2 inspecciones ficticias)
import { randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { PNG_FICTICIO, comprobar, formatoDeEmpresa, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const HOY = new Date().toISOString().slice(0, 10)
const { anio: ANIO, semana: SEM } = semanaIso(HOY)
const s = {}
for (const n of ['ADMIN_A', 'GESTOR_A', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const yo = async (n) => (await s[n].auth.getUser()).data.user.id
const GA = await yo('GESTOR_A')
const A = (await s.ADMIN_A.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const B = (await s.GESTOR_B.from('empresas').select('id').eq('ruc', '20000000028').single()).data?.id
const SEDE = (await s.ADMIN_A.from('sedes').select('id').eq('empresa_id', A).eq('activa', true).limit(1).single()).data.id
const unidades = (await s.ADMIN_A.from('unidades').select('id, nombre, nivel, padre_id').eq('empresa_id', A).eq('vigente', true)).data
const areas = unidades.filter((u) => u.nivel === 'area')
const [AREA_1, AREA_2] = areas
if (!AREA_1 || !AREA_2) throw new Error('La empresa A necesita al menos dos áreas ficticias.')
const SUB_1 = unidades.find((u) => u.padre_id === AREA_1.id)

// Copia del LOTO base para la empresa A, publicada (con los textos nuevos de la versión 2).
// El LOTO de la empresa: el que ya tiene (una sola copia por formato base) o una copia nueva publicada.
const { id: loto, version: v } = await formatoDeEmpresa(s.ADMIN_A, A, 'loto', HOY)
comprobar('El LOTO de la empresa trae los 12 puntos del formato', v.receta.secciones.flatMap((x) => x.puntos).filter((p) => p.tipo === 'cumple').length === 12)

// Programa con la estrategia «Eficacia LOTO» y una actividad por área.
const P = (await s.ADMIN_A.rpc('crear_programa', { p_empresa: A, p_datos: { anio: ANIO, nombre: `PASST áreas ficticio ${randomInt(10000, 99999)}` } })).data
const og = (await s.ADMIN_A.from('passt_nodos').select('id').eq('programa_id', P).eq('tipo', 'objetivo_general').single()).data.id
const nodo = (datos, cl = s.ADMIN_A, id = null) => cl.rpc('guardar_nodo', { p_programa: P, p_id: id, p_datos: datos })
const oe = (await nodo({ tipo: 'objetivo_especifico', padre_id: og, texto: 'Controlar la energía peligrosa (ficticio)' })).data
const est = (await nodo({ tipo: 'seccion', padre_id: oe, texto: 'Eficacia LOTO' })).data
const a1 = await nodo({ tipo: 'actividad', padre_id: est, texto: `Eficacia LOTO · ${AREA_1.nombre}`, responsable_id: GA, plantilla_id: loto, unidad_id: AREA_1.id })
const a2 = await nodo({ tipo: 'actividad', padre_id: est, texto: `Eficacia LOTO · ${AREA_2.nombre}`, responsable_id: GA, plantilla_id: loto, unidad_id: AREA_2.id })
const a3 = await nodo({ tipo: 'actividad', padre_id: est, texto: 'Eficacia LOTO · cualquier área', responsable_id: GA, plantilla_id: loto })
comprobar('Guarda actividades con su área', !a1.error && !a2.error && !a3.error, a1.error?.message ?? a2.error?.message)
const guardadas = (await s.ADMIN_A.from('passt_nodos').select('id, unidad_id').in('id', [a1.data, a2.data, a3.data])).data
comprobar('El área queda en cada actividad', guardadas.find((x) => x.id === a1.data)?.unidad_id === AREA_1.id && guardadas.find((x) => x.id === a3.data)?.unidad_id === null)
const malSec = await nodo({ tipo: 'seccion', padre_id: oe, texto: 'Sección con área', unidad_id: AREA_1.id })
const sec = (await s.ADMIN_A.from('passt_nodos').select('unidad_id').eq('id', malSec.data).maybeSingle()).data
comprobar('Una sección no guarda área (solo las actividades)', Boolean(malSec.error) || sec?.unidad_id === null, malSec.error?.message)
if (B) {
  const deB = (await s.GESTOR_B.from('unidades').select('id').eq('empresa_id', B).limit(1).maybeSingle()).data
  if (deB) {
    const ajena = await nodo({ tipo: 'actividad', padre_id: est, texto: 'Área de otra empresa', unidad_id: deB.id })
    comprobar('No acepta un área de otra empresa', Boolean(ajena.error), ajena.error?.message)
  }
}
for (const a of [a1.data, a2.data, a3.data]) await s.ADMIN_A.rpc('programar_semana', { p_actividad: a, p_semana: SEM, p_programada: true, p_motivo: null })

// Inspección LOTO ficticia en una unidad, con la firma del gestor (el observado es externo).
async function inspeccionar(unidad) {
  const id = randomUUID()
  const firma = `${A}/${id}/firma-${GA}-responsable_registro.png`
  await s.GESTOR_A.storage.from('evidencias').upload(firma, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
  const resp = Object.fromEntries(v.receta.secciones.flatMap((x) => x.puntos).map((p) => [p.clave, { valor: p.tipo === 'cumple' ? 'si' : p.tipo === 'numero' ? 25 : 'Individual' }]))
  return llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', {
    modo: 'registrar', id, version_id: v.id, sede_id: SEDE, unidad_id: unidad, respuestas: resp, fecha: HOY, cerrada_en_equipo: new Date().toISOString(), archivos: [],
    firmantes: [
      { rol_clave: 'observado', rol_titulo: 'Observado', externo_nombre: 'Trabajador Externo Ficticio', externo_documento: '00000000' },
      { rol_clave: 'responsable_area', rol_titulo: 'Responsable del área inspeccionada', persona_id: GA },
      { rol_clave: 'responsable_registro', rol_titulo: 'Responsable del registro e inspección', persona_id: GA },
    ],
    mi_firma: { rol_clave: 'responsable_registro', ruta: firma, bytes: PNG_FICTICIO.length },
  })
}
const ejecutadas = async () => new Set(((await s.ADMIN_A.rpc('passt_ejecucion', { p_programa: P })).data ?? []).filter((x) => x.semana === SEM).map((x) => x.actividad_id))

const i1 = await inspeccionar(SUB_1?.id ?? AREA_1.id)
comprobar(`Registra una LOTO en ${SUB_1 ? 'una subárea de ' : ''}${AREA_1.nombre}`, i1.estado === 200, JSON.stringify(i1.datos))
let e = await ejecutadas()
comprobar(`Queda hecha la actividad de ${AREA_1.nombre}${SUB_1 ? ' (la subárea cuenta)' : ''}`, e.has(a1.data))
comprobar(`La de ${AREA_2.nombre} sigue pendiente`, !e.has(a2.data))
comprobar('La actividad sin área se ejecuta con cualquier área', e.has(a3.data))
const i2 = await inspeccionar(AREA_2.id)
e = await ejecutadas()
comprobar(`Con una LOTO en ${AREA_2.nombre}, queda hecha la suya`, i2.estado === 200 && e.has(a2.data))

const dup = await s.ADMIN_A.rpc('duplicar_programa', { p_id: P, p_datos: { anio: ANIO + 1 } })
const copia = (await s.ADMIN_A.from('passt_nodos').select('unidad_id').eq('programa_id', dup.data).eq('tipo', 'actividad')).data ?? []
comprobar('Al duplicar el programa se copian las áreas', !dup.error && copia.filter((x) => x.unidad_id).length === 2, dup.error?.message)

const fallas = resumen()
const lineas = ['# Pruebas del área en las actividades del PASST (revisión LOTO)', '', `Fecha: ${new Date().toISOString()} · Base: crc-dev · Datos FICTICIOS · Semana ${SEM} de ${ANIO} · **${resultados.length - fallas} de ${resultados.length} correctas**`, '']
for (const x of resultados) lineas.push(`- ${x.paso ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.paso ? ` — ${x.detalle}` : ''}`)
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/passt-area.md', lineas.join('\n') + '\n')
process.exit(fallas ? 1 : 0)
