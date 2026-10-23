// Carga de personal desde Excel (tarea 3.6). La app lee el Excel en el equipo y envía solo los datos de las filas;
// el archivo nunca llega aquí ni se guarda.
//  · modo «revisar»: vista previa, no graba nada (paso 4).
//  · modo «grabar»: vuelve a revisar todo y graba todo o nada (paso 5).
// Quién puede: el administrador de la empresa (solo la suya) y el dueño de la plataforma (cualquier empresa).
// Lo decide la base de datos (puedo_crear_cuenta), no este archivo.
import { MENSAJE_MANTENIMIENTO, candadoListo } from '../_compartido/candado.ts'
import { clienteAdmin, clienteComo, leerJson, quienLlama, responder } from '../_compartido/http.ts'
import { FILAS_MAXIMAS, type Fila, revisar } from './revision.ts'

const MAXIMO_CUERPO = 400_000 // 300 filas caben con holgura

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(req, 204, null)
  if (req.method !== 'POST') return responder(req, 405, { error: 'Método no permitido' })
  if (!candadoListo) return responder(req, 503, { error: MENSAJE_MANTENIMIENTO })

  const llamada = await quienLlama(req)
  if (!llamada) return responder(req, 401, { error: 'Inicia sesión para continuar' })

  const d = await leerJson(req, MAXIMO_CUERPO)
  if (!d) return responder(req, 400, { error: 'Datos no válidos o demasiado grandes' })
  const empresaId = typeof d.empresa_id === 'string' ? d.empresa_id : ''
  const filas = Array.isArray(d.filas) ? (d.filas as Fila[]) : null
  if (!empresaId || !filas) return responder(req, 400, { error: 'Faltan la empresa o las filas' })
  if (!filas.length) return responder(req, 400, { error: 'El Excel no tiene personas' })
  if (filas.length > FILAS_MAXIMAS) return responder(req, 400, { error: `Máximo ${FILAS_MAXIMAS} personas por archivo` })

  // ¿Puede quien llama cargar personal en esta empresa? (administrador de esa empresa o dueño de la plataforma)
  const permiso = await clienteComo(llamada.token).rpc('puedo_crear_cuenta', { p_empresa: empresaId, p_rol: 'usuario' })
  if (permiso.error || permiso.data !== true) return responder(req, 403, { error: 'No autorizado' })

  const admin = clienteAdmin()
  const resultado = await revisar(admin, empresaId, filas)

  if (d.modo === 'revisar') return responder(req, 200, resultado)
  return responder(req, 400, { error: 'Modo no válido' })
})
