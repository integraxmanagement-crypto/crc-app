// Prueba del paso 3: primer ingreso del dueño ficticio y cambio obligatorio de contraseña.
// Uso: node pruebas/primer-ingreso.mjs   (desde la carpeta del proyecto)
import { claveFuerte, comprobar, guardarCuenta, ingresarComo, llamarFuncion, resumen } from './comun.mjs'

const { c, error } = await ingresarComo('DUENO')
comprobar('El dueño ficticio ingresa con su contraseña inicial', !error, error?.message)
if (error) process.exit(1)

const { data: yo } = await c.auth.getUser()
const persona = await c.from('personas').select('debe_cambiar_contrasena').eq('id', yo.user.id).single()
// Prueba de UNA sola vez: cambia la contraseña del dueño ficticio. Si ya la cambió, no se toca nada
// (el dueño usa esa cuenta en el navegador y dejaría de conocer su contraseña).
if (persona.data?.debe_cambiar_contrasena !== true) {
  console.log('El dueño ficticio ya cambió su contraseña: esta prueba es solo para el primer ingreso. No se hizo ningún cambio.')
  process.exit(0)
}
comprobar('La app sabe que debe cambiar la contraseña', persona.data?.debe_cambiar_contrasena === true)

const { cuentas } = await import('./comun.mjs')
const inicial = cuentas.DUENO_CLAVE
for (const [mala, porque] of [
  ['10000001ab', 'contiene el documento'],
  ['peru2026', 'muy común'],
  ['abcd1234', 'secuencia'],
  ['corta1', 'menos de 8'],
]) {
  const r = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: mala })
  comprobar(`Rechaza una contraseña nueva débil (${porque})`, r.estado === 400, r.datos?.error)
}

const r0 = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: 'NoEsLaActual-55', contrasena_nueva: claveFuerte() })
comprobar('Rechaza el cambio si la contraseña actual está mal', r0.estado === 400, r0.datos?.error)

const nueva = claveFuerte()
const r = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
comprobar('Acepta una contraseña nueva fuerte', r.estado === 200, r.datos?.error)
if (r.estado === 200) guardarCuenta('DUENO', cuentas.DUENO_DOC, nueva)

const despues = await c.from('personas').select('debe_cambiar_contrasena').eq('id', yo.user.id).single()
comprobar('Ya no se le pide cambiarla', despues.data?.debe_cambiar_contrasena === false)

const vieja = await ingresarComo('DUENO', inicial)
comprobar('La contraseña inicial ya no sirve', vieja.error?.code === 'invalid_credentials', vieja.error?.message)
const otra = await ingresarComo('DUENO', nueva)
comprobar('La contraseña nueva sí sirve', !otra.error, otra.error?.message)

process.exit(resumen() ? 1 : 0)
