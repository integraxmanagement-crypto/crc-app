// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), la hoja de una electrobomba llena con datos FICTICIOS.
// Uso: node pruebas/demo-electrobomba-lleno.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { gruposDe, llenarExcel, valoresDe } from '../src/inspecciones/excel.ts'

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'electrobomba').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/ELECTROBOMBA_con_marcas_CRC.xlsx', import.meta.url)))
const respuestas = {}
for (const sec of receta.secciones) for (const p of sec.puntos) {
  if (p.tipo === 'si_no') respuestas[p.clave] = p.clave === 'EB-A05' ? { valor: 'no', obs: 'Soporte con corrosión, se pide cambiar' } : p.clave === 'EB-B06' ? { valor: 'no', obs: 'Vibración leve' } : { valor: 'si' }
}
Object.assign(respuestas, { 'EB-P01A': { valor: '110 psi' }, 'EB-P01F': { valor: '100 psi' }, 'EB-P01O': { valor: 'Dentro de lo esperado' }, 'EB-P02A': { valor: '09:00' }, 'EB-P02F': { valor: '09:30' } })
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAIAAAAGJQUHAAAAFUlEQVR4nGP4z8Dwn4GBgYGBgQEAFvQC/YpZwHkAAAAASUVORK5CYII=', 'base64'))
const d = {
  empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123', actividad: 'Actividad de prueba', trabajadores: 120 },
  formato: { nombre: 'Inspección de electrobomba', codigo_formato: 'SO.R.G.054', version_formato: '01', fecha_aprobacion: '2026-07-01' },
  receta, numero: 1, fecha: '2026-10-27', hora: '10:00', sede: 'Sede principal', area: 'Planta', ubicacion: 'Cuarto de bombas', inspector: 'Ana Ficticia',
  resultado: 'No conforme', puntaje: null, observacion: null, activo: { codigo: 'EB-001', datos: { principal_marca: 'Weg', principal_potencia: '30 HP', principal_caudal: '25 L/s', principal_presion_nominal: '100 psi', principal_arranque_parada: 'Arranque 80 psi / Parada manual', principal_alimentacion: 'Trifásico 220 V / 3550 RPM', jockey_marca: 'Pedrollo', jockey_potencia: '2 HP', jockey_caudal: '1.5 L/s', jockey_presion_nominal: '100 psi', jockey_arranque_parada: 'Arranque 90 psi / Parada 110 psi', jockey_alimentacion: 'Trifásico 220 V / 3450 RPM' } }, respuestas, filas: {},
  firmantes: [
    { rol_clave: 'inspector', nombre: 'Ana Ficticia', cargo: 'Inspectora de seguridad', fecha: '2026-10-27' },
    { rol_clave: 'custodia', nombre: 'Luis Ficticio', cargo: 'Jefe de mantenimiento', fecha: '2026-10-27' },
  ],
  persona: () => null,
}
const r = await llenarExcel(original, valoresDe(d), new Map([['logo', png], ['firma.inspector.imagen', png], ['firma.custodia.imagen', png]]), gruposDe(d))
writeFileSync(new URL('../Registros/ELECTROBOMBA_lleno.xlsx', import.meta.url), r)
console.log('Listo: Registros/ELECTROBOMBA_lleno.xlsx')
