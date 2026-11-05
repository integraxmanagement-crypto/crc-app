import { db, mensaje, rpc } from '../empresas/datos'

/**
 * Un puesto del organigrama del equipo de SST (puesto y nombre, nada más: no dice qué rol tiene la cuenta). `nombre` vacío = puesto por cubrir.
 * `sede_id` vacío = puesto «de toda la empresa» (lo maneja el administrador general).
 */
export type Nodo = { id: string; padre_id: string | null; sede_id: string | null; puesto: string; nombre: string | null; sedes: { nombre: string } | null }

/** ¿El dueño de la plataforma habilitó esta sección para mi empresa? */
export const equipoSstHabilitado = () => rpc<boolean>('equipo_sst_habilitado', {})
/** Solo el dueño de la plataforma. */
export const fijarEquipoSst = (empresa: string, habilitado: boolean) => rpc<void>('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: habilitado })
/** Lo que el dueño ve en la ficha de una empresa; sin fila quiere decir habilitado. */
export async function leerEquipoSstEmpresa(empresa: string): Promise<boolean> {
  const { data, error } = await db().from('equipo_sst_config').select('habilitado').eq('empresa_id', empresa).maybeSingle()
  if (error) throw new Error(mensaje(error))
  return data ? (data.habilitado as boolean) : true
}

export async function listarNodos(): Promise<Nodo[]> {
  const { data, error } = await db().from('equipo_sst_nodos').select('id, padre_id, sede_id, puesto, nombre, sedes(nombre)').order('creado_en')
  if (error) throw new Error(mensaje(error))
  return (data ?? []) as unknown as Nodo[]
}
export const agregarNodo = (padre: string | null, sede: string | null, puesto: string, nombre: string) =>
  rpc<string>('agregar_nodo_equipo', { p_padre: padre, p_sede: sede, p_puesto: puesto, p_nombre: nombre })
export const editarNodo = (nodo: string, puesto: string, nombre: string) => rpc<void>('editar_nodo_equipo', { p_nodo: nodo, p_puesto: puesto, p_nombre: nombre })
export const quitarNodo = (nodo: string) => rpc<void>('quitar_nodo_equipo', { p_nodo: nodo })
/** Solo el administrador general y solo si el organigrama está vacío: arma los puestos con las personas del equipo de SST que ya hay. */
export const armarEquipoActual = () => rpc<number>('armar_equipo_sst_actual', {})

/** El WhatsApp de los puestos (solo si el gestor lo publicó). Quien edita el puesto recibe además la cuenta vinculada. */
export type Contacto = { nodo_id: string; whatsapp: string | null; vinculo_id: string | null }
export const listarContactos = () => rpc<Contacto[]>('contactos_equipo_sst', {})
export const vincularNodo = (nodo: string, vinculo: string | null) => rpc<void>('vincular_nodo_equipo', { p_nodo: nodo, p_vinculo: vinculo })
export const gestoresParaVincular = (sede: string | null) => rpc<{ vinculo_id: string; nombre: string }[]>('gestores_para_vincular', { p_sede: sede })

/** El gestor publica su número (vacío = lo borra y deja de verse). Solo el propio. */
export const guardarMiWhatsapp = (numero: string) => rpc<void>('guardar_mi_whatsapp', { p_numero: numero })
/** Mi propio número (la tabla solo deja leer el propio). */
export async function leerMiWhatsapp(): Promise<string> {
  const { data, error } = await db().from('contacto_sst').select('whatsapp').maybeSingle()
  if (error) throw new Error(mensaje(error))
  return (data?.whatsapp as string | undefined) ?? ''
}

/** Solo el dueño de la plataforma: caducidad de la contraseña de los administradores (90 días) por empresa. Sin fila = encendida. */
export const fijarCaducidadAdmin = (empresa: string, activo: boolean) => rpc<void>('fijar_caducidad_admin', { p_empresa: empresa, p_activo: activo })
export async function leerCaducidadAdmin(empresa: string): Promise<boolean> {
  const { data, error } = await db().from('contrasenas_politica').select('caduca_admin').eq('empresa_id', empresa).maybeSingle()
  if (error) throw new Error(mensaje(error))
  return data ? (data.caduca_admin as boolean) : true
}
