// Prueba del hallazgo M1 del análisis de seguridad (12/11/2026): el bloqueo por intentos no se salta con pedidos simultáneos.
// Envía 20 contraseñas equivocadas EN EL MISMO INSTANTE para un documento ficticio que no existe (no toca ninguna cuenta).
// Antes del arreglo podían pasar las 20; ahora como máximo 5 reciben «incorrectos» y el resto sale bloqueado.
// Uso: node pruebas/bloqueo-simultaneo.mjs
import { comprobar, ingresarComo, ingresarConDocumento, resumen } from './comun.mjs'

const A_LA_VEZ = 20
const documento = 'dni:98' + String(Date.now()).slice(-6)
const respuestas = await Promise.all(
  Array.from({ length: A_LA_VEZ }, (_, i) => ingresarConDocumento(documento, `Equivocada-77x${i}`)),
)
const fallos = respuestas.filter((r) => r.estado === 400).length
const bloqueados = respuestas.filter((r) => r.estado === 429).length
comprobar(`De ${A_LA_VEZ} intentos simultáneos, como máximo 5 llegan a probar la contraseña`, fallos <= 5, `${fallos} probados`)
comprobar('El resto sale bloqueado (ninguno queda sin respuesta clara)', fallos + bloqueados === A_LA_VEZ, `${fallos} probados + ${bloqueados} bloqueados`)

const despues = await ingresarConDocumento(documento, 'Equivocada-77x-final')
comprobar('Un intento posterior sigue bloqueado', despues.estado === 429, despues.error?.message)

const { c: dueno } = await ingresarComo('DUENO')
const [, numero] = documento.split(':')
const { data: registro } = await dueno.from('intentos_ingreso').select('resultado').eq('numero_documento', numero)
const cuenta = (r) => (registro ?? []).filter((x) => x.resultado === r).length
comprobar('En el registro quedan como máximo 5 fallos y ningún intento sin terminar',
  cuenta('fallo') <= 5 && cuenta('en_curso') === 0 && cuenta('bloqueado') === A_LA_VEZ + 1 - cuenta('fallo'),
  (registro ?? []).map((x) => x.resultado).join(', '))

process.exit(resumen() ? 1 : 0)
