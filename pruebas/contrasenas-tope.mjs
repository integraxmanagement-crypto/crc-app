// Prueba del tope de 50 intentos al generar contraseñas iniciales al azar (nivel 2, 06/11/2026). No usa la base de datos ni cuentas.
// Uso: node pruebas/contrasenas-tope.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { comprobar, resultados, resumen } from './comun.mjs'
import { INTENTOS_MAXIMOS_CONTRASENA, generarContrasenaInicial, validarContrasena } from '../supabase/functions/_compartido/contrasenas.ts'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }

seccion('1. El tope')
comprobar('El tope por omisión es de 50 intentos', INTENTOS_MAXIMOS_CONTRASENA === 50)
{
  let llamadas = 0
  let error = null
  try { generarContrasenaInicial('12345678', { candidata: () => { llamadas++; return 'abc' } }) } catch (e) { error = e }
  comprobar('Si ninguna candidata sirve, falla (no sigue sin fin)', error instanceof Error)
  comprobar('Probó exactamente 50 veces antes de rendirse', llamadas === 50, String(llamadas))
  comprobar('El error es claro y dice cuántos intentos se hicieron', /50 intentos/.test(error?.message ?? '') && /Intenta de nuevo/.test(error?.message ?? ''), error?.message)
}
{
  let llamadas = 0
  let error = null
  try { generarContrasenaInicial('12345678', { maximo: 7, candidata: () => { llamadas++; return '12345678' } }) } catch (e) { error = e }
  comprobar('El tope se puede cambiar (para pruebas): con 7 prueba 7 veces', llamadas === 7 && /7 intentos/.test(error?.message ?? ''))
}

seccion('2. Funciona normal cuando hay una candidata buena')
{
  let llamadas = 0
  const buena = 'Zq7#kP2m-Xe9'
  const r = generarContrasenaInicial('12345678', { candidata: () => (++llamadas < 3 ? 'abc' : buena) })
  comprobar('Si la tercera candidata sirve, la devuelve y se detiene ahí', r === buena && llamadas === 3, `${r} / ${llamadas}`)
  comprobar('Una candidata buena al primer intento se devuelve al primer intento', (() => { let n = 0; const x = generarContrasenaInicial('12345678', { candidata: () => (n++, buena) }); return x === buena && n === 1 })())
  comprobar('La candidata que contiene el documento se rechaza (y se sigue probando)', (() => { let n = 0; const x = generarContrasenaInicial('12345678', { candidata: () => (++n === 1 ? 'Zq12345678-x' : buena) }); return x === buena && n === 2 })())
}

seccion('3. La generación al azar de siempre sigue igual')
{
  const hechas = new Set()
  let todasValidas = true
  let largoOk = true
  for (let i = 0; i < 300; i++) {
    const c = generarContrasenaInicial('43000091')
    hechas.add(c)
    if (validarContrasena(c, '43000091') !== null) todasValidas = false
    if (c.length !== 12) largoOk = false
  }
  comprobar('300 contraseñas al azar: todas cumplen las reglas', todasValidas)
  comprobar('Todas de 12 caracteres', largoOk)
  comprobar('No se repite ninguna', hechas.size === 300, String(hechas.size))
}

const ok = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba del tope de 50 intentos al generar contraseñas', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · Sin base de datos.`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/contrasenas-tope.md', lineas.join('\n'))
process.exit(ok ? 0 : 1)
