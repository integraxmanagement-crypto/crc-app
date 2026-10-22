// Prueba del candado de servidor: las cuentas pasan al candado al ingresar, y la "puerta trasera"
// (ingresar directo a Supabase sin pasar por la función) queda cerrada incluso con la contraseña correcta.
// Uso: node pruebas/candado.mjs
import {
  claveFuerte, cliente, comprobar, correoInterno, cuentas, guardarCuenta, ingresarComo, llamarFuncion, resumen,
} from './comun.mjs'

const ACTIVAS = ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B', 'USUARIO_B']

// 1. Cada cuenta ingresa por la función (las antiguas pasan solas al candado).
for (const n of ACTIVAS) {
  const r = await ingresarComo(n)
  comprobar(`${n} ingresa por la app con su contraseña de siempre`, !r.error, r.error?.message)
}
const { c: dueno } = await ingresarComo('DUENO')
const { data: personas } = await dueno.from('personas').select('numero_documento, clave_con_candado')
const sin = personas?.filter((p) => !p.clave_con_candado).map((p) => p.numero_documento) ?? []
comprobar('Todas las cuentas activas ya tienen candado (solo queda sin él la cesada 20000003)', sin.length === 1 && sin[0] === '20000003', `sin candado: ${sin.join(', ') || 'ninguna'}`)

// 2. La puerta trasera: ir directo a Supabase con la contraseña CORRECTA.
for (const n of ['DUENO', 'ADMIN_A', 'USUARIO_B']) {
  const { error } = await cliente().auth.signInWithPassword({ email: correoInterno(cuentas[`${n}_DOC`]), password: cuentas[`${n}_CLAVE`] })
  comprobar(`Puerta trasera cerrada: ${n} NO entra directo a Supabase ni con su contraseña correcta`, error?.code === 'invalid_credentials', error?.message ?? 'ENTRÓ')
}

// 3. Cuenta nueva creada con el candado: funciona por la app, no por la puerta trasera.
if (!cuentas.USUARIO_B2_CLAVE) {
  const { c: adminB } = await ingresarComo('ADMIN_B')
  const { data: emp } = await adminB.from('empresas').select('id').single()
  const r = await llamarFuncion(adminB, 'crear-cuenta', {
    empresa_id: emp.id, rol: 'usuario', tipo_documento: 'dni', numero_documento: '30000004',
    apellidos_nombres: 'PRUEBA USUARIO B2, Hugo (ficticio)', fecha_ingreso: '2026-05-04', puesto: 'Operario', area: 'Obras',
  })
  comprobar('Se crea una cuenta nueva con candado (USUARIO_B2)', r.estado === 200, r.datos?.error)
  if (r.estado === 200) guardarCuenta('USUARIO_B2', 'dni:30000004', r.datos.contrasena_inicial)
}
const directo = await cliente().auth.signInWithPassword({ email: correoInterno(cuentas.USUARIO_B2_DOC), password: cuentas.USUARIO_B2_CLAVE })
comprobar('La cuenta nueva NO entra directo a Supabase con su contraseña inicial', directo.error?.code === 'invalid_credentials', directo.error?.message ?? 'ENTRÓ')
const primera = await ingresarComo('USUARIO_B2')
comprobar('La cuenta nueva SÍ entra por la app con su contraseña inicial', !primera.error, primera.error?.message)

// 4. Cambio de contraseña: entrega una sesión nueva que funciona y la anterior queda cerrada.
if (!primera.error) {
  const nueva = claveFuerte()
  const r = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: cuentas.USUARIO_B2_CLAVE, contrasena_nueva: nueva })
  comprobar('USUARIO_B2 cambia su contraseña inicial', r.estado === 200 && Boolean(r.datos?.access_token), r.datos?.error)
  if (r.estado === 200) {
    guardarCuenta('USUARIO_B2', 'dni:30000004', nueva)
    const vieja = await primera.c.auth.refreshSession()
    comprobar('La sesión anterior queda cerrada', Boolean(vieja.error), vieja.error?.message)
    const c = cliente()
    await c.auth.setSession({ access_token: r.datos.access_token, refresh_token: r.datos.refresh_token })
    const renovada = await c.auth.refreshSession()
    const emp = await c.from('empresas').select('ruc')
    comprobar('La sesión nueva funciona y se puede renovar', !renovada.error && emp.data?.length === 1, renovada.error?.message)
    const puerta = await cliente().auth.signInWithPassword({ email: correoInterno(cuentas.USUARIO_B2_DOC), password: nueva })
    comprobar('Con la contraseña nueva tampoco hay puerta trasera', puerta.error?.code === 'invalid_credentials', puerta.error?.message ?? 'ENTRÓ')
  }
}

process.exit(resumen() ? 1 : 0)
