// Prueba de la carga masiva de equipos (extintores y DACI): la plantilla, la lectura y la revisión fila por fila.
// Sin base de datos: todo FICTICIO. Uso: node pruebas/carga-activos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { crearZip, escaparXml, leerHoja, letraColumna } from '../src/carga/xlsx.ts'
import { crearPlantillaEquipos, columnasDe, revisarEquipos } from '../src/activos/revisionEquipos.ts'
import { TIPOS_ACTIVO_BASE } from '../src/formatos/base.ts'
import { comprobar, resultados, resumen } from './comun.mjs'

const ext = TIPOS_ACTIVO_BASE.find((t) => t.codigo === 'extintor')
const daci = TIPOS_ACTIVO_BASE.find((t) => t.codigo === 'dispositivo_alarma')
const ctxExt = {
  tipo: { id: 't-ext', nombre: ext.nombre, subtipos: ext.subtipos, campos: ext.campos },
  sedes: [{ id: 's1', nombre: 'Sede principal' }],
  unidades: [{ id: 'u1', nombre: 'Planta', ruta: 'General › Planta' }, { id: 'u2', nombre: 'Logística', ruta: 'General › Logística' }],
  ubicaciones: [{ id: 'b1', sede_id: 's1', unidad_id: 'u1', nombre: 'Pasillo 1' }, { id: 'b2', sede_id: 's1', unidad_id: 'u2', nombre: 'Almacén' }],
  personas: [{ persona_id: 'p1', apellidos_nombres: 'Prueba Ficticia, Ana' }],
  listas: { agentes_extintores: ['PQS', 'CO₂', 'Agua'], unidades_capacidad: ['kg', 'lb', 'L'], tipos_soporte: ['Pared', 'Pedestal'] },
  codigosExistentes: ['P1-001'],
  exigirTodo: true,
}
const ctxDaci = {
  tipo: { id: 't-daci', nombre: daci.nombre, subtipos: daci.subtipos, campos: daci.campos },
  sedes: [{ id: 's1', nombre: 'Sede principal' }, { id: 's2', nombre: 'Sede norte' }],
  unidades: ctxExt.unidades, ubicaciones: ctxExt.ubicaciones, personas: ctxExt.personas, listas: {}, codigosExistentes: [], exigirTodo: false,
}

const titulo = (c) => `${c.titulo}${c.obligatoria ? ' *' : ''}`
/** Un Excel mínimo con la hoja «Equipos»: la primera fila son los títulos de la plantilla; el resto, lo que se pase. */
function excel(ctx, filas, quitar = []) {
  const cols = columnasDe(ctx).filter((c) => !quitar.includes(c.clave))
  const celda = (ref, v) => (typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : v === '' || v == null ? '' : `<c r="${ref}" t="inlineStr"><is><t>${escaparXml(String(v))}</t></is></c>`)
  const fila = (n, valores) => `<row r="${n}">${valores.map((v, i) => celda(`${letraColumna(i)}${n}`, v)).join('')}</row>`
  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[fila(1, cols.map(titulo)), ...filas.map((f, i) => fila(i + 2, cols.map((c) => f[c.clave] ?? '')))].join('')}</sheetData></worksheet>`
  const raiz = 'http://schemas.openxmlformats.org'
  const bytes = crearZip([
    { nombre: '[Content_Types].xml', texto: `<?xml version="1.0"?><Types xmlns="${raiz}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>` },
    { nombre: '_rels/.rels', texto: `<?xml version="1.0"?><Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', texto: `<?xml version="1.0"?><workbook xmlns="${raiz}/spreadsheetml/2006/main" xmlns:r="${raiz}/officeDocument/2006/relationships"><sheets><sheet name="Equipos" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', texto: `<?xml version="1.0"?><Relationships xmlns="${raiz}/package/2006/relationships"><Relationship Id="rId1" Type="${raiz}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { nombre: 'xl/worksheets/sheet1.xml', texto: hoja },
  ])
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
const bueno = (cod, extra = {}) => ({
  codigo: cod, area: 'General › Planta', ubicacion: 'Pasillo 1', responsable: 'Prueba Ficticia, Ana',
  'campo.numero_serie': `SN-${cod}`, 'campo.agente': 'PQS', 'campo.capacidad': 6, 'campo.capacidad_unidad': 'kg',
  'campo.anio_fabricacion': 2020, 'campo.anio_prueba_hidrostatica': 2023, 'campo.ultimo_mantenimiento': '03/2026', ...extra,
})
const revisar = (ctx, filas, quitar) => revisarEquipos(excel(ctx, filas, quitar), ctx)

console.log('\n── Plantilla')
{
  const xlsx = crearPlantillaEquipos(ctxExt, 'Empresa Ficticia')
  const hoja = await leerHoja(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength), 'Equipos')
  const titulos = (hoja.filas.get(1) ?? []).map(String)
  comprobar('La plantilla de extintores trae las columnas del tipo, con * en las obligatorias', titulos.includes('Código *') && titulos.includes('Área *') && titulos.includes('Ubicación *') && titulos.includes('Responsable *') && titulos.some((t) => t.startsWith('Año de fabricación')) && titulos.some((t) => t.startsWith('Tipo de agente')), titulos.join(' | '))
  comprobar('Los dos años son obligatorios en extintores', titulos.filter((t) => /^Año/.test(t)).every((t) => t.endsWith('*')), titulos.join(' | '))
  const t2 = columnasDe(ctxDaci).map((c) => c.titulo)
  comprobar('Con varias sedes, la plantilla pide la sede; el DACI pide el subtipo', t2.includes('Sede') && t2.includes('Subtipo'), t2.join(' | '))
  comprobar('En DACI el área, la ubicación y el responsable son opcionales', columnasDe(ctxDaci).filter((c) => ['area', 'ubicacion', 'responsable'].includes(c.clave)).every((c) => !c.obligatoria))
}

console.log('\n── Filas correctas')
{
  const r = await revisar(ctxExt, [bueno('P1-010'), bueno('P1-011', { area: 'Logística', ubicacion: 'Almacén', 'campo.agente': 'co2', 'campo.ultimo_mantenimiento': 46082 })])
  comprobar('Dos extintores correctos: sin errores y listos', r.errores.length === 0 && r.listos.length === 2, JSON.stringify(r.errores))
  const d = r.listos[0].datos
  comprobar('Resuelve área, ubicación y responsable a sus identificadores', d.unidad_id === 'u1' && d.ubicacion_id === 'b1' && d.responsable_id === 'p1' && d.sede_id === 's1', JSON.stringify(d))
  comprobar('El próximo mantenimiento se calcula solo (+12 meses) y el mes se normaliza', d.datos.ultimo_mantenimiento === '2026-03' && d.datos.proximo_mantenimiento === '2027-03', JSON.stringify(d.datos))
  comprobar('El agente se reconoce aunque se escriba «co2» (queda «CO₂») y el mes puede venir como fecha de Excel', r.listos[1].datos.datos.agente === 'CO₂' && r.listos[1].datos.datos.ultimo_mantenimiento === '2026-03', JSON.stringify(r.listos[1]?.datos.datos))
}

console.log('\n── Errores: avisa fila por fila y no carga nada')
{
  const r = await revisar(ctxExt, [
    bueno('P1-020', { area: '' }),
    bueno('P1-021', { 'campo.agente': 'Polvo mágico' }),
    bueno('P1-022', { 'campo.anio_fabricacion': 1800 }),
    bueno('P1-023', { responsable: 'Nadie Existe' }),
    bueno('P1-001'),
    bueno('P1-024'),
    bueno('P1-024'),
    bueno('P1-025', { ubicacion: 'Techo' }),
    bueno('P1-026', { 'campo.capacidad': 'seis' }),
    bueno('P1-027', { 'campo.anio_prueba_hidrostatica': '' }),
    bueno('', {}),
  ])
  const por = new Map(r.errores.map((e) => [e.fila, e.mensaje]))
  comprobar('Hay errores y no hay filas listas mezcladas con ellos en la revisión de errores', r.errores.length >= 9, JSON.stringify(r.errores))
  comprobar('Área vacía: «falta el área»', /falta el área/.test(por.get(2) ?? ''), por.get(2))
  comprobar('Agente fuera de la lista: dice cuáles hay', /no está en la lista/.test(por.get(3) ?? '') && /PQS/.test(por.get(3) ?? ''), por.get(3))
  comprobar('Año fuera de rango', /año de 4 cifras/.test(por.get(4) ?? ''), por.get(4))
  comprobar('Responsable que no existe', /no es una persona activa/.test(por.get(5) ?? ''), por.get(5))
  comprobar('Código que ya existe en la empresa', /ya existe/.test(por.get(6) ?? ''), por.get(6))
  comprobar('Código repetido en el mismo Excel (avisa la fila de la primera vez)', /repetido/.test(por.get(8) ?? '') && /fila 7/.test(por.get(8) ?? ''), por.get(8))
  comprobar('Ubicación que no existe', /no existe/.test(por.get(9) ?? ''), por.get(9))
  comprobar('Capacidad que no es número', /debe ser un número/.test(por.get(10) ?? ''), por.get(10))
  comprobar('Falta el año de la prueba hidrostática (obligatorio en extintores)', /falta «Año de la última prueba hidrostática»/.test(por.get(11) ?? ''), por.get(11))
  comprobar('Fila sin código: «falta el código»', /falta el código/.test(por.get(12) ?? ''), por.get(12))
}

console.log('\n── DACI y archivos no válidos')
{
  const r = await revisar(ctxDaci, [
    { codigo: 'D-1', sede: 'Sede norte', subtipo: 'Panel de control', 'campo.modelo': 'X1' },
    { codigo: 'D-2', sede: 'Sede norte', subtipo: 'Detector' },
    { codigo: 'D-3', sede: 'Sede norte', subtipo: 'Panel de control' },
    { codigo: 'D-4', sede: 'Sede sur', subtipo: 'Detector' },
    { codigo: 'D-5', sede: 'Sede norte', subtipo: 'Cámara' },
  ])
  const por = new Map(r.errores.map((e) => [e.fila, e.mensaje]))
  comprobar('DACI: panel con modelo y detector sin modelo están bien', r.listos.length === 2 && r.listos[0].datos.sede_id === 's2' && r.listos[0].datos.subtipo === 'panel', JSON.stringify(r.errores))
  comprobar('DACI: el modelo solo es obligatorio en el panel', /falta «Modelo»/.test(por.get(4) ?? ''), por.get(4))
  comprobar('DACI: sede o subtipo que no existen', /sede «Sede sur» no existe/.test(por.get(5) ?? '') && /subtipo «Cámara»/.test(por.get(6) ?? ''), JSON.stringify([...por]))
  let msg = ''
  try {
    await revisar(ctxExt, [bueno('P1-030')], ['area'])
  } catch (e) {
    msg = e.message
  }
  comprobar('Si falta una columna obligatoria en el Excel, lo dice y manda a usar la plantilla', /Faltan columnas obligatorias/.test(msg) && /Área/.test(msg), msg)
  let vacio = ''
  try {
    await revisar(ctxExt, [])
  } catch (e) {
    vacio = e.message
  }
  comprobar('Un Excel sin equipos se avisa', /no tiene equipos/.test(vacio), vacio)
}

const r = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/carga-activos.md', `# Pruebas de la carga masiva de equipos\n\nFecha: ${new Date().toISOString()} · Sin base de datos · **${r.ok} de ${r.total} correctas**\n\n${resultados.map((x) => `- ${x.ok ? '✅' : '❌'} ${x.nombre}${x.detalle && !x.ok ? ` — ${x.detalle}` : ''}`).join('\n')}\n`)
process.exit(r.ok === r.total ? 0 : 1)
