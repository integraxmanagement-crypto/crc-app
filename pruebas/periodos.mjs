// Prueba de los períodos (tarea 3.4-D): semanas ISO, meses del calendario y «cada semana cuenta en el mes de su jueves» (PASST).
// No usa la base de datos. Uso: node pruebas/periodos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { mesDeLaSemana, periodoDe, periodosHasta, semanaIso } from '../src/inspecciones/periodos.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sumar = (f, d) => new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) + d * 864e5).toISOString().slice(0, 10)

seccion('Semanas ISO')
comprobar('01/01/2026 (jueves) es la semana 1 de 2026 y empieza el lunes 29/12/2025', igual(semanaIso('2026-01-01'), { anio: 2026, semana: 1, lunes: '2025-12-29' }), JSON.stringify(semanaIso('2026-01-01')))
comprobar('03/01/2021 (domingo) es la semana 53 de 2020', igual(semanaIso('2021-01-03'), { anio: 2020, semana: 53, lunes: '2020-12-28' }), JSON.stringify(semanaIso('2021-01-03')))
comprobar('28/10/2026 es la semana 44 (lunes 26/10)', igual(semanaIso('2026-10-28'), { anio: 2026, semana: 44, lunes: '2026-10-26' }))
comprobar('2026 tiene semana 53 (31/12/2026 es jueves)', semanaIso('2026-12-31').semana === 53 && semanaIso('2027-01-03').anio === 2026)
comprobar('29/12/2025 cuenta en el año ISO 2026', semanaIso('2025-12-29').anio === 2026)
const sem = periodoDe('2026-10-28', 'semanal')
comprobar('Período semanal: del lunes al domingo', sem.desde === '2026-10-26' && sem.hasta === '2026-11-01' && sem.clave === '2026-S44', JSON.stringify(sem))

seccion('Cada semana cuenta en el mes de su jueves')
comprobar('30/09/2026 (miércoles) cuenta en octubre: su jueves es 01/10', igual(mesDeLaSemana('2026-09-30'), { anio: 2026, mes: 10 }))
comprobar('01/11/2026 (domingo) cuenta en octubre: su jueves es 29/10', igual(mesDeLaSemana('2026-11-01'), { anio: 2026, mes: 10 }))
const oct = periodoDe('2026-10-15', 'mensual')
comprobar('Octubre 2026 va del 1 al 31 de octubre (mes del calendario)', oct.desde === '2026-10-01' && oct.hasta === '2026-10-31' && oct.clave === '2026-10', JSON.stringify(oct))
const nov = periodoDe('2026-11-02', 'mensual')
comprobar('Noviembre 2026 va del 1 al 30 de noviembre', nov.desde === '2026-11-01' && nov.hasta === '2026-11-30', JSON.stringify(nov))
const dic = periodoDe('2025-12-30', 'mensual')
comprobar('30/12/2025 cuenta en diciembre 2025 (del 1 al 31), aunque su semana ISO sea del año 2026', dic.clave === '2025-12' && dic.desde === '2025-12-01' && dic.hasta === '2025-12-31', JSON.stringify(dic))
const feb = periodoDe('2028-02-10', 'mensual')
comprobar('Febrero de un año bisiesto termina el 29', feb.hasta === '2028-02-29', JSON.stringify(feb))

seccion('Bimestre, trimestre, semestre y año')
const bim = periodoDe('2026-10-15', 'bimestral')
comprobar('Bimestre 5 de 2026 = septiembre y octubre (01/09 al 31/10)', bim.clave === '2026-B5' && bim.desde === '2026-09-01' && bim.hasta === '2026-10-31', JSON.stringify(bim))
const tri = periodoDe('2026-10-15', 'trimestral')
comprobar('Trimestre 4 de 2026 = octubre a diciembre (01/10 al 31/12)', tri.clave === '2026-T4' && tri.desde === '2026-10-01' && tri.hasta === '2026-12-31', JSON.stringify(tri))
const semes = periodoDe('2026-03-10', 'semestral')
comprobar('Semestre 1 de 2026 = enero a junio (01/01 al 30/06)', semes.clave === '2026-S1' && semes.desde === '2026-01-01' && semes.hasta === '2026-06-30', JSON.stringify(semes))
const anio = periodoDe('2026-06-01', 'anual')
comprobar('Año 2026 = del 01/01 al 31/12', anio.desde === '2026-01-01' && anio.hasta === '2026-12-31', JSON.stringify(anio))
comprobar('«Sin frecuencia» no tiene períodos', periodoDe('2026-10-15', 'sin_frecuencia') === null)

seccion('Sin huecos ni solapes')
for (const frec of ['semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual']) {
  // Cada día de 2024 a 2028 cae en un período que lo contiene, y los períodos seguidos se tocan sin huecos.
  let ok = true
  let detalle = ''
  let anterior = null
  for (let d = '2024-01-01'; d <= '2028-12-31'; d = sumar(d, 1)) {
    const p = periodoDe(d, frec)
    if (!(p.desde <= d && d <= p.hasta)) { ok = false; detalle = `${d} fuera de ${p.clave}`; break }
    if (anterior && anterior.clave !== p.clave && sumar(anterior.hasta, 1) !== p.desde) { ok = false; detalle = `hueco entre ${anterior.clave} y ${p.clave}`; break }
    if (frec === 'semanal' ? diaSemanaUtc(p.desde) !== 1 || diaSemanaUtc(p.hasta) !== 0 : p.desde.slice(8) !== '01' || sumar(p.hasta, 1).slice(8) !== '01') { ok = false; detalle = `${p.clave} no va de lunes a domingo (semanal) o de primer a último día del mes`; break }
    anterior = p
  }
  comprobar(`${frec}: cada día de 2024 a 2028 está en un solo período (semanal: de lunes a domingo; los demás: meses completos) y sin huecos`, ok, detalle)
}
function diaSemanaUtc(f) {
  return new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10))).getUTCDay()
}
const lista = periodosHasta('2026-10-28', 'mensual', 13)
comprobar('Lista de los últimos 13 meses, del más reciente al más antiguo', lista.length === 13 && lista[0].clave === '2026-10' && lista[12].clave === '2025-10', lista.map((p) => p.clave).join(' '))
comprobar('Lista de semanas que cruza el cambio de año (semana 53)', periodosHasta('2027-01-10', 'semanal', 3).map((p) => p.clave).join(' ') === '2027-S01 2026-S53 2026-S52')

const r = resumen()
const lineas = ['# Pruebas de los períodos (tarea 3.4-D)', '', `Fecha: ${new Date().toISOString()} · Sin base de datos · **${r.ok} de ${r.total} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/periodos.md', lineas.join('\n'))
process.exit(r.ok === r.total ? 0 : 1)
