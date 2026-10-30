// Prueba del motor de reglas de los formatos (tarea 3.4-B). No usa la base de datos ni cuentas.
// Revisa que las 8 plantillas base estén bien armadas y que los resultados, el puntaje y los hallazgos
// salgan como se espera en casos conocidos (todos ficticios). Guarda un informe en pruebas/resultados/.
// Uso: node pruebas/motor.mjs   (Node 24 entiende los archivos .ts de src/formatos sin compilar)
import { mkdirSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE, TIPOS_ACTIVO_BASE } from '../src/formatos/base.ts'
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

console.log('\n── 1. Las 7 plantillas base están bien armadas')
comprobar('Hay 8 plantillas base', PLANTILLAS_BASE.length === 8)
for (const p of PLANTILLAS_BASE) {
  const problemas = validarReceta(p.receta, true)
  comprobar(`${p.nombre}: sin problemas para publicar`, problemas.length === 0, problemas.join(' | '))
}
const claves = PLANTILLAS_BASE.flatMap((p) => p.receta.secciones.flatMap((s) => s.puntos.map((x) => x.clave)))
comprobar('Ninguna clave de punto se repite entre las 8', new Set(claves).size === claves.length, `${claves.length} puntos`)
const criticos = PLANTILLAS_BASE.flatMap((x) => x.receta.secciones.flatMap((sc) => sc.puntos.filter((pt) => pt.critico).map((pt) => `${x.codigo}/${pt.clave}`)))
const sinAccion = PLANTILLAS_BASE.flatMap((x) => x.receta.secciones.flatMap((sc) => sc.puntos.filter((pt) => pt.critico && !(pt.hallazgo === 'no_cumple' && pt.pide_accion)).map((pt) => pt.clave)))
comprobar('Todo punto crítico de todos los formatos genera hallazgo y pide acción, responsable y plazo', criticos.length > 0 && sinAccion.length === 0, `${criticos.length} críticos; sin acción: ${sinAccion.join(', ')}`)
comprobar('Electrobomba: la hora de inicio (antes y final) es de tipo hora', ['EB-P02A', 'EB-P02F'].every((k) => PLANTILLAS_BASE.find((x) => x.codigo === 'electrobomba').receta.secciones.flatMap((sc) => sc.puntos).find((pt) => pt.clave === k)?.tipo === 'hora'))
comprobar('Ningún punto trae severidad (queda para la v1.1)', PLANTILLAS_BASE.every((p) => p.receta.secciones.every((s) => s.puntos.every((x) => x.severidad == null))))
comprobar('Ningún texto de la base menciona un código de formato tipo «SO.R.G.»', !JSON.stringify(PLANTILLAS_BASE).includes('SO.R.G'))

console.log('\n── 1b. Motobomba (paquete MOTOBOMBA.md del dueño)')
{
  const m = PLANTILLAS_BASE.find((x) => x.codigo === 'motobomba')
  const puntos = m.receta.secciones.flatMap((x) => x.puntos)
  const sn = puntos.filter((x) => x.tipo === 'si_no')
  comprobar('Motobomba: 22 puntos Sí / No (16 antes y 6 durante la prueba), todos con observación obligatoria si es No',
    sn.length === 22 && m.receta.secciones[0].puntos.length === 16 && m.receta.secciones[1].puntos.length === 6 && sn.every((x) => x.obs_si_no_cumple), `${sn.length}`)
  comprobar('Motobomba: 4 datos de la prueba funcional obligatorios, con observaciones opcionales',
    ['MB-P01', 'MB-P02', 'MB-P03', 'MB-P04'].every((k) => puntos.find((x) => x.clave === k)?.obligatorio) && ['MB-P01O', 'MB-P02O', 'MB-P03O', 'MB-P04O'].every((k) => puntos.find((x) => x.clave === k)?.obligatorio === false))
  comprobar('Motobomba: dos firmas (inspector y custodia del registro) y frecuencia semanal', m.receta.firmas.map((f) => f.clave).join() === 'inspector,custodia' && m.frecuencia === 'semanal')
  const todo = { ...todas(R.motobomba, 'si'), 'MB-P01': { valor: '10:00' }, 'MB-P02': { valor: '10' }, 'MB-P03': { valor: '150' }, 'MB-P04': { valor: 'Auto' } }
  const ok = evaluar(R.motobomba, { respuestas: todo, activo: { datos: {} }, fecha: FECHA })
  comprobar('Motobomba: todo en Sí → Conforme y nada falta', ok.resultado === 'Conforme' && ok.faltan.length === 0, `${ok.resultado} ${ok.faltan.join(' | ')}`)
  const mal = evaluar(R.motobomba, { respuestas: { ...todo, 'MB-B03': { valor: 'no', obs: 'Sin lectura' } }, activo: { datos: {} }, fecha: FECHA })
  comprobar('Motobomba: un No en la prueba → No conforme y 1 hallazgo', mal.resultado === 'No conforme' && mal.hallazgos.length === 1, `${mal.resultado} ${mal.hallazgos.length}`)
  const sinObs = evaluar(R.motobomba, { respuestas: { ...todo, 'MB-A01': { valor: 'no' } }, activo: { datos: {} }, fecha: FECHA })
  comprobar('Motobomba: un No sin observación no deja cerrar', sinObs.faltan.some((f) => f.includes('observación')), sinObs.faltan.join(' | '))
}

console.log('\n── 1c. Electrobomba (paquete ELECTROBOMBA.md del dueño)')
{
  const m = PLANTILLAS_BASE.find((x) => x.codigo === 'electrobomba')
  const puntos = m.receta.secciones.flatMap((x) => x.puntos)
  const sn = puntos.filter((x) => x.tipo === 'si_no')
  comprobar('Electrobomba: 29 puntos Sí / No (13 antes, 9 durante y 7 después), todos con observación obligatoria si es No',
    sn.length === 29 && m.receta.secciones.slice(0, 3).map((x) => x.puntos.length).join() === '13,9,7' && sn.every((x) => x.obs_si_no_cumple), `${sn.length}`)
  comprobar('Electrobomba: prueba funcional con «Antes» y «Final» obligatorios y observaciones opcionales (presión y hora de inicio)',
    ['EB-P01A', 'EB-P01F', 'EB-P02A', 'EB-P02F'].every((k) => puntos.find((x) => x.clave === k)?.obligatorio) && ['EB-P01O', 'EB-P02O'].every((k) => puntos.find((x) => x.clave === k)?.obligatorio === false))
  comprobar('Electrobomba: dos firmas y frecuencia semanal', m.receta.firmas.map((f) => f.clave).join() === 'inspector,custodia' && m.frecuencia === 'semanal')
  const tipo = TIPOS_ACTIVO_BASE.find((t) => t.codigo === 'electrobomba')
  comprobar('Electrobomba: la ficha del equipo pide las 12 fichas técnicas (principal y jockey), todas obligatorias', tipo.campos.length === 12 && tipo.campos.every((c) => c.obligatorio && c.tipo === 'texto'))
  const todo = { ...todas(R.electrobomba, 'si'), 'EB-P01A': { valor: '110' }, 'EB-P01F': { valor: '100' }, 'EB-P02A': { valor: '09:00' }, 'EB-P02F': { valor: '09:30' } }
  const ok = evaluar(R.electrobomba, { respuestas: todo, activo: { datos: {} }, fecha: FECHA })
  comprobar('Electrobomba: todo en Sí → Conforme y nada falta', ok.resultado === 'Conforme' && ok.faltan.length === 0, `${ok.resultado} ${ok.faltan.join(' | ')}`)
  const mal = evaluar(R.electrobomba, { respuestas: { ...todo, 'EB-B04': { valor: 'no', obs: 'Ruido' } }, activo: { datos: {} }, fecha: FECHA })
  comprobar('Electrobomba: un No en la prueba → No conforme y 1 hallazgo', mal.resultado === 'No conforme' && mal.hallazgos.length === 1, `${mal.resultado} ${mal.hallazgos.length}`)
  const sinFinal = evaluar(R.electrobomba, { respuestas: { ...todo, 'EB-P01F': { valor: '' } }, activo: { datos: {} }, fecha: FECHA })
  comprobar('Electrobomba: sin el «Final» de la presión no deja cerrar', sinFinal.faltan.some((f) => f.includes('EB-P01F')), sinFinal.faltan.join(' | '))
}

console.log('\n── 2. Extintores')
{
  const al_dia = { proximo_mantenimiento: '2027-03', anio_fabricacion: 2015, anio_prueba_hidrostatica: 2022 }
  let e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Todo √ y al día → Conforme, sin hallazgos', e.resultado === 'Conforme' && e.hallazgos.length === 0 && e.faltan.length === 0, `${e.resultado}`)
  const r = todas(R.extintores, 'si')
  r['EXT-09'] = { valor: 'no' }
  e = evaluar(R.extintores, { respuestas: r, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('X en un crítico (EXT-09) → No conforme y 1 hallazgo', e.resultado === 'No conforme' && e.hallazgos.length === 1 && e.hallazgos[0].clave === 'EXT-09', e.resultado)
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
  comprobar('Fabricado en 1990 (más de 20 años) → No conforme: vencido', e.resultado === 'No conforme: vencido', e.resultado)
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, anio_fabricacion: 2006 } }, fecha: FECHA })
  comprobar('Fabricado hace exactamente 20 años → todavía vigente', e.resultado === 'Conforme', e.resultado)
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, anio_prueba_hidrostatica: 2020 } }, fecha: FECHA })
  comprobar('PH de hace 6 años → No conforme: vencido; de hace 5 → vigente',
    e.resultado === 'No conforme: vencido' && evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), activo: { datos: { ...al_dia, anio_prueba_hidrostatica: 2021 } }, fecha: FECHA }).resultado === 'Conforme')
  e = evaluar(R.extintores, { respuestas: todas(R.extintores, 'si'), observacion: 'Falta señal', activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Cualquier observación escrita → No conforme', e.resultado === 'No conforme: con observaciones', e.resultado)
  comprobar('Al abrir, los no críticos vienen con √ y los críticos sin marcar; sin firmas en la inspección',
    R.extintores.secciones[0].puntos.every((x) => (x.critico ? !x.valor_defecto : x.valor_defecto === 'si')) && R.extintores.firmas.length === 0)
  // Un crítico en X genera hallazgo y pide responsable y fecha de levantamiento (pedido del dueño, 29/10/2026).
  const rx = todas(R.extintores, 'si')
  rx['EXT-10'] = { valor: 'no' }
  let ex = evaluar(R.extintores, { respuestas: rx, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Extintores: un crítico en X sin responsable ni fecha → no se puede cerrar', ex.faltan.length === 1 && /acción correctiva, el responsable y el plazo/.test(ex.faltan[0]), ex.faltan.join(' | '))
  rx['EXT-10'] = { valor: 'no', accion: { texto: 'Cambiar manómetro', responsable: 'p-1', plazo: '2026-11-30' } }
  ex = evaluar(R.extintores, { respuestas: rx, activo: { datos: al_dia }, fecha: FECHA })
  comprobar('Extintores: con responsable y fecha, nace el hallazgo con ese acuerdo', ex.faltan.length === 0 && ex.hallazgos.length === 1 && ex.hallazgos[0].accion?.responsable === 'p-1' && ex.hallazgos[0].accion?.plazo === '2026-11-30', JSON.stringify(ex.hallazgos))
  const dsi = Object.fromEntries(R.daci.secciones.filter((x) => x.clave === 'detector').flatMap((x) => x.puntos).map((x) => [x.clave, { valor: 'si' }]))
  dsi['DACI-D01'] = { valor: 'no' }
  let ed = evaluar(R.daci, { respuestas: dsi, activo: { subtipo: 'detector', datos: {} }, fecha: FECHA })
  comprobar('DACI: un crítico en X sin responsable ni fecha → no se puede cerrar', ed.faltan.length === 1 && /responsable y el plazo/.test(ed.faltan[0]), ed.faltan.join(' | '))
  dsi['DACI-D01'] = { valor: 'no', accion: { texto: 'Limpiar detector', responsable: 'p-1', plazo: '2026-11-15' } }
  ed = evaluar(R.daci, { respuestas: dsi, activo: { subtipo: 'detector', datos: {} }, fecha: FECHA })
  comprobar('DACI: con responsable y fecha, nace el hallazgo y el resultado es «Inoperativo»', ed.faltan.length === 0 && ed.hallazgos.length === 1 && ed.resultado === 'Inoperativo', JSON.stringify([ed.resultado, ed.hallazgos]))
  comprobar('Los 16 puntos del paquete, 6 críticos, semanal', R.extintores.secciones[0].puntos.length === 16 && R.extintores.secciones[0].puntos.filter((x) => x.critico).map((x) => x.clave).join() === 'EXT-09,EXT-10,EXT-11,EXT-12,EXT-13,EXT-15' && PLANTILLAS_BASE.find((x) => x.codigo === 'extintores').frecuencia === 'semanal')
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
  r['BCI-B05'] = { valor: 'no', obs: 'Vibración en el acople (ficticio)', accion: { texto: 'Revisar el acople', responsable: 'persona-ficticia', plazo: '2026-12-01' } } // los críticos piden acción, responsable y plazo
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
  const base = { 'IPF-A01': { valor: 'persona-ficticia' }, 'IPF-A02': { valor: 'Programada' }, 'IPF-A03': { valor: R.ipf.secciones[0].puntos.find((x) => x.clave === 'IPF-A03').valor_defecto }, 'IPF-R01': { valor: 'Recorrido completo (ficticio)' }, 'IPF-R02': { valor: 'No aplica' }, 'IPF-R03': { valor: 'Mantener el orden (ficticio)' } }
  const punto = (c) => R.ipf.secciones[0].puntos.find((x) => x.clave === c)
  comprobar('IPF: el tipo de inspección tiene tres opciones (Programada, No programada, Otros) y el objetivo viene escrito', JSON.stringify(punto('IPF-A02').opciones) === JSON.stringify(['Programada', 'No programada', 'Otros'])
    && punto('IPF-A03').valor_defecto === 'Identificar condiciones y actos inseguros en el área' && punto('IPF-A04').obligatorio === false)
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
