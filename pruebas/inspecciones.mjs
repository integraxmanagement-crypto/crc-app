// Prueba de inspecciones, fotos y firmas (tarea 3.4-C). Solo cuentas y datos FICTICIOS de crc-dev.
// Registra inspecciones por la misma puerta que usa la app (función registrar-inspeccion + almacén «evidencias»)
// y comprueba: una sola vez aunque se reenvíe, cálculo en el servidor, separación entre empresas, quién ve qué,
// firma desde la propia cuenta, corrección con historial y anulación. Guarda un informe en pruebas/resultados/.
// Uso: node pruebas/inspecciones.mjs   (cada corrida deja unas pocas inspecciones ficticias más)
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG_FICTICIO, cliente, comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|permission denied|row-level security/i.test(r.error?.message ?? '')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const HOY = new Date().toISOString().slice(0, 10)

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B']) {
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
const AREA_A = (await s.DUENO.from('unidades').select('id').eq('empresa_id', A).eq('nivel', 'area').limit(1).single()).data.id

// Formato de extintores de A con una versión vigente, y un extintor activo de A.
const { data: plantillasA } = await s.ADMIN_A.from('plantillas').select('id, tipo_activo_id, versiones:plantillas_versiones(id, estado, receta)')
  .eq('empresa_id', A).eq('codigo', 'extintores')
const extFormato = plantillasA.find((p) => p.versiones.some((v) => v.estado === 'vigente'))
if (!extFormato) throw new Error('Corre antes pruebas/formatos.mjs (crea y publica el formato de extintores de A).')
const extVersion = extFormato.versiones.find((v) => v.estado === 'vigente')
// Extintor ficticio al día (mantenimiento, prueba hidrostática y fabricación vigentes) para que el resultado dependa solo del checklist.
const nuevoExt = await s.ADMIN_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: {
  tipo_id: extFormato.tipo_activo_id, codigo: `EXT-INS-${randomUUID().slice(0, 6)}`, sede_id: SEDE_A,
  datos: { numero_serie: 'SER-FICTICIA', agente: 'PQS', capacidad: 6, capacidad_unidad: 'kg', anio_fabricacion: 2022,
           anio_prueba_hidrostatica: 2024, ultimo_mantenimiento: HOY.slice(0, 7) } } })
if (nuevoExt.error) throw new Error(`No se pudo crear el extintor ficticio: ${nuevoExt.error.message}`)
const activo = (await s.ADMIN_A.from('activos').select('id, codigo, numero, subtipo, datos, dotacion').eq('id', nuevoExt.data).single()).data

// Formato LOTO de A, publicado para esta prueba (se aplica a un área, con firmantes de varias cuentas).
const loto = (await s.ADMIN_A.rpc('copiar_plantilla', { p_empresa: A, p_origen: (await s.ADMIN_A.from('plantillas').select('id').is('empresa_id', null).eq('codigo', 'loto').single()).data.id })).data
const lotoV = (await s.ADMIN_A.from('plantillas_versiones').select('id, receta').eq('plantilla_id', loto).single()).data
await s.ADMIN_A.rpc('guardar_borrador', { p_version: lotoV.id, p_datos: { receta: lotoV.receta, codigo_formato: 'FIC-LOTO', version_formato: '01', fecha_aprobacion: HOY, logo: 'positivo' } })
const pub = await s.ADMIN_A.rpc('publicar_version', { p_version: lotoV.id })
if (pub.error) throw new Error(`No se pudo publicar LOTO: ${pub.error.message}`)

const todasSi = (receta) => Object.fromEntries(receta.secciones.flatMap((sec) => sec.puntos.map((p) =>
  [p.clave, { valor: p.tipo === 'cumple' || p.tipo === 'si_no' ? 'si' : p.tipo === 'numero' ? 3 : p.tipo === 'lista' ? 'Individual' : 'Dato ficticio' }])))

async function subir(c, ruta, bytes = PNG_FICTICIO, tipo = 'image/png') {
  return c.storage.from('evidencias').upload(ruta, new Blob([bytes], { type: tipo }), { contentType: tipo, upsert: false })
}

// ───────────────────────────────────────────────
seccion('1. Registrar una inspección con foto y firma, una sola vez')
const insp = randomUUID()
const foto = randomUUID()
const rutaFoto = `${A}/${insp}/${foto}.png`
const rutaFirma = `${A}/${insp}/firma-${ID.GESTOR_A}-inspector.png`
const cuerpo = {
  modo: 'registrar', id: insp, version_id: extVersion.id, sede_id: SEDE_A, activo_id: activo.id,
  activo_foto: { codigo: activo.codigo, numero: activo.numero, subtipo: activo.subtipo, datos: activo.datos, dotacion: activo.dotacion },
  respuestas: { ...todasSi(extVersion.receta), 'EXT-07': { valor: 'no' }, 'EXT-02': { valor: 'si', fotos: 9 } },
  observacion: null, fecha: HOY, iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(),
  dispositivo: 'Prueba automática', resultado: 'Conforme (lo que diga el equipo no cuenta)',
  archivos: [{ id: foto, punto_clave: 'EXT-02', fila: null, ruta: rutaFoto, bytes: PNG_FICTICIO.length, tipo_mime: 'image/png', sha256: sha(PNG_FICTICIO) }],
  firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', orden: 1, persona_id: ID.GESTOR_A }],
  mi_firma: { rol_clave: 'inspector', ruta: rutaFirma, bytes: PNG_FICTICIO.length },
}
{
  const sinFoto = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', cuerpo)
  comprobar('Si la foto todavía no llegó al almacén, el servidor pide reintentar (no graba a medias)', sinFoto.estado === 409 && sinFoto.datos?.reintentar === true, `${sinFoto.estado}`)
  const f1 = await subir(s.GESTOR_A, rutaFoto)
  comprobar('Gestor A sube la foto a la carpeta de la inspección', !f1.error, f1.error?.message)
  const f2 = await subir(s.GESTOR_A, rutaFirma)
  comprobar('Gestor A sube su firma', !f2.error, f2.error?.message)
  const otra = await subir(s.GESTOR_A, rutaFoto)
  comprobar('Una foto subida no se puede reemplazar', Boolean(otra.error))
  const r1 = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', cuerpo)
  comprobar('El servidor graba la inspección', r1.estado === 200 && r1.datos?.estado === 'grabada', JSON.stringify(r1.datos))
  const r2 = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', cuerpo)
  comprobar('Si el equipo la reenvía, responde «ya recibida» y no la duplica', r2.estado === 200 && r2.datos?.estado === 'ya_recibida', JSON.stringify(r2.datos))
  const cuenta = await s.ADMIN_A.from('inspecciones').select('id', { count: 'exact', head: true }).eq('id', insp)
  comprobar('Queda una sola inspección con ese identificador', cuenta.count === 1)
  const i = (await s.ADMIN_A.from('inspecciones').select('*').eq('id', insp).single()).data
  comprobar('El resultado lo calcula el servidor: X en un crítico → «No conforme»', i.resultado === 'No conforme', i.resultado)
  comprobar('…y nace el hallazgo de EXT-07', i.hallazgos.some((h) => h.clave === 'EXT-07'))
  comprobar('Las fotos se cuentan con lo que llegó, no con lo que dice el equipo', i.respuestas['EXT-02'].fotos === 1, `${i.respuestas['EXT-02'].fotos}`)
  comprobar('Guarda quién, cuándo (equipo y servidor) y la huella', i.inspector_id === ID.GESTOR_A && Boolean(i.cerrada_en_equipo) && Boolean(i.recibida_en) && /^[0-9a-f]{64}$/.test(i.huella))
  const fir = (await s.ADMIN_A.from('firmas').select('*').eq('inspeccion_id', insp)).data
  comprobar('La firma del inspector queda firmada, con su cuenta y la huella de lo firmado', fir.length === 1 && fir[0].estado === 'firmada' && fir[0].firmado_por === ID.GESTOR_A && fir[0].huella === i.huella)
  const arch = (await s.ADMIN_A.from('archivos').select('sha256').eq('inspeccion_id', insp)).data
  comprobar('La foto queda registrada con su huella', arch.length === 1 && arch[0].sha256 === sha(PNG_FICTICIO))
  const tarde = await subir(s.GESTOR_A, `${A}/${insp}/${randomUUID()}.png`)
  comprobar('Después de grabada, ya no se pueden agregar fotos a esa inspección', Boolean(tarde.error))
}

// ───────────────────────────────────────────────
seccion('2. Lo que el servidor no acepta')
{
  const base = { ...cuerpo, id: randomUUID(), archivos: [], mi_firma: null }
  const incompleta = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', { ...base, respuestas: { 'EXT-01': { valor: 'si' } } })
  comprobar('Una inspección incompleta se rechaza y dice qué falta', incompleta.estado === 422 && incompleta.datos?.faltan?.length > 0, `${incompleta.estado}`)
  const sinFirmante = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', { ...base, firmantes: [] })
  comprobar('Sin el firmante obligatorio se rechaza', sinFirmante.estado === 422, sinFirmante.datos?.error)
  const externo = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', { ...base, firmantes: [{ rol_clave: 'inspector', externo_nombre: 'Externo Ficticio' }] })
  comprobar('Un firmante externo donde el formato no lo permite se rechaza', externo.estado === 422, externo.datos?.error)
  const deB = await llamarFuncion(s.ADMIN_B, 'registrar-inspeccion', { ...base, id: randomUUID(), firmantes: [{ rol_clave: 'inspector', persona_id: ID.GESTOR_A }] })
  comprobar('Admin B no puede registrar con un formato de A', deB.estado === 422 || deB.estado === 403, `${deB.estado} ${deB.datos?.error}`)
  const usuario = await llamarFuncion(s.USUARIO_A2, 'registrar-inspeccion', { ...base, id: randomUUID() })
  comprobar('Usuario A2 no puede registrar inspecciones', usuario.estado === 403, `${usuario.estado}`)
  const anon = await fetch(`${(await import('./comun.mjs')).URL}/functions/v1/registrar-inspeccion`, { method: 'POST', body: '{}' })
  comprobar('Sin sesión: 401', anon.status === 401)
  const ajeno = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', cuerpo)
  comprobar('Otra cuenta no puede «reenviar» una inspección ajena', ajeno.estado === 403, `${ajeno.estado}`)
  const directo = await s.GESTOR_A.rpc('grabar_inspeccion', { p_por: ID.GESTOR_A, p_datos: { id: randomUUID() } })
  comprobar('Nadie llama directo a grabar_inspeccion (solo la función del servidor)', NO_AUTORIZADO(directo) || Boolean(directo.error), directo.error?.message)
  const insert = await s.ADMIN_A.from('inspecciones').insert({ id: randomUUID() }).select()
  comprobar('Nadie escribe directo en inspecciones', Boolean(insert.error))
  const upd = await s.DUENO.from('firmas').update({ estado: 'firmada' }).eq('inspeccion_id', insp).select()
  comprobar('Ni el dueño cambia directo una firma', Boolean(upd.error) || upd.data.length === 0)
  const fueraCarpeta = await subir(s.GESTOR_A, `${B}/${randomUUID()}/${randomUUID()}.png`)
  comprobar('Gestor A no puede subir fotos en la carpeta de la empresa B', Boolean(fueraCarpeta.error))
  const usuSube = await subir(s.USUARIO_A2, `${A}/${randomUUID()}/${randomUUID()}.png`)
  comprobar('Usuario A2 no puede subir fotos (no registra inspecciones)', Boolean(usuSube.error))
}

// ───────────────────────────────────────────────
seccion('3. Quién ve las inspecciones, las fotos y las firmas')
{
  for (const n of ['ADMIN_B', 'GESTOR_B']) {
    const v = await s[n].from('inspecciones').select('id').eq('id', insp)
    comprobar(`${n} no ve la inspección de A`, v.data?.length === 0)
    const a = await s[n].from('archivos').select('id').eq('inspeccion_id', insp)
    comprobar(`${n} no ve la ficha de la foto de A`, a.data?.length === 0)
    const d = await s[n].storage.from('evidencias').download(rutaFoto)
    comprobar(`${n} no puede descargar la foto de A`, Boolean(d.error))
  }
  const u = await s.USUARIO_A2.from('inspecciones').select('id').eq('id', insp)
  comprobar('Usuario A2 no ve una inspección donde no es firmante', u.data?.length === 0)
  const g = await s.GESTOR_A.storage.from('evidencias').download(rutaFoto)
  comprobar('Gestor A sí descarga la foto de su inspección', !g.error && (await g.data.arrayBuffer()).byteLength === PNG_FICTICIO.length)
  const anon = await cliente().storage.from('evidencias').download(rutaFoto)
  comprobar('Sin sesión no se descarga ninguna foto', Boolean(anon.error))
  const anonT = await cliente().from('inspecciones').select('id').limit(1)
  comprobar('Sin sesión no se ve ninguna inspección', Boolean(anonT.error) || anonT.data.length === 0)
}

// ───────────────────────────────────────────────
seccion('4. Firma desde la propia cuenta (LOTO, en un área)')
const insp2 = randomUUID()
{
  const receta = lotoV.receta
  const resp = { ...todasSi(receta), 'LOTO-05': { valor: 'no', accion: { texto: 'Reforzar la verificación (ficticio)', responsable: ID.USUARIO_A2, plazo: HOY } } }
  const firma = `${A}/${insp2}/firma-${ID.ADMIN_A}-responsable_registro.png`
  await subir(s.ADMIN_A, firma)
  const sinDoc = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', {
    modo: 'registrar', id: randomUUID(), version_id: lotoV.id, sede_id: SEDE_A, unidad_id: AREA_A, respuestas: resp, fecha: HOY,
    cerrada_en_equipo: new Date().toISOString(), archivos: [],
    firmantes: [
      { rol_clave: 'observado', rol_titulo: 'Trabajador observado', externo_nombre: 'Externo Sin Documento' },
      { rol_clave: 'responsable_area', rol_titulo: 'Responsable del área', persona_id: ID.USUARIO_A2 },
      { rol_clave: 'responsable_registro', rol_titulo: 'Responsable del registro', persona_id: ID.ADMIN_A },
    ],
  })
  comprobar('Un firmante externo sin documento se rechaza (se guardan nombre y documento)', sinDoc.estado === 422, sinDoc.datos?.error)
  const r = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', {
    modo: 'registrar', id: insp2, version_id: lotoV.id, sede_id: SEDE_A, unidad_id: AREA_A, respuestas: resp, fecha: HOY,
    cerrada_en_equipo: new Date().toISOString(), archivos: [],
    firmantes: [
      { rol_clave: 'observado', rol_titulo: 'Trabajador observado', externo_nombre: 'Trabajador Externo Ficticio', externo_documento: '00000000' },
      { rol_clave: 'responsable_area', rol_titulo: 'Responsable del área', persona_id: ID.USUARIO_A2 },
      { rol_clave: 'responsable_registro', rol_titulo: 'Responsable del registro', persona_id: ID.ADMIN_A },
    ],
    mi_firma: { rol_clave: 'responsable_registro', ruta: firma, bytes: PNG_FICTICIO.length },
  })
  comprobar('Admin A registra la LOTO con 3 firmantes', r.estado === 200 && r.datos?.estado === 'grabada', JSON.stringify(r.datos))
  const i = (await s.ADMIN_A.from('inspecciones').select('resultado, puntaje').eq('id', insp2).single()).data
  comprobar('LOTO con una X: No conforme y 92 % calculado en el servidor', i.resultado === 'No conforme' && i.puntaje === 92, `${i.resultado} ${i.puntaje}`)
  const f = (await s.ADMIN_A.from('firmas').select('id, rol_clave, estado, persona_id').eq('inspeccion_id', insp2)).data
  const est = Object.fromEntries(f.map((x) => [x.rol_clave, x.estado]))
  const ext = (await s.ADMIN_A.from('firmas').select('externo_nombre, externo_documento, persona_id').eq('inspeccion_id', insp2).eq('rol_clave', 'observado').single()).data
  comprobar('Del externo quedan su nombre y documento, sin cuenta de CRC', ext?.externo_nombre === 'Trabajador Externo Ficticio' && ext?.externo_documento === '00000000' && ext?.persona_id === null)
  comprobar('El externo queda «en papel», el de Admin A firmado y el del área pendiente', est.observado === 'en_papel' && est.responsable_registro === 'firmada' && est.responsable_area === 'pendiente', JSON.stringify(est))
  const vista = await s.USUARIO_A2.from('inspecciones').select('id').eq('id', insp2)
  comprobar('Usuario A2 (firmante) sí ve la inspección que debe firmar', vista.data?.length === 1)
  const pendiente = f.find((x) => x.rol_clave === 'responsable_area')
  const otraCuenta = await s.GESTOR_A.rpc('firmar_inspeccion', { p_firma: pendiente.id, p_ruta: `${A}/${insp2}/firma-${ID.USUARIO_A2}-responsable_area.png`, p_bytes: 10 })
  comprobar('Nadie puede firmar por otra persona', NO_AUTORIZADO(otraCuenta), otraCuenta.error?.message)
  const ruta = `${A}/${insp2}/firma-${ID.USUARIO_A2}-responsable_area.png`
  const sub = await subir(s.USUARIO_A2, ruta)
  comprobar('Usuario A2 sube la imagen de su firma pendiente', !sub.error, sub.error?.message)
  const ajena = await subir(s.USUARIO_A2, `${A}/${insp2}/firma-${ID.ADMIN_A}-responsable_registro.png`)
  comprobar('…pero no una firma que no es suya', Boolean(ajena.error))
  const ok = await s.USUARIO_A2.rpc('firmar_inspeccion', { p_firma: pendiente.id, p_ruta: ruta, p_bytes: PNG_FICTICIO.length })
  comprobar('Usuario A2 firma desde su cuenta', !ok.error, ok.error?.message)
  const dos = await s.USUARIO_A2.rpc('firmar_inspeccion', { p_firma: pendiente.id, p_ruta: ruta, p_bytes: PNG_FICTICIO.length })
  comprobar('No se puede firmar dos veces', Boolean(dos.error))
}

// ───────────────────────────────────────────────
seccion('5. Corregir (con historial) y anular')
{
  const antes = (await s.ADMIN_A.from('inspecciones').select('edicion, huella, respuestas').eq('id', insp).single()).data
  const nuevas = { ...antes.respuestas, 'EXT-07': { valor: 'si' } }
  const g = await llamarFuncion(s.GESTOR_A, 'registrar-inspeccion', { modo: 'corregir', id: insp, edicion: antes.edicion, motivo: 'Prueba', respuestas: nuevas })
  comprobar('Gestor A no puede corregir una inspección cerrada (solo el administrador)', g.estado === 403, `${g.estado}`)
  const c = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', { modo: 'corregir', id: insp, edicion: antes.edicion, motivo: 'Se marcó mal el precinto (ficticio)', respuestas: nuevas })
  comprobar('Admin A corrige con motivo', c.estado === 200 && c.datos?.estado === 'corregida', JSON.stringify(c.datos))
  const i = (await s.ADMIN_A.from('inspecciones').select('edicion, huella, resultado').eq('id', insp).single()).data
  comprobar('El servidor recalcula (ahora «Conforme») y sube la edición', i.resultado === 'Conforme' && i.edicion === antes.edicion + 1, `${i.resultado} ${i.edicion}`)
  const hist = (await s.ADMIN_A.from('inspecciones_ediciones').select('antes, motivo').eq('inspeccion_id', insp)).data
  comprobar('La versión anterior queda guardada con su motivo', hist.length === 1 && hist[0].antes.resultado === 'No conforme' && hist[0].motivo.includes('precinto'))
  const firma = (await s.ADMIN_A.from('firmas').select('huella').eq('inspeccion_id', insp).single()).data
  comprobar('La firma anterior queda sobre la versión anterior (su huella ya no coincide)', firma.huella === antes.huella && firma.huella !== i.huella)
  const viejo = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', { modo: 'corregir', id: insp, edicion: antes.edicion, motivo: 'Otra', respuestas: nuevas })
  comprobar('Si alguien la cambió antes, la corrección se rechaza («vuelve a abrirla»)', viejo.estado === 422 && /cambió antes/.test(viejo.datos?.error ?? ''), viejo.datos?.error)
  const gA = await s.GESTOR_A.rpc('anular_inspeccion', { p_id: insp2, p_motivo: 'Prueba' })
  comprobar('Gestor A no puede anular', NO_AUTORIZADO(gA), gA.error?.message)
  const bA = await s.ADMIN_B.rpc('anular_inspeccion', { p_id: insp2, p_motivo: 'Prueba' })
  comprobar('Admin B no puede anular una inspección de A', NO_AUTORIZADO(bA), bA.error?.message)
  const an = await s.ADMIN_A.rpc('anular_inspeccion', { p_id: insp2, p_motivo: 'Registro de prueba (ficticio)' })
  comprobar('Admin A anula con motivo', !an.error, an.error?.message)
  const sigue = (await s.ADMIN_A.from('inspecciones').select('estado').eq('id', insp2).single()).data
  comprobar('La inspección anulada no se borra', sigue.estado === 'anulada')
}

// ───────────────────────────────────────────────
seccion('6. Espacio usado según el plan')
{
  const u = (await s.ADMIN_A.rpc('uso_almacenamiento', { p_empresa: A })).data?.[0]
  comprobar('Admin A ve el espacio usado y el tope de su plan (250 MB en el gratuito)', u && u.usado > 0 && Number(u.tope) === 262144000, JSON.stringify(u))
  const b = (await s.ADMIN_B.rpc('uso_almacenamiento', { p_empresa: A })).data
  comprobar('Admin B no ve el espacio de A', !b?.length)
}

const fallas = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = [
  '# Inspecciones, fotos y firmas (tarea 3.4-C)',
  '',
  `Fecha: ${new Date().toISOString().slice(0, 10)} · Resultado: **${resultados.length - fallas} de ${resultados.length}** · Cuentas y datos ficticios de crc-dev.`,
  '',
]
for (const [i, g] of grupos.entries()) {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  lineas.push(`## ${g.titulo}`, '', '| Prueba | Resultado |', '|---|---|')
  for (const r of resultados.slice(g.desde, hasta)) lineas.push(`| ${r.nombre} | ${r.paso ? '✅' : `❌ ${String(r.detalle).replace(/\|/g, '/')}`} |`)
  lineas.push('')
}
writeFileSync('pruebas/resultados/inspecciones.md', lineas.join('\n'))
process.exit(fallas ? 1 : 0)
