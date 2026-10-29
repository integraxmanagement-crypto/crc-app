// Ayudas de las pantallas de inspección (tarea 3.4-C).
import { useEffect, useState } from 'react'
import type { Receta } from '../formatos/receta'
import type { Firmante } from './campo'
import { type Uso, misFirmasPendientes, usoAlmacenamiento } from './datos'

export function hoyLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const documentoExternoValido = (d: string | null | undefined) => /^[A-Za-z0-9-]{4,20}$/.test((d ?? '').trim())

/** Revisa en el equipo lo mismo que revisa el servidor sobre los firmantes (para no cerrar algo que será rechazado). */
export function faltanFirmantes(receta: Receta, firmantes: Firmante[]): string[] {
  const faltan: string[] = []
  for (const rol of receta.firmas) {
    const deRol = firmantes.filter((f) => f.rol_clave === rol.clave)
    for (const f of deRol) {
      if (!f.persona_id && !(f.externo_nombre ?? '').trim()) faltan.push(`«${rol.titulo}»: elige a la persona o escribe el nombre del externo.`)
      else if (!f.persona_id && (f.externo_nombre ?? '').trim().length < 3) faltan.push(`«${rol.titulo}»: el nombre del externo es muy corto.`)
      // Del externo se guardan nombre y documento (decisión del dueño, 27/10/2026), aunque firme en papel.
      if (!f.persona_id && f.externo_nombre != null && !documentoExternoValido(f.externo_documento)) faltan.push(`«${rol.titulo}»: escribe el documento del externo (4 a 20 letras o números).`)
    }
    const completos = deRol.filter((f) => f.persona_id || ((f.externo_nombre ?? '').trim().length >= 3 && documentoExternoValido(f.externo_documento))).length
    if (rol.obligatoria && completos < rol.minimo) faltan.push(`«${rol.titulo}»: faltan firmantes (mínimo ${rol.minimo}).`)
  }
  return faltan
}

/** Espacio de fotos de la empresa (D-37). Lleno = no se toman fotos nuevas. */
/** `enviadas` hace que se vuelva a leer cuando llegan inspecciones nuevas (sus fotos ocupan espacio). */
export function useUso(empresaId: string, online: boolean, enviadas = 0) {
  const [uso, setUso] = useState<Uso | null>(null)
  useEffect(() => {
    if (online) void usoAlmacenamiento(empresaId).then(setUso, () => {})
  }, [empresaId, online, enviadas])
  return uso
}
export const espacioLleno = (uso: Uso | null) => Boolean(uso?.tope && uso.usado >= uso.tope)

/** ¿Cuántas firmas esperan a esta persona? (para mostrar «Mis firmas» en el menú solo cuando hay). */
export function useFirmasPendientes(cuenta: string | null, online: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!cuenta || !online) return
    let vivo = true
    const leer = () => misFirmasPendientes(cuenta).then((f) => vivo && setN(f.filter((x) => x.inspecciones?.estado === 'cerrada').length), () => {})
    void leer()
    const cada = setInterval(leer, 120_000)
    return () => {
      vivo = false
      clearInterval(cada)
    }
  }, [cuenta, online])
  return n
}

/** Unidades en orden de árbol (gerencia → sus áreas → sus subáreas), con la profundidad para sangrar la lista. */
export function ordenarUnidades<T extends { id: string; padre_id: string | null; nombre: string }>(unidades: T[]): (T & { profundidad: number })[] {
  const ids = new Set(unidades.map((u) => u.id))
  const hijos = (padre: string | null) =>
    unidades.filter((u) => (padre === null ? !u.padre_id || !ids.has(u.padre_id) : u.padre_id === padre)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const salida: (T & { profundidad: number })[] = []
  const recorrer = (padre: string | null, profundidad: number) => {
    for (const u of hijos(padre)) {
      salida.push({ ...u, profundidad })
      if (profundidad < 5) recorrer(u.id, profundidad + 1)
    }
  }
  recorrer(null, 0)
  return salida
}
