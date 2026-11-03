// Etapa 2 sobre la demo de dos sedes (FICTICIA, solo crc-dev): un usuario gestor en la Sede Norte con dos facultades marcadas y dos solicitudes
// del gestor de la Sede Norte que esperan al administrador (anular una inspección y corregir otra), para probar Solicitudes y Facultades en la app.
// Antes hay que correr demo-dos-sedes.mjs y demo-dos-sedes-formatos.mjs. Se puede repetir: lo que ya existe no se vuelve a crear.
// Las contraseñas van a .env.pruebas.local y nunca se imprimen. Uso: node pruebas/demo-dos-sedes-etapa2.mjs
import { claveFuerte, cuentas, guardarCuenta, ingresarComo, llamarFuncion } from './comun.mjs'

const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}
const { c: dueno } = await ingresarComo('DUENO')
const empresa = falla(await dueno.from('empresas').select('id').eq('ruc', '20000000061').single(), 'empresa demo').id
const norte = falla(await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', 'Sede Norte (demo)').single(), 'sede norte').id

// Cuenta nueva: usuario gestor de la Sede Norte (la crea el administrador de esa sede)
const NOMBRE = 'DEMO_USUGES_NORTE'
if (!cuentas[`${NOMBRE}_CLAVE`]) {
  const { c } = await ingresarComo('DEMO_ADMSEDE_NORTE')
  const r = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: empresa, rol: 'usuario_gestor', tipo_documento: 'dni', numero_documento: '42000008', apellidos_nombres: 'DEMO USUARIO GESTOR NORTE, Paola (ficticia)',
    fecha_ingreso: '2026-01-15', puesto: 'Supervisor SST', area: 'Seguridad', sedes: [norte],
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ${NOMBRE}: ${r.datos?.error}`)
  guardarCuenta(NOMBRE, 'dni:42000008', r.datos.contrasena_inicial)
  const primera = await ingresarComo(NOMBRE, r.datos.contrasena_inicial)
  if (primera.error) throw new Error(`${NOMBRE} no pudo hacer su primer ingreso: ${primera.error.message}`)
  const nueva = claveFuerte()
  const cambio = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: r.datos.contrasena_inicial, contrasena_nueva: nueva })
  if (cambio.estado !== 200) throw new Error(`${NOMBRE} no pudo cambiar su contraseña: ${cambio.datos?.error}`)
  guardarCuenta(NOMBRE, 'dni:42000008', nueva)
}

// Facultades marcadas por el administrador de la sede: ver inspecciones y ver el programa anual
const { c: adm } = await ingresarComo('DEMO_ADMSEDE_NORTE')
const { c: ug } = await ingresarComo(NOMBRE)
const idUg = (await ug.auth.getUser()).data.user.id
const vinculo = falla(await dueno.from('vinculos').select('id').eq('persona_id', idUg).eq('empresa_id', empresa).eq('estado', 'activo').single(), 'vínculo').id
for (const p of ['inspecciones.ver', 'passt.ver']) falla(await adm.rpc('dar_facultad', { p_vinculo: vinculo, p_permiso: p }), `facultad ${p}`)

// Dos solicitudes del gestor de la Sede Norte (si todavía no hay pendientes)
const { c: ges } = await ingresarComo('DEMO_GESTOR_NORTE')
const pendientes = (await dueno.from('solicitudes_cambio').select('id').eq('empresa_id', empresa).eq('estado', 'pendiente')).data ?? []
if (!pendientes.length) {
  const insp = (await dueno.from('inspecciones').select('id, edicion, respuestas').eq('empresa_id', empresa).eq('sede_id', norte).eq('estado', 'cerrada').order('numero')).data ?? []
  if (insp.length < 2) throw new Error('Faltan inspecciones de la Sede Norte: corre antes demo-dos-sedes-formatos.mjs')
  falla(await ges.rpc('solicitar_cambio', { p_tipo: 'anular_inspeccion', p_objetivo: insp[0].id, p_datos: {}, p_motivo: 'Se registró por error en esta caseta (demo ficticia)' }), 'solicitud de anulación')
  const claves = Object.keys(insp[1].respuestas ?? {})
  if (claves.length) {
    const cambiada = { ...insp[1].respuestas, [claves[0]]: { ...insp[1].respuestas[claves[0]], valor: insp[1].respuestas[claves[0]].valor === 'si' ? 'no' : 'si', obs: 'Corregido por el gestor (demo ficticia)' } }
    falla(await ges.rpc('solicitar_cambio', { p_tipo: 'corregir_inspeccion', p_objetivo: insp[1].id, p_datos: { edicion: insp[1].edicion, respuestas: cambiada }, p_motivo: 'Se marcó mal un punto (demo ficticia)' }), 'solicitud de corrección')
  }
}
console.log('Etapa 2 en la demo lista: DEMO_USUGES_NORTE (dni 42000008) con «ver inspecciones» y «ver programa anual»; el gestor Norte tiene solicitudes por resolver.')
