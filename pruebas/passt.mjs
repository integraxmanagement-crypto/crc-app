// Prueba del Programa Anual de SST (tarea 3.4-E). Solo cuentas y datos FICTICIOS de crc-dev.
// Comprueba quién ve y cambia, el árbol, programar semanas, aprobar y reprogramar, lo ejecutado por inspecciones
// (calculado al consultar) y a mano, la baja, duplicar y la separación entre empresas.
// Uso: node pruebas/passt.mjs   (cada corrida crea un programa, un formato, un equipo y 1 inspección ficticios)
import { randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { semanaIso } from '../src/inspecciones/periodos.ts'
import { PNG_FICTICIO, cliente, comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|solo el administrador|row-level security|permission denied/i.test(r.error?.message ?? '')
const HOY = new Date().toISOString().slice(0, 10)
const { anio: ANIO, semana: SEM } = semanaIso(HOY)
const ANTES = Math.max(1, SEM - 1)
const SUFIJO = String(randomInt(10000, 99999))

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const yo = async (n) => (await s[n].auth.getUser()).data.user.id
const ID = { ADMIN_A: await yo('ADMIN_A'), GESTOR_A: await yo('GESTOR_A'), USUARIO_A2: await yo('USUARIO_A2') }
const { data: empresas } = await s.DUENO.from('empresas').select('id, ruc')
const A = empresas.find((e) => e.ruc === '20000000010').id
const B = empresas.find((e) => e.ruc === '20000000028').id
const SEDE_A = (await s.DUENO.from('sedes').select('id').eq('empresa_id', A).eq('activa', true).limit(1).single()).data.id

// Formato ficticio publicado y un equipo, para que una actividad se ejecute sola con la inspección.
const receta = {
  version: 1,
  secciones: [{ clave: 'general', titulo: 'Revisión (ficticia)', puntos: [{ clave: 'PAS-01', texto: 'Punto ficticio', tipo: 'cumple', obligatorio: true, critico: false, hallazgo: 'no_cumple', obs_si_no_cumple: false, foto_si_no_cumple: false, pide_accion: false }] }],
  firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }],
  reglas: [{ tipo: 'x_en', etiqueta: 'Inoperativo', alcance: 'todos' }], resultado_defecto: 'Operativo', puntaje: false, na_favorable: true, hallazgo_vencimiento: false, observacion_general: true,
}
const tipo = (await s.ADMIN_A.rpc('guardar_tipo_activo', { p_empresa: A, p_id: null, p_datos: { nombre: `Equipo PASST ficticio ${SUFIJO}`, subtipos: [] } })).data
const formato = (await s.ADMIN_A.rpc('nueva_plantilla', { p_empresa: A, p_datos: { nombre: `Formato PASST ficticio ${SUFIJO}`, aplica_a: 'activo', tipo_activo_id: tipo, frecuencia: 'semanal' } })).data
const ver = (await s.ADMIN_A.from('plantillas_versiones').select('id').eq('plantilla_id', formato).single()).data.id
await s.ADMIN_A.rpc('guardar_borrador', { p_version: ver, p_datos: { receta, codigo_formato: `FIC-PAS-${SUFIJO}`, version_formato: '01', fecha_aprobacion: HOY, logo: 'ninguno' } })
if ((await s.ADMIN_A.rpc('publicar_version', { p_version: ver })).error) throw new Error('No se pudo publicar el formato ficticio')
const equipo = (await s.ADMIN_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipo, codigo: `PAS-${SUFIJO}`, sede_id: SEDE_A } })).data

seccion('1. Quién ve y quién crea')
const u = await s.USUARIO_A2.rpc('crear_programa', { p_empresa: A, p_datos: { anio: ANIO } })
comprobar('Un usuario (trabajador) no crea programas', NO_AUTORIZADO(u), u.error?.message)
const b = await s.GESTOR_B.rpc('crear_programa', { p_empresa: A, p_datos: { anio: ANIO } })
comprobar('Otra empresa no crea programas en A', NO_AUTORIZADO(b), b.error?.message)
const c = await s.GESTOR_A.rpc('crear_programa', { p_empresa: A, p_datos: { anio: ANIO, nombre: `PASST ficticio ${SUFIJO}` } })
comprobar('El gestor crea un programa general del año', !c.error, c.error?.message)
const P = c.data
const nodos = async (cl = s.GESTOR_A) => (await cl.from('passt_nodos').select('*').eq('programa_id', P)).data ?? []
const og = (await nodos()).find((n) => n.tipo === 'objetivo_general')
comprobar('Nace con su objetivo general', Boolean(og))
comprobar('El usuario no ve el programa', ((await s.USUARIO_A2.from('passt_programas').select('id').eq('id', P)).data ?? []).length === 0)
comprobar('Otra empresa no ve el programa', ((await s.GESTOR_B.from('passt_programas').select('id').eq('id', P)).data ?? []).length === 0)
comprobar('Sin sesión no se ve nada', ((await cliente().from('passt_programas').select('id').limit(1)).data ?? []).length === 0)
comprobar('El dueño de la plataforma lo ve', ((await s.DUENO.from('passt_programas').select('id').eq('id', P)).data ?? []).length === 1)

seccion('2. Árbol: objetivos, metas, secciones y actividades')
const nodo = (cl, datos, id = null) => cl.rpc('guardar_nodo', { p_programa: P, p_id: id, p_datos: datos })
const oe = await nodo(s.GESTOR_A, { tipo: 'objetivo_especifico', padre_id: og.id, texto: 'Objetivo específico ficticio', recursos: 'Presupuesto ficticio' })
comprobar('Agrega un objetivo específico con recursos', !oe.error, oe.error?.message)
const metas = Array.from({ length: 5 }, (_, k) => ({ texto: `Meta ficticia ${k + 1}`, indicador: `Indicador ${k + 1}` }))
const m5 = await s.GESTOR_A.rpc('guardar_metas', { p_nodo: oe.data, p_metas: metas, p_motivo: null })
comprobar('Guarda 5 metas con su indicador', !m5.error && ((await s.GESTOR_A.from('passt_metas').select('id').eq('nodo_id', oe.data)).data ?? []).length === 5, m5.error?.message)
const m6 = await s.GESTOR_A.rpc('guardar_metas', { p_nodo: oe.data, p_metas: [...metas, { texto: 'Sexta' }], p_motivo: null })
comprobar('No acepta una sexta meta', Boolean(m6.error), m6.error?.message)
const sec = await nodo(s.GESTOR_A, { tipo: 'seccion', padre_id: oe.data, texto: 'Sección ficticia' })
const malLugar = await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: oe.data, texto: 'Actividad en mal lugar' })
comprobar('Una actividad no puede ir directo en un objetivo (va en una sección)', Boolean(malLugar.error), malLugar.error?.message)
const usuarioResp = await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: sec.data, texto: 'Actividad ficticia', responsable_id: ID.USUARIO_A2 })
comprobar('Un usuario no puede ser responsable (decisión del dueño)', Boolean(usuarioResp.error), usuarioResp.error?.message)
const a1 = (await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: sec.data, texto: 'Inspección semanal ficticia', responsable_id: ID.GESTOR_A, plantilla_id: formato, meta_pct: 100 })).data
const a2 = (await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: sec.data, texto: 'Capacitación ficticia', responsable_id: ID.GESTOR_A, meta_pct: 90 })).data
const a3 = (await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: sec.data, texto: 'Simulacro ficticio', responsable_id: ID.ADMIN_A })).data
comprobar('Agrega 3 actividades (una vinculada a un formato)', Boolean(a1 && a2 && a3))
const ordenAntes = (await nodos()).filter((n) => n.padre_id === sec.data).sort((x, y) => x.orden - y.orden).map((n) => n.id)
const mv = await s.GESTOR_A.rpc('mover_nodo', { p_id: a3, p_datos: { direccion: 'subir' } })
const ordenDespues = (await nodos()).filter((n) => n.padre_id === sec.data).sort((x, y) => x.orden - y.orden).map((n) => n.id)
comprobar('Sube una actividad un lugar', !mv.error && JSON.stringify(ordenDespues) === JSON.stringify([ordenAntes[0], ordenAntes[2], ordenAntes[1]]), mv.error?.message)
const resps = (await s.GESTOR_A.rpc('passt_responsables', { p_empresa: A })).data ?? []
comprobar('La lista de responsables trae solo administradores y gestores', resps.length > 0 && resps.every((r) => r.rol === 'admin_empresa' || r.rol === 'gestor'))
const directo = await s.GESTOR_A.from('passt_nodos').update({ texto: 'cambio directo' }).eq('id', a1).select()
comprobar('Nadie cambia las tablas directo', Boolean(directo.error) || (directo.data ?? []).length === 0)

seccion('3. Programar semanas, aprobar y reprogramar')
const prog = (cl, act, w, val, motivo = null) => cl.rpc('programar_semana', { p_actividad: act, p_semana: w, p_programada: val, p_motivo: motivo })
for (const [act, w] of [[a1, ANTES], [a1, SEM], [a2, ANTES], [a2, SEM], [a3, SEM]]) await prog(s.GESTOR_A, act, w, true)
const programadas = (await s.GESTOR_A.from('passt_semanas').select('id').in('actividad_id', [a1, a2, a3]).eq('programada', true)).data ?? []
comprobar('El gestor programa semanas en borrador', programadas.length === (ANTES === SEM ? 3 : 5), String(programadas.length))
const w54 = await prog(s.GESTOR_A, a1, 54, true)
comprobar('No existe la semana 54', Boolean(w54.error))
const apG = await s.GESTOR_A.rpc('aprobar_programa', { p_id: P })
comprobar('El gestor no aprueba', NO_AUTORIZADO(apG), apG.error?.message)
const apA = await s.ADMIN_A.rpc('aprobar_programa', { p_id: P })
comprobar('El administrador aprueba', !apA.error, apA.error?.message)
const repG = await prog(s.GESTOR_A, a2, Math.min(SEM + 2, 52), true, 'Cambio de fecha ficticio')
comprobar('Aprobado: el gestor ya no reprograma (decisión del dueño)', NO_AUTORIZADO(repG), repG.error?.message)
const sinMotivo = await prog(s.ADMIN_A, a2, Math.min(SEM + 2, 52), true)
comprobar('Aprobado: el administrador necesita un motivo', Boolean(sinMotivo.error), sinMotivo.error?.message)
const repA = await prog(s.ADMIN_A, a2, Math.min(SEM + 2, 52), true, 'Se movió la capacitación (ficticio)')
comprobar('El administrador reprograma con motivo', !repA.error, repA.error?.message)
const estructuraG = await nodo(s.GESTOR_A, { tipo: 'actividad', padre_id: sec.data, texto: 'Otra' })
comprobar('Aprobado: el gestor no cambia la estructura', NO_AUTORIZADO(estructuraG), estructuraG.error?.message)
const hist = ((await s.GESTOR_A.from('passt_historial').select('cambio, motivo').eq('programa_id', P)).data ?? []).map((h) => h.cambio)
comprobar('El historial guarda la aprobación y la reprogramación con su motivo', hist.includes('aprobado') && hist.includes('reprogramado'), JSON.stringify(hist))

seccion('4. Lo ejecutado: por inspección y a mano')
const ejecucion = async () => (await s.GESTOR_A.rpc('passt_ejecucion', { p_programa: P })).data ?? []
comprobar('Sin inspecciones, nada ejecutado por inspección', (await ejecucion()).length === 0)
const insp = randomUUID()
const r = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', {
  modo: 'registrar', id: insp, version_id: ver, sede_id: SEDE_A, activo_id: equipo, fecha: HOY, cerrada_en_equipo: new Date().toISOString(), archivos: [],
  respuestas: { 'PAS-01': { valor: 'no' } }, firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', persona_id: ID.ADMIN_A }],
})
comprobar('El administrador (no el responsable) inspecciona con resultado «Inoperativo»', r.estado === 200, JSON.stringify(r.datos))
const ej = await ejecucion()
comprobar('La semana queda ejecutada sola, con cualquier inspector y resultado', ej.length === 1 && ej[0].actividad_id === a1 && ej[0].semana === SEM && ej[0].inspecciones === 1, JSON.stringify(ej))
const hall = (await s.GESTOR_A.rpc('passt_hallazgos', { p_programa: P })).data ?? []
comprobar('La actividad muestra el hallazgo abierto de su inspección', hall.length === 1 && hall[0].abiertos === 1, JSON.stringify(hall))
const marcarG = (act, w, ok = true, coment = 'Se hizo (ficticio)', ruta = null, bytes = null) =>
  s.GESTOR_A.rpc('marcar_semana', { p_actividad: act, p_semana: w, p_ejecutada: ok, p_comentario: coment, p_foto_ruta: ruta, p_foto_bytes: bytes })
const ajena = await marcarG(a3, SEM)
comprobar('El gestor no marca una actividad que no es suya', NO_AUTORIZADO(ajena), ajena.error?.message)
const vinculada = await marcarG(a1, ANTES)
comprobar('El responsable no marca a mano una actividad vinculada a un formato', NO_AUTORIZADO(vinculada), vinculada.error?.message)
const corto = await marcarG(a2, SEM, true, 'ok')
comprobar('Sin explicar qué se hizo no se marca', Boolean(corto.error))
const ruta = `${A}/${a2}/passt-${SEM}-${randomUUID().slice(0, 8)}.png`
const sube = await s.GESTOR_A.storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
comprobar('El responsable sube la foto de evidencia', !sube.error, sube.error?.message)
const subeB = await s.GESTOR_B.storage.from('evidencias').upload(`${A}/${a2}/passt-${SEM}-${randomUUID().slice(0, 8)}.png`, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
comprobar('Otra empresa no sube fotos al programa', Boolean(subeB.error))
const propia = await marcarG(a2, SEM, true, 'Capacitación dictada (ficticio)', ruta, PNG_FICTICIO.length)
comprobar('El responsable marca su actividad sin formato, aunque el programa esté aprobado', !propia.error, propia.error?.message)
const verFoto = await s.ADMIN_A.storage.from('evidencias').download(ruta)
comprobar('El administrador ve la foto', !verFoto.error)
const admin = await s.ADMIN_A.rpc('marcar_semana', { p_actividad: a3, p_semana: SEM, p_ejecutada: true, p_comentario: 'Simulacro hecho (ficticio)', p_foto_ruta: null, p_foto_bytes: null })
comprobar('El administrador marca cualquier actividad', !admin.error, admin.error?.message)
const sem = (await s.GESTOR_A.from('passt_semanas').select('actividad_id, semana, manual, manual_por').eq('actividad_id', a2).eq('semana', SEM).single()).data
comprobar('La marca guarda quién la hizo', sem?.manual === true && sem.manual_por === ID.GESTOR_A)
const anu = await s.ADMIN_A.rpc('anular_inspeccion', { p_id: insp, p_motivo: 'Inspección de prueba anulada (ficticio)' })
comprobar('Si se anula la inspección, la semana vuelve a quedar pendiente (se calcula al consultar)', !anu.error && (await ejecucion()).length === 0)

seccion('5. Baja y duplicar')
const bajaG = await s.GESTOR_A.rpc('baja_nodo', { p_id: a3, p_motivo: 'Intento' })
comprobar('Aprobado: el gestor no da de baja', NO_AUTORIZADO(bajaG))
const bajaA = await s.ADMIN_A.rpc('baja_nodo', { p_id: a3, p_motivo: 'Ya no se hará (ficticio)' })
comprobar('El administrador da de baja con motivo (no se borra)', !bajaA.error && (await nodos()).find((n) => n.id === a3)?.vigente === false, bajaA.error?.message)
const dup = await s.GESTOR_A.rpc('duplicar_programa', { p_id: P, p_datos: { anio: ANIO + 1, nombre: `PASST ficticio ${SUFIJO} siguiente` } })
comprobar('El gestor duplica el programa para el año siguiente', !dup.error, dup.error?.message)
const P2 = dup.data
const n2 = (await s.GESTOR_A.from('passt_nodos').select('id, tipo, vigente').eq('programa_id', P2)).data ?? []
comprobar('Copia el árbol vigente (sin lo dado de baja)', n2.filter((n) => n.tipo === 'actividad').length === 2 && n2.every((n) => n.vigente), JSON.stringify(n2.map((n) => n.tipo)))
const pr2 = (await s.GESTOR_A.from('passt_programas').select('estado, anio, duplicado_de').eq('id', P2).single()).data
comprobar('La copia queda en borrador, con el año nuevo', pr2?.estado === 'borrador' && pr2.anio === ANIO + 1 && pr2.duplicado_de === P)
const s2 = (await s.GESTOR_A.from('passt_semanas').select('programada, manual, passt_nodos!inner(programa_id)').eq('passt_nodos.programa_id', P2)).data ?? []
comprobar('Copia las semanas programadas, no lo ejecutado', s2.length > 0 && s2.every((x) => x.programada && !x.manual), JSON.stringify(s2.length))
const metas2 = (await s.GESTOR_A.from('passt_metas').select('id, passt_nodos!inner(programa_id)').eq('passt_nodos.programa_id', P2)).data ?? []
comprobar('Copia las 5 metas', metas2.length === 5)
const dupB = await s.GESTOR_B.rpc('duplicar_programa', { p_id: P, p_datos: { anio: ANIO } })
comprobar('Otra empresa no duplica', NO_AUTORIZADO(dupB))

const res = resumen()
const lineas = ['# Pruebas del Programa Anual de SST (tarea 3.4-E)', '', `Fecha: ${new Date().toISOString()} · Base: crc-dev · Datos FICTICIOS · Semana de la prueba: ${SEM} de ${ANIO} · **${res.ok} de ${res.total} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/passt.md', lineas.join('\n'))
process.exit(res.ok === res.total ? 0 : 1)
