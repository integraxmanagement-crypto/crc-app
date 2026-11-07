// Prueba de la gestión de planes de acción (06/11/2026): matriz de planes por sede, sincronizada con «Hallazgos», y el destino de cada formato.
// Solo cuentas y datos FICTICIOS de crc-dev (empresa ficticia A). Cada corrida crea un tipo de activo, un formato, un equipo y dos inspecciones ficticias
// (como pruebas/hallazgos.mjs: los hallazgos no se borran). Uso: node pruebas/planes.mjs
import { randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|row-level security|permission denied/i.test(r.error?.message ?? '')
const HOY = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const dia = (n) => new Date(Date.parse(`${HOY}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
const SUFIJO = String(randomInt(10000, 99999))
const ok = (r) => !r.error

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const yo = async (n) => (await s[n].auth.getUser()).data.user.id
const ID = { GESTOR_A: await yo('GESTOR_A'), USUARIO_A2: await yo('USUARIO_A2'), ADMIN_A: await yo('ADMIN_A') }
const A = (await s.DUENO.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id
const SEDE_A = (await s.DUENO.from('sedes').select('id').eq('empresa_id', A).eq('activa', true).limit(1).single()).data.id

const punto = (clave, texto, extra = {}) => ({ clave, texto, tipo: 'cumple', obligatorio: true, critico: false, hallazgo: 'no_cumple', obs_si_no_cumple: false, foto_si_no_cumple: false, pide_accion: false, ...extra })
const receta = {
  version: 1,
  secciones: [{ clave: 'general', titulo: 'Revisión (ficticia)', puntos: [punto('PLA-01', 'Señal visible (ficticio)', { pide_accion: true }), punto('PLA-02', 'Acceso libre (ficticio)'), punto('PLA-03', 'Orden (ficticio)')] }],
  firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }],
  reglas: [{ tipo: 'x_en', etiqueta: 'Con observaciones', alcance: 'todos' }],
  resultado_defecto: 'Conforme', puntaje: false, na_favorable: true, hallazgo_vencimiento: false, observacion_general: true,
}
const tipo = (await s.ADMIN_A.rpc('guardar_tipo_activo', { p_empresa: A, p_id: null, p_datos: { nombre: `Equipo ficticio PLA ${SUFIJO}`, subtipos: [] } })).data
const plantilla = (await s.ADMIN_A.rpc('nueva_plantilla', { p_empresa: A, p_datos: { nombre: `Planes ficticio ${SUFIJO}`, aplica_a: 'activo', tipo_activo_id: tipo, frecuencia: 'mensual' } })).data
const ver = (await s.ADMIN_A.from('plantillas_versiones').select('id').eq('plantilla_id', plantilla).single()).data.id
await s.ADMIN_A.rpc('guardar_borrador', { p_version: ver, p_datos: { receta, codigo_formato: `FIC-PLA-${SUFIJO}`, version_formato: '01', fecha_aprobacion: HOY, logo: 'ninguno' } })
const pub = await s.ADMIN_A.rpc('publicar_version', { p_version: ver })
if (pub.error) throw new Error(`No se pudo publicar: ${pub.error.message}`)
const equipo = (await s.ADMIN_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipo, codigo: `PLA-${SUFIJO}`, sede_id: SEDE_A } })).data

const registrar = (id) => llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', {
  modo: 'registrar', id, version_id: ver, sede_id: SEDE_A, activo_id: equipo, fecha: HOY, cerrada_en_equipo: new Date().toISOString(), archivos: [],
  respuestas: { 'PLA-01': { valor: 'no', accion: { texto: 'Reponer la señal (ficticio)', responsable: ID.USUARIO_A2, plazo: dia(10) } }, 'PLA-02': { valor: 'no' }, 'PLA-03': { valor: 'si' } },
  firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', persona_id: ID.GESTOR_A }],
})
const planes = async (c, insp) => {
  const hs = (await c.from('hallazgos').select('id, clave').eq('inspeccion_id', insp)).data ?? []
  const filas = (await c.from('condiciones').select('*').eq('matriz', 'planes').in('hallazgo_id', hs.map((h) => h.id).concat([randomUUID()]))).data ?? []
  return { hs, filas, de: (clave) => filas.find((f) => f.hallazgo_id === hs.find((h) => h.clave === clave)?.id) }
}

seccion('1. Los hallazgos llegan solos a la matriz de planes de acción')
const insp1 = randomUUID()
const r1 = await registrar(insp1)
comprobar('Se registra una inspección con 2 X', r1.estado === 200 && r1.datos?.estado === 'grabada', JSON.stringify(r1.datos))
let p = await planes(s.GESTOR_A, insp1)
comprobar('Cada hallazgo es una fila de la matriz de planes', p.hs.length === 2 && p.filas.length === 2, `${p.hs.length} hallazgos · ${p.filas.length} filas`)
const f1 = p.de('PLA-01')
comprobar('La fila trae descripción, acción, responsable del levantamiento y plazo del hallazgo',
  f1?.datos?.descripcion_hallazgo?.includes('Señal visible') && f1.datos.accion_correctiva === 'Reponer la señal (ficticio)' && f1.datos.resp_levantamiento === ID.USUARIO_A2 && f1.fecha_programada === dia(10), JSON.stringify(f1?.datos))
comprobar('La fecha del hallazgo es la de la inspección y el responsable del ACR es el inspector', f1?.fecha_hallazgo === HOY && f1?.datos?.resp_acr === ID.GESTOR_A)
comprobar('Sin el área (el equipo no la tiene) queda como borrador', f1?.borrador === true)
comprobar('El hallazgo sin asignar también llega, como borrador', p.de('PLA-02')?.borrador === true && !p.de('PLA-02')?.datos?.accion_correctiva)
comprobar('No llegan a la matriz de condiciones', ((await s.GESTOR_A.from('condiciones').select('id').eq('matriz', 'condiciones').in('hallazgo_id', p.hs.map((h) => h.id))).data ?? []).length === 0)
comprobar('Si la inspección llega dos veces no se duplican las filas', (await registrar(insp1)).datos?.estado === 'ya_recibida' && (await planes(s.GESTOR_A, insp1)).filas.length === 2)

seccion('2. Columnas de la matriz de planes y quién la ve')
comprobar('El gestor prepara la matriz de planes', ok(await s.GESTOR_A.rpc('preparar_condiciones', { p_sede: SEDE_A, p_matriz: 'planes' })))
const cols = (await s.GESTOR_A.from('condiciones_columnas').select('clave, nombre, tipo, obligatoria, orden').eq('sede_id', SEDE_A).eq('matriz', 'planes').order('orden')).data ?? []
comprobar('Tiene las 9 columnas pedidas, en orden', cols.map((c) => c.clave).join() === 'area,descripcion_hallazgo,resp_acr,fecha_hallazgo,accion_correctiva,resp_levantamiento,fecha_programada,fecha_cierre,estado', cols.map((c) => c.clave).join())
comprobar('Los nombres son los pedidos', cols.map((c) => c.nombre).join(' | ') === 'Área | Descripción del hallazgo | Responsable del ACR | Fecha del hallazgo | Acción correctiva | Responsable del levantamiento | Plazo inicial propuesto | Fecha de levantamiento | Estado')
comprobar('Área, responsable del ACR y del levantamiento son listas con buscador (área y persona)', cols.find((c) => c.clave === 'area').tipo === 'area' && cols.find((c) => c.clave === 'resp_acr').tipo === 'persona' && cols.find((c) => c.clave === 'resp_levantamiento').tipo === 'persona')
comprobar('Las columnas de condiciones siguen siendo las suyas (14, sin mezclarse)', (await s.GESTOR_A.rpc('preparar_condiciones', { p_sede: SEDE_A, p_matriz: 'condiciones' })).error == null
  && ((await s.GESTOR_A.from('condiciones_columnas').select('id').eq('sede_id', SEDE_A).eq('matriz', 'condiciones').eq('es_base', true)).data ?? []).length === 14)
comprobar('El usuario común no ve la matriz de planes', (await planes(s.USUARIO_A2, insp1)).filas.length === 0 && NO_AUTORIZADO(await s.USUARIO_A2.rpc('preparar_condiciones', { p_sede: SEDE_A, p_matriz: 'planes' })))
comprobar('Otra empresa no la ve', (await planes(s.ADMIN_B, insp1)).filas.length === 0)
comprobar('Una matriz que no existe se rechaza', !ok(await s.GESTOR_A.rpc('preparar_condiciones', { p_sede: SEDE_A, p_matriz: 'otra' })))
const tarj = (await s.GESTOR_A.from('condiciones_tarjetas').select('titulo, operador, fija').eq('sede_id', SEDE_A).eq('matriz', 'planes').order('orden')).data ?? []
comprobar('Tiene sus dos tarjetas fijas', tarj.length >= 2 && tarj[0].operador === 'borrador' && tarj[1].titulo === 'Sin plazo definido')

seccion('3. Sincronizado con «Hallazgos»: lo que se cambia en uno se ve en el otro')
const h2 = p.hs.find((h) => h.clave === 'PLA-02')
const g = await s.GESTOR_A.rpc('gestionar_hallazgo', { p_id: h2.id, p_datos: { responsable_id: ID.USUARIO_A2, plazo: dia(7), accion: 'Despejar el acceso (ficticio)' } })
comprobar('El gestor asigna el hallazgo desde «Hallazgos»', ok(g), g.error?.message)
p = await planes(s.GESTOR_A, insp1)
const f2 = p.de('PLA-02')
comprobar('La matriz se pone al día: acción, responsable y plazo', f2?.datos?.accion_correctiva === 'Despejar el acceso (ficticio)' && f2.datos.resp_levantamiento === ID.USUARIO_A2 && f2.fecha_programada === dia(7), JSON.stringify(f2?.datos))
// Desde la matriz: completar el plan (área, ACR y lo que falte) y que el hallazgo lo refleje
const area = (await s.DUENO.from('unidades').select('id, nombre').eq('empresa_id', A).eq('nivel', 'area').eq('vigente', true).limit(1)).data?.[0]
const datosPlan = (extra = {}) => ({ area: area?.nombre ?? 'Almacén general', ...(area ? { area_id: area.id } : {}), descripcion_hallazgo: 'Acceso bloqueado (ficticio)', resp_acr: ID.GESTOR_A, fecha_hallazgo: HOY, accion_correctiva: 'Retirar el pallet y señalizar', resp_levantamiento: ID.USUARIO_A2, fecha_programada: dia(5), ...extra })
const ed = await s.GESTOR_A.rpc('guardar_condicion', { p_id: f2.id, p_sede: SEDE_A, p_datos: datosPlan(), p_borrador: false, p_matriz: 'planes' })
comprobar('El gestor completa el plan desde la matriz', ok(ed), ed.error?.message)
const hAct = (await s.GESTOR_A.from('hallazgos').select('accion, plazo, responsable_id, estado').eq('id', h2.id).single()).data
comprobar('El hallazgo refleja la acción y el plazo cambiados en la matriz', hAct?.accion === 'Retirar el pallet y señalizar' && hAct.plazo === dia(5) && hAct.estado !== 'cerrado', JSON.stringify(hAct))
comprobar('El plan completo deja de ser borrador', (await planes(s.GESTOR_A, insp1)).de('PLA-02')?.borrador === false)
comprobar('Una persona de otra empresa no puede ser responsable', !ok(await s.GESTOR_A.rpc('guardar_condicion', { p_id: f2.id, p_sede: SEDE_A, p_datos: datosPlan({ resp_levantamiento: randomUUID() }), p_matriz: 'planes' })))
comprobar('Un plan no se guarda como si fuera una condición (matriz equivocada)', !ok(await s.GESTOR_A.rpc('guardar_condicion', { p_id: f2.id, p_sede: SEDE_A, p_datos: datosPlan(), p_matriz: 'condiciones' })))
const cierreMal = await s.GESTOR_A.rpc('validar_cierre_condicion', { p_id: f2.id, p_fecha: dia(2) })
comprobar('No se cierra con fecha futura', Boolean(cierreMal.error) && /futura/i.test(cierreMal.error.message))
const cierre = await s.GESTOR_A.rpc('validar_cierre_condicion', { p_id: f2.id, p_fecha: HOY })
comprobar('Validar el cierre en la matriz', ok(cierre), cierre.error?.message)
const hCerrado = (await s.GESTOR_A.from('hallazgos').select('estado, cierre_comentario').eq('id', h2.id).single()).data
comprobar('También cierra el hallazgo y deja anotado desde dónde', hCerrado?.estado === 'cerrado' && /planes de acción/.test(hCerrado.cierre_comentario ?? ''), JSON.stringify(hCerrado))
comprobar('La fecha de levantamiento es la elegida', (await planes(s.GESTOR_A, insp1)).de('PLA-02')?.fecha_cierre === HOY)
const reabre = await s.GESTOR_A.rpc('reabrir_hallazgo', { p_id: h2.id, p_motivo: 'Prueba: reabrir desde Hallazgos' })
comprobar('Reabrir el hallazgo reabre el plan', ok(reabre) && (await planes(s.GESTOR_A, insp1)).de('PLA-02')?.fecha_cierre === null, reabre.error?.message)
// Cerrar desde «Hallazgos» se ve en la matriz
const h1 = p.hs.find((h) => h.clave === 'PLA-01')
const cierraH = await s.USUARIO_A2.rpc('cerrar_hallazgo', { p_id: h1.id, p_comentario: 'Señal repuesta (ficticio)', p_foto_ruta: null, p_foto_bytes: null })
comprobar('El responsable cierra el hallazgo desde «Hallazgos»', ok(cierraH), cierraH.error?.message)
comprobar('El plan queda con fecha de levantamiento', (await planes(s.GESTOR_A, insp1)).de('PLA-01')?.fecha_cierre === HOY)

seccion('4. A dónde van los hallazgos de cada formato')
comprobar('Sin elegir, un formato común va a planes de acción (ya se vio)', (await s.GESTOR_A.from('plantillas').select('destino_hallazgos').eq('id', plantilla).single()).data.destino_hallazgos === null)
comprobar('El gestor no cambia el destino de un formato', NO_AUTORIZADO(await s.GESTOR_A.rpc('fijar_destino_formato', { p_plantilla: plantilla, p_destino: 'condiciones' })))
comprobar('Otra empresa no cambia el destino', NO_AUTORIZADO(await s.ADMIN_B.rpc('fijar_destino_formato', { p_plantilla: plantilla, p_destino: 'condiciones' })))
comprobar('Un destino que no existe se rechaza', !ok(await s.ADMIN_A.rpc('fijar_destino_formato', { p_plantilla: plantilla, p_destino: 'otro' })))
comprobar('Una plantilla base de CRC no se cambia', !ok(await s.ADMIN_A.rpc('fijar_destino_formato', { p_plantilla: (await s.ADMIN_A.from('plantillas').select('id').is('empresa_id', null).limit(1).single()).data.id, p_destino: 'planes' })))
comprobar('El administrador general manda los hallazgos del formato a condiciones', ok(await s.ADMIN_A.rpc('fijar_destino_formato', { p_plantilla: plantilla, p_destino: 'condiciones' })))
const insp2 = randomUUID()
comprobar('Se registra otra inspección', (await registrar(insp2)).datos?.estado === 'grabada')
p = await planes(s.GESTOR_A, insp2)
comprobar('Esos hallazgos ya no llegan a la matriz de planes', p.hs.length === 2 && p.filas.length === 0, `${p.hs.length} hallazgos · ${p.filas.length} filas`)
comprobar('Vuelve al valor por defecto (planes de acción)', ok(await s.ADMIN_A.rpc('fijar_destino_formato', { p_plantilla: plantilla, p_destino: null })) && (await s.GESTOR_A.from('plantillas').select('destino_hallazgos').eq('id', plantilla).single()).data.destino_hallazgos === null)

seccion('5. Las columnas de planes se configuran aparte de las de condiciones')
const cambio = (c) => s.ADMIN_A.rpc('cambiar_columnas_condiciones', { p_sede: SEDE_A, p_cambio: { ...c, matriz: 'planes' } })
comprobar('El administrador agrega una columna a la matriz de planes', ok(await cambio({ operacion: 'agregar', nombre: `Costo estimado ${SUFIJO}`, tipo: 'numero' })))
const nuevaCol = (await s.ADMIN_A.from('condiciones_columnas').select('clave, matriz, orden').eq('sede_id', SEDE_A).eq('nombre', `Costo estimado ${SUFIJO}`)).data ?? []
comprobar('Queda solo en la matriz de planes, al final', nuevaCol.length === 1 && nuevaCol[0].matriz === 'planes' && nuevaCol[0].orden === 10, JSON.stringify(nuevaCol))
comprobar('Se puede ocultar y eliminar sin tocar las condiciones', ok(await cambio({ operacion: 'ocultar', clave: nuevaCol[0].clave })) && ok(await cambio({ operacion: 'eliminar', clave: nuevaCol[0].clave })))
comprobar('Una columna base de planes no se elimina', !ok(await cambio({ operacion: 'eliminar', clave: 'accion_correctiva' })))
const prop = await s.GESTOR_A.rpc('solicitar_cambio', { p_tipo: 'cambio_columnas_condiciones', p_objetivo: SEDE_A, p_datos: { operacion: 'ocultar', clave: 'fecha_cierre', matriz: 'planes' }, p_motivo: 'Prueba de planes de acción' })
comprobar('El gestor propone un cambio en la matriz de planes', ok(prop), prop.error?.message)
const sol = (await s.ADMIN_A.from('solicitudes_cambio').select('titulo').eq('id', prop.data).single()).data
comprobar('La solicitud dice que es de planes de acción', /planes de acción/.test(sol?.titulo ?? ''), sol?.titulo)
comprobar('El administrador la aprueba y se oculta esa columna', ok(await s.ADMIN_A.rpc('resolver_solicitud', { p_id: prop.data, p_aprobar: true, p_comentario: null }))
  && (await s.ADMIN_A.from('condiciones_columnas').select('visible').eq('sede_id', SEDE_A).eq('matriz', 'planes').eq('clave', 'fecha_cierre').single()).data.visible === false)
comprobar('Se vuelve a mostrar', ok(await cambio({ operacion: 'mostrar', clave: 'fecha_cierre' })))

const bien = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba de la gestión de planes de acción', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · crc-dev · empresa ficticia A.`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/planes.md', lineas.join('\n'))
process.exit(bien ? 0 : 1)
