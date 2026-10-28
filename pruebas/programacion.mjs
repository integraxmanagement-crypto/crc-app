// Prueba de la programación (tarea 3.4-D, parte 1): frecuencia por formato (solo el administrador la cambia),
// valores iniciales de las plantillas base y avance por período («equipos inspeccionados de total»).
// Solo cuentas y datos FICTICIOS de crc-dev; cada corrida crea un tipo de activo, un formato y 3 equipos ficticios.
// Uso: node pruebas/programacion.mjs
import { randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { periodoDe } from '../src/inspecciones/periodos.ts'
import { comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|Solo el administrador/i.test(r.error?.message ?? '')
const HOY = new Date().toISOString().slice(0, 10)
const SUFIJO = String(randomInt(10000, 99999))

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const GESTOR_A = (await s.GESTOR_A.auth.getUser()).data.user.id
const { data: empresas } = await s.DUENO.from('empresas').select('id, ruc')
const A = empresas.find((e) => e.ruc === '20000000010').id
const B = empresas.find((e) => e.ruc === '20000000028').id
const SEDE_A = (await s.DUENO.from('sedes').select('id').eq('empresa_id', A).eq('activa', true).limit(1).single()).data.id
const SEDE_B = (await s.DUENO.from('sedes').select('id').eq('empresa_id', B).eq('activa', true).limit(1).single()).data.id

seccion('1. Frecuencias de las plantillas base')
const { data: bases } = await s.ADMIN_A.from('plantillas').select('codigo, frecuencia').is('empresa_id', null)
const frec = Object.fromEntries(bases.map((b) => [b.codigo, b.frecuencia]))
comprobar('Valores iniciales aprobados: extintores, caseta, DACI e IPF mensual; bombas semanal; LOTO trimestral',
  frec.extintores === 'mensual' && frec.car === 'mensual' && frec.daci === 'mensual' && frec.ipf === 'mensual' && frec.bombas === 'semanal' && frec.loto === 'trimestral', JSON.stringify(frec))

seccion('2. Formato propio y quién cambia la frecuencia')
const tipo = await s.ADMIN_A.rpc('guardar_tipo_activo', { p_empresa: A, p_id: null, p_datos: { nombre: `Luces de emergencia ficticias ${SUFIJO}`, subtipos: [] } })
comprobar('Admin A crea un tipo de activo propio', !tipo.error, tipo.error?.message)
const nueva = await s.GESTOR_A.rpc('nueva_plantilla', { p_empresa: A, p_datos: { nombre: `Luces ficticias ${SUFIJO}`, aplica_a: 'activo', tipo_activo_id: tipo.data, frecuencia: 'bimestral' } })
comprobar('Gestor A crea un formato con frecuencia bimestral (al crearlo la define)', !nueva.error, nueva.error?.message)
const plantilla = nueva.data
const leerFrec = async () => (await s.ADMIN_A.from('plantillas').select('frecuencia').eq('id', plantilla).single()).data.frecuencia
comprobar('Queda bimestral', (await leerFrec()) === 'bimestral')
const g1 = await s.GESTOR_A.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: `Luces ficticias ${SUFIJO}`, frecuencia: 'anual' } })
comprobar('El gestor NO puede cambiar la frecuencia', NO_AUTORIZADO(g1) && (await leerFrec()) === 'bimestral', g1.error?.message)
const g2 = await s.GESTOR_A.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: `Luces ficticias ${SUFIJO} (renombrado)`, descripcion: 'Descripción ficticia' } })
comprobar('El gestor sí cambia el nombre (la frecuencia se mantiene)', !g2.error && (await leerFrec()) === 'bimestral', g2.error?.message)
const a1 = await s.ADMIN_A.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: `Luces ficticias ${SUFIJO}`, frecuencia: 'mensual' } })
comprobar('El administrador cambia la frecuencia a mensual', !a1.error && (await leerFrec()) === 'mensual', a1.error?.message)
for (const f of ['semanal', 'trimestral', 'semestral', 'anual', 'sin_frecuencia', 'mensual']) {
  const r = await s.ADMIN_A.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: `Luces ficticias ${SUFIJO}`, frecuencia: f } })
  if (r.error) comprobar(`Acepta la frecuencia «${f}»`, false, r.error.message)
}
comprobar('Acepta las 7 frecuencias', (await leerFrec()) === 'mensual')
const mala = await s.ADMIN_A.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: `Luces ficticias ${SUFIJO}`, frecuencia: 'quincenal' } })
comprobar('Rechaza una frecuencia que no existe', Boolean(mala.error), mala.error?.message)
const gb = await s.GESTOR_B.rpc('guardar_plantilla', { p_plantilla: plantilla, p_datos: { nombre: 'Intento de B', frecuencia: 'anual' } })
comprobar('Otra empresa no toca el formato', NO_AUTORIZADO(gb), gb.error?.message)

// Receta simple y publicación: una X da «Inoperativo».
const { data: ver } = await s.ADMIN_A.from('plantillas_versiones').select('id').eq('plantilla_id', plantilla).single()
const receta = {
  version: 1,
  secciones: [{ clave: 'general', titulo: 'Revisión general', puntos: [{ clave: 'LUZ-01', texto: 'Enciende al cortar la energía (ficticio)', tipo: 'cumple', obligatorio: true, critico: true, hallazgo: 'no_cumple', obs_si_no_cumple: false, foto_si_no_cumple: false, pide_accion: false }] }],
  firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }],
  reglas: [{ tipo: 'x_en', etiqueta: 'Inoperativo', alcance: 'todos' }],
  resultado_defecto: 'Operativo', puntaje: false, na_favorable: true, hallazgo_vencimiento: false, observacion_general: true,
}
const gb2 = await s.ADMIN_A.rpc('guardar_borrador', { p_version: ver.id, p_datos: { receta, codigo_formato: `FIC-LUZ-${SUFIJO}`, version_formato: '01', fecha_aprobacion: HOY, logo: 'ninguno' } })
const pub = await s.ADMIN_A.rpc('publicar_version', { p_version: ver.id })
comprobar('El formato ficticio se publica', !gb2.error && !pub.error, gb2.error?.message ?? pub.error?.message)

seccion('3. Avance por período')
const equipos = []
for (const k of [1, 2, 3]) {
  const r = await s.ADMIN_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipo.data, codigo: `LUZ-${SUFIJO}-${k}`, sede_id: SEDE_A } })
  if (r.error) throw new Error(`No se pudo crear el equipo ficticio: ${r.error.message}`)
  equipos.push(r.data)
}
const insp = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', {
  modo: 'registrar', id: randomUUID(), version_id: ver.id, sede_id: SEDE_A, activo_id: equipos[0], respuestas: { 'LUZ-01': { valor: 'no' } },
  fecha: HOY, cerrada_en_equipo: new Date().toISOString(), archivos: [], firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', persona_id: GESTOR_A }],
})
comprobar('Se inspecciona el equipo 1 con una X: «Inoperativo»', insp.estado === 200 && insp.datos?.estado === 'grabada', JSON.stringify(insp.datos))
const baja = await s.ADMIN_A.rpc('dar_baja_activo', { p_id: equipos[2], p_fecha: HOY, p_motivo: 'Baja ficticia de prueba' })
comprobar('El equipo 3 se da de baja hoy', !baja.error, baja.error?.message)

const mes = periodoDe(HOY, 'mensual')
const av = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: mes.desde, p_hasta: mes.hasta })
const filas = av.data ?? []
const hechos = filas.filter((f) => f.inspeccion_id)
comprobar(`Mes actual (${mes.etiqueta}): total 2 (el dado de baja no cuenta)`, !av.error && filas.length === 2, av.error?.message ?? JSON.stringify(filas.map((f) => f.codigo)))
comprobar('1 de 2 inspeccionados: el «Inoperativo» cuenta como inspeccionado', hechos.length === 1 && hechos[0].resultado === 'Inoperativo' && hechos[0].codigo === `LUZ-${SUFIJO}-1`, JSON.stringify(hechos))
comprobar('Falta el equipo 2', filas.find((f) => !f.inspeccion_id)?.codigo === `LUZ-${SUFIJO}-2`)
comprobar('El equipo inspeccionado trae su hallazgo', hechos[0]?.hallazgos === 1)
const anterior = periodoDe(new Date(Date.parse(mes.desde) - 864e5).toISOString().slice(0, 10), 'mensual')
const avAnt = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: anterior.desde, p_hasta: anterior.hasta })
comprobar('Mes anterior: los equipos todavía no existían, total 0', !avAnt.error && avAnt.data.length === 0, avAnt.error?.message ?? JSON.stringify(avAnt.data))
const semana = periodoDe(HOY, 'semanal')
const avSem = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: semana.desde, p_hasta: semana.hasta })
comprobar('Semana actual: mismo conteo (1 de 2)', !avSem.error && avSem.data.length === 2 && avSem.data.filter((f) => f.inspeccion_id).length === 1)

seccion('4. Quién ve el avance')
const u = await s.USUARIO_A2.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: mes.desde, p_hasta: mes.hasta })
comprobar('Un usuario sin permiso de ver inspecciones no ve el avance', NO_AUTORIZADO(u), u.error?.message)
const b = await s.GESTOR_B.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: mes.desde, p_hasta: mes.hasta })
comprobar('Otra empresa no ve el avance de A', NO_AUTORIZADO(b), b.error?.message)
const otraSede = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_B, p_desde: mes.desde, p_hasta: mes.hasta })
comprobar('No se puede pedir con una sede de otra empresa', Boolean(otraSede.error), otraSede.error?.message)
const largo = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: '2025-01-01', p_hasta: '2026-12-31' })
comprobar('Un período de más de un año se rechaza', Boolean(largo.error), largo.error?.message)
const dueno = await s.DUENO.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: SEDE_A, p_desde: mes.desde, p_hasta: mes.hasta })
comprobar('El dueño de la plataforma ve el avance', !dueno.error && dueno.data.length === 2, dueno.error?.message)

// Formato de área (LOTO de A): una fila por inspección, sin total.
const { data: lotos } = await s.ADMIN_A.from('plantillas').select('id').eq('empresa_id', A).eq('aplica_a', 'area').limit(1)
if (lotos?.length) {
  const ar = await s.GESTOR_A.rpc('avance_periodo', { p_plantilla: lotos[0].id, p_sede: SEDE_A, p_desde: mes.desde, p_hasta: mes.hasta })
  comprobar('Formato de área: devuelve las inspecciones del período (sin equipos)', !ar.error && ar.data.every((f) => f.activo_id === null && f.inspeccion_id), ar.error?.message)
}

const r = resumen()
const lineas = ['# Pruebas de la programación (tarea 3.4-D, parte 1)', '', `Fecha: ${new Date().toISOString()} · Base: crc-dev · Datos FICTICIOS · **${r.ok} de ${r.total} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/programacion.md', lineas.join('\n'))
process.exit(r.ok === r.total ? 0 : 1)
