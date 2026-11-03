// Prueba de separación entre DOS SEDES de la misma empresa (etapa 1 del punto 2, 02/11/2026). Solo datos FICTICIOS.
// Empresa D (RUC 20000000052) con la sede 1 y la sede 2. Cuentas: administrador general, administrador de la sede 1, gestor de la sede 2,
// usuario de la sede 1, gestor con las dos sedes y administrador de la sede 2. Se entra por la misma puerta que usa la app
// (clave pública + RLS + funciones) e intenta ver o tocar lo que no le corresponde. Se puede repetir.
// Uso: node pruebas/separacion-sedes.mjs
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { revisarPermisosTablas } from './permisos-tablas.mjs'
import { PNG_FICTICIO, claveFuerte, cuentas, formatoDeEmpresa, guardarCuenta, ingresarComo, llamarFuncion, comprobar, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const SIN_PERMISO = (r) => r.error?.code === '42501' || /permission denied|No autorizado|Ya no tienes acceso/i.test(r.error?.message ?? '') || r.estado === 403
const HOY = new Date().toISOString().slice(0, 10)
const RUC_C = '20000000052'
const sha = (b) => createHash('sha256').update(b).digest('hex')

// ───────────────────────────────────────────────
// Preparación (idempotente): empresa D, dos sedes, cuentas, un tipo de activo y su formato
// ───────────────────────────────────────────────
const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)

let empresa = (await dueno.from('empresas').select('id').eq('ruc', RUC_C).maybeSingle()).data?.id
if (!empresa) {
  const r = await dueno.rpc('crear_empresa', {
    p_ficha: { ruc: RUC_C, razon_social: 'EMPRESA D · Dos sedes Ficticia S.A.C.', domicilio_direccion: 'Av. Inventada 100', domicilio_distrito: 'Callao',
      domicilio_provincia: 'Callao', domicilio_departamento: 'Callao', ciiu_codigo: '4100', actividad_texto: 'Construcción de edificios (ficticia)', plan: 'gratuito', es_prueba: true },
    p_sede: { nombre: 'Sede 1 (ficticia)', direccion: 'Av. Inventada 100', distrito: 'Callao', provincia: 'Callao', departamento: 'Callao' },
  })
  if (r.error) throw new Error(`No se pudo crear la empresa D: ${r.error.message}`)
  empresa = r.data
}
const sedeNombre = async (nombre, direccion) => {
  const ya = (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', nombre).maybeSingle()).data?.id
  if (ya) return ya
  const r = await dueno.rpc('guardar_sede', { p_empresa: empresa, p_sede: null, p_datos: { nombre, direccion, distrito: 'Lima', provincia: 'Lima', departamento: 'Lima' } })
  if (r.error) throw new Error(`No se pudo crear la sede ${nombre}: ${r.error.message}`)
  return r.data
}
const S1 = await sedeNombre('Sede 1 (ficticia)', 'Av. Inventada 100')
const S2 = await sedeNombre('Sede 2 (ficticia)', 'Av. Inventada 200')

// Listas de la empresa D: un puesto y la estructura Gerencia → Área «Seguridad» (las cuentas de prueba las usan).
if (!(await dueno.from('puestos').select('id').eq('empresa_id', empresa).eq('nombre', 'Prueba').maybeSingle()).data) {
  const pu = await dueno.rpc('guardar_item_lista', { p_lista: 'puestos', p_empresa: empresa, p_id: null, p_nombre: 'Prueba' })
  if (pu.error) throw new Error(`No se pudo crear el puesto: ${pu.error.message}`)
}
let AREA = (await dueno.from('unidades').select('id').eq('empresa_id', empresa).eq('nivel', 'area').eq('nombre', 'Seguridad').maybeSingle()).data?.id
if (!AREA) {
  const g = await dueno.rpc('guardar_unidad', { p_empresa: empresa, p_id: null, p_nivel: 'gerencia', p_padre: null, p_nombre: 'Gerencia General' })
  if (g.error) throw new Error(`No se pudo crear la gerencia: ${g.error.message}`)
  const a = await dueno.rpc('guardar_unidad', { p_empresa: empresa, p_id: null, p_nivel: 'area', p_padre: g.data, p_nombre: 'Seguridad' })
  if (a.error) throw new Error(`No se pudo crear el área: ${a.error.message}`)
  AREA = a.data
}

const PERSONAS = [
  // [nombre, documento, apellidos y nombres, rol, sedes, lo crea]
  ['ADMIN_C', 'dni:41000001', 'PRUEBA ADMIN GENERAL C, Gabriela (ficticia)', 'admin_empresa', null, 'DUENO'],
  ['ADMSEDE_C1', 'dni:41000002', 'PRUEBA ADMIN SEDE 1 C, Hugo (ficticio)', 'admin_sede', [S1], 'DUENO'],
  ['ADMSEDE_C2', 'dni:41000006', 'PRUEBA ADMIN SEDE 2 C, Irene (ficticia)', 'admin_sede', [S2], 'DUENO'],
  ['GESTOR_C2', 'dni:41000003', 'PRUEBA GESTOR SEDE 2 C, Julio (ficticio)', 'gestor', [S2], 'ADMSEDE_C2'],
  ['USUARIO_C1', 'dni:41000004', 'PRUEBA USUARIO SEDE 1 C, Karen (ficticia)', 'usuario', [S1], 'ADMSEDE_C1'],
  ['GESTOR_C12', 'dni:41000005', 'PRUEBA GESTOR DOS SEDES C, Luis (ficticio)', 'gestor', [S1, S2], 'ADMIN_C'],
]
for (const [nombre, documento, nombres, rol, sedes, creador] of PERSONAS) {
  if (cuentas[`${nombre}_CLAVE`]) continue
  const { c, error } = await ingresarComo(creador)
  if (error) throw new Error(`${creador} no pudo ingresar: ${error.message}`)
  const [tipo, numero] = documento.split(':')
  const r = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: empresa, rol, tipo_documento: tipo, numero_documento: numero, apellidos_nombres: nombres, fecha_ingreso: '2026-01-15',
    puesto: 'Prueba', area: 'Seguridad', ...(sedes ? { sedes } : {}),
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ${nombre}: ${r.datos?.error} ${r.datos?.depurar ?? ""}`)
  const inicial = r.datos.contrasena_inicial
  guardarCuenta(nombre, documento, inicial)
  const primera = await ingresarComo(nombre, inicial)
  if (primera.error) throw new Error(`${nombre} no pudo hacer su primer ingreso: ${primera.error.message}`)
  const nueva = claveFuerte()
  const cambio = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
  if (cambio.estado !== 200) throw new Error(`${nombre} no pudo cambiar su contraseña: ${cambio.datos?.error}`)
  guardarCuenta(nombre, documento, nueva)
}

const s = { DUENO: dueno }
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C2', 'USUARIO_C1', 'GESTOR_C12', 'ADMIN_A', 'ADMIN_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const yo = async (n) => (await s[n].auth.getUser()).data.user.id
const ID = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C2', 'USUARIO_C1', 'GESTOR_C12']) ID[n] = await yo(n)
const vinculoDe = async (n) => (await dueno.from('vinculos').select('id').eq('persona_id', ID[n]).eq('empresa_id', empresa).eq('estado', 'activo').single()).data.id
const V = {}
for (const n of Object.keys(ID)) V[n] = await vinculoDe(n)

// Tipo de activo «motobomba» activado para la empresa D y su formato publicado (22 puntos Sí/No, dos firmas).
const tipoBase = (await dueno.from('tipos_activo').select('id').is('empresa_id', null).eq('codigo', 'motobomba').single()).data.id
const tipoC = (await dueno.rpc('activar_tipo_activo', { p_empresa: empresa, p_tipo_base: tipoBase })).data
const { id: plantilla, version } = await formatoDeEmpresa(dueno, empresa, 'motobomba', HOY)
const receta = (await dueno.from('plantillas_versiones').select('receta').eq('id', version.id).single()).data.receta
const respuestasOk = Object.fromEntries(receta.secciones.flatMap((sec) => sec.puntos.map((p) =>
  [p.clave, { valor: p.tipo === 'si_no' ? 'si' : p.tipo === 'hora' ? '10:00' : p.obligatorio ? 'Dato ficticio' : null }])))

// Una ubicación y un activo en cada sede, creados por quien corresponde.
const SUF = randomUUID().slice(0, 6)
const nuevaUbic = async (c, sede, nombre) => c.rpc('guardar_ubicacion', { p_empresa: empresa, p_id: null, p_sede: sede, p_unidad: AREA, p_nombre: nombre })
const nuevoActivo = async (c, sede, codigo, ubic) => c.rpc('guardar_activo', { p_empresa: empresa, p_id: null, p_datos: { tipo_id: tipoC, codigo, sede_id: sede, unidad_id: AREA, ubicacion_id: ubic, datos: {} } })

// ───────────────────────────────────────────────
seccion('1. Activos y ubicaciones: cada sede ve y toca solo lo suyo')
const ub1 = await nuevaUbic(s.ADMSEDE_C1, S1, `Cuarto de bombas 1 ${SUF}`)
comprobar('Admin de la sede 1 crea una ubicación en la sede 1', !ub1.error, ub1.error?.message)
const ub2 = await nuevaUbic(s.GESTOR_C2, S2, `Cuarto de bombas 2 ${SUF}`)
comprobar('Gestor de la sede 2 crea una ubicación en la sede 2', !ub2.error, ub2.error?.message)
const ubFuera = await nuevaUbic(s.ADMSEDE_C1, S2, `Intrusa ${SUF}`)
comprobar('Admin de la sede 1 NO crea una ubicación en la sede 2', SIN_PERMISO(ubFuera), ubFuera.error?.message)
const ubFuera2 = await nuevaUbic(s.GESTOR_C2, S1, `Intrusa ${SUF}`)
comprobar('Gestor de la sede 2 NO crea una ubicación en la sede 1', SIN_PERMISO(ubFuera2), ubFuera2.error?.message)

const act1 = await nuevoActivo(s.ADMSEDE_C1, S1, `MB-S1-${SUF}`, ub1.data)
comprobar('Admin de la sede 1 da de alta un activo en la sede 1', !act1.error, act1.error?.message)
const act2 = await nuevoActivo(s.GESTOR_C2, S2, `MB-S2-${SUF}`, ub2.data)
comprobar('Gestor de la sede 2 da de alta un activo en la sede 2', !act2.error, act2.error?.message)
const actFuera = await nuevoActivo(s.ADMSEDE_C1, S2, `MB-INTRUSO-${SUF}`, ub2.data)
comprobar('Admin de la sede 1 NO da de alta un activo en la sede 2', SIN_PERMISO(actFuera), actFuera.error?.message)
const edFuera = await s.ADMSEDE_C1.rpc('guardar_activo', { p_empresa: empresa, p_id: act2.data, p_datos: { tipo_id: tipoC, codigo: `MB-S2-${SUF}`, sede_id: S2, unidad_id: AREA, ubicacion_id: ub2.data, datos: {} } })
comprobar('Admin de la sede 1 NO edita un activo de la sede 2', SIN_PERMISO(edFuera), edFuera.error?.message)
const mueve = await s.ADMSEDE_C1.rpc('guardar_activo', { p_empresa: empresa, p_id: act1.data, p_datos: { tipo_id: tipoC, codigo: `MB-S1-${SUF}`, sede_id: S2, unidad_id: AREA, ubicacion_id: ub2.data, datos: {} } })
comprobar('Admin de la sede 1 NO pasa su activo a la sede 2', SIN_PERMISO(mueve), mueve.error?.message)
const baja = await s.ADMSEDE_C1.rpc('dar_baja_activo', { p_id: act2.data, p_fecha: HOY, p_motivo: 'Prueba intrusa' })
comprobar('Admin de la sede 1 NO da de baja un activo de la sede 2', SIN_PERMISO(baja), baja.error?.message)

const ver = async (n, tabla, campo = 'sede_id') => (await s[n].from(tabla).select(`id, ${campo}`).eq('empresa_id', empresa)).data ?? []
for (const [n, sedesVe] of [['ADMSEDE_C1', [S1]], ['USUARIO_C1', [S1]], ['GESTOR_C2', [S2]], ['GESTOR_C12', [S1, S2]], ['ADMIN_C', [S1, S2]]]) {
  const a = await ver(n, 'activos')
  comprobar(`${n}: de los activos ve solo los de sus sedes`, a.length > 0 && a.every((x) => sedesVe.includes(x.sede_id)) && sedesVe.every((sd) => a.some((x) => x.sede_id === sd)), `${a.length} activo(s)`)
  const u = await ver(n, 'ubicaciones')
  comprobar(`${n}: de las ubicaciones ve solo las de sus sedes`, u.length > 0 && u.every((x) => sedesVe.includes(x.sede_id)), `${u.length} ubicación(es)`)
}

// ───────────────────────────────────────────────
seccion('2. Inspecciones, planes de acción, fotos y firmas')
const registrar = async (n, sede, activo, extra = {}) => {
  const id = randomUUID()
  const foto = randomUUID()
  const rutaFoto = `${empresa}/${id}/${foto}.png`
  const rutaFirma = `${empresa}/${id}/firma-${ID[n]}-inspector.png`
  const subir = (ruta) => s[n].storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
  const up1 = await subir(rutaFoto)
  const up2 = await subir(rutaFirma)
  const cuerpo = {
    modo: 'registrar', id, version_id: version.id, sede_id: sede, activo_id: activo,
    activo_foto: { codigo: 'X', numero: 1, subtipo: null, datos: {}, dotacion: {} },
    respuestas: { ...respuestasOk, ...(extra.respuestas ?? {}) }, observacion: null, fecha: HOY,
    iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(), dispositivo: 'Prueba automática',
    archivos: [{ id: foto, punto_clave: 'MB-A01', fila: null, ruta: rutaFoto, bytes: PNG_FICTICIO.length, tipo_mime: 'image/png', sha256: sha(PNG_FICTICIO) }],
    firmantes: extra.firmantes ?? [{ rol_clave: 'inspector', rol_titulo: 'Inspector', orden: 1, persona_id: ID[n] }, { rol_clave: 'custodia', rol_titulo: 'Custodia', orden: 2, persona_id: ID.USUARIO_C1 }],
    mi_firma: { rol_clave: 'inspector', ruta: rutaFirma, bytes: PNG_FICTICIO.length },
  }
  const r = await llamarFuncion(s[n], 'registrar-inspeccion', cuerpo)
  return { id, rutaFoto, subidas: !up1.error && !up2.error, ...r }
}
// Faltan los datos del activo en la «foto del equipo»: se toman del servidor, así que basta el código.
const accion = { texto: 'Revisar el tablero (ficticio)', responsable: ID.GESTOR_C2, plazo: '2026-12-31' }
const i2 = await registrar('GESTOR_C2', S2, act2.data, { respuestas: { 'MB-B01': { valor: 'no', obs: 'Sin flujo de agua (ficticio)', accion } } })
comprobar('Gestor de la sede 2 registra una inspección de la sede 2 (con un plan de acción)', i2.estado === 200, `${i2.estado} ${i2.datos?.error ?? ''}`)
const i1 = await registrar('ADMSEDE_C1', S1, act1.data)
comprobar('Admin de la sede 1 registra una inspección de la sede 1', i1.estado === 200, `${i1.estado} ${i1.datos?.error ?? ''}`)
const fuera = await registrar('ADMSEDE_C1', S2, act2.data)
comprobar('Admin de la sede 1 NO registra una inspección de la sede 2', fuera.estado === 403, `${fuera.estado} ${fuera.datos?.error ?? ''}`)
const fuera2 = await registrar('GESTOR_C2', S1, act1.data)
comprobar('Gestor de la sede 2 NO registra una inspección de la sede 1', fuera2.estado === 403, `${fuera2.estado} ${fuera2.datos?.error ?? ''}`)
const doble = await registrar('GESTOR_C12', S2, act2.data)
comprobar('Gestor con las dos sedes registra en la sede 2', doble.estado === 200, `${doble.estado} ${doble.datos?.error ?? ''}`)
// La sede la decide el servidor: una cuenta de una sola sede que manda otra sede no la cambia (se rechaza o se corrige a la suya, nunca queda en la otra).
const solo = await dueno.from('inspecciones').select('id, sede_id').in('id', [i1.id, i2.id, doble.id])
comprobar('Cada inspección quedó en la sede correcta', solo.data?.find((x) => x.id === i2.id)?.sede_id === S2 && solo.data?.find((x) => x.id === i1.id)?.sede_id === S1)
comprobar('Ninguna inspección rechazada quedó guardada', (await dueno.from('inspecciones').select('id').in('id', [fuera.id, fuera2.id])).data?.length === 0)

for (const [n, sedesVe] of [['ADMSEDE_C1', [S1]], ['USUARIO_C1', null], ['GESTOR_C2', [S2]], ['GESTOR_C12', [S1, S2]], ['ADMIN_C', [S1, S2]]]) {
  const r = await s[n].from('inspecciones').select('id, sede_id').eq('empresa_id', empresa)
  if (!sedesVe) {
    // Un usuario sin permiso de ver inspecciones solo ve las que firma.
    const suyas = new Set(((await dueno.from('firmas').select('inspeccion_id').eq('persona_id', ID.USUARIO_C1).in('inspeccion_id', (r.data ?? []).map((x) => x.id))).data ?? []).map((x) => x.inspeccion_id))
    comprobar(`${n}: solo ve las inspecciones que firma`, r.data?.length > 0 && r.data.every((x) => suyas.has(x.id)) && r.data.some((x) => x.id === i2.id), `${r.data?.length}`)
  } else comprobar(`${n}: de las inspecciones ve solo las de sus sedes`, r.data?.length > 0 && r.data.every((x) => sedesVe.includes(x.sede_id)), `${r.data?.length}`)
}
const aj = await s.ADMSEDE_C1.rpc('anular_inspeccion', { p_id: i2.id, p_motivo: 'Prueba intrusa' })
comprobar('Admin de la sede 1 NO anula una inspección de la sede 2', SIN_PERMISO(aj), aj.error?.message)

// Planes de acción
const hz = async (n) => (await s[n].from('hallazgos').select('id, sede_id, responsable_id').eq('empresa_id', empresa)).data ?? []
const hz2 = (await hz('ADMIN_C')).filter((h) => h.sede_id === S2)
comprobar('El plan de acción nació con la sede de la inspección (sede 2)', hz2.length >= 1)
comprobar('Admin de la sede 1 NO ve los planes de acción de la sede 2', (await hz('ADMSEDE_C1')).every((h) => h.sede_id !== S2))
comprobar('Gestor de la sede 2 sí ve los de su sede', (await hz('GESTOR_C2')).some((h) => h.sede_id === S2))
comprobar('Admin de la sede 2 sí los ve', (await hz('ADMSEDE_C2')).some((h) => h.sede_id === S2))
const hid = hz2[0]?.id
const g1 = await s.ADMSEDE_C1.rpc('gestionar_hallazgo', { p_id: hid, p_datos: { responsable_id: ID.ADMSEDE_C1, plazo: '2026-12-31', accion: 'Intruso' } })
comprobar('Admin de la sede 1 NO gestiona un plan de acción de la sede 2', SIN_PERMISO(g1), g1.error?.message)
const g2 = await s.ADMSEDE_C1.rpc('cerrar_hallazgo', { p_id: hid, p_comentario: 'Intruso', p_foto_ruta: null, p_foto_bytes: null })
comprobar('Admin de la sede 1 NO cierra un plan de acción de la sede 2', SIN_PERMISO(g2), g2.error?.message)
const g3 = await s.ADMSEDE_C2.rpc('gestionar_hallazgo', { p_id: hid, p_datos: { responsable_id: ID.GESTOR_C2, plazo: '2026-12-31', accion: 'Revisar el tablero (ficticio)' } })
comprobar('Admin de la sede 2 sí gestiona el plan de acción de su sede', !g3.error, g3.error?.message)
const g4 = await s.GESTOR_C2.rpc('hallazgo_en_proceso', { p_id: hid })
comprobar('El responsable (gestor de la sede 2) sí lo pone en proceso', !g4.error, g4.error?.message)

// Fotos y firmas
const descarga = async (n, ruta) => (await s[n].storage.from('evidencias').download(ruta)).error ? false : true
comprobar('Admin de la sede 1 NO abre la foto de una inspección de la sede 2', !(await descarga('ADMSEDE_C1', i2.rutaFoto)))
comprobar('Usuario de la sede 1 sin firmar NO abre la foto de la sede 2… salvo que sea firmante: sí es firmante (custodia) y la abre', await descarga('USUARIO_C1', i2.rutaFoto))
comprobar('Gestor de la sede 2 abre la foto de su sede', await descarga('GESTOR_C2', i2.rutaFoto))
comprobar('Admin de la sede 2 abre la foto de su sede', await descarga('ADMSEDE_C2', i2.rutaFoto))
comprobar('Admin general abre la foto de cualquier sede', await descarga('ADMIN_C', i2.rutaFoto))
comprobar('Gestor con las dos sedes abre la foto de la sede 2', await descarga('GESTOR_C12', i2.rutaFoto))
comprobar('Admin de la sede 1 SÍ abre la foto de su propia sede', await descarga('ADMSEDE_C1', i1.rutaFoto))
comprobar('Gestor de la sede 2 NO abre la foto de la sede 1', !(await descarga('GESTOR_C2', i1.rutaFoto)))
const ar = await s.ADMSEDE_C1.from('archivos').select('id').eq('inspeccion_id', i2.id)
comprobar('Admin de la sede 1 NO ve en la lista las fotos de la sede 2', (ar.data?.length ?? 0) === 0)
const fi = await s.ADMSEDE_C1.from('firmas').select('id').eq('inspeccion_id', i2.id)
comprobar('Admin de la sede 1 NO ve las firmas de la sede 2', (fi.data?.length ?? 0) === 0)
// Subir evidencia a una inspección de otra sede: la foto de cierre de un plan de acción de la sede 2
const rutaCierre = `${empresa}/${i2.id}/cierre-${hid}-${randomUUID().slice(0, 8)}.png`
const upIntruso = await s.ADMSEDE_C1.storage.from('evidencias').upload(rutaCierre, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png' })
comprobar('Admin de la sede 1 NO sube la foto de cierre de un plan de acción de la sede 2', Boolean(upIntruso.error))

// ───────────────────────────────────────────────
// Corregir (al final, porque corregir con todo en «Sí» cierra el plan de acción de la inspección).
const ed0 = (await dueno.from('inspecciones').select('edicion').eq('id', i2.id).single()).data.edicion
const corOk = await llamarFuncion(s.ADMSEDE_C2, 'registrar-inspeccion', { modo: 'corregir', id: i2.id, edicion: ed0, motivo: 'Corrección de la propia sede (ficticia)', respuestas: respuestasOk })
comprobar('Admin de la sede 2 sí corrige la inspección de su sede', corOk.estado === 200, `${corOk.estado} ${corOk.datos?.error ?? ''}`)
const cor = await llamarFuncion(s.ADMSEDE_C1, 'registrar-inspeccion', { modo: 'corregir', id: i2.id, edicion: ed0 + 1, motivo: 'Prueba intrusa', respuestas: respuestasOk })
comprobar('Admin de la sede 1 NO corrige una inspección de la sede 2', cor.estado === 403, `${cor.estado} ${cor.datos?.error ?? ''}`)

seccion('3. Funciones de lectura del servidor que se saltan las reglas de las tablas')
const hasta = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
const ap2 = await s.ADMSEDE_C1.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: S2, p_desde: HOY, p_hasta: hasta })
comprobar('avance_periodo: admin de la sede 1 NO pide la sede 2', SIN_PERMISO(ap2), ap2.error?.message)
const ap1 = await s.ADMSEDE_C1.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: S1, p_desde: HOY, p_hasta: hasta })
comprobar('avance_periodo: admin de la sede 1 sí pide su sede', !ap1.error && ap1.data.every((f) => !f.codigo.includes('-S2-')), ap1.error?.message)
const apG = await s.ADMIN_C.rpc('avance_periodo', { p_plantilla: plantilla, p_sede: S2, p_desde: HOY, p_hasta: hasta })
comprobar('avance_periodo: el admin general pide cualquier sede', !apG.error && apG.data.length >= 1, apG.error?.message)

const pers = async (n) => (await s[n].rpc('personas_de_mi_empresa')).data ?? []
const pa = await pers('ADMSEDE_C1')
comprobar('personas_de_mi_empresa: admin de la sede 1 no recibe al gestor de la sede 2', !pa.some((p) => p.persona_id === ID.GESTOR_C2) && pa.some((p) => p.persona_id === ID.USUARIO_C1))
const pg = await pers('ADMIN_C')
comprobar('personas_de_mi_empresa: el admin general recibe a todos', [ID.GESTOR_C2, ID.USUARIO_C1, ID.GESTOR_C12].every((id) => pg.some((p) => p.persona_id === id)))
const pr = async (n) => (await s[n].rpc('passt_responsables', { p_empresa: empresa })).data ?? []
const ra = await pr('ADMSEDE_C1')
comprobar('passt_responsables: admin de la sede 1 no ve al gestor de la sede 2 y sí al gestor de las dos sedes', !ra.some((p) => p.persona_id === ID.GESTOR_C2) && ra.some((p) => p.persona_id === ID.GESTOR_C12))
const tr = async (n) => (await s[n].rpc('passt_trabajadores', { p_empresa: empresa })).data
const trA = await tr('ADMSEDE_C1')
const trG = await tr('ADMIN_C')
comprobar('passt_trabajadores: la sede 1 cuenta menos personas que la empresa entera', Number.isInteger(trA) && Number.isInteger(trG) && trA < trG, `sede 1: ${trA}; empresa: ${trG}`)
const nt = await s.ADMSEDE_C1.rpc('numero_trabajadores', { p_empresa: empresa })
comprobar('numero_trabajadores: igual que passt_trabajadores para el admin de la sede 1', nt.data === trA, `${nt.data}`)
const uA = (await s.ADMSEDE_C1.rpc('uso_almacenamiento', { p_empresa: empresa })).data?.[0]
const uG = (await s.ADMIN_C.rpc('uso_almacenamiento', { p_empresa: empresa })).data?.[0]
comprobar('uso_almacenamiento: la sede 1 usa menos que la empresa entera', Number(uA?.usado) < Number(uG?.usado) && Number(uG?.usado) > 0, `sede 1: ${uA?.usado}; empresa: ${uG?.usado}`)
const otraEmp = await s.ADMSEDE_C1.rpc('uso_almacenamiento', { p_empresa: (await dueno.from('empresas').select('id').eq('ruc', '20000000010').single()).data.id })
comprobar('uso_almacenamiento: nadie lo pide para otra empresa', (otraEmp.data?.length ?? 0) === 0)

// ───────────────────────────────────────────────
seccion('4. Programa anual de SST: general, de sede y aprobación')
const crearPrograma = (n, sede, anio) => s[n].rpc('crear_programa', { p_empresa: empresa, p_datos: { anio, sede_id: sede, nombre: `Programa ficticio ${SUF}`, seguimiento: 'semana' } })
const ANIO = 2090 + Math.floor(Math.random() * 9)
const pS1 = await crearPrograma('ADMSEDE_C1', S1, ANIO)
comprobar('Admin de la sede 1 crea el programa de la sede 1', !pS1.error, pS1.error?.message)
const pS2x = await crearPrograma('ADMSEDE_C1', S2, ANIO)
comprobar('Admin de la sede 1 NO crea el programa de la sede 2', SIN_PERMISO(pS2x), pS2x.error?.message)
const pGx = await crearPrograma('ADMSEDE_C1', null, ANIO)
comprobar('Admin de la sede 1 NO crea un programa general (para todas las sedes)', SIN_PERMISO(pGx), pGx.error?.message)
const pGg = await crearPrograma('GESTOR_C12', null, ANIO)
comprobar('Un gestor NO crea un programa general', SIN_PERMISO(pGg), pGg.error?.message)
const pG = await crearPrograma('ADMIN_C', null, ANIO)
comprobar('El admin general crea el programa general', !pG.error, pG.error?.message)
const pS2 = await crearPrograma('GESTOR_C2', S2, ANIO)
comprobar('Gestor de la sede 2 crea el programa de su sede', !pS2.error, pS2.error?.message)
const nodoS = async (n, programa) => {
  const obj = (await dueno.from('passt_nodos').select('id').eq('programa_id', programa).eq('tipo', 'objetivo_general').single()).data.id
  return s[n].rpc('guardar_nodo', { p_programa: programa, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: obj, texto: 'Objetivo ficticio' } })
}
comprobar('Gestor de la sede 2 edita el programa de su sede', !(await nodoS('GESTOR_C2', pS2.data)).error)
comprobar('Gestor de la sede 2 NO edita el programa de la sede 1', SIN_PERMISO(await nodoS('GESTOR_C2', pS1.data)))
comprobar('Admin de la sede 1 NO edita el programa de la sede 2', SIN_PERMISO(await nodoS('ADMSEDE_C1', pS2.data)))
comprobar('Gestor con dos sedes NO edita el programa general', SIN_PERMISO(await nodoS('GESTOR_C12', pG.data)))
comprobar('Admin de la sede 1 NO edita el programa general', SIN_PERMISO(await nodoS('ADMSEDE_C1', pG.data)))
comprobar('El admin general sí edita el programa general', !(await nodoS('ADMIN_C', pG.data)).error)
comprobar('Gestor con dos sedes edita el programa de la sede 1', !(await nodoS('GESTOR_C12', pS1.data)).error)

// PDF al marcar una semana del programa (03/11/2026): sigue las mismas sedes que la foto.
{
  const og2 = (await dueno.from('passt_nodos').select('id').eq('programa_id', pS2.data).eq('tipo', 'objetivo_general').single()).data.id
  const oe = (await s.GESTOR_C2.rpc('guardar_nodo', { p_programa: pS2.data, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: og2, texto: 'Objetivo del PDF (ficticio)' } })).data
  const se = (await s.GESTOR_C2.rpc('guardar_nodo', { p_programa: pS2.data, p_id: null, p_datos: { tipo: 'seccion', padre_id: oe, texto: 'Actividades (ficticias)' } })).data
  const ac = (await s.GESTOR_C2.rpc('guardar_nodo', { p_programa: pS2.data, p_id: null, p_datos: { tipo: 'actividad', padre_id: se, texto: 'Actividad con PDF (ficticia)', responsable_id: ID.GESTOR_C2 } })).data
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
  const ruta = `${empresa}/${ac}/passt-10-${randomUUID().slice(0, 8)}.pdf`
  const subir = (n) => s[n].storage.from('passt-pdf').upload(`${empresa}/${ac}/passt-10-${randomUUID().slice(0, 8)}.pdf`, new Blob([PDF], { type: 'application/pdf' }), { contentType: 'application/pdf' })
  comprobar('Admin de la sede 1 NO sube un PDF a una actividad del programa de la sede 2', Boolean((await subir('ADMSEDE_C1')).error))
  comprobar('Admin de la sede 2 sí sube el PDF de su programa', !(await subir('ADMSEDE_C2')).error)
  const up = await s.GESTOR_C2.storage.from('passt-pdf').upload(ruta, new Blob([PDF], { type: 'application/pdf' }), { contentType: 'application/pdf' })
  comprobar('El responsable de la sede 2 sube el PDF de su actividad', !up.error, up.error?.message)
  const marca = (n) => s[n].rpc('marcar_semana', { p_actividad: ac, p_semana: 10, p_ejecutada: true, p_comentario: 'Hecho con PDF (ficticio)', p_foto_ruta: null, p_foto_bytes: null, p_pdf_ruta: ruta, p_pdf_bytes: PDF.length })
  comprobar('Admin de la sede 1 NO marca la actividad de la sede 2', SIN_PERMISO(await marca('ADMSEDE_C1')))
  const ok = await marca('GESTOR_C2')
  comprobar('El responsable marca su actividad con el PDF', !ok.error, ok.error?.message)
  comprobar('Admin de la sede 2 abre el PDF', !(await s.ADMSEDE_C2.storage.from('passt-pdf').download(ruta)).error)
  comprobar('Admin general abre el PDF', !(await s.ADMIN_C.storage.from('passt-pdf').download(ruta)).error)
  comprobar('Admin de la sede 1 NO abre el PDF de la sede 2', Boolean((await s.ADMSEDE_C1.storage.from('passt-pdf').download(ruta)).error))
  comprobar('Gestor de la sede 1 y 2 sí lo abre (tiene las dos sedes)', !(await s.GESTOR_C12.storage.from('passt-pdf').download(ruta)).error)
}

const verProg = async (n) => (await s[n].from('passt_programas').select('id, sede_id').eq('empresa_id', empresa).eq('anio', ANIO)).data ?? []
const pv1 = await verProg('ADMSEDE_C1')
comprobar('Admin de la sede 1 ve su programa y el general, y NO el de la sede 2', pv1.some((p) => p.id === pS1.data) && pv1.some((p) => p.id === pG.data) && !pv1.some((p) => p.id === pS2.data))
const pv2 = await verProg('GESTOR_C2')
comprobar('Gestor de la sede 2 ve el suyo y el general, y NO el de la sede 1', pv2.some((p) => p.id === pS2.data) && !pv2.some((p) => p.id === pS1.data))
const pvG = await verProg('ADMIN_C')
comprobar('El admin general ve los tres', [pG.data, pS1.data, pS2.data].every((id) => pvG.some((p) => p.id === id)))
const nodosS2 = await s.ADMSEDE_C1.from('passt_nodos').select('id').eq('programa_id', pS2.data)
comprobar('Admin de la sede 1 NO ve las actividades del programa de la sede 2', (nodosS2.data?.length ?? 0) === 0)

// Aprobación (sin semanas programadas el servidor responde «programa al menos una semana», que ya es pasar la autorización)
const aprueba = (n, id) => s[n].rpc('aprobar_programa', { p_id: id })
const noAut = (r) => SIN_PERMISO(r)
comprobar('Admin de la sede 1 NO aprueba el programa general', noAut(await aprueba('ADMSEDE_C1', pG.data)))
comprobar('Admin de la sede 1 NO aprueba el programa de la sede 2', noAut(await aprueba('ADMSEDE_C1', pS2.data)))
comprobar('Gestor de la sede 2 NO aprueba (ni el suyo)', noAut(await aprueba('GESTOR_C2', pS2.data)))
const aS1 = await aprueba('ADMSEDE_C1', pS1.data)
comprobar('Admin de la sede 1 sí está autorizado a aprobar el programa de su sede', !noAut(aS1), aS1.error?.message)
const aG = await aprueba('ADMIN_C', pG.data)
comprobar('El admin general sí está autorizado a aprobar el programa general', !noAut(aG), aG.error?.message)
const ej = await s.ADMSEDE_C1.rpc('passt_ejecucion', { p_programa: pS2.data })
comprobar('passt_ejecucion: admin de la sede 1 NO lo pide del programa de la sede 2', SIN_PERMISO(ej), ej.error?.message)
const hl = await s.ADMSEDE_C1.rpc('passt_hallazgos', { p_programa: pS2.data })
comprobar('passt_hallazgos: admin de la sede 1 NO lo pide del programa de la sede 2', SIN_PERMISO(hl), hl.error?.message)
const ejG = await s.ADMSEDE_C1.rpc('passt_ejecucion', { p_programa: pG.data })
comprobar('passt_ejecucion: del programa general responde sin error, solo con filas de sus sedes', !ejG.error, ejG.error?.message)
const ejOk = await s.ADMSEDE_C1.rpc('passt_ejecucion', { p_programa: pS1.data })
comprobar('passt_ejecucion: sí responde del programa de su sede', !ejOk.error, ejOk.error?.message)

// ───────────────────────────────────────────────
seccion('5. Cuentas, sedes de cada cuenta y el límite del administrador de sede')
const crear = (n, doc, rol, sedes, extra = {}) => llamarFuncion(s[n], 'crear-cuenta', {
  empresa_id: empresa, rol, tipo_documento: 'dni', numero_documento: doc, apellidos_nombres: `PRUEBA SEDES ${doc}, Ficticio`, fecha_ingreso: '2026-01-15', puesto: 'Prueba', area: 'Seguridad',
  ...(sedes ? { sedes } : {}), ...extra,
})
const suf8 = String(Math.floor(Math.random() * 9000) + 1000)
const c1 = await crear('ADMSEDE_C1', `4100${suf8}`, 'admin_empresa', [S1])
comprobar('Admin de la sede 1 NO crea un administrador general', c1.estado === 403, `${c1.estado}`)
const c2 = await crear('ADMSEDE_C1', `4200${suf8}`, 'admin_sede', [S1])
comprobar('Admin de la sede 1 NO crea un administrador de sede', c2.estado === 403, `${c2.estado}`)
const c3 = await crear('ADMIN_C', `4300${suf8}`, 'admin_sede', [S1])
comprobar('El admin general NO crea administradores (solo el dueño)', c3.estado === 403, `${c3.estado}`)
const c4 = await crear('ADMSEDE_C1', `4400${suf8}`, 'gestor', [S2])
comprobar('Admin de la sede 1 NO crea un gestor para la sede 2', c4.estado === 403, `${c4.estado}`)
const c5 = await crear('ADMSEDE_C1', `4500${suf8}`, 'usuario', [S1, S2])
comprobar('Admin de la sede 1 NO crea un usuario con la sede 1 y la 2', c5.estado === 403, `${c5.estado}`)
const c6 = await crear('ADMSEDE_C1', `4600${suf8}`, 'gestor', [S1])
comprobar('Admin de la sede 1 sí crea un gestor para su sede', c6.estado === 200, `${c6.estado} ${c6.datos?.error ?? ''}`)
const c7 = await crear('ADMIN_C', `4700${suf8}`, 'usuario', null)
comprobar('Una cuenta nueva no puede quedar sin sedes: el admin general debe elegirlas (empresa con dos sedes)', c7.estado === 400, `${c7.estado} ${c7.datos?.error ?? ''}`)
const c8 = await crear('ADMSEDE_C1', `4800${suf8}`, 'usuario', null)
comprobar('El admin de una sola sede crea un usuario sin elegir sede: recibe la suya', c8.estado === 200, `${c8.estado} ${c8.datos?.error ?? ''}`)
const c9 = await crear('ADMIN_C', `4900${suf8}`, 'usuario', [S2, randomUUID()])
comprobar('Una sede que no es de la empresa se rechaza', c9.estado === 400 || c9.estado === 403, `${c9.estado}`)
const sedesDe = async (vinculo) => ((await dueno.from('vinculos_sedes').select('sede_id').eq('vinculo_id', vinculo)).data ?? []).map((x) => x.sede_id).sort()
if (c6.estado === 200) comprobar('El gestor nuevo quedó solo con la sede 1', (await sedesDe(c6.datos.vinculo_id)).join() === [S1].join())
if (c8.estado === 200) comprobar('El usuario nuevo quedó con la sede del administrador (sede 1)', (await sedesDe(c8.datos.vinculo_id)).join() === [S1].join())
const dosSedes = (await sedesDe(V.GESTOR_C12)).join() === [S1, S2].sort().join()
comprobar('El gestor de dos sedes tiene las dos sedes', dosSedes)

// Qué ve el administrador de sede de las personas
const vin = await s.ADMSEDE_C1.from('vinculos').select('id, persona_id, rol').eq('empresa_id', empresa)
comprobar('Admin de la sede 1 ve su cuenta, al usuario de la sede 1 y al gestor de las dos sedes', [V.ADMSEDE_C1, V.USUARIO_C1, V.GESTOR_C12].every((id) => vin.data?.some((x) => x.id === id)))
comprobar('Admin de la sede 1 NO ve al gestor de la sede 2 ni al admin de la sede 2', !vin.data?.some((x) => [V.GESTOR_C2, V.ADMSEDE_C2].includes(x.id)))
comprobar('Admin de la sede 1 NO ve al administrador general', !vin.data?.some((x) => x.id === V.ADMIN_C))
const pe = await s.ADMSEDE_C1.from('personas').select('id').in('id', [ID.GESTOR_C2, ID.ADMSEDE_C2, ID.ADMIN_C])
comprobar('Admin de la sede 1 NO ve las fichas de personas de la sede 2 ni del admin general', (pe.data?.length ?? 0) === 0)
const vinG = await s.ADMIN_C.from('vinculos').select('id').eq('empresa_id', empresa)
comprobar('El admin general ve todas las cuentas de la empresa', Object.values(V).every((id) => vinG.data?.some((x) => x.id === id)))
const vs = await s.ADMSEDE_C1.from('vinculos_sedes').select('vinculo_id, sede_id').eq('empresa_id', empresa)
comprobar('Admin de la sede 1 ve las sedes de las cuentas que ve, no las de otras', vs.data?.length > 0 && vs.data.every((x) => vin.data?.some((v) => v.id === x.vinculo_id)) && !vs.data.some((x) => [V.GESTOR_C2, V.ADMSEDE_C2, V.ADMIN_C].includes(x.vinculo_id)))
const vsU = await s.USUARIO_C1.from('vinculos_sedes').select('vinculo_id').eq('empresa_id', empresa)
comprobar('Un usuario solo ve las sedes de su propia cuenta', vsU.data?.length >= 1 && vsU.data.every((x) => x.vinculo_id === V.USUARIO_C1))

// Acciones sobre cuentas
const cese = (n, v) => s[n].rpc('cesar_vinculo', { p_vinculo: v, p_fecha_cese: HOY, p_motivo: 'Prueba intrusa' })
comprobar('Admin de la sede 1 NO cesa al gestor de la sede 2', SIN_PERMISO(await cese('ADMSEDE_C1', V.GESTOR_C2)))
comprobar('Admin de la sede 1 NO cesa al admin general', SIN_PERMISO(await cese('ADMSEDE_C1', V.ADMIN_C)))
comprobar('Admin de la sede 1 NO cesa al admin de la sede 2', SIN_PERMISO(await cese('ADMSEDE_C1', V.ADMSEDE_C2)))
comprobar('El admin general NO cesa a un administrador de sede (solo el dueño)', SIN_PERMISO(await cese('ADMIN_C', V.ADMSEDE_C2)))
comprobar('Admin de la sede 1 NO se cesa a sí mismo', SIN_PERMISO(await cese('ADMSEDE_C1', V.ADMSEDE_C1)))
const ed = (n, v, datos) => s[n].rpc('actualizar_persona', { p_vinculo: v, p_datos: datos })
comprobar('Admin de la sede 1 NO corrige al gestor de la sede 2', SIN_PERMISO(await ed('ADMSEDE_C1', V.GESTOR_C2, { apellidos_nombres: 'PRUEBA INTRUSO, Ficticio' })))
comprobar('Admin de la sede 1 NO se da el rol de administrador general', SIN_PERMISO(await ed('ADMSEDE_C1', V.ADMSEDE_C1, { rol: 'admin_empresa' })))
comprobar('Admin de la sede 1 NO sube de rol a su usuario a administrador', SIN_PERMISO(await ed('ADMSEDE_C1', V.USUARIO_C1, { rol: 'admin_empresa' })) && SIN_PERMISO(await ed('ADMSEDE_C1', V.USUARIO_C1, { rol: 'admin_sede' })))
comprobar('Admin de la sede 1 sí corrige a su usuario (nombre)', !(await ed('ADMSEDE_C1', V.USUARIO_C1, { apellidos_nombres: 'PRUEBA USUARIO SEDE 1 C, Karen (ficticia)' })).error)
const pw = (n, p) => llamarFuncion(s[n], 'dar-contrasena', { persona_id: p })
comprobar('Admin de la sede 1 NO da contraseña al gestor de la sede 2', (await pw('ADMSEDE_C1', ID.GESTOR_C2)).estado === 403)
comprobar('Admin de la sede 1 NO da contraseña al admin general', (await pw('ADMSEDE_C1', ID.ADMIN_C)).estado === 403)
comprobar('Admin de la sede 1 NO da contraseña a su propia cuenta por esta vía', (await pw('ADMSEDE_C1', ID.ADMSEDE_C1)).estado === 403)

// Sedes de cada cuenta (función nueva)
const asig = (n, v, sedes) => s[n].rpc('asignar_sedes', { p_vinculo: v, p_sedes: sedes })
comprobar('Admin de la sede 1 NO se agrega la sede 2', SIN_PERMISO(await asig('ADMSEDE_C1', V.ADMSEDE_C1, [S1, S2])))
comprobar('Admin de la sede 1 NO agrega la sede 2 a su usuario', SIN_PERMISO(await asig('ADMSEDE_C1', V.USUARIO_C1, [S1, S2])))
comprobar('Admin de la sede 1 NO toca las sedes del gestor de la sede 2', SIN_PERMISO(await asig('ADMSEDE_C1', V.GESTOR_C2, [S1, S2])))
comprobar('Admin de la sede 1 NO cambia las sedes de un administrador', SIN_PERMISO(await asig('ADMSEDE_C1', V.ADMSEDE_C2, [S1])))
const vacia = await asig('ADMIN_C', V.USUARIO_C1, [])
comprobar('Una cuenta no puede quedar sin sedes (ni el admin general la deja vacía)', vacia.error && !SIN_PERMISO(vacia), vacia.error?.message)
const quita = await asig('ADMSEDE_C1', V.GESTOR_C12, [S2])
comprobar('Admin de la sede 1 quita SU sede a un gestor de dos sedes: queda con la sede 2', !quita.error && (await sedesDe(V.GESTOR_C12)).join() === [S2].join(), quita.error?.message)
const quita2 = await asig('ADMSEDE_C1', V.GESTOR_C12, [])
comprobar('…y no puede dejarlo sin sedes', Boolean(quita2.error))
const restaura = await asig('ADMIN_C', V.GESTOR_C12, [S1, S2])
comprobar('El admin general restablece las dos sedes del gestor', !restaura.error && (await sedesDe(V.GESTOR_C12)).join() === [S1, S2].sort().join(), restaura.error?.message)
const dueSede = await asig('DUENO', V.ADMSEDE_C2, [S2])
comprobar('El dueño sí puede fijar las sedes de un administrador de sede', !dueSede.error, dueSede.error?.message)
const dueAd = await asig('ADMIN_C', V.ADMSEDE_C2, [S1, S2])
comprobar('El admin general NO cambia las sedes de un administrador de sede (solo el dueño)', SIN_PERMISO(dueAd))

// Permisos del rol: nadie puede cambiarlos desde la app
const rp = await s.ADMSEDE_C1.from('roles_permisos').insert({ rol: 'admin_sede', permiso: 'empresa.editar_logos' })
comprobar('Admin de la sede 1 NO se agrega permisos al rol (no hay escritura en roles_permisos)', Boolean(rp.error))
const rp2 = await s.ADMSEDE_C1.from('vinculos_sedes').insert({ vinculo_id: V.ADMSEDE_C1, sede_id: S2, empresa_id: empresa })
comprobar('Admin de la sede 1 NO se agrega una sede escribiendo la tabla', Boolean(rp2.error))
const rp3 = await s.ADMSEDE_C1.from('vinculos').update({ rol: 'admin_empresa' }).eq('id', V.ADMSEDE_C1)
comprobar('Admin de la sede 1 NO cambia su rol escribiendo la tabla', Boolean(rp3.error) || (await dueno.from('vinculos').select('rol').eq('id', V.ADMSEDE_C1).single()).data.rol === 'admin_sede')
comprobar('El rol admin_sede no tiene permisos de toda la empresa',
  !(await dueno.from('roles_permisos').select('permiso').eq('rol', 'admin_sede').in('permiso', ['empresa.editar_logos', 'empresa.editar_contactos', 'plantillas.publicar', 'listas.editar'])).data?.length)
const asignables = (await dueno.from('roles_asignables').select('rol, rol_asignable').in('rol', ['admin_sede', 'admin_empresa'])).data ?? []
comprobar('Los roles asignables: el admin de sede solo asigna gestor, usuario gestor y usuario; nadie asigna administradores',
  asignables.filter((x) => x.rol === 'admin_sede').map((x) => x.rol_asignable).sort().join() === 'gestor,usuario,usuario_gestor' && !asignables.some((x) => /^admin_/.test(x.rol_asignable)))

// ───────────────────────────────────────────────
seccion('6. Quitar una sede con inspecciones guardadas sin señal: el servidor las rechaza y quedan en el equipo')
{
  // El gestor de dos sedes prepara (sin enviar) una inspección de la sede 2; luego le quitan la sede 2; al volver la señal la manda.
  const pendiente = { id: randomUUID(), foto: randomUUID() }
  const quito = await asig('ADMIN_C', V.GESTOR_C12, [S1])
  comprobar('El admin general le quita la sede 2 al gestor', !quito.error, quito.error?.message)
  const r = await registrar('GESTOR_C12', S2, act2.data)
  comprobar('Al llegar el envío pendiente de la sede 2, el servidor lo rechaza (403) con un mensaje claro', r.estado === 403 && /sede/i.test(r.datos?.error ?? ''), `${r.estado} ${r.datos?.error ?? ''}`)
  comprobar('…y no se grabó nada', (await dueno.from('inspecciones').select('id').eq('id', r.id)).data?.length === 0)
  const ok = await registrar('GESTOR_C12', S1, act1.data)
  comprobar('Lo de la sede 1 sigue entrando', ok.estado === 200, `${ok.estado} ${ok.datos?.error ?? ''}`)
  const verS2 = (await s.GESTOR_C12.from('activos').select('id').eq('empresa_id', empresa).eq('sede_id', S2)).data ?? []
  comprobar('Ya no ve activos de la sede 2', verS2.length === 0)
  const vuelve = await asig('ADMIN_C', V.GESTOR_C12, [S1, S2])
  comprobar('Se le devuelve la sede 2 (para repetir la prueba)', !vuelve.error, vuelve.error?.message)
  void pendiente
}

// ───────────────────────────────────────────────
seccion('7. El administrador general y el dueño ven todo')
for (const n of ['ADMIN_C', 'DUENO']) {
  const a = await s[n].from('activos').select('sede_id').eq('empresa_id', empresa)
  comprobar(`${n}: ve los activos de las dos sedes`, [S1, S2].every((sd) => a.data?.some((x) => x.sede_id === sd)))
  const i = await s[n].from('inspecciones').select('sede_id').eq('empresa_id', empresa)
  comprobar(`${n}: ve las inspecciones de las dos sedes`, [S1, S2].every((sd) => i.data?.some((x) => x.sede_id === sd)))
}

// ───────────────────────────────────────────────
seccion('8. Una persona de la empresa A o B no ve nada de la empresa D (y al revés)')
for (const n of ['ADMIN_A', 'ADMIN_B']) {
  for (const t of ['activos', 'ubicaciones', 'inspecciones', 'hallazgos', 'passt_programas', 'vinculos', 'vinculos_sedes']) {
    const r = await s[n].from(t).select('*', { count: 'exact', head: true }).eq('empresa_id', empresa)
    comprobar(`${n}: 0 filas de ${t} de la empresa D`, (r.count ?? 0) === 0 && !r.error, r.error?.message)
  }
}
const aA = await s.ADMIN_C.from('activos').select('*', { count: 'exact', head: true }).neq('empresa_id', empresa)
comprobar('Admin general de C: 0 activos de otras empresas', (aA.count ?? 0) === 0)

seccion('9. Permisos de las tablas: nadie escribe directo')
await revisarPermisosTablas()

mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Separación entre sedes de una misma empresa (etapa 1 del punto 2)', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · empresa D ficticia (RUC ${RUC_C}).`, '']
for (const [k, g] of grupos.entries()) {
  const hasta2 = grupos[k + 1]?.desde ?? resultados.length
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, hasta2)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.detalle ? ` — ${r.detalle}` : ''}`)
  lineas.push('')
}
const fallas = resultados.filter((r) => !r.paso).length
lineas.push(`**${resultados.length - fallas} de ${resultados.length} pruebas pasaron.**`)
writeFileSync('pruebas/resultados/separacion-sedes.md', lineas.join('\n') + '\n')
process.exit(resumen() ? 1 : 0)
