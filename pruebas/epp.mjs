// Prueba de la Gestión de EPPs (09/11/2026): catálogo, búsqueda, entrega, conformidad con contraseña, anulación y aislamiento entre empresas.
// Solo cuentas y datos FICTICIOS de crc-dev (empresas ficticias A y B). Las entregas con conformidad no se borran (son registro firmado).
// Una contraseña incorrecta cuenta para el bloqueo del ingreso: se prueba UNA sola vez. Uso: node pruebas/epp.mjs
import { randomInt } from 'node:crypto'
import { comprobar, cuentas, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|row-level security|permission denied/i.test(r.error?.message ?? '')
const SUFIJO = String(randomInt(10000, 99999))
const HOY = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const mas6 = (f) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString().slice(0, 10) }

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
console.log('\n── Catálogo y datos del formato')
const nombreEpp = `Casco ficticio EPP ${SUFIJO}`
const cat = await s.ADMIN_A.rpc('guardar_epp_catalogo', { p_id: null, p_nombre: nombreEpp, p_vida_meses: 6, p_vigente: true })
comprobar('El administrador arma el catálogo de EPP', !cat.error, cat.error?.message)
const eppId = cat.data
comprobar('El gestor no puede cambiar el catálogo', NO_AUTORIZADO(await s.GESTOR_A.rpc('guardar_epp_catalogo', { p_id: null, p_nombre: `Otro ${SUFIJO}`, p_vida_meses: null, p_vigente: true })))
comprobar('El usuario común no puede cambiar el catálogo', NO_AUTORIZADO(await s.USUARIO_A2.rpc('guardar_epp_catalogo', { p_id: null, p_nombre: `Otro ${SUFIJO}`, p_vida_meses: null, p_vigente: true })))
const repetido = await s.ADMIN_A.rpc('guardar_epp_catalogo', { p_id: null, p_nombre: nombreEpp.toUpperCase(), p_vida_meses: null, p_vigente: true })
comprobar('No se repite un EPP con el mismo nombre', !!repetido.error && /Ya hay un EPP/.test(repetido.error.message))
comprobar('Los meses fuera de 1 a 120 se rechazan', !!(await s.ADMIN_A.rpc('guardar_epp_catalogo', { p_id: null, p_nombre: `Raro ${SUFIJO}`, p_vida_meses: 500, p_vigente: true })).error)
comprobar('El administrador guarda los datos del formato', !(await s.ADMIN_A.rpc('guardar_epp_config', { p_codigo: `FIC-EPP-${SUFIJO}`, p_version: '01', p_fecha: HOY })).error)
comprobar('El gestor no cambia los datos del formato', NO_AUTORIZADO(await s.GESTOR_A.rpc('guardar_epp_config', { p_codigo: 'X', p_version: '1', p_fecha: HOY })))
const lectura = await s.GESTOR_A.from('epp_catalogo').select('id, nombre').eq('id', eppId)
comprobar('El gestor ve el catálogo de su empresa', lectura.data?.length === 1)
comprobar('El usuario común no ve el catálogo', ((await s.USUARIO_A2.from('epp_catalogo').select('id')).data ?? []).length === 0)
comprobar('La empresa B no ve el catálogo de A', ((await s.ADMIN_B.from('epp_catalogo').select('id').eq('id', eppId)).data ?? []).length === 0)

console.log('\n── Buscar al trabajador')
const yoUsuario = (await s.USUARIO_A2.auth.getUser()).data.user.id
const ficha = (await s.DUENO.from('personas').select('apellidos_nombres, tipo_documento, numero_documento').eq('id', yoUsuario).single()).data
const vinculo = (await s.DUENO.from('vinculos').select('id').eq('persona_id', yoUsuario).eq('estado', 'activo').single()).data.id
const apellido = ficha.apellidos_nombres.split(',')[0]
const porNombre = await s.ADMIN_A.rpc('buscar_trabajadores_epp', { p_texto: apellido.slice(2, 18) })
comprobar('Se busca por nombre o apellido', porNombre.data?.some((r) => r.vinculo_id === vinculo), porNombre.error?.message)
const porDoc = await s.ADMIN_A.rpc('buscar_trabajadores_epp', { p_texto: ficha.numero_documento })
comprobar('Se busca por DNI o carnet de extranjería', porDoc.data?.some((r) => r.vinculo_id === vinculo) && porDoc.data.every((r) => r.numero_documento.startsWith(ficha.numero_documento)))
const codigo = `T${SUFIJO}`
comprobar('Se guarda el código de trabajador', !(await s.ADMIN_A.rpc('fijar_codigo_trabajador', { p_vinculo: vinculo, p_codigo: codigo })).error)
const porCodigo = await s.ADMIN_A.rpc('buscar_trabajadores_epp', { p_texto: codigo })
comprobar('Se busca por código de trabajador', porCodigo.data?.length === 1 && porCodigo.data[0].codigo_trabajador === codigo)
comprobar('Menos de 2 letras no busca', (await s.ADMIN_A.rpc('buscar_trabajadores_epp', { p_texto: 'a' })).data?.length === 0)
comprobar('El usuario común no puede buscar', NO_AUTORIZADO(await s.USUARIO_A2.rpc('buscar_trabajadores_epp', { p_texto: apellido })))
comprobar('La empresa B no encuentra a trabajadores de A', ((await s.ADMIN_B.rpc('buscar_trabajadores_epp', { p_texto: ficha.numero_documento })).data ?? []).length === 0)
comprobar('El usuario común no puede poner el código', NO_AUTORIZADO(await s.USUARIO_A2.rpc('fijar_codigo_trabajador', { p_vinculo: vinculo, p_codigo: 'ZZZ' })))
comprobar('La empresa B no puede poner el código a un trabajador de A', NO_AUTORIZADO(await s.ADMIN_B.rpc('fijar_codigo_trabajador', { p_vinculo: vinculo, p_codigo: 'ZZZ' })))

console.log('\n── Entregas y conformidad')
const e1 = await s.ADMIN_A.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'nuevo' })
comprobar('Se registra la entrega de un EPP', !e1.error, e1.error?.message)
const fila = (await s.ADMIN_A.from('epp_entregas').select('*').eq('id', e1.data).single()).data
comprobar('La fecha de renovación sale de los meses del catálogo', fila?.fecha_renovacion === mas6(HOY), fila?.fecha_renovacion)
comprobar('La entrega queda sin conformidad', fila?.conformidad_en === null && fila?.epp_nombre === nombreEpp)
comprobar('El motivo debe ser válido', !!(await s.ADMIN_A.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'regalo' })).error)
comprobar('Una fecha futura se rechaza', !!(await s.ADMIN_A.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: '2099-01-01', p_motivo: 'nuevo' })).error)
comprobar('El usuario común no puede registrar entregas', NO_AUTORIZADO(await s.USUARIO_A2.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'nuevo' })))
comprobar('La empresa B no puede registrar entregas a trabajadores de A', NO_AUTORIZADO(await s.ADMIN_B.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'nuevo' })))
comprobar('Nadie escribe directo en la tabla de entregas', !!(await s.ADMIN_A.from('epp_entregas').insert({ empresa_id: fila.empresa_id, vinculo_id: vinculo, persona_id: yoUsuario, epp_nombre: 'x', fecha_entrega: HOY, motivo: 'nuevo', entregado_por: yoUsuario })).error)
comprobar('La empresa B no ve las entregas de A', ((await s.ADMIN_B.from('epp_entregas').select('id').eq('id', e1.data)).data ?? []).length === 0)
comprobar('El usuario común no ve las entregas', ((await s.USUARIO_A2.from('epp_entregas').select('id')).data ?? []).length === 0)

const doc = { tipo_documento: ficha.tipo_documento, numero_documento: ficha.numero_documento }
const conf = (c, body) => llamarFuncion(c, 'confirmar-entrega-epp', body)
let r = await conf(s.ADMIN_B, { entrega_id: e1.data, ...doc, contrasena: cuentas.USUARIO_A2_CLAVE })
comprobar('La empresa B no puede dar la conformidad de una entrega de A', r.estado === 403, `estado ${r.estado}`)
r = await conf(s.USUARIO_A2, { entrega_id: e1.data, ...doc, contrasena: cuentas.USUARIO_A2_CLAVE })
comprobar('El usuario común no puede usar la función de conformidad', r.estado === 403, `estado ${r.estado}`)
r = await conf(s.GESTOR_A, { entrega_id: e1.data, tipo_documento: 'dni', numero_documento: '99999999', contrasena: 'cualquiera1' })
comprobar('Un documento que no es del trabajador se rechaza sin probar contraseña', r.estado === 422, `estado ${r.estado}`)
r = await conf(s.GESTOR_A, { entrega_id: e1.data, ...doc, contrasena: `${cuentas.USUARIO_A2_CLAVE}x` })
comprobar('Una contraseña incorrecta no da la conformidad', r.estado === 400 && /incorrectos/.test(r.datos?.error ?? ''), `estado ${r.estado}`)
comprobar('Sigue sin conformidad', (await s.ADMIN_A.from('epp_entregas').select('conformidad_en').eq('id', e1.data).single()).data.conformidad_en === null)
r = await conf(s.GESTOR_A, { entrega_id: e1.data, ...doc, contrasena: cuentas.USUARIO_A2_CLAVE })
comprobar('Con la contraseña correcta el trabajador da su conformidad', r.estado === 200 && r.datos?.ok === true, `estado ${r.estado} ${r.datos?.error ?? ''}`)
const tras = (await s.ADMIN_A.from('epp_entregas').select('conformidad_en, conformidad_por').eq('id', e1.data).single()).data
comprobar('Queda la fecha de la conformidad y quién la dio', !!tras.conformidad_en && tras.conformidad_por === yoUsuario)
r = await conf(s.GESTOR_A, { entrega_id: e1.data, ...doc, contrasena: cuentas.USUARIO_A2_CLAVE })
comprobar('No se da la conformidad dos veces', r.estado === 409, `estado ${r.estado}`)
const anuladaFirmada = await s.ADMIN_A.rpc('anular_entrega_epp', { p_entrega: e1.data })
comprobar('Una entrega con conformidad no se puede anular', !!anuladaFirmada.error && /ya tiene la conformidad/.test(anuladaFirmada.error.message))

console.log('\n── Anular una entrega pendiente')
const e2 = await s.ADMIN_A.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'perdida' })
comprobar('La empresa B no puede anular entregas de A', NO_AUTORIZADO(await s.ADMIN_B.rpc('anular_entrega_epp', { p_entrega: e2.data })))
comprobar('Una entrega pendiente se anula', !(await s.ADMIN_A.rpc('anular_entrega_epp', { p_entrega: e2.data })).error)
comprobar('Ya no existe', ((await s.ADMIN_A.from('epp_entregas').select('id').eq('id', e2.data)).data ?? []).length === 0)
comprobar('Nadie más que el servidor marca conformidades', NO_AUTORIZADO(await s.ADMIN_A.rpc('marcar_conformidad_epp', { p_entrega: e1.data, p_persona: yoUsuario })))

console.log('\n── Desactivar un EPP del catálogo')
await s.ADMIN_A.rpc('guardar_epp_catalogo', { p_id: eppId, p_nombre: nombreEpp, p_vida_meses: 6, p_vigente: false })
comprobar('Un EPP desactivado ya no se puede entregar', !!(await s.ADMIN_A.rpc('registrar_entrega_epp', { p_vinculo: vinculo, p_epp: eppId, p_fecha: HOY, p_motivo: 'nuevo' })).error)
comprobar('Las entregas anteriores se conservan', ((await s.ADMIN_A.from('epp_entregas').select('id').eq('id', e1.data)).data ?? []).length === 1)

console.log()
void resultados
process.exit(resumen() ? 1 : 0)
