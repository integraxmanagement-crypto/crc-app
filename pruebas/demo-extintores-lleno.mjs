// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), el registro semanal de extintores lleno con datos
// FICTICIOS: 3 equipos y 60 equipos (más filas que las 56 dibujadas). Uso: node pruebas/demo-extintores-lleno.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { valoresDe } from '../src/inspecciones/excel.ts'
import { llenarExcelPeriodo, valoresFilas, valoresGenerales } from '../src/inspecciones/excelPeriodo.ts'

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'extintores').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/EXTINTORES_con_marcas_CRC.xlsx', import.meta.url)))
const claves = receta.secciones[0].puntos.map((p) => p.clave)
const base = valoresDe({
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123', actividad: 'Actividad de prueba', trabajadores: 120 },
  formato: { nombre: 'Inspección de extintores portátiles', codigo_formato: 'FIC-EXT', version_formato: '02', fecha_aprobacion: '2026-01-15' },
  receta, numero: null, fecha: '2026-10-26', hora: null, sede: 'Sede principal', area: null, ubicacion: null, inspector: null,
  resultado: null, puntaje: null, observacion: null, activo: null, respuestas: {}, filas: {}, firmantes: [], persona: () => null,
})
const equipo = (k) => {
  const datos = { numero_serie: `SN-${1000 + k}`, agente: k % 2 ? 'CO₂' : 'PQS', capacidad: k % 2 ? 5 : 6, capacidad_unidad: 'Kg', anio_fabricacion: 2015, anio_prueba_hidrostatica: 2023, proximo_mantenimiento: '2027-03' }
  const respuestas = Object.fromEntries(claves.map((c) => [c, { valor: k === 1 && c === 'EXT-10' ? 'no' : k === 2 && c === 'EXT-05' ? 'na' : 'si' }]))
  return {
    codigo: `P1-${String(k + 1).padStart(3, '0')}`, datos,
    lugar: { area: 'Planta', ubicacion: `Pasillo ficticio ${k + 1}`, responsable: 'Prueba Ficticia, Ana' },
    inspeccion: k % 5 === 4 ? null : {
      empresa: { razon_social: 'x', ruc: 'x', domicilio: 'x', actividad: 'x' }, formato: { nombre: 'x', codigo_formato: null, version_formato: null, fecha_aprobacion: null },
      receta, numero: k + 1, fecha: '2026-10-27', hora: '10:00', sede: 's', area: 'Planta', ubicacion: null, inspector: 'Ana',
      resultado: k === 1 ? 'No conforme' : k === 3 ? 'No conforme: vencido' : 'Conforme', puntaje: null, observacion: k === 3 ? 'Manguera con una pequeña grieta, por cambiar' : null,
      activo: { codigo: `P1-${String(k + 1).padStart(3, '0')}`, datos }, respuestas, filas: {}, firmantes: [], persona: () => null,
    },
  }
}
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAAAGJQUHAAAAFUlEQVR4nGP4z8Dwn4GBgYGBgQEAFvQC/YpZwHkAAAAASUVORK5CYII=', 'base64'))
for (const n of [3, 60]) {
  const equipos = Array.from({ length: n }, (_, k) => equipo(k))
  const periodo = { etiqueta: 'Semana 44', desde: '2026-10-26', hasta: '2026-11-01' }
  const r = await llenarExcelPeriodo(original, valoresGenerales(base, periodo, { hechos: n, total: n }, { nombre: 'Ana Ficticia', cargo: 'Inspectora de seguridad' }), valoresFilas(equipos), new Map([['firma.registro.imagen', png], ['logo', png]]))
  writeFileSync(new URL(`../Registros/EXTINTORES_lleno_${n}.xlsx`, import.meta.url), r.bytes)
  console.log(n, r.filas, r.usadasDelFormato, r.agregadas)
}
