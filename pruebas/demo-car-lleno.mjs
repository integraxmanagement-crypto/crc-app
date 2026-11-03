// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), el registro mensual de casetas de ataque rápido (CAR) lleno con
// datos FICTICIOS: 3 y 10 casetas (más filas que las 7 dibujadas). Uso: node pruebas/demo-car-lleno.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { valoresDe } from '../src/inspecciones/excel.ts'
import { llenarExcelPeriodo, valoresFilas, valoresGenerales } from '../src/inspecciones/excelPeriodo.ts'

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'car').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/CAR_con_marcas_CRC.xlsx', import.meta.url)))
const claves = receta.secciones.flatMap((s) => s.puntos.map((p) => p.clave))
const base = valoresDe({
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123', actividad: 'Actividad de prueba', trabajadores: 120 },
  formato: { nombre: 'Inspección de caseta de ataque rápido (CAR)', codigo_formato: 'SO.R.G.081', version_formato: '01', fecha_aprobacion: '2026-01-15' },
  receta, numero: null, fecha: '2026-10-31', hora: null, sede: 'Sede principal', area: null, ubicacion: null, inspector: null,
  resultado: null, puntaje: null, observacion: null, activo: null, respuestas: {}, filas: {}, firmantes: [], persona: () => null,
})
const equipo = (k) => {
  const falla = k === 1 || k === 6
  const respuestas = Object.fromEntries(claves.map((c) => [c, { valor: falla && c === 'CAR-M02' ? 'no' : k === 2 && c === 'CAR-M10' ? 'na' : 'si' }]))
  const codigo = `CAR-${String(k + 1).padStart(2, '0')}`
  return {
    codigo, datos: {},
    lugar: { area: 'Planta', ubicacion: `Zona ${k + 1} (ficticia)`, responsable: 'Prueba Ficticia, Ana' },
    inspeccion: k % 5 === 4 ? null : {
      empresa: { razon_social: 'x', ruc: 'x', domicilio: 'x', actividad: 'x' }, formato: { nombre: 'x', codigo_formato: null, version_formato: null, fecha_aprobacion: null },
      receta, numero: k + 1, fecha: '2026-10-27', hora: '10:00', sede: 's', area: 'Planta', ubicacion: null, inspector: 'Ana',
      resultado: falla ? 'No conforme' : 'Conforme', puntaje: null, observacion: falla ? 'Falta una manguera, se repone' : null,
      activo: { codigo, datos: {} }, respuestas, filas: {}, firmantes: [], persona: () => null,
    },
  }
}
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAAAGJQUHAAAAFUlEQVR4nGP4z8Dwn4GBgYGBgQEAFvQC/YpZwHkAAAAASUVORK5CYII=', 'base64'))
for (const n of [3, 10]) {
  const equipos = Array.from({ length: n }, (_, k) => equipo(k))
  const periodo = { etiqueta: 'Octubre 2026', desde: '2026-10-01', hasta: '2026-10-31' }
  const r = await llenarExcelPeriodo(original, valoresGenerales(base, periodo, { hechos: n, total: n }, { nombre: 'Ana Ficticia', cargo: 'Inspectora de seguridad' }), valoresFilas(equipos), new Map([['firma.registro.imagen', png], ['logo', png]]))
  writeFileSync(new URL(`../Registros/CAR_lleno_${n}.xlsx`, import.meta.url), r.bytes)
  console.log(n, r.filas, r.usadasDelFormato, r.agregadas)
}
