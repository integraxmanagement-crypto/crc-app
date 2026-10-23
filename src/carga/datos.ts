// Comunicación con la función del servidor «carga-personal» (tarea 3.6).
// Se envían solo los datos de las filas: el archivo Excel nunca sale del equipo.
import { invocar } from '../empresas/datos'
import type { Registro } from './lectura.ts'

export type Estado = 'nueva' | 'alta_cuenta_existente' | 'sin_cambios' | 'actualizar' | 'reactivar' | 'administrador' | 'falta_lista' | 'error'

export type Revisada = {
  fila: number
  tipo: string
  numero: string
  nombres: string
  estado: Estado
  motivos: string[]
  cambios: string[]
  faltan: string[]
}

export type Faltante = ({ tipo: 'puesto'; nombre: string } | { tipo: 'unidad'; nivel: 'gerencia' | 'area' | 'subarea'; camino: string[] }) & {
  filas: number[]
  necesario: boolean
}

export type NoAparece = { vinculo_id: string; apellidos_nombres: string; tipo_documento: string; numero_documento: string; rol: string }

export type Revision = { filas: Revisada[]; faltantes: Faltante[]; noAparecen: NoAparece[] }

export const revisarCarga = (empresaId: string, filas: Registro[]) =>
  invocar<Revision>('carga-personal', { modo: 'revisar', empresa_id: empresaId, filas })

export const ESTADOS: Record<Estado, { texto: string; clase: string }> = {
  nueva: { texto: 'Nueva', clase: 'chip-ok' },
  alta_cuenta_existente: { texto: 'Ya tenía cuenta en CRC', clase: 'chip-ok' },
  actualizar: { texto: 'Ya existe · con cambios', clase: 'chip-aviso' },
  sin_cambios: { texto: 'Ya existe · sin cambios', clase: 'chip-gris' },
  reactivar: { texto: 'Estaba cesada', clase: 'chip-aviso' },
  administrador: { texto: 'Administrador · no se toca', clase: 'chip-gris' },
  falta_lista: { texto: 'Falta crear en las listas', clase: 'chip-aviso' },
  error: { texto: 'Error', clase: 'chip-mal' },
}

export const textoFaltante = (f: Faltante) =>
  f.tipo === 'puesto'
    ? `Puesto «${f.nombre}»`
    : `${f.nivel === 'gerencia' ? 'Gerencia' : f.nivel === 'area' ? 'Área' : 'Subárea'} «${f.camino.join(' › ')}»`
