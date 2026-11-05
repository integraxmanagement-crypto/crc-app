// Prueba de la etapa 3 del punto 2 (03/11/2026): el gestor prepara un borrador de formato y PIDE publicarlo (formato nuevo o cambio de uno que ya existe)
// o pide retirarlo; solo el administrador general decide. El gestor ya no retira ni reactiva formatos directo.
// Solo datos FICTICIOS, en crc-dev. Usa la empresa D (RUC 20000000052) de separacion-sedes.mjs y crea formatos propios con nombre al azar
// (no toca los formatos que ya usan las inspecciones). Se puede repetir: cada corrida deja un formato ficticio retirado.
// Uso: node pruebas/formatos-solicitudes.mjs   (corre antes node pruebas/separacion-sedes.mjs y node pruebas/facultades.mjs una vez)
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { comprobar, ingresarComo, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const SIN_PERMISO = (r) => r.error?.code === '42501' || /No autorizado|permission denied/i.test(r.error?.message ?? '')
const HOY = new Date().toISOString().slice(0, 10)
const SUF = randomUUID().slice(0, 6)
const INICIO = new Date(Date.now() - 2000).toISOString() // la limpieza final borra solo las solicitudes nacidas desde aquí

const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const D = (await dueno.from('empresas').select('id').eq('ruc', '20000000052').maybeSingle()).data?.id
if (!D) throw new Error('Falta la empresa D: corre antes node pruebas/separacion-sedes.mjs')
const A = (await dueno.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id

const s = { DUENO: dueno }
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'GESTOR_C1', 'GESTOR_C2', 'USUARIO_C1', 'USUGES_C1', 'ADMIN_A', 'GESTOR_A', 'ADMIN_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message} (¿corriste antes facultades.mjs?)`)
  s[n] = c
}
const ID = {}
for (const n of ['ADMIN_C', 'GESTOR_C1']) ID[n] = (await s[n].auth.getUser()).data.user.id

// Receta válida para publicar: se toma de la motobomba de la empresa D (formatos ya publicados)
const recetaBuena = (await dueno.from('plantillas_versiones').select('receta, plantillas!inner(codigo, empresa_id)').eq('plantillas.empresa_id', D).eq('estado', 'vigente').limit(1).single()).data.receta
const encabezado = (extra = {}) => ({ codigo_formato: `FIC-SOL-${SUF}`, version_formato: '01', fecha_aprobacion: HOY, logo: 'positivo', receta: recetaBuena, ...extra })
const pedir = (quien, tipo, objetivo, motivo = 'Motivo de la prueba (ficticio)') => s[quien].rpc('solicitar_cambio', { p_tipo: tipo, p_objetivo: objetivo, p_datos: {}, p_motivo: motivo })
const solicitud = async (id) => (await dueno.from('solicitudes_cambio').select('*').eq('id', id).single()).data
const estadoVersion = async (id) => (await dueno.from('plantillas_versiones').select('estado').eq('id', id).single()).data?.estado

// ───────────────────────────────────────────────
seccion('1. El gestor prepara un formato nuevo (borrador) y pide publicarlo')
const nombre = `Prueba solicitud formato ${SUF}`
const pl = await s.GESTOR_C1.rpc('nueva_plantilla', { p_empresa: D, p_datos: { nombre, aplica_a: 'area', frecuencia: 'mensual' } })
comprobar('El gestor crea el formato nuevo (queda en borrador)', !pl.error && Boolean(pl.data), pl.error?.message)
const PLANTILLA = pl.data
const v1 = (await dueno.from('plantillas_versiones').select('id, estado').eq('plantilla_id', PLANTILLA).single()).data
comprobar('Nace como borrador y la empresa no lo usa todavía', v1?.estado === 'borrador')
const sinListo = await pedir('GESTOR_C1', 'publicar_formato', v1.id)
comprobar('No se puede pedir un borrador incompleto (sin código, versión o puntos)', Boolean(sinListo.error) && /código|versión|punto|sección|completa/i.test(sinListo.error.message), sinListo.error?.message)
const g1 = await s.GESTOR_C1.rpc('guardar_borrador', { p_version: v1.id, p_datos: encabezado() })
comprobar('El gestor completa el borrador', !g1.error, g1.error?.message)
const sinMotivo = await pedir('GESTOR_C1', 'publicar_formato', v1.id, ' ')
comprobar('Sin motivo no se puede pedir', Boolean(sinMotivo.error), sinMotivo.error?.message)
const directo = await s.GESTOR_C1.rpc('publicar_version', { p_version: v1.id })
comprobar('El gestor no publica directo', SIN_PERMISO(directo), directo.error?.message)

// ───────────────────────────────────────────────
seccion('2. Quién puede pedir')
for (const [quien, texto] of [['ADMIN_C', 'El administrador general no pide (publica directo)'], ['ADMSEDE_C1', 'El administrador de sede no pide'], ['USUGES_C1', 'Un usuario gestor no pide'], ['USUARIO_C1', 'Un usuario no pide'], ['GESTOR_A', 'Un gestor de otra empresa no pide sobre un formato ajeno'], ['ADMIN_B', 'Un administrador de otra empresa no pide']]) {
  const r = await pedir(quien, 'publicar_formato', v1.id)
  comprobar(texto, Boolean(r.error), r.error?.message)
}
const baseVersion = (await dueno.from('plantillas_versiones').select('id').is('empresa_id', null).eq('estado', 'vigente').limit(1).single()).data.id
const deBase = await pedir('GESTOR_C1', 'publicar_formato', baseVersion)
comprobar('No se pide publicar una versión base de CRC', Boolean(deBase.error), deBase.error?.message)
const noExiste = await pedir('GESTOR_C1', 'publicar_formato', randomUUID())
comprobar('No se pide sobre algo que no existe', Boolean(noExiste.error), noExiste.error?.message)
const tipoRaro = await pedir('GESTOR_C1', 'publicar_todo', v1.id)
comprobar('Un tipo de solicitud inventado se rechaza', Boolean(tipoRaro.error), tipoRaro.error?.message)

const pidio = await pedir('GESTOR_C1', 'publicar_formato', v1.id, 'Formato nuevo para la empresa (ficticio)')
comprobar('El gestor pide publicar el formato nuevo', !pidio.error && Boolean(pidio.data), pidio.error?.message)
const SOL1 = pidio.data
const sol1 = await solicitud(SOL1)
comprobar('Queda pendiente, sin sede (es de toda la empresa) y con el nombre del formato', sol1?.estado === 'pendiente' && sol1.sede_id === null && sol1.titulo.includes(nombre), `${sol1?.estado} ${sol1?.titulo}`)
comprobar('El título dice que es un formato nuevo', /nuevo/i.test(sol1?.titulo ?? ''), sol1?.titulo)
const dup = await pedir('GESTOR_C1', 'publicar_formato', v1.id)
comprobar('No se puede pedir dos veces lo mismo mientras está pendiente', Boolean(dup.error), dup.error?.message)

// ───────────────────────────────────────────────
seccion('3. Quién ve y quién resuelve')
const ve = async (quien, id) => ((await s[quien].from('solicitudes_cambio').select('id').eq('id', id)).data ?? []).length === 1
comprobar('El gestor que pidió la ve', await ve('GESTOR_C1', SOL1))
comprobar('El administrador general la ve', await ve('ADMIN_C', SOL1))
comprobar('El dueño de la plataforma la ve', await ve('DUENO', SOL1))
for (const [quien, texto] of [['ADMSEDE_C1', 'El administrador de sede no la ve (el formato es de toda la empresa)'], ['GESTOR_C2', 'Otro gestor no la ve'], ['USUARIO_C1', 'Un usuario no la ve'], ['USUGES_C1', 'Un usuario gestor no la ve'], ['ADMIN_B', 'Otra empresa no la ve'], ['GESTOR_A', 'Un gestor de otra empresa no la ve']])
  comprobar(texto, !(await ve(quien, SOL1)))
for (const [quien, texto] of [['GESTOR_C1', 'El gestor no resuelve su propia solicitud'], ['ADMSEDE_C1', 'El administrador de sede no resuelve solicitudes de formatos'], ['GESTOR_C2', 'Otro gestor no resuelve'], ['USUARIO_C1', 'Un usuario no resuelve'], ['ADMIN_B', 'Un administrador de otra empresa no resuelve']]) {
  const r = await s[quien].rpc('resolver_solicitud', { p_id: SOL1, p_aprobar: true, p_comentario: null })
  comprobar(texto, Boolean(r.error), r.error?.message)
}
comprobar('Nada cambió con esos intentos: el borrador sigue sin publicar', (await estadoVersion(v1.id)) === 'borrador' && (await solicitud(SOL1)).estado === 'pendiente')

// ───────────────────────────────────────────────
seccion('4. El administrador general aprueba: el formato se publica a su nombre')
const negarSinTexto = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL1, p_aprobar: false, p_comentario: '' })
comprobar('Para denegar hay que escribir el motivo', Boolean(negarSinTexto.error), negarSinTexto.error?.message)
const aprueba = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL1, p_aprobar: true, p_comentario: 'Aprobado (prueba ficticia)' })
comprobar('El administrador general aprueba', !aprueba.error, aprueba.error?.message)
const pub = (await dueno.from('plantillas_versiones').select('estado, publicado_por').eq('id', v1.id).single()).data
comprobar('La versión quedó publicada (vigente) y la publicó el administrador, no el gestor', pub?.estado === 'vigente' && pub.publicado_por === ID.ADMIN_C, `${pub?.estado}`)
const sol1b = await solicitud(SOL1)
comprobar('La solicitud quedó aprobada, con quién y cuándo', sol1b.estado === 'aprobada' && sol1b.resuelto_por === ID.ADMIN_C && Boolean(sol1b.resuelto_en) && sol1b.visto_solicitante === false)
const otraVez = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL1, p_aprobar: true, p_comentario: null })
comprobar('No se resuelve dos veces', Boolean(otraVez.error), otraVez.error?.message)
const ven = (await s.USUARIO_C1.from('plantillas').select('id').eq('id', PLANTILLA)).data ?? []
comprobar('Ahora los usuarios de la empresa ven el formato', ven.length === 1)

// ───────────────────────────────────────────────
seccion('5. Cambiar un formato que ya existe: el gestor abre un borrador y pide publicarlo')
const nb = await s.GESTOR_C1.rpc('nuevo_borrador', { p_plantilla: PLANTILLA })
comprobar('El gestor abre un borrador nuevo del formato publicado', !nb.error && Boolean(nb.data), nb.error?.message)
const v2 = nb.data
const recetaCambiada = structuredClone(recetaBuena)
recetaCambiada.secciones[0].titulo = `${recetaCambiada.secciones[0].titulo} (revisada)`
const g2 = await s.GESTOR_C1.rpc('guardar_borrador', { p_version: v2, p_datos: encabezado({ version_formato: '02', receta: recetaCambiada }) })
comprobar('El gestor cambia el borrador', !g2.error, g2.error?.message)
const p2 = await pedir('GESTOR_C1', 'publicar_formato', v2, 'Cambio de un título (ficticio)')
comprobar('Pide publicar el cambio', !p2.error && Boolean(p2.data), p2.error?.message)
const SOL2 = p2.data
comprobar('El título dice que es un cambio de un formato existente', /cambio|modific/i.test((await solicitud(SOL2)).titulo), (await solicitud(SOL2)).titulo)
// El gestor retoca el borrador DESPUÉS de pedir: el administrador no puede aprobar algo distinto de lo que revisó
const g3 = await s.GESTOR_C1.rpc('guardar_borrador', { p_version: v2, p_datos: encabezado({ version_formato: '02', receta: structuredClone({ ...recetaCambiada, secciones: recetaCambiada.secciones.map((sec, i) => (i === 0 ? { ...sec, titulo: `${sec.titulo} (retocada ${SUF})` } : sec)) }) }) })
comprobar('El gestor retoca el borrador después de pedir', !g3.error, g3.error?.message)
const aprobarCambiado = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL2, p_aprobar: true, p_comentario: null })
comprobar('Aprobar un borrador que cambió después de la solicitud se rechaza', Boolean(aprobarCambiado.error) && /cambi/i.test(aprobarCambiado.error.message), aprobarCambiado.error?.message)
comprobar('…y nada se publicó ni se resolvió', (await estadoVersion(v2)) === 'borrador' && (await solicitud(SOL2)).estado === 'pendiente')
const niega = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL2, p_aprobar: false, p_comentario: 'Pídelo de nuevo con el borrador final (ficticio)' })
comprobar('El administrador la deniega con su comentario', !niega.error, niega.error?.message)
const sol2 = await solicitud(SOL2)
comprobar('Queda denegada, con el comentario y sin avisar como vista', sol2.estado === 'denegada' && sol2.comentario_resolucion.includes('borrador final') && sol2.visto_solicitante === false)
comprobar('El formato vigente sigue igual', (await estadoVersion(v1.id)) === 'vigente' && (await estadoVersion(v2)) === 'borrador')
const p3 = await pedir('GESTOR_C1', 'publicar_formato', v2, 'Con el borrador final (ficticio)')
comprobar('Después de una denegación el gestor puede pedir de nuevo', !p3.error && Boolean(p3.data), p3.error?.message)
const ok3 = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: p3.data, p_aprobar: true, p_comentario: null })
comprobar('El administrador aprueba el cambio', !ok3.error, ok3.error?.message)
comprobar('La versión nueva quedó vigente y la anterior retirada', (await estadoVersion(v2)) === 'vigente' && (await estadoVersion(v1.id)) === 'retirada')

// ───────────────────────────────────────────────
seccion('6. Retirar un formato: el gestor pide, el administrador decide')
const directoVigencia = await s.GESTOR_C1.rpc('cambiar_vigencia_plantilla', { p_plantilla: PLANTILLA, p_vigente: false })
comprobar('El gestor ya no retira un formato directo', SIN_PERMISO(directoVigencia), directoVigencia.error?.message)
comprobar('…y sigue vigente', (await dueno.from('plantillas').select('vigente').eq('id', PLANTILLA).single()).data.vigente === true)
for (const [quien, texto] of [['ADMIN_C', 'El administrador general no pide, retira directo'], ['USUGES_C1', 'Un usuario gestor no pide retirar'], ['GESTOR_A', 'Un gestor de otra empresa no pide retirar este formato']]) {
  const r = await pedir(quien, 'retirar_formato', PLANTILLA)
  comprobar(texto, Boolean(r.error), r.error?.message)
}
const baseP = (await dueno.from('plantillas').select('id').is('empresa_id', null).eq('vigente', true).limit(1).single()).data.id
const retiraBase = await pedir('GESTOR_C1', 'retirar_formato', baseP)
comprobar('No se pide retirar un formato base de CRC', Boolean(retiraBase.error), retiraBase.error?.message)
const r4 = await pedir('GESTOR_C1', 'retirar_formato', PLANTILLA, 'Ya no se usa (ficticio)')
comprobar('El gestor pide retirar el formato', !r4.error && Boolean(r4.data), r4.error?.message)
const SOL4 = r4.data
const sol4 = await solicitud(SOL4)
comprobar('Queda pendiente, sin sede, con el nombre del formato', sol4.estado === 'pendiente' && sol4.sede_id === null && sol4.titulo.includes(nombre), sol4.titulo)
const dup4 = await pedir('GESTOR_C1', 'retirar_formato', PLANTILLA)
comprobar('No se pide dos veces', Boolean(dup4.error), dup4.error?.message)
const noSede = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: SOL4, p_aprobar: true, p_comentario: null })
comprobar('El administrador de sede no resuelve el retiro', Boolean(noSede.error), noSede.error?.message)
const ret = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: SOL4, p_aprobar: true, p_comentario: null })
comprobar('El administrador general aprueba el retiro', !ret.error, ret.error?.message)
comprobar('El formato quedó no vigente', (await dueno.from('plantillas').select('vigente').eq('id', PLANTILLA).single()).data.vigente === false)
comprobar('La solicitud quedó aprobada', (await solicitud(SOL4)).estado === 'aprobada')
const yaRetirado = await pedir('GESTOR_C1', 'retirar_formato', PLANTILLA)
comprobar('No se pide retirar uno que ya está retirado', Boolean(yaRetirado.error), yaRetirado.error?.message)

// ───────────────────────────────────────────────
seccion('7. Las demás solicitudes siguen igual y nadie escribe directo')
const lista = (await s.GESTOR_C1.from('solicitudes_cambio').select('id, tipo').in('id', [SOL1, SOL2, SOL4])).data ?? []
comprobar('El gestor ve sus 3 solicitudes de formatos', lista.length === 3)
const ins = await s.GESTOR_C1.from('solicitudes_cambio').insert({ empresa_id: D, tipo: 'publicar_formato', estado: 'aprobada', objetivo_id: v1.id, titulo: 'x', motivo: 'xxx', solicitado_por: ID.GESTOR_C1 }).select()
comprobar('Nadie inserta una solicitud directo en la tabla', Boolean(ins.error))
const upd = await s.ADMIN_C.from('solicitudes_cambio').update({ estado: 'aprobada' }).eq('id', SOL1).select()
comprobar('Nadie cambia una solicitud directo en la tabla', Boolean(upd.error) || (upd.data ?? []).length === 0)
const vista = await s.GESTOR_C1.rpc('marcar_solicitud_vista', { p_id: SOL2 })
comprobar('El gestor marca como vista la respuesta que recibió', !vista.error, vista.error?.message)
const deOtra = await s.GESTOR_A.rpc('marcar_solicitud_vista', { p_id: SOL2 })
comprobar('Un gestor de otra empresa no puede tocarla', Boolean(deOtra.error) || (await solicitud(SOL2)).visto_solicitante === true)

// Limpieza (nivel 2): las solicitudes de esta corrida se borran para que no se acumulen en la empresa D (mismo candado que facultades.mjs)
const limpieza = await dueno.rpc('limpiar_pruebas_facultades', { p_empresa: D, p_desde: INICIO })
comprobar('Limpieza: la prueba borra las solicitudes que creó en la empresa D', !limpieza.error && limpieza.data.solicitudes > 0, limpieza.error?.message)

// Informe
const informe = grupos.map((g, i) => {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  const filas = resultados.slice(g.desde, hasta)
  return `## ${g.titulo}\n\n${filas.map((r) => `- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.detalle ? ` — ${r.detalle}` : ''}`).join('\n')}\n`
}).join('\n')
mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true })
writeFileSync(new URL('./resultados/formatos-solicitudes.md', import.meta.url), `# Etapa 3: solicitudes de formatos del gestor (${HOY})\n\nEmpresa D (ficticia). Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}.\n\n${informe}`)
resumen()
