// Registro de un período (semana o mes) de un formato por equipo, con el Excel de la organización (extintores): una fila por
// equipo con su última inspección del período, el logo arriba y, abajo, quien hizo la inspección y custodia el registro.
// Lo usan «Avance por período» y el botón «Generar registro» de extintores.
import type { CopiaLocal, FormatoLocal } from './campo'
import { type FilaAvance, inspeccionesCompletas } from './datos'
import { partes, valoresDe } from './excel'
import { type EquipoPeriodo, type ResultadoPeriodo, llenarExcelPeriodo, valoresFilas, valoresGenerales } from './excelPeriodo'
import { vistaDeExcel } from './excelVista'
import { datosHoja, excelDeFormato, guardarExcel, logoPng } from './hoja'

export type EntradaRegistro = {
  formato: FormatoLocal
  copia: CopiaLocal
  sede: string
  periodo: { etiqueta: string; desde: string; hasta: string }
  filas: FilaAvance[]
  registro: { nombre: string; cargo: string; fecha?: string }
  firma: Uint8Array | null
}

/** Arma el Excel del registro; null si el formato no tiene Excel de la organización. */
export async function armarRegistro(o: EntradaRegistro): Promise<ResultadoPeriodo | null> {
  const { formato, copia, sede, periodo, filas } = o
  const archivo = await excelDeFormato(formato.plantilla.id)
  if (!archivo) return null
  const nombreSede = copia.sedes.find((s) => s.id === sede)?.nombre ?? ''
  const nombreUbicacion = (id: string | null) => (id ? (copia.ubicaciones.find((u) => u.id === id)?.nombre ?? '') : '')
  const completas = new Map((await inspeccionesCompletas(filas.flatMap((f) => (f.inspeccion_id ? [f.inspeccion_id] : [])))).map((i) => [i.id, i]))
  const personas = new Map(copia.personas.map((p) => [p.persona_id, p.apellidos_nombres]))
  const nombre = (id: string | null) => (id ? (personas.get(id) ?? 'Persona de la empresa') : '')
  const subtipos = copia.tipos.find((t) => t.id === formato.plantilla.tipo_activo_id)?.subtipos ?? []
  const equipos: EquipoPeriodo[] = filas.map((f) => {
    const i = f.inspeccion_id ? completas.get(f.inspeccion_id) : undefined
    const a = copia.activos.find((x) => x.id === f.activo_id)
    // Los puntos de una sección «solo para» otros subtipos no se evalúan en este equipo.
    const noAplica = new Set(formato.version.receta.secciones.flatMap((s) => (s.solo_subtipos?.length && !(a?.subtipo && s.solo_subtipos.includes(a.subtipo)) ? s.puntos.map((p) => p.clave) : [])))
    return {
      tipo: subtipos.find((x) => x.codigo === a?.subtipo)?.nombre ?? '',
      noAplica,
      codigo: f.codigo ?? '',
      datos: a?.datos ?? {},
      lugar: { area: copia.unidades.find((u) => u.id === a?.unidad_id)?.nombre ?? '', ubicacion: nombreUbicacion(a?.ubicacion_id ?? null), responsable: nombre(a?.responsable_id ?? null) },
      inspeccion: i && i.plantillas_versiones
        ? datosHoja(i, { nombreFormato: formato.plantilla.nombre, version: i.plantillas_versiones, copia, nombre, lugares: { sede: i.sedes?.nombre, area: i.unidades?.nombre, ubicacion: i.ubicaciones?.nombre } })
        : null,
    }
  })
  const v = formato.version
  const base = valoresDe({
    empresa: copia.empresa,
    formato: { nombre: formato.plantilla.nombre, codigo_formato: v.codigo_formato, version_formato: v.version_formato, fecha_aprobacion: v.fecha_aprobacion },
    receta: v.receta, numero: null, fecha: periodo.hasta, hora: null, sede: nombreSede, area: null, ubicacion: null, inspector: null,
    resultado: null, puntaje: null, observacion: null, activo: null, respuestas: {}, filas: {}, firmantes: [], persona: () => null,
  })
  const imagenes = new Map<string, Uint8Array>()
  if (o.firma) imagenes.set('firma.registro.imagen', o.firma)
  const logo = await logoPng(copia, v.logo).catch(() => null)
  if (logo) imagenes.set('logo', logo)
  const hechos = filas.filter((x) => x.inspeccion_id).length
  return llenarExcelPeriodo(archivo, valoresGenerales(base, { ...periodo, etiqueta: periodo.etiqueta }, { hechos, total: filas.length }, o.registro), valoresFilas(equipos), imagenes.size ? imagenes : undefined)
}

/** Descarga el Excel o devuelve la vista para el PDF (que se imprime desde la pantalla). */
export async function entregarRegistro(bytes: Uint8Array, como: 'excel' | 'pdf', nombreArchivo: string) {
  if (como === 'excel') {
    guardarExcel(bytes, nombreArchivo)
    return null
  }
  return vistaDeExcel(await partes(bytes))
}
