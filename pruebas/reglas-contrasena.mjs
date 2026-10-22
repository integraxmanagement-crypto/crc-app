// Prueba de las reglas de contraseña contra Supabase, con los requisitos del panel activos
// (minúscula, mayúscula, número y símbolo). Crea a USUARIO_A2 (ficticio) si no existe.
// Uso: node pruebas/reglas-contrasena.mjs
import { claveFuerte, comprobar, cuentas, guardarCuenta, ingresarComo, llamarFuncion, resumen } from './comun.mjs'

if (!cuentas.USUARIO_A2_CLAVE) {
  const { c: adminA } = await ingresarComo('ADMIN_A')
  const { data: empresa } = await adminA.from('empresas').select('id').single()
  const r = await llamarFuncion(adminA, 'crear-cuenta', {
    empresa_id: empresa.id, rol: 'usuario', tipo_documento: 'pas', numero_documento: 'PA200004',
    apellidos_nombres: 'PRUEBA USUARIO A2, Gina (ficticia)', fecha_ingreso: '2026-03-01', puesto: 'Almacenera', area: 'Logística',
  })
  comprobar('El sistema crea una cuenta nueva (pasaporte) con contraseña inicial que cumple los requisitos', r.estado === 200, r.datos?.error)
  if (r.estado !== 200) process.exit(1)
  const inicial = r.datos.contrasena_inicial
  comprobar('La contraseña inicial tiene 12 caracteres', inicial.length === 12)
  guardarCuenta('USUARIO_A2', 'pas:PA200004', inicial)
}

const { c, error } = await ingresarComo('USUARIO_A2')
comprobar('USUARIO_A2 ingresa', !error, error?.message)
const actual = cuentas.USUARIO_A2_CLAVE

for (const [mala, porque] of [
  ['arena-roja-27', 'sin mayúscula'],
  ['ArenaRoja27', 'sin símbolo'],
  ['Peru2026!', 'palabra común'],
  ['Abcd-1234', 'secuencia'],
  ['Pa200004-x', 'contiene el documento'],
]) {
  const r = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: actual, contrasena_nueva: mala })
  comprobar(`Rechaza "${mala}" (${porque})`, r.estado === 400, r.datos?.error)
}

const nueva = claveFuerte()
const r = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: actual, contrasena_nueva: nueva })
comprobar('Acepta una contraseña con minúscula, mayúscula, número y símbolo', r.estado === 200, r.datos?.error)
if (r.estado === 200) guardarCuenta('USUARIO_A2', 'pas:PA200004', nueva)

process.exit(resumen() ? 1 : 0)
