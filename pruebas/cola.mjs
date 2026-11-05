// Prueba de las reglas de reintento de la cola de envío de inspecciones (nivel 2, 06/11/2026): tope de 12 intentos y espera mínima de 30 s.
// Son funciones puras (src/inspecciones/cola.ts): no usa la base de datos ni cuentas. Uso: node pruebas/cola.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { comprobar, resultados, resumen } from './comun.mjs'
import { ESPERAS, ESPERA_MINIMA_MS, TOPE_INTENTOS, despuesDeFallar, esperaSegundos, toca } from '../src/inspecciones/cola.ts'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }
const T0 = 1_000_000_000_000

seccion('1. Las constantes aprobadas')
comprobar('El tope es de 12 intentos', TOPE_INTENTOS === 12)
comprobar('Las esperas son 30 s, 1, 2, 5, 15 y 30 min', JSON.stringify(ESPERAS) === JSON.stringify([30, 60, 120, 300, 900, 1800]))
comprobar('La espera mínima entre intentos es de 30 segundos', ESPERA_MINIMA_MS === 30_000)
comprobar('Después de la sexta espera se repite la de 30 min', esperaSegundos(5) === 1800 && esperaSegundos(6) === 1800 && esperaSegundos(40) === 1800)

seccion('2. Tras fallar: espera creciente y, al llegar al tope, «necesita atención»')
{
  let intentos = 0
  const esperas = []
  let estado = 'pendiente'
  for (let falla = 1; falla <= 11; falla++) {
    const r = despuesDeFallar(intentos, T0)
    comprobar(`Fallo n.º ${falla}: sigue pendiente y queda con ${falla} intento(s)`, r.estado === 'pendiente' && r.intentos === falla)
    esperas.push((r.proximo_intento - T0) / 1000)
    intentos = r.intentos
    estado = r.estado
  }
  comprobar('Las esperas crecen 30, 60, 120, 300, 900 y 1800 s y luego se quedan en 1800 s', JSON.stringify(esperas) === JSON.stringify([30, 60, 120, 300, 900, 1800, 1800, 1800, 1800, 1800, 1800]), esperas.join(','))
  comprobar('Hasta el fallo 11 todavía se reintenta sola', estado === 'pendiente' && intentos === 11)
  const doce = despuesDeFallar(intentos, T0)
  comprobar('El fallo n.º 12 la pasa a «necesita atención»', doce.estado === 'atencion' && doce.intentos === 12)
  comprobar('Al pasar a «necesita atención» ya no tiene próximo intento programado', doce.proximo_intento === 0)
  const trece = despuesDeFallar(12, T0)
  comprobar('Aunque algo la intentara una vez más, sigue en «necesita atención»', trece.estado === 'atencion')
  const horas = esperas.reduce((a, b) => a + b, 0) / 3600
  comprobar('Las esperas programadas de los primeros 11 fallos suman unas 3 horas (la cifra de «unas 6 horas» del informe era una cota alta)', horas > 2 && horas < 6, `${horas.toFixed(1)} h`)
}

seccion('3. Quién se reintenta sola')
{
  const base = { proximo_intento: 0 }
  for (const e of ['enviada', 'rechazada', 'atencion']) {
    comprobar(`«${e}» no se reintenta sola, ni con envío forzado`, !toca({ ...base, estado: e }, T0 + 9e9, true) && !toca({ ...base, estado: e }, T0 + 9e9, false))
  }
  comprobar('«necesita atención» tampoco se reintenta sola cada 60 s ni al volver la señal', !toca({ estado: 'atencion', proximo_intento: 0, ultimo_intento: T0 - 9e9 }, T0, true))
  comprobar('Una pendiente nueva (sin intentos) sale en el envío normal', toca({ estado: 'pendiente', proximo_intento: 0 }, T0, false))
  comprobar('Una «enviando» que quedó a medias (la app se cerró) se retoma', toca({ estado: 'enviando', proximo_intento: 0, ultimo_intento: T0 - 60_000 }, T0, false))
  comprobar('Una pendiente con la espera sin cumplir NO sale en el envío normal', !toca({ estado: 'pendiente', proximo_intento: T0 + 60_000 }, T0, false))
  comprobar('…y sale cuando la espera se cumple', toca({ estado: 'pendiente', proximo_intento: T0 + 60_000 }, T0 + 60_000, false))
}

seccion('4. Envío forzado: se salta la espera creciente pero respeta los 30 segundos mínimos')
{
  const it = (espera = 1_800_000, ultimo = T0) => ({ estado: 'pendiente', proximo_intento: T0 + espera, ultimo_intento: ultimo })
  comprobar('Forzado a los 10 s del último intento: NO sale', !toca(it(), T0 + 10_000, true))
  comprobar('Forzado a los 29,999 s: NO sale', !toca(it(), T0 + 29_999, true))
  comprobar('Forzado justo a los 30 s: sale, aunque la espera creciente (30 min) no se haya cumplido', toca(it(), T0 + 30_000, true))
  comprobar('Forzado a los 5 min: sale', toca(it(), T0 + 300_000, true))
  comprobar('Una señal que se corta y vuelve 5 veces en 20 s no produce reintentos', [2_000, 6_000, 10_000, 14_000, 18_000].every((ms) => !toca(it(), T0 + ms, true)))
  comprobar('Envío normal con la espera cumplida pero a menos de 30 s del último intento: NO sale', !toca({ estado: 'pendiente', proximo_intento: T0, ultimo_intento: T0 }, T0 + 5_000, false))
  comprobar('Una inspección que nunca se intentó sale forzada de inmediato', toca({ estado: 'pendiente', proximo_intento: 0 }, T0, true))
  comprobar('Cada inspección cuenta su propio último intento (una reciente no bloquea a otra antigua)', !toca(it(1, T0), T0 + 5_000, true) && toca(it(1, T0 - 60_000), T0 + 5_000, true))
}

seccion('5. «Reintentar ahora» (a mano)')
{
  comprobar('El envío manual no espera ni la espera creciente ni los 30 s', toca({ estado: 'pendiente', proximo_intento: T0 + 1_800_000, ultimo_intento: T0 }, T0 + 1_000, true, true))
  comprobar('Tras reintentar a mano los intentos vuelven a cero: se cuenta de nuevo hasta 12', despuesDeFallar(0, T0).estado === 'pendiente' && despuesDeFallar(0, T0).intentos === 1)
  comprobar('«Necesita atención» no se reintenta ni con el indicador manual hasta que el botón la devuelva a «pendiente»', !toca({ estado: 'atencion', proximo_intento: 0 }, T0, true, true))
}

const ok = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba de la cola de envío: tope de 12 intentos y espera mínima de 30 s', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · Funciones puras (sin base de datos).`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/cola.md', lineas.join('\n'))
process.exit(ok ? 0 : 1)
