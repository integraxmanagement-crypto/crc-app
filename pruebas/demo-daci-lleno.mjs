// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), el registro mensual del sistema DACI lleno con datos
// FICTICIOS: 5 y 60 dispositivos (más filas que las 57 dibujadas). Uso: node pruebas/demo-daci-lleno.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { valoresDe } from '../src/inspecciones/excel.ts'
import { llenarExcelPeriodo, valoresFilas, valoresGenerales } from '../src/inspecciones/excelPeriodo.ts'

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'daci').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/DACI_con_marcas_CRC.xlsx', import.meta.url)))
const subtipos = ['panel', 'pulsador', 'detector', 'sirena']
const puntosDe = (sub) => receta.secciones.filter((s) => s.solo_subtipos?.includes(sub)).flatMap((s) => s.puntos.map((p) => p.clave))
const base = valoresDe({
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123', actividad: 'Actividad de prueba', trabajadores: 120 },
  formato: { nombre: 'Inspección del sistema DACI', codigo_formato: 'FIC-DACI', version_formato: '01', fecha_aprobacion: '2026-01-15' },
  receta, numero: null, fecha: '2026-10-31', hora: null, sede: 'Sede principal', area: null, ubicacion: null, inspector: null,
  resultado: null, puntaje: null, observacion: null, activo: null, respuestas: {}, filas: {}, firmantes: [], persona: () => null,
})
const equipo = (k) => {
  const sub = subtipos[k % 4]
  const claves = puntosDe(sub)
  const falla = k === 1 || k === 6
  const respuestas = Object.fromEntries(claves.map((c) => [c, { valor: falla && c === claves[0] ? 'no' : k === 2 && c === claves[claves.length - 1] ? 'na' : 'si' }]))
  const datos = { subtipo: sub, modelo: 'MOD-1', zona: `Z${k + 1}` }
  return {
    codigo: `D-${String(k + 1).padStart(3, '0')}`, datos,
    tipo: { panel: 'Panel de control', pulsador: 'Pulsador (estación manual)', detector: 'Detector', sirena: 'Sirena o luz estroboscópica' }[sub],
    noAplica: new Set(receta.secciones.filter((x) => x.solo_subtipos?.length && !x.solo_subtipos.includes(sub)).flatMap((x) => x.puntos.map((q) => q.clave))),
    lugar: { area: 'Planta', ubicacion: `${sub} ficticio ${k + 1}`, responsable: 'Prueba Ficticia, Ana' },
    inspeccion: k % 5 === 4 ? null : {
      empresa: { razon_social: 'x', ruc: 'x', domicilio: 'x', actividad: 'x' }, formato: { nombre: 'x', codigo_formato: null, version_formato: null, fecha_aprobacion: null },
      receta, numero: k + 1, fecha: '2026-10-27', hora: '10:00', sede: 's', area: 'Planta', ubicacion: null, inspector: 'Ana',
      resultado: falla ? 'Inoperativo' : 'Operativo', puntaje: null, observacion: falla ? 'Equipo con falla, se pide acción' : null,
      activo: { codigo: `D-${String(k + 1).padStart(3, '0')}`, datos }, respuestas, filas: {}, firmantes: [], persona: () => null,
    },
  }
}
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAAAGJQUHAAAAFUlEQVR4nGP4z8Dwn4GBgYGBgQEAFvQC/YpZwHkAAAAASUVORK5CYII=', 'base64'))
for (const n of [5, 60]) {
  const equipos = Array.from({ length: n }, (_, k) => equipo(k))
  const periodo = { etiqueta: 'Octubre 2026', desde: '2026-10-01', hasta: '2026-10-31' }
  const r = await llenarExcelPeriodo(original, valoresGenerales(base, periodo, { hechos: n, total: n }, { nombre: 'Ana Ficticia', cargo: 'Inspectora de seguridad' }), valoresFilas(equipos), new Map([['firma.registro.imagen', png], ['logo', png]]))
  writeFileSync(new URL(`../Registros/DACI_lleno_${n}.xlsx`, import.meta.url), r.bytes)
  console.log(n, r.filas, r.usadasDelFormato, r.agregadas)
}
