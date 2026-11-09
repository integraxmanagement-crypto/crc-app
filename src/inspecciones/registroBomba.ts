// Registro de una bomba contra incendio (motobomba o electrobomba) con el Excel de la organización (09/11/2026): la hoja de la inspección del
// mes elegido, con quien hizo la inspección y custodia el registro en las dos firmas del pie (inspector y custodia). La firma puede ser
// electrónica (imagen dibujada en pantalla) o física (el espacio queda en blanco para firmar a mano).
import type { CopiaLocal } from './campo'
import { detalleInspeccion } from './datos'
import { gruposDe, llenarExcel, valoresDe } from './excel'
import { datosHoja, excelDeFormato, logoPng } from './hoja'

export type EntradaRegistroBomba = {
  inspeccionId: string
  copia: CopiaLocal
  registro: { nombre: string; cargo: string; fecha: string }
  /** null = firma física. */
  firma: Uint8Array | null
}

/** Arma el Excel; null si el formato no tiene Excel de la organización. */
export async function armarRegistroBomba(o: EntradaRegistroBomba): Promise<Uint8Array | null> {
  const d = await detalleInspeccion(o.inspeccionId)
  const i = d.inspeccion
  const v = i.plantillas_versiones
  if (!v) throw new Error('La inspección no tiene versión de formato.')
  const archivo = await excelDeFormato(i.plantilla_id)
  if (!archivo) return null
  const personas = new Map(o.copia.personas.map((p) => [p.persona_id, p.apellidos_nombres]))
  const nombre = (id: string | null | undefined) => (id ? (personas.get(id) ?? 'Persona de la empresa') : '')
  const firmantes = ['inspector', 'custodia'].map((rol) => ({ rol_clave: rol, nombre: o.registro.nombre, cargo: o.registro.cargo, fecha: o.registro.fecha }))
  const imagenes = new Map<string, Uint8Array>()
  if (o.firma) {
    imagenes.set('firma.inspector.imagen', o.firma)
    imagenes.set('firma.custodia.imagen', o.firma)
  }
  const logo = await logoPng(o.copia, (v as { logo?: string }).logo).catch(() => null)
  if (logo) imagenes.set('logo', logo)
  const datos = datosHoja(i, {
    nombreFormato: i.plantillas?.nombre ?? '',
    version: v,
    copia: o.copia,
    nombre,
    lugares: { sede: i.sedes?.nombre, area: i.unidades?.nombre, ubicacion: i.ubicaciones?.nombre },
    firmantes,
  })
  return llenarExcel(archivo, valoresDe(datos), imagenes, gruposDe(datos))
}
