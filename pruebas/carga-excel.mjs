// Prueba final de la carga desde Excel (tarea 3.6, paso 7). Solo datos FICTICIOS; no graba nada.
// 1. Lee el Excel de 25 filas (pruebas/excel/crear_excel_prueba.py) con el MISMO lector de la app.
// 2. Lo envía a la revisión del servidor como el administrador de A y revisa fila por fila lo esperado.
// 3. Prueba archivos malos: dañado, que no es Excel, Excel antiguo, CSV, más de 1 MB, sin personas, 301 personas.
// 4. Prueba los límites del servidor (más de 300 filas, envío demasiado grande, sin filas).
// Guarda un informe en pruebas/resultados/carga-desde-excel.md.
// Uso: node pruebas/carga-excel.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { leerPersonal } from '../src/carga/lectura.ts'
import { crearPlantilla } from '../src/carga/plantilla.ts'
import { comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const leerArchivo = (ruta) => {
  const b = readFileSync(ruta)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}
/** Lee y devuelve el mensaje de error del lector (o null si lo aceptó). */
const rechazo = async (bytes) => {
  try {
    await leerPersonal(bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    return null
  } catch (e) {
    return e.message
  }
}

const { c: adminA } = await ingresarComo('ADMIN_A')
const { c: dueno } = await ingresarComo('DUENO')
const { data: empresas } = await dueno.from('empresas').select('id, ruc')
const A = empresas.find((e) => e.ruc === '20000000010').id

// ───────────────────────────────────────────────
seccion('1. El lector de la app con el Excel de 25 filas')
const excel = leerArchivo('pruebas/excel/CRC_prueba_carga_25_filas_FICTICIO.xlsx')
const { registros } = await leerPersonal(excel)
const fila = (n) => registros.find((r) => r.fila === n)
comprobar('Lee las 25 personas', registros.length === 25, `${registros.length}`)
comprobar('Fecha guardada por Excel → 03/04/2023', fila(2)?.fecha === '2023-04-03', fila(2)?.fecha)
comprobar('Fecha escrita a mano «15/03/2021» → 15/03/2021', fila(8)?.fecha === '2021-03-15', fila(8)?.fecha)
comprobar('Fecha imposible «31/02/2022» se marca como no válida', fila(9)?.fecha === null && fila(9)?.fechaTexto === '31/02/2022')
comprobar('Avisa cuando Excel guardó el documento como número', fila(3)?.numeroEraNumero === true && fila(4)?.numeroEraNumero === true)
comprobar('El documento escrito como texto no se marca', fila(2)?.numeroEraNumero === false)
const modelo = await leerPersonal(leerArchivo('pruebas/excel/CRC_modelo_carga_personal_FICTICIO_v01.xlsx'))
comprobar('El Excel modelo del dueño se sigue leyendo (27 personas)', modelo.registros.length === 27, `${modelo.registros.length}`)

// ───────────────────────────────────────────────
seccion('2. La revisión del servidor, fila por fila (administrador de A)')
const ESPERADO = {
  2: ['nueva'], 3: ['nueva'], 4: ['error', 'quitarle un 0'], 5: ['nueva'], 6: ['nueva'], 7: ['nueva'], 8: ['nueva'],
  9: ['error', 'Fecha de ingreso no válida'], 10: ['error', 'fuera de rango'], 11: ['error', 'Repetido'],
  12: ['error', 'Faltan los apellidos'], 13: ['error', 'administradores los crea Integrax'], 14: ['error', 'Rol no válido'],
  15: ['falta_lista', 'Puesto «Piloto de submarino»'], 16: ['falta_lista', 'Área fantasma'], 17: ['nueva'],
  18: ['falta_lista', 'Línea Z'], 19: ['error', 'Falta la gerencia'], 20: ['error', 'Tipo de documento no válido'],
  21: ['administrador'], 22: ['actualizar|sin_cambios'], 23: ['error', 'otra empresa'], 24: ['error', 'como CE'],
  25: ['nueva'], 26: ['nueva'],
}
const rev = await llamarFuncion(adminA, 'carga-personal', { modo: 'revisar', empresa_id: A, filas: registros })
comprobar('La revisión responde', rev.estado === 200, `${rev.estado}`)
for (const [n, [estado, texto]] of Object.entries(ESPERADO)) {
  const r = rev.datos?.filas?.find((f) => f.fila === Number(n))
  const todo = [...(r?.motivos ?? []), ...(r?.faltan ?? [])].join(' / ')
  comprobar(`Fila ${n}: ${estado.replace('|', ' o ')}${texto ? ` («${texto}»)` : ''}`,
    Boolean(r) && estado.split('|').includes(r.estado) && (!texto || todo.includes(texto)), `${r?.estado} · ${todo}`)
}
const n7 = rev.datos?.filas?.find((f) => f.fila === 7)
comprobar('Fila 7: el número con puntos queda limpio (72000006)', n7?.numero === '72000006', n7?.numero)
const faltantes = rev.datos?.faltantes ?? []
comprobar('Propone crear solo lo que falta (puesto, área y subárea)', faltantes.length === 3, faltantes.map((f) => f.nombre ?? f.camino?.join(' › ')).join(' | '))
const grabar = await llamarFuncion(adminA, 'carga-personal', { modo: 'grabar', empresa_id: A, filas: registros })
comprobar('Con filas con error no se puede grabar (409) y nada se graba', grabar.estado === 409, `${grabar.estado}`)
const { count } = await dueno.from('personas').select('id', { count: 'exact', head: true }).like('numero_documento', '72000%')
comprobar('Ninguna persona de este Excel quedó creada', count === 0, `${count}`)

// ───────────────────────────────────────────────
seccion('3. Archivos malos: se rechazan con un mensaje claro, sin colgarse')
const bytes = new Uint8Array(excel)
const casos = [
  ['Excel dañado (cortado a la mitad)', bytes.slice(0, Math.floor(bytes.length / 2)), /dañado|no es un Excel/],
  ['Archivo que no es Excel (bytes al azar)', crypto.getRandomValues(new Uint8Array(4096)), /no es un Excel/],
  ['Excel antiguo (.xls)', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Uint8Array(500)]), /antiguo \(\.xls\)/],
  ['Lista en CSV renombrada', new TextEncoder().encode('tipo_documento,numero_documento\nDNI,72000001\n'), /no es un Excel/],
  ['Archivo de más de 1 MB', (() => { const b = new Uint8Array(1024 * 1024 + 10); b[0] = 0x50; b[1] = 0x4b; return b })(), /más de 1 MB/],
  ['Plantilla sin personas', crearPlantilla({ empresa: 'Empresa ficticia', puestos: ['Operaria'], gerencias: ['G'], areas: ['A'], subareas: [] }), /no tiene personas/],
]
for (const [nombre, contenido, esperado] of casos) {
  const m = await rechazo(contenido)
  comprobar(`${nombre}: rechazado`, Boolean(m) && esperado.test(m), m ?? 'lo aceptó')
}
const largo = await rechazo(new Uint8Array(readFileSync('pruebas/excel/CRC_prueba_301_filas_FICTICIO.xlsx')))
comprobar('Excel de 301 personas: rechazado (máximo 300)', /máximo por archivo es 300/.test(largo ?? ''), largo ?? 'lo aceptó')

// ───────────────────────────────────────────────
seccion('4. Límites del servidor (por si alguien se salta la pantalla)')
const base = registros[0]
const muchas = Array.from({ length: 301 }, (_, i) => ({ ...base, fila: i + 2, numero: String(74000000 + i) }))
const r301 = await llamarFuncion(adminA, 'carga-personal', { modo: 'revisar', empresa_id: A, filas: muchas })
comprobar('301 filas enviadas directo: rechazadas', r301.estado === 400, `${r301.estado} · ${r301.datos?.error}`)
const gordas = Array.from({ length: 200 }, (_, i) => ({ ...base, fila: i + 2, nombres: 'x'.repeat(2500) }))
const rGordo = await llamarFuncion(adminA, 'carga-personal', { modo: 'revisar', empresa_id: A, filas: gordas })
comprobar('Envío demasiado grande: rechazado', rGordo.estado === 400, `${rGordo.estado} · ${rGordo.datos?.error}`)
const rVacio = await llamarFuncion(adminA, 'carga-personal', { modo: 'revisar', empresa_id: A, filas: [] })
comprobar('Sin filas: rechazado', rVacio.estado === 400, `${rVacio.estado} · ${rVacio.datos?.error}`)
const directo = await adminA.rpc('grabar_carga', { p_empresa: A, p_por: '00000000-0000-0000-0000-000000000000', p_datos: {} })
comprobar('Nadie puede llamar al grabado de la base de datos sin pasar por la revisión', Boolean(directo.error), directo.error?.message)

const fallas = resumen()

// Informe legible
const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
let md = `# Carga de personal desde Excel — prueba final (tarea 3.6)\n\nFecha: ${fecha} (hora de Lima). Solo datos ficticios; esta prueba no graba nada.\n\n`
md += `Archivo: \`pruebas/excel/CRC_prueba_carga_25_filas_FICTICIO.xlsx\` (se crea con \`pruebas/excel/crear_excel_prueba.py\`).\n\n`
md += `**Resultado: ${resultados.length - fallas} de ${resultados.length} pruebas pasaron.**\n\n`
for (let i = 0; i < grupos.length; i++) {
  const g = grupos[i]
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  md += `## ${g.titulo}\n\n| Resultado | Prueba | Detalle |\n|---|---|---|\n`
  for (const r of resultados.slice(g.desde, hasta)) md += `| ${r.paso ? '✅ Pasa' : '❌ Falla'} | ${r.nombre} | ${String(r.detalle ?? '').replace(/\|/g, '/')} |\n`
  md += '\n'
}
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/carga-desde-excel.md', md)
console.log('Informe: pruebas/resultados/carga-desde-excel.md')
