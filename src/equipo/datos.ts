import { db, mensaje, rpc } from '../empresas/datos'

/** Un gestor del equipo de SST tal como lo ve quien consulta (solo lo que la base de datos permite mostrar). */
export type MiembroEquipo = { vinculo_id: string; nombre: string; puesto: string | null; whatsapp: string | null; sedes: string[] }

export const listarEquipoSst = () => rpc<MiembroEquipo[]>('equipo_sst', {})
export const guardarMiWhatsapp = (numero: string) => rpc<void>('guardar_mi_whatsapp', { p_numero: numero })
/** Mi propio número (la tabla solo deja leer el propio). */
export async function leerMiWhatsapp(): Promise<string> {
  const { data, error } = await db().from('contacto_sst').select('whatsapp').maybeSingle()
  if (error) throw new Error(mensaje(error))
  return (data?.whatsapp as string | undefined) ?? ''
}
