// Datos FICTICIOS de muestra para ver el avance del PASST en el inicio (revisión de diseño, obs. 5), solo en crc-dev.
// Crea un programa aprobado del año con 3 objetivos, 6 actividades, semanas programadas alrededor de este mes y algunas
// ejecutadas a mano. Uso: node pruebas/demo-inicio-passt.mjs   (cada corrida crea un programa nuevo)
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { ingresarComo } from './comun.mjs'

const { anio: ANIO, semana: SEM } = semanaIso(new Date().toISOString().slice(0, 10))
const s = {}
for (const n of ['ADMIN_A', 'GESTOR_A']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const id = async (n) => (await s[n].auth.getUser()).data.user.id
const ADMIN = await id('ADMIN_A')
const GESTOR = await id('GESTOR_A')
const { data: emp } = await s.ADMIN_A.from('empresas').select('id').eq('ruc', '20000000010').single()

const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}
const P = falla(await s.ADMIN_A.rpc('crear_programa', { p_empresa: emp.id, p_datos: { anio: ANIO, nombre: `PASST de muestra ${ANIO} (ficticio)` } }), 'crear programa')
const og = (await s.ADMIN_A.from('passt_nodos').select('id').eq('programa_id', P).eq('tipo', 'objetivo_general').single()).data
const nodo = (datos) => s.ADMIN_A.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: datos })

// Semanas relativas a la de hoy: negativas ya pasaron. «ok» = se ejecuta a mano.
const plan = [
  ['Reducir accidentes en planta (ficticio)', [
    ['Inspecciones de orden y limpieza', GESTOR, [[-4, true], [-2, true], [0, false], [2, false]]],
    ['Charlas de 5 minutos', GESTOR, [[-3, true], [-1, true], [1, false]]],
  ]],
  ['Cumplir la capacitación anual (ficticio)', [
    ['Capacitación en uso de extintores', ADMIN, [[-6, true], [-3, true], [3, false]]],
    ['Capacitación en primeros auxilios', ADMIN, [[-1, false], [2, false]]],
  ]],
  ['Preparar la respuesta a emergencias (ficticio)', [
    ['Simulacro de sismo', ADMIN, [[-5, true], [0, true]]],
    ['Revisión de botiquines', GESTOR, [[1, false]]],
  ]],
]
const marcar = []
for (const [objetivo, actividades] of plan) {
  const oe = falla(await nodo({ tipo: 'objetivo_especifico', padre_id: og.id, texto: objetivo }), 'objetivo')
  const sec = falla(await nodo({ tipo: 'seccion', padre_id: oe, texto: 'Actividades (ficticias)' }), 'sección')
  for (const [texto, resp, semanas] of actividades) {
    const a = falla(await nodo({ tipo: 'actividad', padre_id: sec, texto, responsable_id: resp }), 'actividad')
    for (const [d, ok] of semanas) {
      const w = SEM + d
      if (w < 1 || w > 52) continue
      falla(await s.ADMIN_A.rpc('programar_semana', { p_actividad: a, p_semana: w, p_programada: true, p_motivo: null }), 'programar')
      if (ok) marcar.push([a, w])
    }
  }
}
falla(await s.ADMIN_A.rpc('aprobar_programa', { p_id: P }), 'aprobar')
for (const [a, w] of marcar)
  falla(await s.ADMIN_A.rpc('marcar_semana', { p_actividad: a, p_semana: w, p_ejecutada: true, p_comentario: 'Hecho (ficticio)', p_foto_ruta: null, p_foto_bytes: null }), 'marcar')
console.log(`Programa de muestra creado (${P}) con ${marcar.length} semanas ejecutadas.`)
