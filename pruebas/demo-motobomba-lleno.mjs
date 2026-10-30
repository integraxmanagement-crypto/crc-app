// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), la hoja de una motobomba llena con datos FICTICIOS.
// Uso: node pruebas/demo-motobomba-lleno.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { gruposDe, llenarExcel, valoresDe } from '../src/inspecciones/excel.ts'

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'motobomba').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/MOTOBOMBA_con_marcas_CRC.xlsx', import.meta.url)))
const respuestas = {}
for (const s of receta.secciones) for (const p of s.puntos) {
  if (p.tipo === 'si_no') respuestas[p.clave] = p.clave === 'MB-A05' ? { valor: 'no', obs: 'Nivel en 1/2 tanque, se pide completar' } : p.clave === 'MB-B03' ? { valor: 'no', obs: 'Tacómetro sin lectura' } : { valor: 'si' }
}
Object.assign(respuestas, {
  'MB-P01': { valor: '10:35' }, 'MB-P01O': { valor: 'Prueba de 30 minutos' }, 'MB-P02': { valor: '1 250 h' }, 'MB-P03': { valor: '150 psi' }, 'MB-P04': { valor: 'Principal y Jockey en automático' },
})
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAAAGJQUHAAAAFUlEQVR4nGP4z8Dwn4GBgYGBgQEAFvQC/YpZwHkAAAAASUVORK5CYII=', 'base64'))
const d = {
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123', actividad: 'Actividad de prueba', trabajadores: 120 },
  formato: { nombre: 'Inspección de motobomba', codigo_formato: 'SO.R.G.075', version_formato: '01', fecha_aprobacion: '2026-03-09' },
  receta, numero: 1, fecha: '2026-10-27', hora: '10:00', sede: 'Sede principal', area: 'Planta', ubicacion: 'Cuarto de bombas', inspector: 'Ana Ficticia',
  resultado: 'No conforme', puntaje: null, observacion: null, activo: { codigo: 'MB-001', datos: {} }, respuestas, filas: {},
  firmantes: [
    { rol_clave: 'inspector', nombre: 'Ana Ficticia', cargo: 'Inspectora de seguridad', fecha: '2026-10-27' },
    { rol_clave: 'custodia', nombre: 'Luis Ficticio', cargo: 'Jefe de mantenimiento', fecha: '2026-10-27' },
  ],
  persona: () => null,
}
const r = await llenarExcel(original, valoresDe(d), new Map([['logo', png], ['firma.inspector.imagen', png], ['firma.custodia.imagen', png]]), gruposDe(d))
writeFileSync(new URL('../Registros/MOTOBOMBA_lleno.xlsx', import.meta.url), r)
console.log('Listo: Registros/MOTOBOMBA_lleno.xlsx')
