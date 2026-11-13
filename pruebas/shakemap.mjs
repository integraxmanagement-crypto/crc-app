// Prueba de la comparación con USGS ShakeMap (13/11/2026). No usa la base de datos ni internet: respuestas FICTICIAS con la forma de las de USGS.
// Uso: node pruebas/shakemap.mjs
import { compararIntensidades, intensidadEnPunto, leerFichaShakeMap } from '../src/inicio/shakemap.ts'
import { comprobar, resumen } from './comun.mjs'

// Ficha con ShakeMap
const ficha = leerFichaShakeMap({
  properties: {
    mmi: 7.7, cdi: 8.3, felt: 1520, alert: 'yellow',
    products: { shakemap: [{ contents: { 'download/coverage_mmi_low_res.covjson': { url: 'https://x/low.covjson' }, 'download/coverage_mmi_medium_res.covjson': { url: 'https://x/med.covjson' } } }] },
  },
})
comprobar('La ficha trae intensidad máxima, reportada, número de reportes, alerta PAGER y la cuadrícula de baja resolución',
  ficha.disponible && ficha.mmiMaximo === 7.7 && ficha.cdiMaximo === 8.3 && ficha.reportes === 1520 && ficha.pager === 'yellow' && ficha.urlMmi === 'https://x/low.covjson')
const sin = leerFichaShakeMap({ properties: { mmi: null, products: {} } })
comprobar('Un sismo sin ShakeMap se reconoce (no disponible, sin datos)', !sin.disponible && sin.mmiMaximo === null && sin.urlMmi === null && sin.pager === null)
comprobar('Una alerta desconocida no se acepta', leerFichaShakeMap({ properties: { alert: 'azul' } }).pager === null)

// Cuadrícula ficticia 3 columnas (lon -77, -76, -75) × 3 filas (lat -14, -13, -12; de sur a norte)
const g = { domain: { axes: { x: { start: -77, stop: -75, num: 3 }, y: { start: -14, stop: -12, num: 3 } } },
  ranges: { MMI: { values: [1, 2, 3, 4, 5, 6, 7, 8, null] } } }
comprobar('Esquina suroeste (lat -14, lon -77) = primer valor', intensidadEnPunto(g, -14, -77) === 1)
comprobar('Esquina sureste (lat -14, lon -75) = tercer valor', intensidadEnPunto(g, -14, -75) === 3)
comprobar('Centro (lat -13, lon -76) = quinto valor', intensidadEnPunto(g, -13, -76) === 5)
comprobar('Noroeste (lat -12, lon -77) = séptimo valor: las filas van de sur a norte', intensidadEnPunto(g, -12, -77) === 7)
comprobar('Se toma la celda más cercana (lat -12.9, lon -76.2 → centro)', intensidadEnPunto(g, -12.9, -76.2) === 5)
comprobar('Una celda sin dato da null', intensidadEnPunto(g, -12, -75) === null)
comprobar('Fuera de la cuadrícula da null (la sacudida allí es leve)', intensidadEnPunto(g, -10, -70) === null && intensidadEnPunto(g, -20, -76) === null)

// Veredicto
comprobar('Menos de medio grado: muy parecidos', compararIntensidades(6.9, 7.2).cercano && compararIntensidades(6.9, 7.2).texto.startsWith('Muy parecidos'))
comprobar('Entre medio y un grado: parecidos, con el sentido', compararIntensidades(6.0, 6.8).texto.includes('menor') && compararIntensidades(6.0, 6.8).cercano)
comprobar('Más de un grado: difieren y se pide revisar', !compararIntensidades(4.0, 6.0).cercano && compararIntensidades(4.0, 6.0).texto.includes('IGP'))

process.exit(resumen() ? 0 : 1)
