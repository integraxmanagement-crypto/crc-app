// Prueba de la gestión de condiciones (05/11/2026): estado calculado, campos obligatorios, columnas por sede, quién puede qué, y propuestas del gestor
// que decide un administrador. Solo datos FICTICIOS, en crc-dev, empresa D (RUC 20000000052, dos sedes). Se puede repetir: al final limpia lo que creó.
// Uso: node pruebas/condiciones.mjs   (antes: node pruebas/separacion-sedes.mjs una vez, para que existan la empresa D y sus cuentas)
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG_FICTICIO, comprobar, ingresarComo, resultados, resumen } from './comun.mjs'
import { faltantes, estadoDe, textoDe, vacio } from '../src/condiciones/reglas.ts'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }
const SIN_PERMISO = (r) => r.error?.code === '42501' || /permission denied|No autorizado|violates row-level|new row violates/i.test(r.error?.message ?? '')
const HOY = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
const dia = (n) => new Date(Date.parse(`${HOY}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
const INICIO = new Date(Date.now() - 2000).toISOString()

// ───────────────────────────────────────────────
seccion('1. El estado se calcula con las fechas')
const hoy = '2026-11-10'
comprobar('Sin cierre y plazo por venir: pendiente', estadoDe({ fecha_programada: '2026-11-20', fecha_cierre: null }, hoy) === 'pendiente')
comprobar('El mismo día del plazo todavía es pendiente', estadoDe({ fecha_programada: '2026-11-10', fecha_cierre: null }, hoy) === 'pendiente')
comprobar('Sin cierre y plazo vencido: atrasado', estadoDe({ fecha_programada: '2026-11-09', fecha_cierre: null }, hoy) === 'atrasado')
comprobar('Cerrada el día del plazo: dentro de plazo', estadoDe({ fecha_programada: '2026-11-08', fecha_cierre: '2026-11-08' }, hoy) === 'dentro_plazo')
comprobar('Cerrada antes del plazo: dentro de plazo', estadoDe({ fecha_programada: '2026-11-08', fecha_cierre: '2026-11-05' }, hoy) === 'dentro_plazo')
comprobar('Cerrada después del plazo: fuera de plazo', estadoDe({ fecha_programada: '2026-11-08', fecha_cierre: '2026-11-09' }, hoy) === 'fuera_plazo')
comprobar('Sin plazo y sin cierre: pendiente', estadoDe({ fecha_programada: null, fecha_cierre: null }, hoy) === 'pendiente')
comprobar('Sin plazo y cerrada: dentro de plazo', estadoDe({ fecha_programada: null, fecha_cierre: '2026-11-09' }, hoy) === 'dentro_plazo')

seccion('2. Lo obligatorio')
const col = (clave, tipo, obligatoria = true, visible = true) => ({ clave, nombre: clave, tipo, opciones: [], obligatoria, visible, orden: 1, es_base: true, id: clave })
const cols = [col('area', 'texto'), col('descripcion', 'descripcion', false), col('estado', 'estado'), col('resp_inspeccion', 'responsable_auto'), col('oculta', 'texto', true, false), col('nota', 'texto', false)]
comprobar('Falta el área y la descripción', JSON.stringify(faltantes(cols, {})) === JSON.stringify(['area', 'Descripción: peligro observado y riesgo asociado']))
comprobar('La descripción pide peligro Y riesgo (aunque la columna no marque obligatoria)', faltantes(cols, { area: 'Taller', descripcion: { peligro: 'Cable pelado', riesgo: '' } }).length === 1)
comprobar('Con todo completo no falta nada', faltantes(cols, { area: 'Taller', descripcion: { peligro: 'Cable pelado', riesgo: 'Descarga eléctrica' } }).length === 0)
comprobar('Estado y responsable automáticos nunca se piden', !faltantes(cols, {}).some((x) => x === 'estado' || x === 'resp_inspeccion'))
comprobar('Una columna oculta no se pide aunque sea obligatoria', !faltantes(cols, {}).includes('oculta'))
comprobar('Vacío: texto en blanco, lista sin elegir, descripción a medias', vacio('  ', 'texto') && vacio([], 'multiple') && vacio({ peligro: 'abc', riesgo: '' }, 'descripcion') && !vacio('x', 'texto'))
comprobar('Texto de la descripción para la tabla', textoDe({ peligro: 'A', riesgo: 'B' }, 'descripcion') === 'Peligro: A · Riesgo: B')

// ───────────────────────────────────────────────
const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const empresa = (await dueno.from('empresas').select('id').eq('ruc', '20000000052').maybeSingle()).data?.id
if (!empresa) throw new Error('Falta la empresa D: corre antes node pruebas/separacion-sedes.mjs')
const sedeId = async (nombre) => (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', nombre).single()).data.id
const S1 = await sedeId('Sede 1 (ficticia)')
const S2 = await sedeId('Sede 2 (ficticia)')
const s = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C2', 'GESTOR_C12', 'USUARIO_C1', 'ADMIN_A']) {
  const r = await ingresarComo(n)
  if (r.error) throw new Error(`${n} no pudo ingresar: ${r.error.message}`)
  s[n] = r.c
}
const rpc = (n, f, a) => s[n].rpc(f, a)
const ok = (r) => !r.error
const col_ = async (n, sede, clave) => (await s[n].from('condiciones_columnas').select('*').eq('sede_id', sede).eq('clave', clave).maybeSingle()).data

seccion('3. Quién ve y quién carga')
comprobar('El administrador de la sede 1 prepara la matriz de su sede', ok(await rpc('ADMSEDE_C1', 'preparar_condiciones', { p_sede: S1 })))
comprobar('Hay 14 columnas base (y repetir no las duplica)', (await rpc('ADMSEDE_C1', 'preparar_condiciones', { p_sede: S1 }), (await s.ADMSEDE_C1.from('condiciones_columnas').select('id').eq('sede_id', S1).eq('es_base', true)).data?.length === 14))
comprobar('El usuario común no puede preparar ni ver la matriz', SIN_PERMISO(await rpc('USUARIO_C1', 'preparar_condiciones', { p_sede: S1 })) && (await s.USUARIO_C1.from('condiciones_columnas').select('id').eq('sede_id', S1)).data?.length === 0)
comprobar('El administrador de otra empresa no la ve ni la prepara', SIN_PERMISO(await rpc('ADMIN_A', 'preparar_condiciones', { p_sede: S1 })) && (await s.ADMIN_A.from('condiciones_columnas').select('id').eq('sede_id', S1)).data?.length === 0)
comprobar('El administrador de la sede 2 no toca la sede 1', SIN_PERMISO(await rpc('ADMSEDE_C2', 'preparar_condiciones', { p_sede: S1 })))
comprobar('El gestor de la sede 2 no toca la sede 1', SIN_PERMISO(await rpc('GESTOR_C2', 'preparar_condiciones', { p_sede: S1 })))
comprobar('El administrador general sí ve las dos sedes', ok(await rpc('ADMIN_C', 'preparar_condiciones', { p_sede: S1 })) && ok(await rpc('ADMIN_C', 'preparar_condiciones', { p_sede: S2 })))
comprobar('Nadie escribe directo en la tabla', SIN_PERMISO(await s.ADMSEDE_C1.from('condiciones').insert({ id: randomUUID(), empresa_id: empresa, sede_id: S1, fecha_hallazgo: HOY, creado_por: randomUUID(), creado_por_nombre: 'x' }))
  && SIN_PERMISO(await s.ADMSEDE_C1.from('condiciones_columnas').update({ obligatoria: false }).eq('sede_id', S1)))
comprobar('Los obligatorios de fábrica: todo menos cierre, estado y responsable de la inspección',
  (await s.ADMSEDE_C1.from('condiciones_columnas').select('clave, obligatoria').eq('sede_id', S1).eq('es_base', true)).data
    .every((c) => c.obligatoria === !['fecha_cierre', 'estado', 'resp_inspeccion'].includes(c.clave)))

seccion('4. Cargar una condición')
const personas = (await rpc('ADMSEDE_C1', 'personas_de_sede', { p_sede: S1 })).data ?? []
comprobar('La lista de responsables trae gente de la sede', personas.length >= 2, String(personas.length))
comprobar('El usuario común no pide esa lista', SIN_PERMISO(await rpc('USUARIO_C1', 'personas_de_sede', { p_sede: S1 })))
const foto = async (n, id, ext = 'png') => {
  const ruta = `${empresa}/${id}-abcd1234.${ext}`
  const r = await s[n].storage.from('condiciones').upload(ruta, PNG_FICTICIO, { contentType: 'image/png' })
  return { ruta, error: r.error }
}
const id1 = randomUUID()
const f1 = await foto('ADMSEDE_C1', id1)
comprobar('El administrador sube la foto de evidencia al almacén', !f1.error, f1.error?.message)
comprobar('El usuario común no puede subir fotos', !!(await foto('USUARIO_C1', randomUUID())).error)
comprobar('No se acepta una ruta de otra forma', !!(await s.ADMSEDE_C1.storage.from('condiciones').upload(`${empresa}/cualquier-cosa.png`, PNG_FICTICIO, { contentType: 'image/png' })).error)
const valido = (extra = {}) => ({
  area: 'Taller mecánico', ubicacion: 'Pasillo 3, junto al tablero', fecha_hallazgo: dia(-2), clasificacion: 'Tipo A',
  descripcion: { peligro: 'Cable eléctrico pelado', riesgo: 'Descarga eléctrica' }, evidencia: f1.ruta, plan_accion: 'Reemplazar el cable',
  fecha_programada: dia(10), resp_levantamiento: personas[0]?.id, origen: 'Inspección de seguridad', motivo: 'Condición subestándar', ...extra,
})
const g1 = await rpc('ADMSEDE_C1', 'guardar_condicion', { p_id: id1, p_sede: S1, p_datos: valido() })
comprobar('Una condición completa se guarda', ok(g1), g1.error?.message)
const fila1 = (await s.ADMSEDE_C1.from('condiciones').select('*').eq('id', id1).maybeSingle()).data
comprobar('Queda a nombre de quien la cargó y con la fecha elegida', fila1?.creado_por_nombre?.includes('ADMIN SEDE 1') && fila1?.fecha_hallazgo === dia(-2), fila1?.creado_por_nombre)
comprobar('El responsable del levantamiento guarda su nombre', typeof fila1?.datos?.resp_levantamiento_nombre === 'string' && fila1.datos.resp_levantamiento_nombre.length > 2)
comprobar('El gestor de la sede 2 no la ve', (await s.GESTOR_C2.from('condiciones').select('id').eq('id', id1)).data?.length === 0)
comprobar('El administrador general sí la ve', (await s.ADMIN_C.from('condiciones').select('id').eq('id', id1)).data?.length === 1)
comprobar('Otra empresa no la ve', (await s.ADMIN_A.from('condiciones').select('id').eq('id', id1)).data?.length === 0)
comprobar('Quien tiene acceso abre la foto', ok(await s.ADMIN_C.storage.from('condiciones').createSignedUrl(f1.ruta, 60)))
comprobar('Otra empresa no abre la foto', !!(await s.ADMIN_A.storage.from('condiciones').createSignedUrl(f1.ruta, 60)).error || (await s.ADMIN_A.storage.from('condiciones').download(f1.ruta)).error != null)

const falla = async (n, sede, datos, texto, nombre) => {
  const r = await rpc(n, 'guardar_condicion', { p_id: randomUUID(), p_sede: sede, p_datos: datos })
  comprobar(nombre, !!r.error && new RegExp(texto, 'i').test(r.error.message), r.error?.message)
}
await falla('ADMSEDE_C1', S1, valido({ area: '' }), 'Falta completar: Área', 'Sin área no se guarda')
await falla('ADMSEDE_C1', S1, valido({ descripcion: { peligro: 'Cable pelado', riesgo: '' } }), 'peligro observado y el riesgo asociado', 'La descripción sin riesgo no se guarda')
await falla('ADMSEDE_C1', S1, valido({ descripcion: { peligro: '', riesgo: 'Descarga' } }), 'peligro observado y el riesgo asociado', 'La descripción sin peligro no se guarda')
await falla('ADMSEDE_C1', S1, valido({ evidencia: undefined }), 'Falta completar: Evidencia', 'Sin foto no se guarda (es obligatoria)')
await falla('ADMSEDE_C1', S1, valido({ fecha_programada: dia(-5) }), 'anterior a la fecha de hallazgo', 'El plazo no puede ser anterior al hallazgo')
await falla('ADMSEDE_C1', S1, valido({ fecha_hallazgo: dia(3) }), 'no puede ser futura', 'El hallazgo no puede ser futuro')
await falla('ADMSEDE_C1', S1, valido({ fecha_cierre: dia(1) }), 'no puede ser futura', 'El cierre no puede ser futuro')
await falla('ADMSEDE_C1', S1, valido({ fecha_cierre: dia(-4) }), 'anterior a la fecha de hallazgo', 'El cierre no puede ser anterior al hallazgo')
await falla('ADMSEDE_C1', S1, valido({ fecha_hallazgo: '2026-02-31' }), 'Fecha no válida', 'Una fecha que no existe no se guarda')
await falla('ADMSEDE_C1', S1, valido({ clasificacion: 'Tipo C' }), 'opción válida', 'La clasificación solo acepta las opciones de la lista')
await falla('ADMSEDE_C1', S1, valido({ evidencia: `${randomUUID()}/${randomUUID()}-abcd1234.png` }), 'no es válida', 'No se acepta una foto de otra empresa')
await falla('ADMSEDE_C1', S1, valido({ resp_levantamiento: randomUUID() }), 'persona de la lista', 'El responsable debe ser de la sede')
await falla('USUARIO_C1', S1, valido(), 'No autorizado', 'El usuario común no puede cargar')
await falla('GESTOR_C2', S1, valido(), 'No autorizado', 'El gestor de otra sede no puede cargar en esta')
const cerrada = await rpc('GESTOR_C12', 'guardar_condicion', { p_id: id1, p_sede: S1, p_datos: valido({ fecha_cierre: dia(-1) }) })
comprobar('El gestor de esa sede puede editar y cerrar la condición', ok(cerrada), cerrada.error?.message)
const fila1b = (await s.ADMSEDE_C1.from('condiciones').select('*').eq('id', id1).maybeSingle()).data
comprobar('Queda anotado quién la cambió y que sigue a nombre de quien la creó', fila1b?.actualizado_por != null && fila1b?.creado_por === fila1?.creado_por)
comprobar('Con cierre antes del plazo queda dentro de plazo', estadoDe(fila1b, HOY) === 'dentro_plazo')
comprobar('El gestor de otra sede no edita esa condición', SIN_PERMISO(await rpc('GESTOR_C2', 'guardar_condicion', { p_id: id1, p_sede: S1, p_datos: valido() })))
comprobar('Editar por otra sede (mismo id, sede distinta) no mueve la condición', !ok(await rpc('ADMIN_C', 'guardar_condicion', { p_id: id1, p_sede: S2, p_datos: valido() })))

seccion('5. El administrador configura las columnas')
const cambio = (n, c) => rpc(n, 'cambiar_columnas_condiciones', { p_sede: S1, p_cambio: c })
comprobar('Ocultar una columna', ok(await cambio('ADMSEDE_C1', { operacion: 'ocultar', clave: 'motivo' })) && (await col_('ADMSEDE_C1', S1, 'motivo')).visible === false)
const g2 = await rpc('ADMSEDE_C1', 'guardar_condicion', { p_id: randomUUID(), p_sede: S1, p_datos: valido({ motivo: undefined }) })
comprobar('Con la columna oculta ya no se pide', ok(g2), g2.error?.message)
comprobar('Mostrarla otra vez', ok(await cambio('ADMSEDE_C1', { operacion: 'mostrar', clave: 'motivo' })))
await falla('ADMSEDE_C1', S1, valido({ motivo: undefined }), 'Falta completar: Motivo', 'Visible otra vez, vuelve a ser obligatoria')
comprobar('Agregar una columna de varias opciones obligatoria', ok(await cambio('ADMSEDE_C1', { operacion: 'agregar', nombre: 'Equipos afectados', tipo: 'multiple', opciones: ['Grúa', 'Montacargas', 'Andamio'], obligatoria: true })))
const nueva = (await s.ADMSEDE_C1.from('condiciones_columnas').select('*').eq('sede_id', S1).eq('nombre', 'Equipos afectados').maybeSingle()).data
comprobar('Queda al final, no es base y guarda sus opciones', nueva && !nueva.es_base && nueva.opciones.length === 3 && nueva.orden === 15, String(nueva?.orden))
await falla('ADMSEDE_C1', S1, valido(), `Falta completar: Equipos afectados`, 'La columna nueva obligatoria se pide')
await falla('ADMSEDE_C1', S1, valido({ [nueva.clave]: ['Grúa', 'Cohete'] }), 'opciones válidas', 'Solo acepta las opciones de la lista')
const id3 = randomUUID()
comprobar('Con opciones válidas se guarda', ok(await rpc('ADMSEDE_C1', 'guardar_condicion', { p_id: id3, p_sede: S1, p_datos: valido({ [nueva.clave]: ['Grúa', 'Andamio'] }) })))
comprobar('Dos columnas no pueden llamarse igual', !ok(await cambio('ADMSEDE_C1', { operacion: 'agregar', nombre: 'equipos AFECTADOS', tipo: 'texto' })))
comprobar('Una lista pide al menos una opción', !ok(await cambio('ADMSEDE_C1', { operacion: 'agregar', nombre: 'Lista vacía', tipo: 'lista', opciones: [] })))
comprobar('Las opciones no se repiten', !ok(await cambio('ADMSEDE_C1', { operacion: 'agregar', nombre: 'Repetidas', tipo: 'lista', opciones: ['a', 'A'] })))
comprobar('Convertir el área en lista desplegable', ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'area', tipo: 'lista', opciones: ['Taller mecánico', 'Almacén'] })))
await falla('ADMSEDE_C1', S1, valido({ area: 'Cocina' }), 'opción válida', 'Con el área en lista, solo acepta sus opciones')
comprobar('Devolver el área a texto libre', ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'area', tipo: 'texto' })))
comprobar('La fecha de hallazgo no cambia de tipo', !ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'fecha_hallazgo', tipo: 'texto' })))
comprobar('Una columna base no se elimina', !ok(await cambio('ADMSEDE_C1', { operacion: 'eliminar', clave: 'area' })))
comprobar('El estado nunca es obligatorio', ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'estado', obligatoria: true })) && (await col_('ADMSEDE_C1', S1, 'estado')).obligatoria === false)
comprobar('Cambiar el nombre y volver a ponerlo', ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'origen', nombre: 'Origen del hallazgo' })) && ok(await cambio('ADMSEDE_C1', { operacion: 'modificar', clave: 'origen', nombre: 'Origen' })))
comprobar('Eliminar la columna agregada borra sus datos', ok(await cambio('ADMSEDE_C1', { operacion: 'eliminar', clave: nueva.clave }))
  && !(await s.ADMSEDE_C1.from('condiciones').select('datos').eq('id', id3).single()).data.datos[nueva.clave])
comprobar('Las columnas son de cada sede: la sede 2 no cambió', (await col_('ADMSEDE_C2', S2, 'motivo'))?.visible === true && !(await s.ADMSEDE_C2.from('condiciones_columnas').select('id').eq('sede_id', S2).eq('nombre', 'Equipos afectados')).data?.length)
comprobar('El administrador de la sede 2 no cambia las columnas de la sede 1', SIN_PERMISO(await cambio('ADMSEDE_C2', { operacion: 'ocultar', clave: 'area' })))
comprobar('El gestor no cambia columnas directo', SIN_PERMISO(await cambio('GESTOR_C12', { operacion: 'ocultar', clave: 'area' })))
comprobar('El usuario común tampoco', SIN_PERMISO(await cambio('USUARIO_C1', { operacion: 'ocultar', clave: 'area' })))

seccion('6. El gestor propone y el administrador decide')
const propuesta = (n, sede, c, motivo = 'Necesitamos registrar los equipos') => rpc(n, 'solicitar_cambio', { p_tipo: 'cambio_columnas_condiciones', p_objetivo: sede, p_datos: c, p_motivo: motivo })
const p1 = await propuesta('GESTOR_C12', S1, { operacion: 'agregar', nombre: 'Turno', tipo: 'lista', opciones: ['Día', 'Noche'] })
comprobar('El gestor envía su propuesta', ok(p1) && typeof p1.data === 'string', p1.error?.message)
comprobar('La matriz no cambia mientras nadie decide', !(await s.ADMSEDE_C1.from('condiciones_columnas').select('id').eq('sede_id', S1).eq('nombre', 'Turno')).data?.length)
const sol1 = (await s.ADMSEDE_C1.from('solicitudes_cambio').select('*').eq('id', p1.data).single()).data
comprobar('La solicitud es de la sede, pendiente y con título legible', sol1?.sede_id === S1 && sol1.estado === 'pendiente' && /Agregar la columna «Turno»/.test(sol1.titulo), sol1?.titulo)
comprobar('Una propuesta mal hecha se rechaza al pedirla', !ok(await propuesta('GESTOR_C12', S1, { operacion: 'agregar', nombre: 'X', tipo: 'volar' })))
comprobar('El gestor de otra sede no propone para esta', !ok(await propuesta('GESTOR_C2', S1, { operacion: 'ocultar', clave: 'area' })))
comprobar('El usuario común no propone', !ok(await propuesta('USUARIO_C1', S1, { operacion: 'ocultar', clave: 'area' })))
comprobar('El gestor no se aprueba a sí mismo', !ok(await rpc('GESTOR_C12', 'resolver_solicitud', { p_id: p1.data, p_aprobar: true, p_comentario: null })))
comprobar('El administrador de la otra sede no decide esta propuesta', !ok(await rpc('ADMSEDE_C2', 'resolver_solicitud', { p_id: p1.data, p_aprobar: true, p_comentario: null })))
comprobar('El administrador de la sede la aprueba', ok(await rpc('ADMSEDE_C1', 'resolver_solicitud', { p_id: p1.data, p_aprobar: true, p_comentario: null })))
const turno = await col_('ADMSEDE_C1', S1, (await s.ADMSEDE_C1.from('condiciones_columnas').select('clave').eq('sede_id', S1).eq('nombre', 'Turno').maybeSingle()).data?.clave ?? 'x')
comprobar('Al aprobar se ejecuta: la columna aparece con sus opciones', turno?.tipo === 'lista' && turno.opciones.length === 2)
comprobar('Una solicitud resuelta no se decide otra vez', !ok(await rpc('ADMIN_C', 'resolver_solicitud', { p_id: p1.data, p_aprobar: false, p_comentario: 'ya no' })))
const p2 = await propuesta('GESTOR_C12', S1, { operacion: 'ocultar', clave: 'ubicacion' })
comprobar('Otra propuesta: ocultar la ubicación', ok(p2))
comprobar('Denegar pide un motivo', !ok(await rpc('ADMIN_C', 'resolver_solicitud', { p_id: p2.data, p_aprobar: false, p_comentario: '' })))
comprobar('El administrador general la deniega', ok(await rpc('ADMIN_C', 'resolver_solicitud', { p_id: p2.data, p_aprobar: false, p_comentario: 'La ubicación se necesita' })))
comprobar('Al denegar la matriz queda sin el cambio', (await col_('ADMSEDE_C1', S1, 'ubicacion')).visible === true)
const p3 = await propuesta('GESTOR_C12', S1, { operacion: 'eliminar', clave: 'area' })
comprobar('Una propuesta que no se podría cumplir se rechaza al pedirla (base no se elimina)', !ok(p3))
const p4 = await propuesta('GESTOR_C12', S1, { operacion: 'eliminar', clave: (await s.ADMSEDE_C1.from('condiciones_columnas').select('clave').eq('sede_id', S1).eq('nombre', 'Turno').single()).data.clave })
comprobar('Proponer eliminar la columna agregada', ok(p4))
comprobar('Al aprobar se elimina', ok(await rpc('ADMSEDE_C1', 'resolver_solicitud', { p_id: p4.data, p_aprobar: true, p_comentario: null })) && !(await s.ADMSEDE_C1.from('condiciones_columnas').select('id').eq('sede_id', S1).eq('nombre', 'Turno')).data?.length)

seccion('7. Limpieza')
const nuevas = (await dueno.from('condiciones').select('id').eq('empresa_id', empresa).gte('creado_en', INICIO)).data?.length ?? 0
comprobar('La prueba dejó condiciones nuevas (hay algo que limpiar)', nuevas >= 2, String(nuevas))
const limpio = await dueno.rpc('limpiar_pruebas_condiciones', { p_empresa: empresa, p_desde: INICIO })
comprobar('El dueño limpia solo lo de esta corrida', ok(limpio) && limpio.data.condiciones === nuevas, JSON.stringify(limpio.data ?? limpio.error?.message))
comprobar('Lo anterior no se puede borrar con una fecha vieja', !ok(await dueno.rpc('limpiar_pruebas_condiciones', { p_empresa: empresa, p_desde: '2020-01-01T00:00:00Z' })))
comprobar('Nadie más limpia', SIN_PERMISO(await s.ADMIN_C.rpc('limpiar_pruebas_condiciones', { p_empresa: empresa, p_desde: INICIO })))
comprobar('No se limpia una empresa que no es la ficticia D', !ok(await dueno.rpc('limpiar_pruebas_condiciones', { p_empresa: randomUUID(), p_desde: INICIO })))
comprobar('Las columnas base siguen todas en su lugar', (await s.ADMSEDE_C1.from('condiciones_columnas').select('id').eq('sede_id', S1).eq('es_base', true)).data?.length === 14)

const bien = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba de la gestión de condiciones', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · crc-dev · empresa ficticia D.`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/condiciones.md', lineas.join('\n'))
process.exit(bien ? 0 : 1)
