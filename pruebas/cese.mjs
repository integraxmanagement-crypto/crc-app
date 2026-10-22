// Prueba del paso 4: cese y reactivación, y bloqueo del ingreso de una persona cesada.
// Deja a USUARIO_A cesado al terminar (para probar el ingreso a mano en la app).
// Uso: node pruebas/cese.mjs
import { comprobar, ingresarComo, resumen } from './comun.mjs'

const { c: adminA } = await ingresarComo('ADMIN_A')
const { c: adminB } = await ingresarComo('ADMIN_B')
const { c: gestorA } = await ingresarComo('GESTOR_A')

// Vínculo de USUARIO_A, visto por su administrador.
const { data: vinculos } = await adminA
  .from('vinculos')
  .select('id, estado, personas!inner(numero_documento)')
  .eq('personas.numero_documento', '20000003')
const vinculo = vinculos?.[0]
comprobar('El administrador A ve el vínculo de su usuario', Boolean(vinculo))

// Si quedó cesado de una corrida anterior, se reactiva para empezar de cero.
if (vinculo?.estado === 'cesado') await adminA.rpc('reactivar_vinculo', { p_vinculo: vinculo.id })

// USUARIO_A abre sesión ANTES del cese (como un celular con la app abierta).
const { c: usuarioA, error: e0 } = await ingresarComo('USUARIO_A')
comprobar('Antes del cese, USUARIO_A ingresa', !e0, e0?.message)
const antes = await usuarioA.from('empresas').select('razon_social')
comprobar('Antes del cese, USUARIO_A ve su empresa', antes.data?.length === 1)

// Intentos de cese no permitidos.
const porB = await adminB.rpc('cesar_vinculo', { p_vinculo: vinculo.id, p_fecha_cese: '2026-10-22', p_motivo: 'Prueba indebida' })
comprobar('El administrador B NO puede cesar a alguien de A', porB.error?.message === 'No autorizado', porB.error?.message)
const porGestor = await gestorA.rpc('cesar_vinculo', { p_vinculo: vinculo.id, p_fecha_cese: '2026-10-22', p_motivo: 'Prueba indebida' })
comprobar('El gestor A NO puede cesar cuentas', porGestor.error?.message === 'No autorizado', porGestor.error?.message)
const sinMotivo = await adminA.rpc('cesar_vinculo', { p_vinculo: vinculo.id, p_fecha_cese: '2026-10-22', p_motivo: '' })
comprobar('El cese exige un motivo', Boolean(sinMotivo.error), sinMotivo.error?.message)

// Cese real.
const cese = await adminA.rpc('cesar_vinculo', {
  p_vinculo: vinculo.id, p_fecha_cese: '2026-10-22', p_motivo: 'Fin de contrato (prueba ficticia)',
})
comprobar('El administrador A cesa a USUARIO_A (fecha y motivo)', !cese.error, cese.error?.message)

const despues = await usuarioA.from('empresas').select('razon_social')
comprobar('Con la sesión que ya tenía abierta, ya no ve datos de la empresa', despues.data?.length === 0)
const renovar = await usuarioA.auth.refreshSession()
comprobar('Su sesión abierta se cerró: no puede renovar el permiso (como al volver la señal)', Boolean(renovar.error), renovar.error?.message)

const { data: historial } = await adminA
  .from('vinculos_historial')
  .select('accion, motivo_cese, fecha_cese')
  .eq('vinculo_id', vinculo.id)
  .order('hecho_en')
comprobar('El historial guarda el cese con fecha y motivo', historial?.at(-1)?.accion === 'cese' && Boolean(historial.at(-1).motivo_cese))

// Reactivación y nuevo cese.
const reac = await adminA.rpc('reactivar_vinculo', { p_vinculo: vinculo.id })
comprobar('El administrador A puede reactivar la cuenta', !reac.error, reac.error?.message)
const { c: usuarioA2, error: e2 } = await ingresarComo('USUARIO_A')
const otraVez = e2 ? null : await usuarioA2.from('empresas').select('razon_social')
comprobar('Reactivada, USUARIO_A vuelve a ingresar y ver su empresa', !e2 && otraVez?.data?.length === 1, e2?.message)
await adminA.rpc('cesar_vinculo', { p_vinculo: vinculo.id, p_fecha_cese: '2026-10-22', p_motivo: 'Fin de contrato (prueba ficticia)' })

// Ingreso de una persona cesada.
const { c: cesada, error: e3 } = await ingresarComo('USUARIO_A')
if (e3) {
  comprobar('Una persona cesada NO puede ingresar (portero activo)', e3.message.includes('inhabilitada'), e3.message)
} else {
  const ve = await cesada.from('empresas').select('razon_social')
  console.log('ℹ️  Portero aún apagado: la persona cesada logra iniciar sesión, pero...')
  comprobar('...no ve ningún dato de la empresa', ve.data?.length === 0)
  console.log('   → Falta activar el portero para que ni siquiera pueda ingresar.')
}

process.exit(resumen() ? 1 : 0)
