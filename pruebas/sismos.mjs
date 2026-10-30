// Prueba de las utilidades de la sección de sismos del inicio. No usa la base de datos ni internet: datos FICTICIOS.
// Uso: node pruebas/sismos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import {
  colorPorMagnitud, distanciaDeLima, enPeru, formatearFechaHora, formatearLugar, hace, leerSismos, sismoParaAlerta, urlSismos,
} from '../src/inicio/sismos.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const AHORA = Date.UTC(2026, 9, 29, 15, 0, 0)
const url = new URL(urlSismos(7, 4, AHORA))
comprobar('Consulta a USGS en GeoJSON, ordenada por hora, hasta 200', url.origin + url.pathname === 'https://earthquake.usgs.gov/fdsnws/event/1/query'
  && url.searchParams.get('format') === 'geojson' && url.searchParams.get('orderby') === 'time' && url.searchParams.get('limit') === '200')
comprobar('Caja de Perú y alrededores', url.searchParams.get('minlatitude') === '-19' && url.searchParams.get('maxlongitude') === '-67')
comprobar('Desde hace 7 días, sin zona horaria', url.searchParams.get('starttime') === '2026-10-22T15:00:00')
comprobar('Con magnitud mínima 4', url.searchParams.get('minmagnitude') === '4')
comprobar('«Todos» no manda magnitud mínima', !new URL(urlSismos(1, 0, AHORA)).searchParams.has('minmagnitude'))

const lista = leerSismos({ features: [
  { id: 'a', properties: { mag: 5.4, place: '45 km SW of Ica, Peru', time: AHORA - 20 * 60_000, url: 'https://ejemplo.invalid/a' }, geometry: { coordinates: [-76.2, -14.4, 35] } },
  { id: 'b', properties: { mag: null, place: null, time: AHORA - 3 * 3_600_000, url: 'https://ejemplo.invalid/b' }, geometry: { coordinates: [-70, -18, 100] } },
  { id: 'c', properties: { mag: 6.1, place: 'Off the coast of Ecuador', time: AHORA - 10 * 60_000, url: 'https://ejemplo.invalid/c' }, geometry: { coordinates: [-81, -2, 10] } },
] })
comprobar('Lee cada sismo: magnitud, lugar, hora, lat, lon y profundidad', lista[0].mag === 5.4 && lista[0].lat === -14.4 && lista[0].lon === -76.2 && lista[0].depth === 35)
comprobar('Sin magnitud ni lugar: 0 y texto vacío', lista[1].mag === 0 && lista[1].place === '')
comprobar('Filtro «Solo Perú» por el texto del lugar', lista.filter(enPeru).map((s) => s.id).join() === 'a')
comprobar('Aviso: el primero de M≥5 en la última hora', sismoParaAlerta(lista, AHORA)?.id === 'a')
comprobar('Aviso con «Solo Perú»: no cuenta el de Ecuador', sismoParaAlerta(lista.filter(enPeru), AHORA)?.id === 'a' && sismoParaAlerta([lista[2]], AHORA + 61 * 60_000) === null)
comprobar('Semáforo de magnitud', colorPorMagnitud(6.2) === '#b3261e' && colorPorMagnitud(5) === '#d9641e' && colorPorMagnitud(4.3) === '#c99a12' && colorPorMagnitud(2) === '#3d7a5a')
comprobar('Distancia a Lima (Ica, unos 270 km)', Math.abs(distanciaDeLima(-14.07, -75.73) - 270) < 15, `${distanciaDeLima(-14.07, -75.73)}`)
comprobar('«hace …»', hace(AHORA - 30_000, AHORA) === 'hace instantes' && hace(AHORA - 12 * 60_000, AHORA) === 'hace 12 min'
  && hace(AHORA - 185 * 60_000, AHORA) === 'hace 3 h 5 min' && hace(AHORA - 2 * 86_400_000, AHORA) === 'hace 2 día(s)')
comprobar('Lugar en español', formatearLugar('45 km SW of Ica, Peru') === '45 km al SO de Ica, Peru' && formatearLugar('Off the coast of Ecuador') === 'Off the coast of Ecuador' && formatearLugar('') === 'Ubicación sin datos')
comprobar('Fecha y hora de Lima', /10:00:00/.test(formatearFechaHora(AHORA)), formatearFechaHora(AHORA))

const fallas = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/sismos.md', ['# Pruebas de la sección de sismos', '', `Fecha: ${new Date().toISOString()} · Datos FICTICIOS · **${resultados.length - fallas} de ${resultados.length} correctas**`, '',
  ...resultados.map((x) => `- ${x.paso ? '✅' : '❌'} ${x.nombre}`)].join('\n') + '\n')
process.exit(fallas ? 1 : 0)
