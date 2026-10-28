// Piezas comunes para armar hojas Excel de inspecciones (tareas 3.4-C y 3.4-D).
import { db, mensaje } from '../empresas/datos'
import type { Receta } from '../formatos/receta'
import { type CopiaLocal, leerArchivo } from './campo'
import type { Inspeccion } from './datos'
import type { DatosHoja } from './excel'

/** El Excel de la organización para un formato (de la memoria del equipo si ya está; si no, del almacén). null = no tiene. */
export async function excelDeFormato(plantillaId: string): Promise<Uint8Array | null> {
  const { data: x, error } = await db().from('plantillas_excel').select('ruta').eq('plantilla_id', plantillaId).maybeSingle()
  if (error) throw new Error(mensaje(error))
  if (!x) return null
  let archivo = await leerArchivo(`formatos-excel:${x.ruta}`)
  if (!archivo) {
    const r = await db().storage.from('formatos-excel').download(x.ruta)
    if (r.error) throw new Error(mensaje(r.error))
    archivo = r.data
  }
  return new Uint8Array(await archivo.arrayBuffer())
}

/** Ofrece el archivo para guardar en el equipo. */
export function guardarExcel(bytes: Uint8Array, nombre: string) {
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  enlace.download = `${nombre.replace(/[^\p{L}\p{N}]+/gu, '-')}.xlsx`
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
}

export type VersionHoja = { receta: Receta; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null }
type Lugares = { sede?: string | null; area?: string | null; ubicacion?: string | null }

/** Los datos de una inspección para llenar sus marcas (sin firmas: se firma y se fecha a mano). */
export function datosHoja(
  i: Pick<Inspeccion, 'numero' | 'fecha' | 'iniciada_en_equipo' | 'cerrada_en_equipo' | 'inspector_id' | 'resultado' | 'puntaje' | 'observacion' | 'activo_foto' | 'respuestas' | 'filas'>,
  extra: { nombreFormato: string; version: VersionHoja; copia: CopiaLocal | null; nombre: (id: string | null) => string; lugares: Lugares; firmantes?: DatosHoja['firmantes'] },
): DatosHoja {
  const { version: v, copia, nombre } = extra
  return {
    empresa: copia?.empresa ?? { razon_social: '', ruc: '', domicilio: '', actividad: '' },
    formato: { nombre: extra.nombreFormato, codigo_formato: v.codigo_formato, version_formato: v.version_formato, fecha_aprobacion: v.fecha_aprobacion },
    receta: v.receta,
    numero: i.numero,
    fecha: i.fecha,
    hora: new Date(i.iniciada_en_equipo ?? i.cerrada_en_equipo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }),
    sede: extra.lugares.sede ?? null,
    area: extra.lugares.area ?? null,
    ubicacion: extra.lugares.ubicacion ?? null,
    inspector: nombre(i.inspector_id),
    resultado: i.resultado,
    puntaje: i.puntaje,
    observacion: i.observacion,
    activo: i.activo_foto ? { codigo: i.activo_foto.codigo, datos: i.activo_foto.datos } : null,
    respuestas: i.respuestas,
    filas: i.filas,
    firmantes: extra.firmantes ?? [],
    persona: (pid) => nombre(pid) || null,
  }
}
