// Prueba de la etapa 2 del punto 2 (03/11/2026): usuario gestor, facultades por persona, solicitudes de cambio del gestor
// (anular y corregir inspecciones, cambiar el programa anual aprobado) con aprobación del administrador, y gestores que manejan el personal de su sede.
// Solo datos FICTICIOS, en crc-dev. Usa la empresa D (RUC 20000000052, dos sedes) de separacion-sedes.mjs. Se puede repetir.
// Uso: node pruebas/facultades.mjs   (corre antes node pruebas/separacion-sedes.mjs una vez, para que existan la empresa D y sus cuentas)
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG_FICTICIO, claveFuerte, cuentas, formatoDeEmpresa, guardarCuenta, ingresarComo, llamarFuncion, comprobar, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const SIN_PERMISO = (r) => r.error?.code === '42501' || /permission denied|No autorizado|Ya no tienes acceso|solo el administrador|no puede|no se puede/i.test(r.error?.message ?? '') || r.estado === 403
const HOY = new Date().toISOString().slice(0, 10)
const INICIO = new Date(Date.now() - 2000).toISOString() // desde aquí es «de esta corrida»; la limpieza final borra solo lo que nació después
const sha = (b) => createHash('sha256').update(b).digest('hex')

// ───────────────────────────────────────────────
// Preparación: empresa D con sus dos sedes y cuentas nuevas (usuarios gestores y un gestor de la sede 1)
// ───────────────────────────────────────────────
const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const empresa = (await dueno.from('empresas').select('id').eq('ruc', '20000000052').maybeSingle()).data?.id
if (!empresa) throw new Error('Falta la empresa D: corre antes node pruebas/separacion-sedes.mjs')
const sedeId = async (nombre) => (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', nombre).single()).data.id
const S1 = await sedeId('Sede 1 (ficticia)')
const S2 = await sedeId('Sede 2 (ficticia)')
const AREA = (await dueno.from('unidades').select('id').eq('empresa_id', empresa).eq('nivel', 'area').eq('nombre', 'Seguridad').single()).data.id

async function asegurarCuenta(nombre, documento, nombres, rol, sedes, creador) {
  if (cuentas[`${nombre}_CLAVE`]) return
  const { c, error } = await ingresarComo(creador)
  if (error) throw new Error(`${creador} no pudo ingresar: ${error.message}`)
  const [tipo, numero] = documento.split(':')
  const r = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: empresa, rol, tipo_documento: tipo, numero_documento: numero, apellidos_nombres: nombres, fecha_ingreso: '2026-01-15',
    puesto: 'Prueba', area: 'Seguridad', sedes,
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ${nombre}: ${r.datos?.error}`)
  const inicial = r.datos.contrasena_inicial
  guardarCuenta(nombre, documento, inicial)
  const primera = await ingresarComo(nombre, inicial)
  if (primera.error) throw new Error(`${nombre} no pudo hacer su primer ingreso: ${primera.error.message}`)
  const nueva = claveFuerte()
  const cambio = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
  if (cambio.estado !== 200) throw new Error(`${nombre} no pudo cambiar su contraseña: ${cambio.datos?.error}`)
  guardarCuenta(nombre, documento, nueva)
}
await asegurarCuenta('GESTOR_C1', 'dni:43000001', 'PRUEBA GESTOR SEDE 1 C, Marco (ficticio)', 'gestor', [S1], 'ADMSEDE_C1')
await asegurarCuenta('USUGES_C1', 'dni:43000002', 'PRUEBA USUARIO GESTOR SEDE 1 C, Nora (ficticia)', 'usuario_gestor', [S1], 'ADMSEDE_C1')
await asegurarCuenta('USUGES_C2', 'dni:43000003', 'PRUEBA USUARIO GESTOR SEDE 2 C, Omar (ficticio)', 'usuario_gestor', [S2], 'ADMSEDE_C2')

const s = { DUENO: dueno }
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2', 'ADMIN_A', 'GESTOR_A', 'ADMIN_B', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const ID = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C1', 'GESTOR_C2', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2']) ID[n] = (await s[n].auth.getUser()).data.user.id
const V = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C1', 'GESTOR_C2', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2'])
  V[n] = (await dueno.from('vinculos').select('id').eq('persona_id', ID[n]).eq('empresa_id', empresa).eq('estado', 'activo').single()).data.id

// Equipos e inspecciones: una motobomba por sede, cada una con una inspección cerrada (la de la sede 2 con un «No» que genera plan de acción)
const tipoBase = (await dueno.from('tipos_activo').select('id').is('empresa_id', null).eq('codigo', 'motobomba').single()).data.id
const tipo = (await dueno.rpc('activar_tipo_activo', { p_empresa: empresa, p_tipo_base: tipoBase })).data
const { version } = await formatoDeEmpresa(dueno, empresa, 'motobomba', HOY)
const receta = (await dueno.from('plantillas_versiones').select('receta').eq('id', version.id).single()).data.receta
const todoSi = Object.fromEntries(receta.secciones.flatMap((sec) => sec.puntos.map((p) => [p.clave, { valor: p.tipo === 'si_no' ? 'si' : p.tipo === 'hora' ? '10:00' : p.obligatorio ? 'Dato ficticio' : null }])))
const SUF = randomUUID().slice(0, 6)
const nuevoActivo = async (quien, sede, codigo) => (await s[quien].rpc('guardar_activo', { p_empresa: empresa, p_id: null, p_datos: { tipo_id: tipo, codigo, sede_id: sede, unidad_id: AREA, datos: {} } })).data
const registrar = async (quien, sede, activo, extra = {}) => {
  const id = randomUUID()
  const foto = randomUUID()
  const rutaFoto = `${empresa}/${id}/${foto}.png`
  const rutaFirma = `${empresa}/${id}/firma-${ID[quien]}-inspector.png`
  const subir = (ruta) => s[quien].storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
  await subir(rutaFoto)
  await subir(rutaFirma)
  const r = await llamarFuncion(s[quien], 'registrar-inspeccion', {
    modo: 'registrar', id, version_id: version.id, sede_id: sede, activo_id: activo,
    activo_foto: { codigo: 'X', numero: 1, subtipo: null, datos: {}, dotacion: {} },
    respuestas: { ...todoSi, ...(extra.respuestas ?? {}) }, observacion: null, fecha: HOY,
    iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(), dispositivo: 'Prueba automática',
    archivos: [{ id: foto, punto_clave: 'MB-A01', fila: null, ruta: rutaFoto, bytes: PNG_FICTICIO.length, tipo_mime: 'image/png', sha256: sha(PNG_FICTICIO) }],
    firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', orden: 1, persona_id: ID[quien] }, { rol_clave: 'custodia', rol_titulo: 'Custodia', orden: 2, persona_id: ID.USUARIO_C1 }],
    mi_firma: { rol_clave: 'inspector', ruta: rutaFirma, bytes: PNG_FICTICIO.length },
  })
  if (r.estado !== 200) throw new Error(`Inspección de ${quien}: ${r.estado} ${r.datos?.error ?? ''}`)
  return id
}
const act1 = await nuevoActivo('ADMSEDE_C1', S1, `FAC-S1-${SUF}`)
const act2 = await nuevoActivo('ADMSEDE_C2', S2, `FAC-S2-${SUF}`)
const accion = { texto: 'Revisar el tablero (ficticio)', responsable: ID.GESTOR_C2, plazo: '2026-12-31' }
const insp = async () => ({
  s1: await registrar('ADMSEDE_C1', S1, act1),
  s2: await registrar('ADMSEDE_C2', S2, act2, { respuestas: { 'MB-B01': { valor: 'no', obs: 'Sin flujo de agua (ficticio)', accion } } }),
})
const I = await insp()
const verInsp = async (n) => ((await s[n].from('inspecciones').select('id, sede_id, estado').eq('empresa_id', empresa)).data ?? [])
const hallazgosDe = async (n) => ((await s[n].from('hallazgos').select('id, sede_id').eq('empresa_id', empresa)).data ?? [])

// ───────────────────────────────────────────────
seccion('1. El rol nuevo y sus permisos')
{
  const roles = (await dueno.from('roles').select('codigo, orden').order('orden')).data
  comprobar('Existe el rol «usuario_gestor», entre el gestor y el usuario', roles.map((r) => r.codigo).join() === 'admin_empresa,admin_sede,gestor,usuario_gestor,usuario', roles.map((r) => r.codigo).join())
  const permisosDe = async (rol) => ((await dueno.from('roles_permisos').select('permiso').eq('rol', rol)).data ?? []).map((x) => x.permiso).sort()
  comprobar('El usuario gestor empieza solo con lo del usuario', (await permisosDe('usuario_gestor')).join() === (await permisosDe('usuario')).join())
  const gp = await permisosDe('gestor')
  comprobar('El gestor suma crear y cesar cuentas y corregir personas…', ['cuentas.crear', 'cuentas.cesar', 'personas.editar', 'personas.ver_empresa'].every((p) => gp.includes(p)))
  comprobar('…pero no cambiar contraseñas, ni anular, ni corregir inspecciones, ni reprogramar, ni dar facultades', !['cuentas.contrasena', 'inspecciones.anular', 'inspecciones.editar_cerrada', 'passt.reprogramar', 'facultades.dar', 'solicitudes.resolver'].some((p) => gp.includes(p)))
  const ap = await permisosDe('admin_sede')
  comprobar('El administrador de sede puede dar facultades y resolver solicitudes', ['facultades.dar', 'solicitudes.resolver'].every((p) => ap.includes(p)))
  const asig = (await dueno.from('roles_asignables').select('rol, rol_asignable')).data
  const de = (rol) => asig.filter((a) => a.rol === rol).map((a) => a.rol_asignable).sort().join()
  comprobar('Los administradores asignan gestor, usuario gestor y usuario', de('admin_empresa') === 'gestor,usuario,usuario_gestor' && de('admin_sede') === 'gestor,usuario,usuario_gestor', `${de('admin_empresa')} | ${de('admin_sede')}`)
  comprobar('El gestor asigna solo usuario gestor y usuario', de('gestor') === 'usuario,usuario_gestor', de('gestor'))
  comprobar('mis_permisos: el gestor 1 recibe los de su rol', ((await s.GESTOR_C1.rpc('mis_permisos')).data ?? []).includes('inspecciones.registrar'))
  comprobar('mis_permisos: el usuario gestor sin facultades no recibe permisos de inspecciones', !((await s.USUGES_C1.rpc('mis_permisos')).data ?? []).some((p) => p.startsWith('inspecciones.')))
}

// ───────────────────────────────────────────────
seccion('2. Usuario gestor: sin facultades no ve nada; con cada una, solo lo suyo')
{
  // Sin la facultad, una cuenta solo ve las inspecciones que ella misma firmó (puede quedar alguna de una corrida anterior).
  const firmadas = async (n) => new Set(((await dueno.from('firmas').select('inspeccion_id').eq('persona_id', ID[n])).data ?? []).map((x) => x.inspeccion_id))
  const soloLasSuyas = async (n) => { const f = await firmadas(n); return (await verInsp(n)).every((x) => f.has(x.id)) }
  comprobar('Sin facultades no ve inspecciones, salvo las que ella firmó', await soloLasSuyas('USUGES_C1'))
  comprobar('Sin facultades no ve planes de acción de otros', (await hallazgosDe('USUGES_C2')).length === 0)
  const dar = (quien, vinculo, permiso) => s[quien].rpc('dar_facultad', { p_vinculo: vinculo, p_permiso: permiso })
  const quitar = (quien, vinculo, permiso) => s[quien].rpc('quitar_facultad', { p_vinculo: vinculo, p_permiso: permiso })

  const g1 = await dar('ADMSEDE_C1', V.USUGES_C1, 'inspecciones.ver')
  comprobar('El administrador de la sede 1 marca «ver inspecciones» a su usuario gestor', !g1.error, g1.error?.message)
  const ve = await verInsp('USUGES_C1')
  comprobar('El usuario gestor de la sede 1 ve solo las inspecciones de su sede', ve.length > 0 && ve.every((x) => x.sede_id === S1))
  comprobar('…y no ve nada de la sede 2', !ve.some((x) => x.id === I.s2))
  comprobar('El usuario gestor de la sede 2 (sin marcas) sigue sin ver nada', (await verInsp('USUGES_C2')).length === 0)
  const p1 = await s.USUGES_C1.rpc('mis_permisos')
  comprobar('mis_permisos refleja la facultad marcada', (p1.data ?? []).includes('inspecciones.ver'))
  const q1 = await quitar('ADMSEDE_C1', V.USUGES_C1, 'inspecciones.ver')
  comprobar('El administrador quita la facultad', !q1.error && await soloLasSuyas('USUGES_C1'), q1.error?.message)

  // Registrar inspecciones
  const act = await nuevoActivo('ADMSEDE_C1', S1, `FAC-R-${SUF}`)
  const sinReg = await registrar('USUGES_C1', S1, act).then(() => 'registró', (e) => e.message)
  comprobar('Sin la facultad no registra inspecciones', sinReg !== 'registró', sinReg)
  await dar('ADMSEDE_C1', V.USUGES_C1, 'inspecciones.registrar')
  const conReg = await registrar('USUGES_C1', S1, act).then(() => 'registró', (e) => e.message)
  comprobar('Con «registrar inspecciones» registra en su sede', conReg === 'registró', conReg)
  const otraSede = await registrar('USUGES_C1', S2, act2).then(() => 'registró', (e) => e.message)
  comprobar('…pero no en la sede 2', otraSede !== 'registró', otraSede)
  await quitar('ADMSEDE_C1', V.USUGES_C1, 'inspecciones.registrar')

  // Planes de acción
  comprobar('Sin la facultad no ve planes de acción de su sede', (await hallazgosDe('USUGES_C2')).length === 0)
  await dar('ADMSEDE_C2', V.USUGES_C2, 'hallazgos.gestionar')
  const hz = await hallazgosDe('USUGES_C2')
  comprobar('Con «gestionar planes de acción» ve los de la sede 2 y solo esos', hz.length > 0 && hz.every((h) => h.sede_id === S2))
  const hid = hz[0]?.id
  const gest = await s.USUGES_C2.rpc('gestionar_hallazgo', { p_id: hid, p_datos: { responsable_id: ID.GESTOR_C2, plazo: '2026-12-31', accion: 'Revisar el tablero (ficticio)' } })
  comprobar('…y los gestiona', !gest.error, gest.error?.message)
  comprobar('El usuario gestor de la sede 1 no gestiona el de la sede 2', SIN_PERMISO(await s.USUGES_C1.rpc('gestionar_hallazgo', { p_id: hid, p_datos: { responsable_id: ID.USUGES_C1, plazo: '2026-12-31', accion: 'Intruso' } })))
  await quitar('ADMSEDE_C2', V.USUGES_C2, 'hallazgos.gestionar')

  // Programa anual (solo lectura) y nombres
  const ANIO = 2090 + randomInt(0, 9)
  const prog = await s.ADMSEDE_C1.rpc('crear_programa', { p_empresa: empresa, p_datos: { anio: ANIO, sede_id: S1, nombre: `Programa facultades ${SUF}`, seguimiento: 'semana' } })
  comprobar('Se crea un programa de la sede 1 para la prueba', !prog.error, prog.error?.message)
  comprobar('Sin «ver programa anual» no ve programas', ((await s.USUGES_C1.from('passt_programas').select('id').eq('empresa_id', empresa)).data ?? []).length === 0)
  await dar('ADMSEDE_C1', V.USUGES_C1, 'passt.ver')
  const vp = (await s.USUGES_C1.from('passt_programas').select('id, sede_id').eq('empresa_id', empresa)).data ?? []
  comprobar('Con «ver programa anual» ve los de su sede y no los de la sede 2', vp.length > 0 && vp.every((x) => x.sede_id === S1 || x.sede_id === null))
  const edit = await s.USUGES_C1.rpc('guardar_nodo', { p_programa: prog.data, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: (await dueno.from('passt_nodos').select('id').eq('programa_id', prog.data).eq('tipo', 'objetivo_general').single()).data.id, texto: 'Intruso' } })
  comprobar('Ver el programa no deja editarlo', SIN_PERMISO(edit), edit.error?.message)
  await quitar('ADMSEDE_C1', V.USUGES_C1, 'passt.ver')
  comprobar('Sin «ver nombres» no recibe la lista del personal', ((await s.USUGES_C1.rpc('personas_de_mi_empresa')).data ?? []).length === 0)
  await dar('ADMSEDE_C1', V.USUGES_C1, 'personas.ver_nombres')
  const nombres = (await s.USUGES_C1.rpc('personas_de_mi_empresa')).data ?? []
  comprobar('Con «ver nombres» recibe solo al personal de su sede', nombres.length > 0 && !nombres.some((p) => p.persona_id === ID.GESTOR_C2))
  await quitar('ADMSEDE_C1', V.USUGES_C1, 'personas.ver_nombres')
  s.PROGRAMA_FAC = prog.data
}

// ───────────────────────────────────────────────
seccion('3. Quién puede marcar facultades, y cuáles')
{
  const dar = (quien, vinculo, permiso) => s[quien].rpc('dar_facultad', { p_vinculo: vinculo, p_permiso: permiso })
  comprobar('Una facultad que no está en la lista no se marca (crear cuentas)', SIN_PERMISO(await dar('ADMIN_C', V.USUGES_C1, 'cuentas.crear')) || Boolean((await dar('ADMIN_C', V.USUGES_C1, 'cuentas.crear')).error))
  comprobar('Tampoco aprobar el programa', Boolean((await dar('ADMIN_C', V.USUGES_C1, 'passt.aprobar')).error))
  comprobar('Tampoco editar formatos', Boolean((await dar('ADMIN_C', V.USUGES_C1, 'plantillas.publicar')).error))
  comprobar('A un usuario común no se le marcan facultades', Boolean((await dar('ADMIN_C', V.USUARIO_C1, 'inspecciones.ver')).error))
  comprobar('A un administrador no se le marcan facultades', Boolean((await dar('ADMIN_C', V.ADMSEDE_C1, 'inspecciones.ver')).error))
  comprobar('Al gestor no se le marcan las del usuario gestor', Boolean((await dar('ADMIN_C', V.GESTOR_C1, 'inspecciones.ver')).error))
  comprobar('Al usuario gestor no se le marcan las del gestor (anular inspecciones)', Boolean((await dar('ADMIN_C', V.USUGES_C1, 'inspecciones.anular')).error))
  comprobar('El administrador de la sede 1 no marca a la cuenta de la sede 2', SIN_PERMISO(await dar('ADMSEDE_C1', V.USUGES_C2, 'inspecciones.ver')), (await dar('ADMSEDE_C1', V.USUGES_C2, 'inspecciones.ver')).error?.message)
  comprobar('Un gestor no marca facultades', SIN_PERMISO(await dar('GESTOR_C1', V.USUGES_C1, 'inspecciones.ver')))
  comprobar('Un usuario gestor no se marca facultades a sí mismo', SIN_PERMISO(await dar('USUGES_C1', V.USUGES_C1, 'inspecciones.ver')))
  comprobar('Un usuario no marca facultades', SIN_PERMISO(await dar('USUARIO_C1', V.USUGES_C1, 'inspecciones.ver')))
  comprobar('Otra empresa no marca facultades en la empresa D', SIN_PERMISO(await dar('ADMIN_A', V.USUGES_C1, 'inspecciones.ver')))
  const ok = await dar('ADMIN_C', V.USUGES_C2, 'passt.ver')
  comprobar('El administrador general marca a cuentas de cualquier sede', !ok.error, ok.error?.message)
  const ya = await dar('ADMIN_C', V.USUGES_C2, 'passt.ver')
  comprobar('Marcar dos veces la misma facultad no duplica', !ya.error && ((await dueno.from('facultades_persona').select('permiso').eq('vinculo_id', V.USUGES_C2).eq('permiso', 'passt.ver')).data ?? []).length === 1)
  const hist = (await dueno.from('facultades_historial').select('accion, permiso, hecho_por').eq('vinculo_id', V.USUGES_C2).eq('permiso', 'passt.ver')).data ?? []
  comprobar('Cada cambio queda en el historial, con quién lo hizo', hist.some((h) => h.accion === 'dar' && h.hecho_por === ID.ADMIN_C))
  await s.ADMIN_C.rpc('quitar_facultad', { p_vinculo: V.USUGES_C2, p_permiso: 'passt.ver' })
  // Cambiar el rol anula las facultades
  await s.ADMIN_C.rpc('dar_facultad', { p_vinculo: V.USUGES_C2, p_permiso: 'inspecciones.ver' })
  const antes = ((await dueno.from('facultades_persona').select('permiso').eq('vinculo_id', V.USUGES_C2)).data ?? []).length
  const cambio = await s.ADMIN_C.rpc('actualizar_persona', { p_vinculo: V.USUGES_C2, p_datos: { rol: 'usuario' } })
  const despues = ((await dueno.from('facultades_persona').select('permiso').eq('vinculo_id', V.USUGES_C2)).data ?? []).length
  comprobar('Al pasar a la cuenta a «usuario», sus facultades se borran solas', antes === 1 && (cambio.error ? true : despues === 0), cambio.error?.message ?? `${antes} → ${despues}`)
  if (!cambio.error) await s.ADMIN_C.rpc('actualizar_persona', { p_vinculo: V.USUGES_C2, p_datos: { rol: 'usuario_gestor' } })
  await s.ADMIN_C.rpc('quitar_facultad', { p_vinculo: V.USUGES_C2, p_permiso: 'inspecciones.ver' })
}

// ───────────────────────────────────────────────
seccion('4. El gestor solicita anular una inspección; el administrador decide')
const pend = (n) => s[n].from('solicitudes_cambio').select('id, tipo, estado, objetivo_id, sede_id').eq('empresa_id', empresa)
const estadoDe = async (id) => (await dueno.from('solicitudes_cambio').select('estado, resuelto_por, comentario_resolucion').eq('id', id).single()).data
{
  const directa = await s.GESTOR_C1.rpc('anular_inspeccion', { p_id: I.s1, p_motivo: 'Directo (ficticio)' })
  comprobar('El gestor sin marca no anula directo', SIN_PERMISO(directa), directa.error?.message)
  const solicitar = (n, tipo, objetivo, datos, motivo = 'Se registró en el equipo equivocado (ficticio)') => s[n].rpc('solicitar_cambio', { p_tipo: tipo, p_objetivo: objetivo, p_datos: datos, p_motivo: motivo })
  const ajena = await solicitar('GESTOR_C1', 'anular_inspeccion', I.s2, {})
  comprobar('No se solicita sobre una inspección de otra sede', Boolean(ajena.error), ajena.error?.message)
  comprobar('Un usuario gestor no solicita cambios (es del gestor)', Boolean((await solicitar('USUGES_C1', 'anular_inspeccion', I.s1, {})).error))
  comprobar('Un usuario no solicita cambios', Boolean((await solicitar('USUARIO_C1', 'anular_inspeccion', I.s1, {})).error))
  comprobar('Sin motivo no se solicita', Boolean((await solicitar('GESTOR_C1', 'anular_inspeccion', I.s1, {}, 'x')).error))
  comprobar('Un tipo inventado no se solicita', Boolean((await solicitar('GESTOR_C1', 'borrar_todo', I.s1, {})).error))
  const a = await solicitar('GESTOR_C1', 'anular_inspeccion', I.s1, {})
  comprobar('El gestor de la sede 1 solicita anular la inspección de su sede', !a.error && Boolean(a.data), a.error?.message)
  const sid = a.data
  comprobar('Queda «pendiente» y la inspección sigue cerrada', (await estadoDe(sid)).estado === 'pendiente' && (await dueno.from('inspecciones').select('estado').eq('id', I.s1).single()).data.estado === 'cerrada')
  const ve = async (n) => ((await pend(n)).data ?? []).some((x) => x.id === sid)
  comprobar('La ve quien la pidió', await ve('GESTOR_C1'))
  comprobar('La ve el administrador de la sede 1', await ve('ADMSEDE_C1'))
  comprobar('La ve el administrador general', await ve('ADMIN_C'))
  comprobar('No la ve el administrador de la sede 2', !(await ve('ADMSEDE_C2')))
  comprobar('No la ve otro gestor de la empresa', !(await ve('GESTOR_C2')))
  comprobar('No la ve un usuario', !(await ve('USUARIO_C1')))
  comprobar('No la ve otra empresa', !(await ve('ADMIN_A')) && !(await ve('GESTOR_B')))
  const mia = await s.GESTOR_C1.rpc('resolver_solicitud', { p_id: sid, p_aprobar: true, p_comentario: 'Me la apruebo yo' })
  comprobar('El gestor no resuelve su propia solicitud', SIN_PERMISO(mia), mia.error?.message)
  const otra = await s.ADMSEDE_C2.rpc('resolver_solicitud', { p_id: sid, p_aprobar: true, p_comentario: 'Intruso' })
  comprobar('El administrador de la sede 2 no resuelve la de la sede 1', SIN_PERMISO(otra), otra.error?.message)
  const sinComentario = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: sid, p_aprobar: false, p_comentario: '' })
  comprobar('Al denegar hay que escribir el comentario', Boolean(sinComentario.error), sinComentario.error?.message)
  const den = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: sid, p_aprobar: false, p_comentario: 'Todavía se necesita (ficticio)' })
  comprobar('El administrador de la sede 1 deniega', !den.error, den.error?.message)
  const e1 = await estadoDe(sid)
  comprobar('Queda «denegada», con quién y el comentario', e1.estado === 'denegada' && e1.resuelto_por === ID.ADMSEDE_C1 && e1.comentario_resolucion.includes('Todavía'))
  comprobar('La inspección sigue cerrada: todo quedó como estaba', (await dueno.from('inspecciones').select('estado').eq('id', I.s1).single()).data.estado === 'cerrada')
  comprobar('No se resuelve dos veces', Boolean((await s.ADMIN_C.rpc('resolver_solicitud', { p_id: sid, p_aprobar: true, p_comentario: 'Otra vez' })).error))
  const aviso = (await s.GESTOR_C1.from('solicitudes_cambio').select('estado, visto_solicitante').eq('id', sid).single()).data
  comprobar('El gestor ve la respuesta, todavía sin leer', aviso.estado === 'denegada' && aviso.visto_solicitante === false)
  const visto = await s.GESTOR_C1.rpc('marcar_solicitud_vista', { p_id: sid })
  comprobar('Al abrirla queda como vista', !visto.error && (await dueno.from('solicitudes_cambio').select('visto_solicitante').eq('id', sid).single()).data.visto_solicitante === true, visto.error?.message)

  // Otra solicitud, esta vez aprobada
  const b = await solicitar('GESTOR_C1', 'anular_inspeccion', I.s1, {})
  const ap = await s.ADMIN_C.rpc('resolver_solicitud', { p_id: b.data, p_aprobar: true, p_comentario: 'De acuerdo (ficticio)' })
  comprobar('El administrador general aprueba', !ap.error, ap.error?.message)
  const ins = (await dueno.from('inspecciones').select('estado, anulada_por, motivo_anulacion').eq('id', I.s1).single()).data
  comprobar('La inspección queda anulada, con el motivo del gestor y como hecho del administrador que aprobó', ins.estado === 'anulada' && ins.anulada_por === ID.ADMIN_C && ins.motivo_anulacion.includes('equipo equivocado'), JSON.stringify(ins))
  comprobar('La solicitud queda «aprobada»', (await estadoDe(b.data)).estado === 'aprobada')
  I.s1 = await registrar('ADMSEDE_C1', S1, act1) // una inspección nueva para lo que sigue
}

// ───────────────────────────────────────────────
seccion('5. El gestor solicita corregir una inspección')
{
  const ed = (await dueno.from('inspecciones').select('edicion, respuestas').eq('id', I.s1).single()).data
  const cambio = { ...ed.respuestas, 'MB-A01': { valor: 'no', obs: 'Nivel bajo, se repone (ficticio)' } }
  const solicitar = (datos) => s.GESTOR_C1.rpc('solicitar_cambio', { p_tipo: 'corregir_inspeccion', p_objetivo: I.s1, p_datos: datos, p_motivo: 'Se marcó mal el nivel de aceite (ficticio)' })
  // El administrador aplica lo pedido con la ruta de siempre (valida el servidor) y después aprueba la solicitud.
  const aplicar = async (quien, sid) => {
    const sol = (await s[quien].from('solicitudes_cambio').select('objetivo_id, motivo, datos').eq('id', sid).single()).data
    return llamarFuncion(s[quien], 'registrar-inspeccion', { modo: 'corregir', id: sol.objetivo_id, edicion: sol.datos.edicion, motivo: sol.motivo, respuestas: sol.datos.respuestas, filas: sol.datos.filas, observacion: sol.datos.observacion })
  }
  const directo = await llamarFuncion(s.GESTOR_C1, 'registrar-inspeccion', { modo: 'corregir', id: I.s1, edicion: ed.edicion, motivo: 'Directo', respuestas: cambio })
  comprobar('El gestor sin marca no corrige directo', directo.estado === 403, `${directo.estado}`)
  const a = await solicitar({ edicion: ed.edicion, respuestas: cambio })
  comprobar('El gestor solicita la corrección', !a.error && Boolean(a.data), a.error?.message)
  comprobar('Sin las respuestas nuevas no se solicita', Boolean((await solicitar({ edicion: ed.edicion })).error))
  const sinAplicar = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: a.data, p_aprobar: true, p_comentario: 'Sin aplicar' })
  comprobar('No se aprueba una corrección que todavía no se aplicó', Boolean(sinAplicar.error) && (await estadoDe(a.data)).estado === 'pendiente', sinAplicar.error?.message)
  const delOtro = await s.ADMSEDE_C2.rpc('resolver_solicitud', { p_id: a.data, p_aprobar: true, p_comentario: 'Intruso' })
  comprobar('El administrador de otra sede no aprueba la corrección', SIN_PERMISO(delOtro), delOtro.error?.message)
  const intrusoAplica = await llamarFuncion(s.ADMSEDE_C2, 'registrar-inspeccion', { modo: 'corregir', id: I.s1, edicion: ed.edicion, motivo: 'Intruso', respuestas: cambio })
  comprobar('…ni aplica la corrección en una sede que no es la suya', intrusoAplica.estado === 403, `${intrusoAplica.estado}`)
  const nCom = async () => ((await dueno.from('solicitudes_cambio').select('id').eq('empresa_id', empresa).eq('estado', 'comunicada').eq('tipo', 'corregir_inspeccion')).data ?? []).length
  const antesCom = await nCom()
  const ok = await aplicar('ADMSEDE_C1', a.data)
  comprobar('El administrador de la sede 1 aplica la corrección pedida (valida el servidor)', ok.estado === 200, `${ok.estado} ${ok.datos?.error ?? ''}`)
  const aprob = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: a.data, p_aprobar: true, p_comentario: 'Aplicada (ficticio)' })
  comprobar('Después aprueba la solicitud', !aprob.error && (await estadoDe(a.data)).estado === 'aprobada', aprob.error?.message)
  const dsp = (await dueno.from('inspecciones').select('edicion, respuestas').eq('id', I.s1).single()).data
  comprobar('La inspección queda corregida (edición +1) con las respuestas pedidas', dsp.edicion === ed.edicion + 1 && dsp.respuestas['MB-A01'].valor === 'no')
  const hist = (await dueno.from('inspecciones_ediciones').select('hecho_por, motivo').eq('inspeccion_id', I.s1).order('edicion', { ascending: false }).limit(1)).data?.[0]
  comprobar('El historial dice que la corrigió el administrador que aprobó, con el motivo del gestor', hist?.hecho_por === ID.ADMSEDE_C1 && Boolean(hist.motivo?.includes('nivel de aceite')))
  comprobar('La corrección aplicada por un administrador no se comunica como si fuera del gestor', (await nCom()) === antesCom)
  // Denegar una corrección
  const ed2 = (await dueno.from('inspecciones').select('edicion').eq('id', I.s1).single()).data.edicion
  const b = await solicitar({ edicion: ed2, respuestas: { ...cambio, 'MB-A02': { valor: 'no', obs: 'No' } } })
  const den = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: b.data, p_aprobar: false, p_comentario: 'No hace falta (ficticio)' })
  comprobar('El administrador deniega la corrección', !den.error && (await estadoDe(b.data)).estado === 'denegada', den.error?.message)
  comprobar('Denegar no cambia la inspección', (await dueno.from('inspecciones').select('edicion').eq('id', I.s1).single()).data.edicion === ed2)
  comprobar('Una corrección ya resuelta no se aprueba otra vez', Boolean((await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: b.data, p_aprobar: true, p_comentario: 'Otra vez' })).error))
  // Una aprobación no sirve con la corrección de otra solicitud
  const c = await solicitar({ edicion: ed2, respuestas: cambio })
  const otraAprob = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: c.data, p_aprobar: true, p_comentario: 'Con la corrección de la anterior' })
  comprobar('La aprobación solo vale con la corrección de esa edición de la inspección', Boolean(otraAprob.error), otraAprob.error?.message)
  await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: c.data, p_aprobar: false, p_comentario: 'Ya cambió (ficticio)' })
}

// ───────────────────────────────────────────────
seccion('6. El gestor solicita cambiar el programa anual aprobado')
{
  const P = s.PROGRAMA_FAC
  const og = (await dueno.from('passt_nodos').select('id').eq('programa_id', P).eq('tipo', 'objetivo_general').single()).data.id
  const oe = (await s.ADMSEDE_C1.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: og, texto: 'Objetivo (ficticio)' } })).data
  const se = (await s.ADMSEDE_C1.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'seccion', padre_id: oe, texto: 'Actividades (ficticias)' } })).data
  const ac = (await s.ADMSEDE_C1.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'actividad', padre_id: se, texto: 'Actividad (ficticia)', responsable_id: ID.GESTOR_C1 } })).data
  const borr = await s.GESTOR_C1.rpc('guardar_nodo', { p_programa: P, p_id: ac, p_datos: { tipo: 'actividad', padre_id: se, texto: 'Actividad (ficticia) editada por el gestor', responsable_id: ID.GESTOR_C1 } })
  comprobar('En borrador el gestor edita la estructura directo (todavía no rige nada)', !borr.error, borr.error?.message)
  const prog5 = await s.ADMSEDE_C1.rpc('programar_semana', { p_actividad: ac, p_semana: 5, p_programada: true, p_motivo: null })
  comprobar('El administrador programa una semana (las semanas las programa solo él)', !prog5.error, prog5.error?.message)
  const apr = await s.ADMSEDE_C1.rpc('aprobar_programa', { p_id: P })
  comprobar('El administrador de la sede 1 aprueba el programa', !apr.error, apr.error?.message)
  const directo = await s.GESTOR_C1.rpc('programar_semana', { p_actividad: ac, p_semana: 6, p_programada: true, p_motivo: 'Directo (ficticio)' })
  comprobar('Aprobado, el gestor sin marca no cambia el programa directo', SIN_PERMISO(directo), directo.error?.message)
  const sem = async (w) => ((await dueno.from('passt_semanas').select('programada').eq('actividad_id', ac).eq('semana', w)).data ?? [])[0]?.programada === true
  const pedir = (datos, motivo = 'Se mueve por un feriado (ficticio)') => s.GESTOR_C1.rpc('solicitar_cambio', { p_tipo: 'cambio_programa', p_objetivo: P, p_datos: datos, p_motivo: motivo })
  comprobar('Una operación fuera de la lista no se solicita', Boolean((await pedir({ operacion: 'aprobar_programa', p_id: P })).error))
  comprobar('Un programa de la sede 2 no se solicita', Boolean((await s.GESTOR_C1.rpc('solicitar_cambio', { p_tipo: 'cambio_programa', p_objetivo: (await dueno.from('passt_programas').select('id').eq('empresa_id', empresa).eq('sede_id', S2).limit(1).single()).data.id, p_datos: { operacion: 'programar_semana', p_actividad: ac, p_semana: 6, p_programada: true }, p_motivo: 'Intruso' })).error))
  const a = await pedir({ operacion: 'programar_semana', p_actividad: ac, p_semana: 6, p_programada: true })
  comprobar('El gestor solicita programar la semana 6', !a.error, a.error?.message)
  comprobar('Mientras está pendiente no cambia nada', !(await sem(6)))
  const ok = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: a.data, p_aprobar: true, p_comentario: 'Aprobado (ficticio)' })
  comprobar('El administrador aprueba y la semana queda programada', !ok.error && (await sem(6)), ok.error?.message)
  const h = (await dueno.from('passt_historial').select('hecho_por, motivo').eq('programa_id', P).order('id', { ascending: false }).limit(1)).data?.[0]
  comprobar('El historial del programa dice quién aprobó y el motivo del gestor', h?.hecho_por === ID.ADMSEDE_C1 && Boolean(h.motivo?.includes('feriado')), JSON.stringify(h))
  const b = await pedir({ operacion: 'programar_semana', p_actividad: ac, p_semana: 7, p_programada: true })
  const den = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: b.data, p_aprobar: false, p_comentario: 'Ese mes no (ficticio)' })
  comprobar('El administrador deniega: el programa queda igual', !den.error && !(await sem(7)) && (await estadoDe(b.data)).estado === 'denegada', den.error?.message)
  const c = await pedir({ operacion: 'baja_nodo', p_id: ac })
  const apC = await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: c.data, p_aprobar: true, p_comentario: 'Sí' })
  comprobar('También se puede pedir dar de baja una actividad', !apC.error && (await dueno.from('passt_nodos').select('vigente').eq('id', ac).single()).data.vigente === false, apC.error?.message)
  s.ACTIVIDAD_FAC = ac
}

// ───────────────────────────────────────────────
seccion('7. Gestor con la marca «sin aprobación»: lo hace directo y el administrador recibe la comunicación')
{
  const dar = (permiso, quien = 'ADMSEDE_C1', vinculo = V.GESTOR_C1) => s[quien].rpc('dar_facultad', { p_vinculo: vinculo, p_permiso: permiso })
  const comunicadas = async (n) => ((await s[n].from('solicitudes_cambio').select('id, tipo, estado, solicitado_por').eq('empresa_id', empresa).eq('estado', 'comunicada')).data ?? [])
  const g = await dar('inspecciones.anular')
  comprobar('El administrador de la sede 1 marca «anular inspecciones» al gestor 1', !g.error, g.error?.message)
  comprobar('mis_permisos del gestor lo incluye', ((await s.GESTOR_C1.rpc('mis_permisos')).data ?? []).includes('inspecciones.anular'))
  const antes = (await comunicadas('ADMSEDE_C1')).length
  const an = await s.GESTOR_C1.rpc('anular_inspeccion', { p_id: I.s1, p_motivo: 'Duplicada (ficticio)' })
  comprobar('Con la marca, el gestor anula directo', !an.error, an.error?.message)
  const c1 = await comunicadas('ADMSEDE_C1')
  comprobar('El administrador de la sede recibe la comunicación', c1.length === antes + 1 && c1.some((x) => x.tipo === 'anular_inspeccion' && x.solicitado_por === ID.GESTOR_C1))
  comprobar('El administrador general también', (await comunicadas('ADMIN_C')).some((x) => x.solicitado_por === ID.GESTOR_C1 && x.tipo === 'anular_inspeccion'))
  comprobar('El administrador de la otra sede no', !(await comunicadas('ADMSEDE_C2')).some((x) => x.solicitado_por === ID.GESTOR_C1))
  const com = c1.find((x) => x.tipo === 'anular_inspeccion' && x.solicitado_por === ID.GESTOR_C1)
  comprobar('Una comunicación no se «resuelve» (no hay nada que aprobar)', Boolean((await s.ADMSEDE_C1.rpc('resolver_solicitud', { p_id: com.id, p_aprobar: false, p_comentario: 'No' })).error))
  const v = await s.ADMSEDE_C1.rpc('marcar_solicitud_vista', { p_id: com.id })
  comprobar('El administrador la marca como vista', !v.error && ((await dueno.from('solicitudes_cambio').select('vistos').eq('id', com.id).single()).data.vistos ?? []).includes(ID.ADMSEDE_C1), v.error?.message)
  const real2 = (await dueno.from('inspecciones').select('edicion, respuestas').eq('id', I.s2).single()).data
  comprobar('El gestor sin esa marca para corregir sigue necesitando aprobación', (await llamarFuncion(s.GESTOR_C1, 'registrar-inspeccion', { modo: 'corregir', id: I.s2, edicion: real2.edicion, motivo: 'Directo', respuestas: real2.respuestas })).estado === 403)

  await dar('inspecciones.editar_cerrada')
  const ed = (await dueno.from('inspecciones').select('edicion, respuestas, sede_id').eq('id', I.s1 === null ? I.s2 : I.s2).single()).data
  const sinSede = await llamarFuncion(s.GESTOR_C1, 'registrar-inspeccion', { modo: 'corregir', id: I.s2, edicion: ed.edicion, motivo: 'Intruso', respuestas: ed.respuestas })
  comprobar('Con la marca, igual no corrige inspecciones de otra sede', sinSede.estado === 403, `${sinSede.estado}`)
  const nueva = await registrar('ADMSEDE_C1', S1, act1)
  const ed1 = (await dueno.from('inspecciones').select('edicion, respuestas').eq('id', nueva).single()).data
  const corr = await llamarFuncion(s.GESTOR_C1, 'registrar-inspeccion', { modo: 'corregir', id: nueva, edicion: ed1.edicion, motivo: 'Directo con la marca (ficticio)', respuestas: ed1.respuestas })
  comprobar('Con la marca, el gestor corrige directo en su sede', corr.estado === 200, `${corr.estado} ${corr.datos?.error ?? ''}`)
  comprobar('…y el administrador recibe la comunicación de la corrección', (await comunicadas('ADMSEDE_C1')).some((x) => x.tipo === 'corregir_inspeccion' && x.solicitado_por === ID.GESTOR_C1))

  await dar('passt.reprogramar')
  const P = s.PROGRAMA_FAC
  const og = (await dueno.from('passt_nodos').select('id').eq('programa_id', P).eq('tipo', 'objetivo_general').single()).data.id
  const ac2 = (await s.ADMSEDE_C1.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'seccion', padre_id: og, texto: 'Sección nueva (ficticia)' } }))
  const dir = await s.GESTOR_C1.rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: og, texto: 'Objetivo agregado por el gestor (ficticio)', motivo: 'Ajuste pedido por la jefatura (ficticio)' } })
  comprobar('Con la marca, el gestor cambia el programa aprobado directo', !dir.error, dir.error?.message ?? ac2.error?.message)
  comprobar('…y el administrador recibe la comunicación del cambio del programa', (await comunicadas('ADMSEDE_C1')).some((x) => x.tipo === 'cambio_programa' && x.solicitado_por === ID.GESTOR_C1))
  const progS2 = (await dueno.from('passt_programas').select('id').eq('empresa_id', empresa).eq('sede_id', S2).limit(1).single()).data.id
  const o2 = (await dueno.from('passt_nodos').select('id').eq('programa_id', progS2).eq('tipo', 'objetivo_general').single()).data.id
  comprobar('…pero no en el programa de la sede 2', SIN_PERMISO(await s.GESTOR_C1.rpc('guardar_nodo', { p_programa: progS2, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: o2, texto: 'Intruso', motivo: 'Intruso' } })))
  for (const p of ['inspecciones.anular', 'inspecciones.editar_cerrada', 'passt.reprogramar']) await s.ADMSEDE_C1.rpc('quitar_facultad', { p_vinculo: V.GESTOR_C1, p_permiso: p })
  const sinMarca = await s.GESTOR_C1.rpc('anular_inspeccion', { p_id: nueva, p_motivo: 'Directo (ficticio)' })
  comprobar('Al quitar las marcas vuelve a necesitar aprobación', SIN_PERMISO(sinMarca), sinMarca.error?.message)
  comprobar('A un gestor no se le marca «registrar inspecciones» (ya lo tiene) ni nada fuera de las tres', Boolean((await s.ADMSEDE_C1.rpc('dar_facultad', { p_vinculo: V.GESTOR_C1, p_permiso: 'cuentas.crear' })).error))
  comprobar('Un gestor no puede marcarse las tres a sí mismo', SIN_PERMISO(await s.GESTOR_C1.rpc('dar_facultad', { p_vinculo: V.GESTOR_C1, p_permiso: 'inspecciones.anular' })))
}

// ───────────────────────────────────────────────
seccion('8. El gestor maneja el personal de su sede, con límites')
{
  const doc = () => `43${randomInt(100000, 999999)}`
  const crear = (n, rol, sedes, documento = doc()) => llamarFuncion(s[n], 'crear-cuenta', { empresa_id: empresa, rol, tipo_documento: 'dni', numero_documento: documento, apellidos_nombres: `PRUEBA PERSONAL ${documento}, Ana (ficticia)`, fecha_ingreso: '2026-01-15', puesto: 'Prueba', area: 'Seguridad', sedes })
  // Cuentas FIJAS (nivel 2, 04/11/2026): la prueba ya no crea cuentas nuevas en cada corrida. La primera vez el gestor las crea (y se comprueba);
  // las siguientes se reutilizan: se buscan por documento y, si están cesadas, el gestor las reactiva.
  const FIJO = { usuario: '43000091', usuario_gestor: '43000092' }
  const fija = async (rol) => {
    const p = (await dueno.from('personas').select('id').eq('tipo_documento', 'dni').eq('numero_documento', FIJO[rol]).maybeSingle()).data
    const v = p ? (await dueno.from('vinculos').select('id, persona_id, estado').eq('persona_id', p.id).eq('empresa_id', empresa).maybeSingle()).data : null
    if (!v) {
      const r = await crear('GESTOR_C2', rol, [S2], FIJO[rol])
      comprobar(rol === 'usuario' ? 'El gestor de la sede 2 crea un usuario en su sede (cuenta fija, solo la primera vez)' : '…y un usuario gestor (cuenta fija, solo la primera vez)', r.estado === 200, `${r.estado} ${r.datos?.error ?? ''}`)
      return r.estado === 200 ? (await dueno.from('vinculos').select('id, persona_id').eq('empresa_id', empresa).eq('rol', rol).eq('estado', 'activo').order('creado_en', { ascending: false }).limit(1)).data[0] : null
    }
    if (v.estado !== 'activo') {
      const r = await s.GESTOR_C2.rpc('reactivar_vinculo', { p_vinculo: v.id })
      comprobar(`Se reutiliza la cuenta fija de ${rol === 'usuario' ? 'usuario' : 'usuario gestor'}: el gestor de su sede la reactiva`, !r.error, r.error?.message)
    } else comprobar(`Se reutiliza la cuenta fija de ${rol === 'usuario' ? 'usuario' : 'usuario gestor'} (ya estaba activa)`, true)
    return { id: v.id, persona_id: v.persona_id }
  }
  const u = await fija('usuario')
  const ug = await fija('usuario_gestor')
  const vincsAntes = (await dueno.from('vinculos').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa)).count
  comprobar('No crea un gestor', (await crear('GESTOR_C2', 'gestor', [S2])).estado >= 400)
  comprobar('No crea un administrador de sede', (await crear('GESTOR_C2', 'admin_sede', [S2])).estado >= 400)
  comprobar('No crea un administrador general', (await crear('GESTOR_C2', 'admin_empresa', [])).estado >= 400)
  comprobar('No crea cuentas en la sede 1', (await crear('GESTOR_C2', 'usuario', [S1])).estado >= 400)
  comprobar('Un usuario gestor no crea cuentas', (await crear('USUGES_C1', 'usuario', [S1])).estado >= 400)
  comprobar('Un usuario no crea cuentas', (await crear('USUARIO_C1', 'usuario', [S1])).estado >= 400)
  if (u) {
    const vu = u
    const vistaG = (await s.GESTOR_C2.from('vinculos').select('id').eq('id', vu.id)).data ?? []
    comprobar('El gestor ve las cuentas de su sede', vistaG.length === 1)
    const cs = await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: vu.id, p_fecha_cese: HOY, p_motivo: 'Fin de la prueba (ficticio)' })
    comprobar('El gestor cesa a un usuario de su sede', !cs.error, cs.error?.message)
    const rea = await s.GESTOR_C2.rpc('reactivar_vinculo', { p_vinculo: vu.id })
    comprobar('…y lo reactiva', !rea.error, rea.error?.message)
    await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: vu.id, p_fecha_cese: HOY, p_motivo: 'Fin de la prueba (ficticio)' })
    const pw = await llamarFuncion(s.GESTOR_C2, 'dar-contrasena', { persona_id: vu.persona_id })
    comprobar('El gestor no da contraseñas nuevas', pw.estado >= 400, `${pw.estado} ${pw.datos?.error ?? ''}`)
  }
  if (ug) await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: ug.id, p_fecha_cese: HOY, p_motivo: 'Fin de la prueba (ficticio)' })
  const vincsDespues = (await dueno.from('vinculos').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa)).count
  comprobar('Las cuentas de personal no se acumulan: tras las pruebas negativas la empresa D no ganó vínculos', vincsDespues === vincsAntes, `${vincsAntes} → ${vincsDespues}`)
  comprobar('No cesa a otro gestor', SIN_PERMISO(await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: V.GESTOR_C1, p_fecha_cese: HOY, p_motivo: 'Intruso' })))
  comprobar('No cesa a un administrador', SIN_PERMISO(await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: V.ADMSEDE_C2, p_fecha_cese: HOY, p_motivo: 'Intruso' })))
  comprobar('No cesa a una cuenta de la sede 1', SIN_PERMISO(await s.GESTOR_C2.rpc('cesar_vinculo', { p_vinculo: V.USUARIO_C1, p_fecha_cese: HOY, p_motivo: 'Intruso' })))
  comprobar('No cambia el rol de un usuario gestor a gestor', Boolean((await s.GESTOR_C2.rpc('actualizar_persona', { p_vinculo: V.USUGES_C2, p_datos: { rol: 'gestor' } })).error))
}

// ───────────────────────────────────────────────
seccion('9. Nadie escribe directo; otras empresas no ven nada; anon no ejecuta')
{
  for (const t of ['facultades_persona', 'facultades_historial', 'solicitudes_cambio']) {
    const ins = await s.ADMIN_C.from(t).insert({})
    const upd = await s.ADMIN_C.from(t).update({ estado: 'aprobada' }).is('id', null)
    const del = await s.ADMIN_C.from(t).delete().is('id', null)
    comprobar(`Nadie escribe directo en ${t} (ni el administrador general)`, [ins, upd, del].every((r) => /permission denied/i.test(r.error?.message ?? '') || ['42703', 'PGRST204'].includes(r.error?.code)), [ins, upd, del].map((r) => r.error?.message).join(' | '))
    const ajeno = await s.ADMIN_B.from(t).select('*', { count: 'exact', head: true })
    comprobar(`Otra empresa no ve nada de ${t}`, (ajeno.count ?? 0) === 0)
  }
  const { cliente } = await import('./comun.mjs')
  const anon = cliente()
  for (const [f, args] of [['mis_permisos', {}], ['dar_facultad', { p_vinculo: V.USUGES_C1, p_permiso: 'passt.ver' }], ['quitar_facultad', { p_vinculo: V.USUGES_C1, p_permiso: 'passt.ver' }],
    ['solicitar_cambio', { p_tipo: 'anular_inspeccion', p_objetivo: I.s2, p_datos: {}, p_motivo: 'Intruso' }], ['resolver_solicitud', { p_id: randomUUID(), p_aprobar: true, p_comentario: 'x' }], ['marcar_solicitud_vista', { p_id: randomUUID() }]]) {
    const r = await anon.rpc(f, args)
    comprobar(`Sin sesión no se ejecuta ${f}`, Boolean(r.error))
  }
  comprobar('El dueño de la plataforma ve las solicitudes de la empresa D', ((await dueno.from('solicitudes_cambio').select('id').eq('empresa_id', empresa)).data ?? []).length > 0)
}

// ───────────────────────────────────────────────
seccion('10. Limpieza: la prueba borra lo que ella misma creó en la empresa D (nada de antes, nada de otras empresas)')
{
  const cuenta = async (tabla, col, valor, extra = (q) => q) => (await extra(dueno.from(tabla).select('*', { count: 'exact', head: true }).eq(col, valor))).count ?? 0
  const solD = () => cuenta('solicitudes_cambio', 'empresa_id', empresa)
  const solNuevas = async () => (await dueno.from('solicitudes_cambio').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa).gte('solicitado_en', INICIO)).count ?? 0
  const hisNuevo = async () => (await dueno.from('facultades_historial').select('*', { count: 'exact', head: true }).eq('empresa_id', empresa).gte('hecho_en', INICIO)).count ?? 0
  const otrasSol = async () => (await dueno.from('solicitudes_cambio').select('*', { count: 'exact', head: true }).neq('empresa_id', empresa)).count ?? 0
  const otrasHis = async () => (await dueno.from('facultades_historial').select('*', { count: 'exact', head: true }).neq('empresa_id', empresa)).count ?? 0
  const antesSol = await solD()
  const nuevasSol = await solNuevas()
  const nuevoHis = await hisNuevo()
  const ajenasSol = await otrasSol()
  const ajenasHis = await otrasHis()
  comprobar('La prueba dejó solicitudes e historial nuevos (hay algo que limpiar)', nuevasSol > 0 && nuevoHis > 0, `${nuevasSol} · ${nuevoHis}`)
  for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'GESTOR_C1', 'USUGES_C1', 'USUARIO_C1', 'ADMIN_A']) {
    const r = await s[n].rpc('limpiar_pruebas_facultades', { p_empresa: empresa, p_desde: INICIO })
    comprobar(`${n} no puede ejecutar la limpieza (solo el dueño de la plataforma)`, SIN_PERMISO(r), JSON.stringify(r.error))
  }
  const viejo = await dueno.rpc('limpiar_pruebas_facultades', { p_empresa: empresa, p_desde: '2020-01-01T00:00:00Z' })
  comprobar('No acepta una fecha de inicio vieja (no borra de más)', !!viejo.error, viejo.error?.message)
  const demo = (await dueno.from('empresas').select('id').eq('ruc', '20000000061').maybeSingle()).data?.id
  if (demo) {
    const rd = await dueno.rpc('limpiar_pruebas_facultades', { p_empresa: demo, p_desde: INICIO })
    comprobar('No limpia la empresa de la demo', !!rd.error, rd.error?.message)
  }
  const ra = await dueno.rpc('limpiar_pruebas_facultades', { p_empresa: (await dueno.from('empresas').select('id').neq('id', empresa).limit(1)).data?.[0]?.id ?? randomUUID(), p_desde: INICIO })
  comprobar('No limpia otra empresa de prueba ni una que no existe', !!ra.error, ra.error?.message)
  const r = await dueno.rpc('limpiar_pruebas_facultades', { p_empresa: empresa, p_desde: INICIO })
  comprobar('El dueño ejecuta la limpieza de la empresa D', !r.error, r.error?.message)
  comprobar('Ya no quedan solicitudes ni historial de esta corrida', (await solNuevas()) === 0 && (await hisNuevo()) === 0)
  comprobar('Lo de antes de la prueba sigue intacto (solo se fue lo nuevo)', (await solD()) === antesSol - nuevasSol)
  comprobar('Las demás empresas (la demo, A, B) no perdieron nada', (await otrasSol()) === ajenasSol && (await otrasHis()) === ajenasHis)
  comprobar('No quedan facultades marcadas por la prueba', ((await dueno.from('facultades_persona').select('permiso').eq('empresa_id', empresa).gte('otorgado_en', INICIO)).data ?? []).length === 0)
  comprobar('Las cuentas de prueba siguen ahí', (await dueno.from('vinculos').select('id').in('id', Object.values(V))).data?.length === Object.keys(V).length)
}

// Limpieza: el programa de la prueba se desactiva para que no se acumulen
await s.ADMSEDE_C1.rpc('cambiar_vigencia_programa', { p_id: s.PROGRAMA_FAC, p_vigente: false })

const res = resumen()
const lineas = ['# Pruebas de la etapa 2: usuario gestor, facultades y solicitudes', '', `Fecha: ${new Date().toISOString()} · Base: crc-dev · Datos FICTICIOS (empresa D) · **${resultados.length - res} de ${resultados.length} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.paso ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.paso ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/facultades.md', lineas.join('\n'))
process.exit(res ? 1 : 0)
