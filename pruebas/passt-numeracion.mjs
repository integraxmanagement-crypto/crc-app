// Prueba de la numeración automática y de las semanas del año del programa anual (tarea 3.4-E). Sin base de datos.
// Uso: node pruebas/passt-numeracion.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { lunesDeSemana, semanasConMes, semanasDelAnio } from '../src/inspecciones/periodos.ts'
import { numerar } from '../src/passt/numeracion.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}

seccion('Numeración automática')
const n = (id, padre_id, tipo, orden, vigente = true) => ({ id, padre_id, tipo, orden, vigente })
const arbol = [
  n('og', null, 'objetivo_general', 1),
  n('oe1', 'og', 'objetivo_especifico', 1), n('oe2', 'og', 'objetivo_especifico', 5),
  n('s11', 'oe1', 'seccion', 1), n('s12', 'oe1', 'seccion', 2),
  n('a111', 's11', 'actividad', 1), n('a112', 's11', 'actividad', 2), n('a113', 's11', 'actividad', 7), n('a114', 's11', 'actividad', 9),
  n('a121', 's12', 'actividad', 3),
  n('s21', 'oe2', 'seccion', 1), n('a211', 's21', 'actividad', 1),
]
const num = (lista) => Object.fromEntries(numerar(lista).map((x) => [x.id, x.numero]))
const a = num(arbol)
comprobar('Objetivo específico 1 y 2, aunque el orden guardado salte (1 y 5)', a.oe1 === '1' && a.oe2 === '2')
comprobar('Secciones 1.1 y 1.2', a.s11 === '1.1' && a.s12 === '1.2')
comprobar('Actividades 1.1.1 a 1.1.4 seguidas, aunque el orden guardado salte (1, 2, 7, 9)', [a.a111, a.a112, a.a113, a.a114].join(' ') === '1.1.1 1.1.2 1.1.3 1.1.4')
comprobar('La actividad de la segunda sección es 1.2.1, y la del objetivo 2 es 2.1.1', a.a121 === '1.2.1' && a.a211 === '2.1.1')
comprobar('Ningún número se repite', new Set(Object.values(a).filter(Boolean)).size === Object.values(a).filter(Boolean).length)
const baja = num(arbol.map((x) => (x.id === 'a112' ? { ...x, vigente: false } : x)))
comprobar('Al dar de baja la 1.1.2, la siguiente pasa a ser 1.1.2 (sin huecos)', baja.a113 === '1.1.2' && baja.a114 === '1.1.3' && !('a112' in baja))
const movida = num(arbol.map((x) => (x.id === 'a114' ? { ...x, padre_id: 's12', orden: 10 } : x)))
comprobar('Al mover una actividad a otra sección, se renumeran las dos', movida.a114 === '1.2.2' && movida.a113 === '1.1.3')
const bajaRama = num(arbol.map((x) => (x.id === 'oe1' ? { ...x, vigente: false } : x)))
comprobar('Al dar de baja un objetivo, el siguiente pasa a ser el 1', bajaRama.oe2 === '1' && bajaRama.a211 === '1.1.1')
const orden = numerar(arbol).map((x) => x.id)
comprobar('El orden de lectura pone a cada padre antes que sus hijos', orden.indexOf('oe1') < orden.indexOf('s11') && orden.indexOf('s11') < orden.indexOf('a111') && orden.indexOf('a121') < orden.indexOf('oe2'))

seccion('Semanas del año')
comprobar('2026 tiene 53 semanas; 2025 y 2027 tienen 52', semanasDelAnio(2026) === 53 && semanasDelAnio(2025) === 52 && semanasDelAnio(2027) === 52)
comprobar('La semana 1 de 2026 empieza el lunes 29/12/2025', lunesDeSemana(2026, 1) === '2025-12-29')
comprobar('La semana 53 de 2026 empieza el lunes 28/12/2026', lunesDeSemana(2026, 53) === '2026-12-28')
const meses = semanasConMes(2026).reduce((m, s) => ((m[s.mes] = (m[s.mes] ?? 0) + 1), m), {})
comprobar('En 2026, enero, abril, julio, octubre y diciembre tienen 5 semanas; los demás meses, 4',
  JSON.stringify(Object.values(meses)) === JSON.stringify([5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 5]), JSON.stringify(meses))
const m25 = semanasConMes(2025).reduce((m, s) => ((m[s.mes] = (m[s.mes] ?? 0) + 1), m), {})
comprobar('2025 reparte sus 52 semanas de otra forma (el reparto fijo del Excel no sirve todos los años)', Object.values(m25).reduce((x, y) => x + y, 0) === 52 && JSON.stringify(m25) !== JSON.stringify(meses), JSON.stringify(m25))

const r = resumen()
const lineas = ['# Pruebas de numeración y semanas del PASST (tarea 3.4-E)', '', `Fecha: ${new Date().toISOString()} · Sin base de datos · **${r.ok} de ${r.total} correctas**`, '']
for (const [k, g] of grupos.entries()) {
  lineas.push(`## ${g.titulo}`, '')
  for (const x of resultados.slice(g.desde, grupos[k + 1]?.desde ?? resultados.length)) lineas.push(`- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`)
  lineas.push('')
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/passt-numeracion.md', lineas.join('\n'))
process.exit(r.ok === r.total ? 0 : 1)
