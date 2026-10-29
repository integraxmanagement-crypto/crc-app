// Prueba del seguimiento de hallazgos (tarea 3.4-D, parte 2). Solo cuentas y datos FICTICIOS de crc-dev.
// Comprueba: nacen solos al recibir la inspección, quién ve qué, asignar, «en proceso», cerrar con foto, reabrir,
// corrección y anulación de la inspección, y que nadie escribe directo en las tablas.
// Uso: node pruebas/hallazgos.mjs   (cada corrida crea un tipo de activo, un formato, un equipo y 1 inspección ficticios)
import { randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG_FICTICIO, cliente, comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|row-level security|permission denied/i.test(r.error?.message ?? '')
const HOY = new Date().toISOString().slice(0, 10)
const SUFIJO = String(randomInt(10000, 99999))

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const yo = async (n) => (await s[n].auth.getUser()).data.user.id
const ID = { GESTOR_A: await yo('GESTOR_A'), USUARIO_A2: await yo('USUARIO_A2'), GESTOR_B: await yo('GESTOR_B') }
const { data: empresas } = await s.DUENO.from('empresas').select('id, ruc')
const A = empresas.find((e) => e.ruc === '20000000010').id
const SEDE_A = (await s.DUENO.from('sedes').select('id').eq('empresa_id', A).eq('activa', true).limit(1).single()).data.id

// Formato ficticio con 2 puntos: uno pide acción (nace con responsable y plazo), el otro nace sin asignar.
const punto = (clave, texto, extra = {}) => ({ clave, texto, tipo: 'cumple', obligatorio: true, critico: false, hallazgo: 'no_cumple', obs_si_no_cumple: false, foto_si_no_cumple: false, pide_accion: false, ...extra })
const receta = {
  version: 1,
  secciones: [{ clave: 'general', titulo: 'Revisión (ficticia)', puntos: [punto('HAL-01', 'Señal visible (ficticio)', { pide_accion: true }), punto('HAL-02', 'Acceso libre (ficticio)'), punto('HAL-03', 'Batería cargada (ficticio)')] }],
  firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }],
  reglas: [{ tipo: 'x_en', etiqueta: 'Con observaciones', alcance: 'todos' }],
  resultado_defecto: 'Conforme', puntaje: false, na_favorable: true, hallazgo_vencimiento: false, observacion_general: true,
}
const tipo = (await s.ADMIN_A.rpc('guardar_tipo_activo', { p_empresa: A, p_id: null, p_datos: { nombre: `Equipo ficticio HAL ${SUFIJO}`, subtipos: [] } })).data
const plantilla = (await s.ADMIN_A.rpc('nueva_plantilla', { p_empresa: A, p_datos: { nombre: `Hallazgos ficticio ${SUFIJO}`, aplica_a: 'activo', tipo_activo_id: tipo, frecuencia: 'mensual' } })).data
const ver = (await s.ADMIN_A.from('plantillas_versiones').select('id').eq('plantilla_id', plantilla).single()).data.id
await s.ADMIN_A.rpc('guardar_borrador', { p_version: ver, p_datos: { receta, codigo_formato: `FIC-HAL-${SUFIJO}`, version_formato: '01', fecha_aprobacion: HOY, logo: 'ninguno' } })
const pub = await s.ADMIN_A.rpc('publicar_version', { p_version: ver })
if (pub.error) throw new Error(`No se pudo publicar: ${pub.error.message}`)
const equipo = (await s.ADMIN_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipo, codigo: `HAL-${SUFIJO}`, sede_id: SEDE_A } })).data

seccion('1. Nacen solos al recibir la inspección')
const insp = randomUUID()
const r = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', {
  modo: 'registrar', id: insp, version_id: ver, sede_id: SEDE_A, activo_id: equipo, fecha: HOY, cerrada_en_equipo: new Date().toISOString(), archivos: [],
  respuestas: { 'HAL-01': { valor: 'no', accion: { texto: 'Reponer la señal (ficticio)', responsable: ID.USUARIO_A2, plazo: '2026-11-15' } }, 'HAL-02': { valor: 'no' }, 'HAL-03': { valor: 'si' } },
  firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', persona_id: ID.GESTOR_A }],
})
comprobar('Se registra una inspección con 2 X', r.estado === 200 && r.datos?.estado === 'grabada', JSON.stringify(r.datos))
const deInsp = async (c) => (await c.from('hallazgos').select('*').eq('inspeccion_id', insp).order('clave')).data ?? []
let hs = await deInsp(s.GESTOR_A)
const h1 = hs.find((h) => h.clave === 'HAL-01')
const h2 = hs.find((h) => h.clave === 'HAL-02')
comprobar('Nacen 2 hallazgos, uno por cada X', hs.length === 2 && h1 && h2, JSON.stringify(hs.map((h) => h.clave)))
comprobar('El que traía acción nace con responsable, plazo y acción', h1?.responsable_id === ID.USUARIO_A2 && h1?.plazo === '2026-11-15' && h1?.accion === 'Reponer la señal (ficticio)', JSON.stringify(h1))
comprobar('El otro nace sin asignar', h2 && h2.responsable_id === null && h2.plazo === null && h2.estado === 'abierto')
comprobar('Llevan el formato, la sede y el equipo', h1?.plantilla_id === plantilla && h1?.sede_id === SEDE_A && h1?.activo_id === equipo)
const reenvio = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', { modo: 'registrar', id: insp, version_id: ver, sede_id: SEDE_A, fecha: HOY, cerrada_en_equipo: new Date().toISOString() })
comprobar('Si la inspección llega dos veces, no se duplican', reenvio.datos?.estado === 'ya_recibida' && (await deInsp(s.GESTOR_A)).length === 2)
const hist1 = (await s.GESTOR_A.from('hallazgos_historial').select('cambio').eq('hallazgo_id', h1.id)).data
comprobar('Su historial empieza con «creado»', hist1?.length === 1 && hist1[0].cambio === 'creado')

seccion('2. Quién ve qué')
comprobar('El usuario ve solo el que tiene asignado', JSON.stringify((await deInsp(s.USUARIO_A2)).map((h) => h.clave)) === JSON.stringify(['HAL-01']))
comprobar('Otra empresa no ve ninguno', (await deInsp(s.GESTOR_B)).length === 0 && (await deInsp(s.ADMIN_B)).length === 0)
comprobar('Sin sesión no se ve ninguno', ((await cliente().from('hallazgos').select('id').limit(1)).data ?? []).length === 0)
comprobar('El dueño de la plataforma los ve', (await deInsp(s.DUENO)).length === 2)
const histU = (await s.USUARIO_A2.from('hallazgos_historial').select('id').eq('hallazgo_id', h2.id)).data ?? []
comprobar('El usuario no ve el historial de un hallazgo ajeno', histU.length === 0)

seccion('3. Asignar, «en proceso» y nadie escribe directo')
const u1 = await s.USUARIO_A2.rpc('gestionar_hallazgo', { p_id: h2.id, p_datos: { responsable_id: ID.USUARIO_A2, plazo: HOY } })
comprobar('El usuario no puede asignar', NO_AUTORIZADO(u1), u1.error?.message)
const b1 = await s.GESTOR_B.rpc('gestionar_hallazgo', { p_id: h2.id, p_datos: { responsable_id: ID.GESTOR_B } })
comprobar('Otra empresa no puede asignar', NO_AUTORIZADO(b1), b1.error?.message)
const g0 = await s.GESTOR_A.rpc('gestionar_hallazgo', { p_id: h2.id, p_datos: { responsable_id: ID.GESTOR_B, plazo: HOY } })
comprobar('El responsable no puede ser de otra empresa', Boolean(g0.error), g0.error?.message)
const g1 = await s.GESTOR_A.rpc('gestionar_hallazgo', { p_id: h2.id, p_datos: { responsable_id: ID.USUARIO_A2, plazo: '2026-10-01', accion: 'Despejar el acceso (ficticio)' } })
comprobar('El gestor asigna responsable, plazo y acción', !g1.error, g1.error?.message)
comprobar('Ahora el usuario ve los 2', (await deInsp(s.USUARIO_A2)).length === 2)
const directo = await s.GESTOR_A.from('hallazgos').update({ estado: 'cerrado' }).eq('id', h2.id).select()
comprobar('Nadie cambia la tabla directo (solo por las acciones)', Boolean(directo.error) || (directo.data ?? []).length === 0)
const borrar = await s.ADMIN_A.from('hallazgos').delete().eq('id', h2.id).select()
comprobar('Nadie borra un hallazgo', Boolean(borrar.error) || (borrar.data ?? []).length === 0)
const ep = await s.USUARIO_A2.rpc('hallazgo_en_proceso', { p_id: h1.id })
comprobar('El responsable lo marca «en proceso»', !ep.error, ep.error?.message)

seccion('4. Cerrar con comentario y foto')
const corto = await s.USUARIO_A2.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'ok', p_foto_ruta: null, p_foto_bytes: null })
comprobar('Sin explicar qué se hizo no se cierra', Boolean(corto.error), corto.error?.message)
const ruta = `${A}/${insp}/cierre-${h1.id}-${randomUUID().slice(0, 8)}.png`
const sube = await s.USUARIO_A2.storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
comprobar('El responsable sube la foto de cierre', !sube.error, sube.error?.message)
const ajena = await s.GESTOR_B.storage.from('evidencias').upload(`${A}/${insp}/cierre-${h2.id}-${randomUUID().slice(0, 8)}.png`, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
comprobar('Otra empresa no sube fotos de cierre', Boolean(ajena.error))
const falsa = await s.USUARIO_A2.storage.from('evidencias').upload(`${A}/${insp}/cierre-${randomUUID()}-${randomUUID().slice(0, 8)}.png`, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
comprobar('No se sube una foto para un hallazgo que no existe', Boolean(falsa.error))
const cierraB = await s.GESTOR_B.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Intento de otra empresa', p_foto_ruta: null, p_foto_bytes: null })
comprobar('Otra empresa no puede cerrar', NO_AUTORIZADO(cierraB), cierraB.error?.message)
const otraRuta = await s.USUARIO_A2.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Señal repuesta (ficticio)', p_foto_ruta: `${A}/otra/foto.png`, p_foto_bytes: 10 })
comprobar('La foto debe estar en la carpeta del hallazgo', Boolean(otraRuta.error), otraRuta.error?.message)
const cierra = await s.USUARIO_A2.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Señal repuesta (ficticio)', p_foto_ruta: ruta, p_foto_bytes: PNG_FICTICIO.length })
comprobar('El responsable lo cierra con comentario y foto', !cierra.error, cierra.error?.message)
const cerrado = (await s.GESTOR_A.from('hallazgos').select('estado, cerrado_por, cierre_foto_ruta').eq('id', h1.id).single()).data
comprobar('Queda cerrado, con quién y la foto', cerrado?.estado === 'cerrado' && cerrado.cerrado_por === ID.USUARIO_A2 && cerrado.cierre_foto_ruta === ruta, JSON.stringify(cerrado))
const verFoto = await s.GESTOR_A.storage.from('evidencias').download(ruta)
comprobar('El gestor ve la foto de cierre', !verFoto.error)
const verFotoB = await s.GESTOR_B.storage.from('evidencias').download(ruta)
comprobar('Otra empresa no ve la foto de cierre', Boolean(verFotoB.error))
const dosVeces = await s.USUARIO_A2.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Otra vez', p_foto_ruta: null, p_foto_bytes: null })
comprobar('No se cierra dos veces', Boolean(dosVeces.error))

seccion('5. Reabrir')
const ru = await s.USUARIO_A2.rpc('reabrir_hallazgo', { p_id: h1.id, p_motivo: 'Quiero reabrirlo' })
comprobar('El usuario no puede reabrir', NO_AUTORIZADO(ru), ru.error?.message)
const sinMotivo = await s.GESTOR_A.rpc('reabrir_hallazgo', { p_id: h1.id, p_motivo: '' })
comprobar('Sin motivo no se reabre', Boolean(sinMotivo.error))
const rg = await s.GESTOR_A.rpc('reabrir_hallazgo', { p_id: h1.id, p_motivo: 'La señal se volvió a caer (ficticio)' })
const reab = (await s.GESTOR_A.from('hallazgos').select('estado, cierre_comentario').eq('id', h1.id).single()).data
comprobar('El gestor lo reabre y el cierre se quita', !rg.error && reab?.estado === 'abierto' && reab.cierre_comentario === null, rg.error?.message)
const h1hist = (await s.GESTOR_A.from('hallazgos_historial').select('cambio, antes').eq('hallazgo_id', h1.id).order('id')).data.map((x) => x.cambio)
comprobar('El historial guarda todo: creado, en proceso, cerrado, reabierto', JSON.stringify(h1hist) === JSON.stringify(['creado', 'en_proceso', 'cerrado', 'reabierto']), JSON.stringify(h1hist))
const cierre2 = await s.GESTOR_A.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Señal fijada con pernos (ficticio)', p_foto_ruta: null, p_foto_bytes: null })
comprobar('El gestor lo vuelve a cerrar (sin foto)', !cierre2.error, cierre2.error?.message)

seccion('6. Corrección y anulación de la inspección')
const antes = (await s.ADMIN_A.from('inspecciones').select('edicion').eq('id', insp).single()).data
const corr = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', {
  modo: 'corregir', id: insp, edicion: antes.edicion, motivo: 'HAL-02 estaba bien y HAL-03 no (ficticio)',
  respuestas: { 'HAL-01': { valor: 'no', accion: { texto: 'Reponer la señal (ficticio)', responsable: ID.USUARIO_A2, plazo: '2026-11-15' } }, 'HAL-02': { valor: 'si' }, 'HAL-03': { valor: 'no' } },
})
comprobar('El administrador corrige la inspección', corr.estado === 200, JSON.stringify(corr.datos))
hs = await deInsp(s.GESTOR_A)
const por = Object.fromEntries(hs.map((h) => [h.clave, h]))
comprobar('El hallazgo que desapareció queda «anulado por corrección»', por['HAL-02']?.estado === 'anulado' && /corrección/.test(por['HAL-02']?.anulado_motivo ?? ''), JSON.stringify(por['HAL-02']))
comprobar('Nace el hallazgo nuevo (HAL-03)', por['HAL-03']?.estado === 'abierto')
comprobar('El cerrado sigue cerrado', por['HAL-01']?.estado === 'cerrado')
comprobar('No se duplica el que ya existía', hs.length === 3)
const anu = await s.ADMIN_A.rpc('anular_inspeccion', { p_id: insp, p_motivo: 'Inspección de prueba anulada (ficticio)' })
hs = await deInsp(s.GESTOR_A)
const por2 = Object.fromEntries(hs.map((h) => [h.clave, h]))
comprobar('Al anular la inspección, sus hallazgos abiertos se anulan', !anu.error && por2['HAL-03']?.estado === 'anulado' && /Inspección anulada/.test(por2['HAL-03']?.anulado_motivo ?? ''), anu.error?.message ?? JSON.stringify(por2['HAL-03']))
comprobar('El que ya estaba cerrado no cambia', por2['HAL-01']?.estado === 'cerrado')
const tarde = await s.GESTOR_A.rpc('gestionar_hallazgo', { p_id: por2['HAL-03'].id, p_datos: { responsable_id: ID.USUARIO_A2 } })
comprobar('Un hallazgo anulado ya no se asigna', Boolean(tarde.error))

// Al terminar, el formato ficticio de esta prueba se desactiva para que no se acumulen en la lista (revisión de diseño, obs. 12).
await s.ADMIN_A.rpc('cambiar_vigencia_plantilla', { p_plantilla: plantilla, p_vigente: false })
const res = resumen()
const lineas = ['# Pruebas del seguimiento de hallazgos (tarea 3.4-D, parte 2)', '', `Fecha: ${new Date().toISOString()} · Base: crc-dev · Datos FICTICIOS · **${res.ok} de ${res.total} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/hallazgos.md', lineas.join('\n'))
process.exit(res.ok === res.total ? 0 : 1)
