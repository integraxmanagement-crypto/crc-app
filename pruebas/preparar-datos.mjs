// Crea las personas FICTICIAS de las pruebas con la función real crear-cuenta, tal como lo hará la app:
// el dueño crea a los administradores; cada administrador crea a su gestor y su usuario.
// Cada persona hace su primer ingreso y cambia su contraseña. Las contraseñas van solo a .env.pruebas.local.
// Uso: node pruebas/preparar-datos.mjs   (se puede repetir: salta a quien ya existe)
import { claveFuerte, cuentas, guardarCuenta, ingresarComo, llamarFuncion } from './comun.mjs'

const PERSONAS = [
  // [nombre, documento, apellidos y nombres, rol, empresa (RUC), puesto, área, lo crea]
  ['ADMIN_A', 'dni:20000001', 'PRUEBA ADMIN A, Ana (ficticia)', 'admin_empresa', '20000000010', 'Jefa de SSO', 'Seguridad', 'DUENO'],
  ['GESTOR_A', 'dni:20000002', 'PRUEBA GESTOR A, Beto (ficticio)', 'gestor', '20000000010', 'Supervisor SSO', 'Operaciones', 'ADMIN_A'],
  ['USUARIO_A', 'dni:20000003', 'PRUEBA USUARIO A, Carla (ficticia)', 'usuario', '20000000010', 'Operaria', 'Planta', 'ADMIN_A'],
  ['ADMIN_B', 'dni:30000001', 'PRUEBA ADMIN B, Diego (ficticio)', 'admin_empresa', '20000000028', 'Jefe de SSO', 'Seguridad', 'DUENO'],
  ['GESTOR_B', 'dni:30000002', 'PRUEBA GESTOR B, Elena (ficticia)', 'gestor', '20000000028', 'Supervisora SSO', 'Obras', 'ADMIN_B'],
  ['USUARIO_B', 'ce:CE300003', 'PRUEBA USUARIO B, Franco (ficticio)', 'usuario', '20000000028', 'Operario', 'Obras', 'ADMIN_B'],
]

const { c: dueno, error } = await ingresarComo('DUENO')
if (error) throw new Error('El dueño ficticio no pudo ingresar: ' + error.message)
const { data: empresas } = await dueno.from('empresas').select('id, ruc')
const idEmpresa = Object.fromEntries(empresas.map((e) => [e.ruc, e.id]))

for (const [nombre, documento, apellidosNombres, rol, ruc, puesto, area, creador] of PERSONAS) {
  if (cuentas[`${nombre}_CLAVE`]) {
    console.log(`= ${nombre} ya existe, se salta`)
    continue
  }
  const { c, error: e } = await ingresarComo(creador)
  if (e) throw new Error(`${creador} no pudo ingresar: ${e.message}`)
  const [tipo, numero] = documento.split(':')
  const r = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: idEmpresa[ruc], rol, tipo_documento: tipo, numero_documento: numero,
    apellidos_nombres: apellidosNombres, fecha_ingreso: '2026-01-15', puesto, area,
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ${nombre}: ${r.datos?.error}`)
  const inicial = r.datos.contrasena_inicial
  console.log(`+ ${nombre} creado por ${creador} (contraseña inicial de ${inicial.length} caracteres, no se muestra)`)

  // Primer ingreso: cambio obligatorio de contraseña. Se guarda antes, para no perderla si algo falla.
  guardarCuenta(nombre, documento, inicial)
  const primera = await ingresarComo(nombre, inicial)
  if (primera.error) throw new Error(`${nombre} no pudo hacer su primer ingreso: ${primera.error.message}`)
  const nueva = claveFuerte()
  const cambio = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
  if (cambio.estado !== 200) throw new Error(`${nombre} no pudo cambiar su contraseña: ${cambio.datos?.error}`)
  guardarCuenta(nombre, documento, nueva)
  console.log(`  ${nombre} cambió su contraseña en el primer ingreso`)
}
console.log('\nListo. Contraseñas guardadas solo en .env.pruebas.local')
