// Genera, SOLO en esta computadora (Registros/ no se sube a GitHub ni a Drive), copias llenas del Excel del IPF con datos
// FICTICIOS: una condición, tres condiciones y ninguna, para ver cómo se repiten las filas. Uso: node pruebas/demo-ipf-llenos.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { gruposDe, llenarExcel, valoresDe } from '../src/inspecciones/excel.ts'

const crc = (b) => {
  let c = ~0
  for (const x of b) {
    c ^= x
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
const trozo = (tipo, datos) => {
  const t = Buffer.concat([Buffer.from(tipo), datos])
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const f = Buffer.alloc(4)
  f.writeUInt32BE(crc(t))
  return Buffer.concat([largo, t, f])
}
/** PNG de colores (ficticio) de w×h: una «foto» inventada con franjas. */
const png = (w, h, r, g, b) => {
  const fila = Buffer.alloc(1 + w * 3)
  const crudo = Buffer.concat(Array.from({ length: h }, (_, y) => {
    const f = Buffer.from(fila)
    for (let x = 0; x < w; x++) f.set([(r + x) % 256, (g + y) % 256, b], 1 + x * 3)
    return f
  }))
  const cab = Buffer.alloc(13)
  cab.writeUInt32BE(w, 0)
  cab.writeUInt32BE(h, 4)
  cab.set([8, 2, 0, 0, 0], 8)
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', cab), trozo('IDAT', deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]))
}

const receta = PLANTILLAS_BASE.find((p) => p.codigo === 'ipf').receta
const original = new Uint8Array(readFileSync(new URL('../Registros/IPF_con_marcas_CRC.xlsx', import.meta.url)))
const hecho = 'Se encontró que el pasillo de la zona de carga tiene cables sueltos que cruzan el paso del personal y pueden provocar caídas; se recomienda canalizarlos de inmediato y señalizar el área'

async function generar(nombre, nCond, nFirmantes) {
  const filas = Array.from({ length: nCond }, (_, i) => ({
    'IPF-C01': { valor: `Cables sueltos en el pasillo ${i + 1}` },
    'IPF-C02': { valor: 'Caída al mismo nivel' },
    'IPF-C03': { valor: null, fotos: 1 },
    'IPF-C04': { valor: i === 0 ? hecho : 'Colocar tapa en el tablero' },
    'IPF-C05': { valor: 'p-1' },
    'IPF-C06': { valor: '2026-11-15' },
  }))
  const d = {
    empresa: { razon_social: 'Empresa Ficticia A S.A.C.', ruc: '20000000010', domicilio: 'Av. Inventada 123 · Lima', actividad: 'Actividad de prueba', trabajadores: 120 },
    formato: { nombre: 'Inspección de seguridad ocupacional (IPF)', codigo_formato: 'FIC-IPF', version_formato: '03', fecha_aprobacion: '2026-01-15' },
    receta, numero: 83, fecha: '2026-10-29', hora: '09:40', sede: 'Sede principal', area: 'Planta', ubicacion: null, inspector: 'Prueba Ficticia, Ana',
    resultado: null, puntaje: null, observacion: null, activo: null,
    respuestas: {
      'IPF-A01': { valor: 'p-1' }, 'IPF-A02': { valor: 'Otros' }, 'IPF-A04': { valor: 'Inspección de orden y limpieza' }, 'IPF-A03': { valor: 'Identificar condiciones y actos inseguros en el área' },
      'IPF-01': { valor: nCond ? 'si' : 'no' }, 'IPF-R01': { valor: 'Se revisó el área completa.' }, 'IPF-R02': { valor: 'No aplica' }, 'IPF-R03': { valor: 'Mantener el orden.' },
    },
    filas: { condiciones: filas },
    firmantes: ['Ana Ficticia', 'Beto Ficticio', 'Carla Ficticia'].slice(0, nFirmantes).map((n, i) => ({ rol_clave: 'inspectores', nombre: n, cargo: ['Supervisora SST', 'Jefe de planta', 'Asistente'][i], fecha: null }))
      .concat([{ rol_clave: 'responsable_registro', nombre: 'Ana Ficticia', cargo: 'Supervisora SST', fecha: '2026-10-29' }]),
    persona: (id) => (id === 'p-1' ? 'Prueba Ficticia, Ana' : null),
  }
  const imagenes = new Map(filas.map((_, i) => [`foto.IPF-C03#${i + 1}`, png(300 + i * 40, 220, 40 + i * 50, 90, 160)]))
  const lleno = await llenarExcel(original, valoresDe(d), imagenes, gruposDe(d))
  writeFileSync(new URL(`../Registros/${nombre}`, import.meta.url), lleno)
  console.log(`${nombre}: ${lleno.length} bytes`)
}
await generar('IPF_lleno_1condicion.xlsx', 1, 1)
await generar('IPF_lleno_3condiciones.xlsx', 3, 2)
await generar('IPF_lleno_sin_condiciones.xlsx', 0, 1)
