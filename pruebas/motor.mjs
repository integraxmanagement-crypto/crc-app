// Prueba del motor de reglas de los formatos (tarea 3.4-B). No usa la base de datos ni cuentas.
// Revisa que las 6 plantillas base estén bien armadas y que los resultados, el puntaje y los hallazgos
// salgan como se espera en casos conocidos (todos ficticios). Guarda un informe en pruebas/resultados/.
// Uso: node pruebas/motor.mjs   (Node 24 entiende los archivos .ts de src/formatos sin compilar)
import { mkdirSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { evaluar, seccionesVisibles } from '../src/formatos/motor.ts'
import { validarReceta } from '../src/formatos/receta.ts'

const resultados = []
function comprobar(nombre, paso, detalle = '') {
  resultados.push({ nombre, paso, detalle })
  console.log(`${paso ? '✅ PASA ' : '❌ FALLA'}  ${nombre}${detalle ? `  (${detalle})` : ''}`)
}
const R = Object.fromEntries(PLANTILLAS_BASE.map((p) => [p.codigo, p.receta]))
const FECHA = '2026-11-15'

/** Respuestas con el mismo valor para todos los puntos visibles (las fijas, no las repetibles). */
function todas(receta, valor, subtipo = null) {
  const r = {}
  for (const s of seccionesVisibles(receta, subtipo).filter((x) => !x.repetible))
    for (const p of s.puntos) r[p.clave] = { valor: p.tipo === 'cumple' || p.tipo === 'si_no' ? valor : p.tipo === 'numero' ? 10 : p.tipo === 'texto' || p.tipo === 'texto_largo' || p.tipo === 'lista' ? 'Dato ficticio' : null }
  return r
}

console.log('\n── 1. Las 6 plantillas base están bien armadas')
comprobar('Hay 6 plantillas base', PLANTILLAS_BASE.length === 6)
for (const p of PLANTILLAS_BASE) {
  const problemas = validarReceta(p.receta, true)
  comprobar(`${p.nombre}: sin problemas para publicar`, problemas.length === 0, problemas.join(' | '))
}
const claves = PLANTILLAS_BASE.flatMap((p) => p.receta.secciones.flatMap((s) => s.puntos.map((x) => x.clave)))
comprobar('Ninguna clave de punto se repite entre las 6', new Set(claves).size === claves.length, `${claves.length} puntos`)
comprobar('Ningún punto trae severidad (queda para la v1.1)', PLANTILLAS_BASE.every((p) => p.receta.secciones.every((s) => s.puntos.every((x) => x.severidad == null))))
comprobar('Ningún texto de la base menciona un código de formato tipo «SO.R.G.»', !JSON.stringify(PLANTILLAS_BASE).includes('SO.R.G'))

console.log('\n── 2. Extintores')
{
  const al_dia = { proximo_mantenimiento: '2027-03', anio_fabricacion: 2015, anio_prueba_hidrostatica: 2022 }
  let e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Todo √ y al día → Conforme, sin hallazgos', e.resultado === 'Conforme' && e.hallazgos.length === 0 && e.faltan.length === 0, `${e.resultado}`)
  const r = todas(R.extintores, 'si')
  r['EXT-07'] = { valor: 'no' }
  e = evaluar(R.extintores, { respuestas: r, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('X en un crítico (EXT-07) → No conforme y 1 hallazgo', e.resultado === 'No conforme' && e.hallazgos.length === 1 && e.hallazgos[0].clave === 'EXT-07', e.resultado)
  const r2 = todas(R.extintores, 'si')
  r2['EXT-04'] = { valor: 'no' }
  e = evaluar(R.extintores, { respuestas: r2, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('X en un punto no crítico y sin H (EXT-04) → Conforme, sin hallazgo', e.resultado === 'Conforme' && e.hallazgos.length === 0)
  const r3 = todas(R.extintores, 'si')
  r3['EXT-02'] = { valor: 'no' }
  e = evaluar(R.extintores, { respuestas: r3, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('X en no crítico con H (EXT-02) → Conforme, pero 1 hallazgo', e.resultado === 'Conforme' && e.hallazgos.length === 1)
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, proximo_mantenimiento: '2026-10' } }, fecha: FECHA })
  comprobar('Mantenimiento vencido (oct-2026 en nov-2026) → «No conforme: vencido» + hallazgo de vencimiento', e.resultado === 'No conforme: vencido' && e.hallazgos.some((h) => h.origen === 'vencido'), e.resultado)
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, proximo_mantenimiento: '2026-11' } }, fecha: FECHA })
  comprobar('Vence este mismo mes → todavía no está vencido', e.resultado === 'Conforme')
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, anio_fabricacion: 1990 } }, fecha: FECHA })
  comprobar('Fabricado en 1990: sin plazo de vida útil definido, la regla no se aplica', e.resultado === 'Conforme')
  const conPlazo = structuredClone(R.extintores)
  conPlazo.reglas[0].controles[2].anios = 20
  e = evaluar(conPlazo, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, anio_fabricacion: 1990 } }, fecha: FECHA })
  comprobar('Si la empresa pone 20 años de vida útil, uno de 1990 queda vencido', e.resultado === 'No conforme: vencido')
  e = evaluar(R.extintores, { respuestas: { ...todas(R.extintores, 'si'), 'EXT-10': { valor: 'na' } }, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('N/A en la manguera cuenta como favorable → Conforme', e.resultado === 'Conforme')
  const sinResp = todas(R.extintores, 'si')
  delete sinResp['EXT-05']
  e = evaluar(R.extintores, { respuestas: sinResp, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Un punto obligatorio sin responder → no se puede cerrar', e.faltan.length === 1 && e.faltan[0].startsWith('EXT-05'), e.faltan.join(' | '))
}

console.log('\n── 3. Caseta de ataque rápido')
{
  let e = evaluar(R.car, { respuestas: todas(R.car, 'si'), fecha: FECHA })
  comprobar('Todo √ → Conforme', e.resultado === 'Conforme')
  const r = todas(R.car, 'si')
  r['CAR-M02'] = { valor: 'no' }
  e = evaluar(R.car, { respuestas: r, fecha: FECHA })
  comprobar('X en un material → No conforme y 1 hallazgo (por reponer)', e.resultado === 'No conforme' && e.hallazgos.length === 1 && e.hallazgos[0].clave === 'CAR-M02')
  const r2 = todas(R.car, 'si')
  r2['CAR-02'] = { valor: 'no' }
  e = evaluar(R.car, { respuestas: r2, fecha: FECHA })
  comprobar('Acceso bloqueado (crítico) → No conforme', e.resultado === 'No conforme')
  const r3 = todas(R.car, 'si')
  r3['CAR-04'] = { valor: 'no' }
  e = evaluar(R.car, { respuestas: r3, fecha: FECHA })
  comprobar('Interior desordenado (ni crítico ni material) → Conforme, sin hallazgo', e.resultado === 'Conforme' && e.hallazgos.length === 0)
}

console.log('\n── 4. Bombas')
{
  const e1 = seccionesVisibles(R.bombas, 'electrobomba').flatMap((s) => s.puntos.map((p) => p.clave))
  const m1 = seccionesVisibles(R.bombas, 'motobomba').flatMap((s) => s.puntos.map((p) => p.clave))
  comprobar('Electrobomba: ve BCI-E01 y la corriente, no los puntos de motor diésel', e1.includes('BCI-E01') && e1.includes('BCI-L07') && !e1.includes('BCI-M01'))
  comprobar('Motobomba: ve BCI-M01 a M05 y sus lecturas, no BCI-E01', m1.includes('BCI-M05') && m1.includes('BCI-L06') && !e1.includes('BCI-L06') && !m1.includes('BCI-E01'))
  let e = evaluar(R.bombas, { respuestas: todas(R.bombas, 'si', 'motobomba'), activo: { subtipo: 'motobomba' }, fecha: FECHA })
  comprobar('Todo Sí → sin resultado (solo «Realizado»), sin hallazgos', e.resultado === null && e.hallazgos.length === 0 && e.faltan.length === 0, e.faltan.join(' | '))
  const r = todas(R.bombas, 'si', 'electrobomba')
  r['BCI-B05'] = { valor: 'no' }
  e = evaluar(R.bombas, { respuestas: r, activo: { subtipo: 'electrobomba' }, fecha: FECHA })
  comprobar('Un «No» sin observación → falta la observación', e.faltan.some((f) => f.startsWith('BCI-B05')))
  r['BCI-B05'] = { valor: 'no', obs: 'Vibración en el acople (ficticio)' }
  e = evaluar(R.bombas, { respuestas: r, activo: { subtipo: 'electrobomba' }, fecha: FECHA })
  comprobar('«No» en la sección B con observación → 1 hallazgo con la observación', e.faltan.length === 0 && e.hallazgos.length === 1 && e.hallazgos[0].texto.includes('Vibración'))
  const r2 = todas(R.bombas, 'si', 'electrobomba')
  r2['BCI-A04'] = { valor: 'no', obs: 'Foco quemado (ficticio)' }
  e = evaluar(R.bombas, { respuestas: r2, activo: { subtipo: 'electrobomba' }, fecha: FECHA })
  comprobar('«No» en la sección A → sin hallazgo (el anexo pone H solo en B y C)', e.hallazgos.length === 0)
  const conRango = structuredClone(R.bombas)
  const l = conRango.secciones.find((s) => s.clave === 'lecturas').puntos.find((p) => p.clave === 'BCI-L02')
  l.min = 90
  l.max = 120
  const r3 = todas(R.bombas, 'si', 'electrobomba')
  r3['BCI-L02'] = { valor: 140 }
  e = evaluar(conRango, { respuestas: r3, activo: { subtipo: 'electrobomba' }, fecha: FECHA })
  comprobar('Presión de descarga 140 con rango 90–120 → hallazgo «fuera de rango»', e.hallazgos.some((h) => h.origen === 'fuera_rango' && h.clave === 'BCI-L02'))
  e = evaluar(R.bombas, { respuestas: r3, activo: { subtipo: 'electrobomba' }, fecha: FECHA })
  comprobar('La misma lectura sin rango definido → no genera hallazgo', e.hallazgos.length === 0)
}

console.log('\n── 5. DACI')
{
  let e = evaluar(R.daci, { respuestas: todas(R.daci, 'si', 'pulsador'), activo: { subtipo: 'pulsador' }, fecha: FECHA })
  comprobar('Pulsador todo √ → Operativo (solo ve sus 3 puntos)', e.resultado === 'Operativo' && Object.keys(todas(R.daci, 'si', 'pulsador')).length === 3)
  const r = todas(R.daci, 'si', 'sirena')
  r['DACI-A02'] = { valor: 'no' }
  e = evaluar(R.daci, { respuestas: r, activo: { subtipo: 'sirena' }, fecha: FECHA })
  comprobar('Sirena que no suena en la prueba (crítico) → Inoperativo', e.resultado === 'Inoperativo')
  const r2 = todas(R.daci, 'si', 'panel')
  r2['DACI-P02'] = { valor: 'no' }
  e = evaluar(R.daci, { respuestas: r2, activo: { subtipo: 'panel' }, fecha: FECHA })
  comprobar('Panel con un indicador apagado (no crítico) → Operativo, con 1 hallazgo', e.resultado === 'Operativo' && e.hallazgos.length === 1)
}

console.log('\n── 6. LOTO')
{
  let e = evaluar(R.loto, { respuestas: todas(R.loto, 'si'), fecha: FECHA })
  comprobar('Todo √ → Conforme, puntaje 100 %', e.resultado === 'Conforme' && e.puntaje === 100)
  // Caso del documento de traspaso: 10 Sí, 1 N/A, 1 No → 92 %
  const r = todas(R.loto, 'si')
  r['LOTO-06'] = { valor: 'na' }
  r['LOTO-11'] = { valor: 'no' }
  e = evaluar(R.loto, { respuestas: r, fecha: FECHA })
  comprobar('10 √, 1 N/A, 1 X → No conforme, puntaje 92 %', e.resultado === 'No conforme' && e.puntaje === 92, `${e.puntaje} %`)
  comprobar('La X sin acción, responsable ni plazo → no se puede cerrar', e.faltan.some((f) => f.startsWith('LOTO-11')))
  r['LOTO-11'] = { valor: 'no', accion: { texto: 'Reponer tarjetas (ficticio)', responsable: 'persona-ficticia', plazo: '2026-11-30' } }
  e = evaluar(R.loto, { respuestas: r, fecha: FECHA })
  comprobar('Con acción, responsable y plazo → se puede cerrar y el hallazgo los trae', e.faltan.length === 0 && e.hallazgos[0]?.accion?.plazo === '2026-11-30')
  const sinNa = structuredClone(R.loto)
  sinNa.na_favorable = false
  e = evaluar(sinNa, { respuestas: r, fecha: FECHA })
  comprobar('Si la empresa decide que N/A no cuenta: 10 de 11 = 91 %', e.puntaje === 91, `${e.puntaje} %`)
}

console.log('\n── 7. IPF')
{
  const base = { 'IPF-R01': { valor: 'Recorrido completo (ficticio)' }, 'IPF-R02': { valor: 'No aplica' }, 'IPF-R03': { valor: 'Mantener el orden (ficticio)' } }
  let e = evaluar(R.ipf, { respuestas: { ...base, 'IPF-01': { valor: 'no' } }, fecha: FECHA })
  comprobar('Sin condiciones inseguras → Conforme, sin hallazgos', e.resultado === 'Conforme' && e.hallazgos.length === 0 && e.faltan.length === 0, e.faltan.join(' | '))
  e = evaluar(R.ipf, { respuestas: { ...base, 'IPF-01': { valor: 'si' } }, filas: { condiciones: [] }, fecha: FECHA })
  comprobar('Dice que sí hubo pero no registra ninguna → no se puede cerrar', e.faltan.some((f) => f.includes('al menos 1')))
  const fila = (n) => ({
    'IPF-C01': { valor: `Cables sueltos ${n} (ficticio)` },
    'IPF-C02': { valor: 'Caída al mismo nivel' },
    'IPF-C03': { valor: null, fotos: 1 },
    'IPF-C04': { valor: 'Ordenar y canalizar los cables' },
    'IPF-C05': { valor: 'persona-ficticia' },
    'IPF-C06': { valor: '2026-11-30' },
  })
  e = evaluar(R.ipf, { respuestas: { ...base, 'IPF-01': { valor: 'si' } }, filas: { condiciones: [fila(1), fila(2)] }, fecha: FECHA })
  comprobar('2 condiciones → «Con condiciones inseguras» y 2 hallazgos con responsable y plazo', e.resultado === 'Con condiciones inseguras' && e.hallazgos.length === 2 && e.hallazgos[1].accion.responsable === 'persona-ficticia')
  const sinFoto = fila(3)
  sinFoto['IPF-C03'] = { valor: null, fotos: 0 }
  e = evaluar(R.ipf, { respuestas: { ...base, 'IPF-01': { valor: 'si' } }, filas: { condiciones: [sinFoto] }, fecha: FECHA })
  comprobar('Una condición sin foto → falta la foto', e.faltan.some((f) => f.includes('foto')))
}

const fallas = resultados.filter((r) => !r.paso).length
console.log(`\n${resultados.length - fallas} de ${resultados.length} pruebas pasaron.`)
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = [
  '# Motor de reglas de los formatos (tarea 3.4-B)',
  '',
  `Fecha: ${new Date().toISOString().slice(0, 10)} · Resultado: **${resultados.length - fallas} de ${resultados.length}** · Sin base de datos, casos ficticios.`,
  '',
  '| Prueba | Resultado |',
  '|---|---|',
  ...resultados.map((r) => `| ${r.nombre}${r.detalle ? ` (${r.detalle.replace(/\|/g, '/')})` : ''} | ${r.paso ? '✅' : '❌'} |`),
]
writeFileSync('pruebas/resultados/motor-de-reglas.md', lineas.join('\n') + '\n')
process.exit(fallas ? 1 : 0)
