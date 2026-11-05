import type { OpcionCombo } from './comboAyuda'
import { conLimite, db } from './empresas/datos'
import { type Unidad, caminoUnidad } from './usuarios/datos'

/** Estructura de la empresa (gerencias, áreas y líneas), tal como se arma en «Estructura y puestos». */
export async function leerUnidades(empresaId: string): Promise<Unidad[]> {
  const { data, error } = await conLimite(db().from('unidades').select('id, nombre, vigente, nivel, padre_id').eq('empresa_id', empresaId).order('nombre'))
  if (error) throw new Error(error.message)
  return (data ?? []) as Unidad[]
}

/** Las áreas y líneas vigentes, con el camino que las contiene como detalle. */
export function opcionesArea(unidades: Unidad[]): OpcionCombo[] {
  return unidades
    .filter((u) => u.nivel !== 'gerencia' && caminoUnidad(unidades, u.id).vigente)
    .map((u) => {
      const ruta = caminoUnidad(unidades, u.id).ruta
      return { id: u.id, texto: u.nombre, detalle: ruta.includes(' › ') ? ruta.slice(0, ruta.length - u.nombre.length - 3) : undefined }
    })
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'))
}

