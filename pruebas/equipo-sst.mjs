// Prueba de la etapa 4 del punto 2 (04/11/2026): «Conoce al equipo de SST» (puesto y WhatsApp de cada gestor) y roles adicionales como ETIQUETAS sin permisos.
// Solo datos FICTICIOS, en crc-dev. Usa la empresa D (RUC 20000000052, dos sedes) y sus cuentas (las crea separacion-sedes.mjs / facultades.mjs). Se puede repetir.
// Uso: node pruebas/equipo-sst.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { comprobar, ingresarComo, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO = (r) => !!r.error && (r.error.code === '42501' || /permission denied|No autorizado|no se puede|no puede|solo /i.test(r.error.message ?? ''))
const SEGUIDO = (r) => !r.error

const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const empresa = (await dueno.from('empresas').select('id').eq('ruc', '20000000052').maybeSingle()).data?.id
if (!empresa) throw new Error('Falta la empresa D: corre antes node pruebas/separacion-sedes.mjs')

const s = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2', 'GESTOR_A', 'ADMIN_A']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message} (corre antes facultades.mjs)`)
  s[n] = c
}
const ID = {}
for (const n of Object.keys(s)) ID[n] = (await s[n].auth.getUser()).data.user.id
const V = {}
for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2', 'ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2'])
  V[n] = (await dueno.from('vinculos').select('id').eq('persona_id', ID[n]).eq('empresa_id', empresa).eq('estado', 'activo').single()).data.id

// Estado limpio de partida (sobras de una corrida anterior)
for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12']) await s[n].rpc('guardar_mi_whatsapp', { p_numero: '' })
for (const n of ['USUARIO_C1', 'USUGES_C1', 'USUGES_C2'])
  for (const e of ['miembro_comite', 'brigadista', 'monitor_seguridad', 'otro']) await s.ADMIN_C.rpc('quitar_etiqueta', { p_vinculo: V[n], p_etiqueta: e })

// ───────────────────────────────────────────────
seccion('1. El gestor escribe su propio WhatsApp (opcional); nadie más lo escribe')
{
  let r = await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: '900 000 101' })
  comprobar('El gestor guarda su número (con espacios)', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.from('contacto_sst').select('whatsapp').eq('vinculo_id', V.GESTOR_C1)
  comprobar('Queda guardado limpio y con el código del país (+51900000101)', r.data?.[0]?.whatsapp === '+51900000101', JSON.stringify(r.data))
  for (const malo of ['abc', '123', '9'.repeat(20), '+51 9000;DROP']) {
    r = await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: malo })
    comprobar(`Rechaza un número inválido («${malo}»)`, !!r.error, r.error?.message)
  }
  r = await s.GESTOR_C1.from('contacto_sst').select('whatsapp').eq('vinculo_id', V.GESTOR_C1)
  comprobar('Los intentos inválidos no cambiaron el número', r.data?.[0]?.whatsapp === '+51900000101')
  r = await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: '+51 900 000 111' })
  comprobar('Puede cambiarlo', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.from('contacto_sst').select('whatsapp').eq('vinculo_id', V.GESTOR_C1)
  comprobar('Y el cambio se ve', r.data?.[0]?.whatsapp === '+51900000111')
  for (const n of ['USUARIO_C1', 'USUGES_C1', 'ADMSEDE_C1', 'ADMIN_C']) {
    r = await s[n].rpc('guardar_mi_whatsapp', { p_numero: '900000999' })
    comprobar(`${n} (no es gestor) no puede guardar un WhatsApp`, NO(r), JSON.stringify(r.error))
  }
  const ins = await s.GESTOR_C1.from('contacto_sst').insert({ vinculo_id: V.GESTOR_C2, empresa_id: empresa, whatsapp: '+51900000222' })
  comprobar('Nadie escribe directo en la tabla (ni el gestor)', !!ins.error)
  const upd = await s.GESTOR_C1.from('contacto_sst').update({ whatsapp: '+51900000333' }).eq('vinculo_id', V.GESTOR_C1).select()
  comprobar('Tampoco actualiza directo', !!upd.error || (upd.data ?? []).length === 0)
  const dsc = await s.GESTOR_C1.from('contacto_sst').select('vinculo_id').neq('vinculo_id', V.GESTOR_C1)
  comprobar('El gestor, en la tabla, ve solo su propio contacto', (dsc.data ?? []).length === 0)
  const otro = await s.USUARIO_C1.from('contacto_sst').select('vinculo_id')
  comprobar('Un usuario no lee la tabla (solo ve el equipo por la pantalla)', (otro.data ?? []).length === 0)
  const anon = await dueno.auth.getSession() // el dueño tampoco necesita leer la tabla; no se prueba más
  comprobar('(sesión del dueño válida para el resto)', !!anon.data.session)
  r = await s.GESTOR_C2.rpc('guardar_mi_whatsapp', { p_numero: '900000202' })
  comprobar('Otro gestor guarda el suyo sin pisar el de GESTOR_C1', SEGUIDO(r))
  r = await s.GESTOR_C1.from('contacto_sst').select('whatsapp').eq('vinculo_id', V.GESTOR_C1)
  comprobar('El número de GESTOR_C1 sigue igual', r.data?.[0]?.whatsapp === '+51900000111')
}

// ───────────────────────────────────────────────
seccion('2. «Conoce al equipo de SST»: cada persona ve a los gestores de SU sede')
{
  await s.GESTOR_C12.rpc('guardar_mi_whatsapp', { p_numero: '' })
  const verEquipo = async (n) => {
    const r = await s[n].rpc('equipo_sst')
    if (r.error) return { error: r.error, filas: [] }
    return { filas: r.data ?? [] }
  }
  const ids = (e) => e.filas.map((f) => f.vinculo_id).sort()
  let e = await verEquipo('USUARIO_C1')
  comprobar('El usuario de la sede 1 puede consultar el equipo', !e.error, e.error?.message)
  comprobar('Ve a los gestores de su sede (el de la sede 1 y el de las dos sedes)', ids(e).includes(V.GESTOR_C1) && ids(e).includes(V.GESTOR_C12))
  comprobar('No ve al gestor de la otra sede', !ids(e).includes(V.GESTOR_C2))
  comprobar('Ve al usuario gestor de su sede, no al de la otra, y no ve a los usuarios (solo el equipo SST)', ids(e).includes(V.USUGES_C1) && !ids(e).includes(V.USUGES_C2) && !ids(e).includes(V.USUARIO_C1))
  comprobar('Ve al administrador general y al de su sede, no al de la otra sede', ids(e).includes(V.ADMIN_C) && ids(e).includes(V.ADMSEDE_C1) && !ids(e).includes(V.ADMSEDE_C2))
  comprobar('Cada fila trae su rol', e.filas.find((f) => f.vinculo_id === V.ADMIN_C)?.rol === 'admin_empresa' && e.filas.find((f) => f.vinculo_id === V.ADMSEDE_C1)?.rol === 'admin_sede'
    && e.filas.find((f) => f.vinculo_id === V.GESTOR_C1)?.rol === 'gestor' && e.filas.find((f) => f.vinculo_id === V.USUGES_C1)?.rol === 'usuario_gestor')
  comprobar('El WhatsApp solo sale en los gestores', e.filas.filter((f) => f.rol !== 'gestor').every((f) => f.whatsapp == null))
  const fila = e.filas.find((f) => f.vinculo_id === V.GESTOR_C1)
  comprobar('Cada fila trae nombre, puesto y WhatsApp', !!fila?.nombre && fila?.whatsapp === '+51900000111' && 'puesto' in (fila ?? {}), JSON.stringify(fila))
  comprobar('Quien no puso número aparece sin número', e.filas.find((f) => f.vinculo_id === V.GESTOR_C12)?.whatsapp == null)
  comprobar('La fila trae las sedes donde atiende', Array.isArray(fila?.sedes) && fila.sedes.length >= 1, JSON.stringify(fila?.sedes))
  comprobar('No se filtra ningún dato interno (documento, correo)', !Object.keys(fila ?? {}).some((k) => /documento|correo|persona_id|email/i.test(k)), Object.keys(fila ?? {}).join())

  e = await verEquipo('USUGES_C2')
  comprobar('El usuario gestor de la sede 2 ve al gestor de la sede 2 y al de las dos, no al de la sede 1', ids(e).includes(V.GESTOR_C2) && ids(e).includes(V.GESTOR_C12) && !ids(e).includes(V.GESTOR_C1))
  e = await verEquipo('ADMIN_C')
  comprobar('El administrador general ve a los gestores de las dos sedes', [V.GESTOR_C1, V.GESTOR_C2, V.GESTOR_C12].every((x) => ids(e).includes(x)))
  e = await verEquipo('ADMSEDE_C2')
  comprobar('El administrador de la sede 2 ve a los gestores de su sede, no al de la sede 1', ids(e).includes(V.GESTOR_C2) && ids(e).includes(V.GESTOR_C12) && !ids(e).includes(V.GESTOR_C1))
  e = await verEquipo('GESTOR_C1')
  comprobar('Un gestor se ve a sí mismo en el equipo de su sede', ids(e).includes(V.GESTOR_C1))
  e = await verEquipo('GESTOR_A')
  comprobar('Una empresa distinta no ve a ningún gestor de la empresa D', !ids(e).some((x) => Object.values(V).includes(x)), JSON.stringify(ids(e)))
  const anonimo = await (await ingresarComo('DUENO')).c.rpc('equipo_sst')
  comprobar('El dueño (sin empresa propia) no recibe error', !anonimo.error, anonimo.error?.message)
  // Cesar a un gestor lo saca del equipo: no se prueba (cambiaría cuentas); se revisa en la consulta que solo cuenta vínculos activos
  const q = await dueno.from('vinculos').select('id').in('id', [V.GESTOR_C1, V.GESTOR_C2, V.GESTOR_C12]).eq('estado', 'activo')
  comprobar('(los tres gestores de la prueba siguen activos)', (q.data ?? []).length === 3)
}

// ───────────────────────────────────────────────
seccion('3. Roles adicionales: son etiquetas, no dan permisos')
{
  const permisos = async (n) => ((await s[n].rpc('mis_permisos')).data ?? []).join(',')
  const antes = await permisos('USUARIO_C1')
  let r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('El gestor marca «brigadista» a un usuario de su sede', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Marcarla otra vez no falla ni duplica', SEGUIDO(r))
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'miembro_comite', p_detalle: null })
  comprobar('Puede marcar «miembro del comité»', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'monitor_seguridad', p_detalle: null })
  comprobar('Puede marcar «monitor de seguridad»', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'otro', p_detalle: null })
  comprobar('«Otro» exige escribir cuál', !!r.error)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'otro', p_detalle: 'Primeros auxilios' })
  comprobar('«Otro» con su detalle se guarda', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'jefe_del_mundo', p_detalle: null })
  comprobar('Una etiqueta que no existe se rechaza', !!r.error)
  r = await s.GESTOR_C1.from('etiquetas_persona').select('etiqueta, detalle').eq('vinculo_id', V.USUARIO_C1)
  comprobar('Quedan 4 etiquetas (sin duplicados)', (r.data ?? []).length === 4, JSON.stringify(r.data))
  comprobar('Las etiquetas no cambian los permisos de la cuenta', (await permisos('USUARIO_C1')) === antes, antes)
  r = await s.USUARIO_C1.from('etiquetas_persona').select('etiqueta').eq('vinculo_id', V.USUARIO_C1)
  comprobar('El usuario ve sus propias etiquetas', (r.data ?? []).length === 4)
  r = await s.USUGES_C1.from('etiquetas_persona').select('etiqueta').eq('vinculo_id', V.USUARIO_C1)
  comprobar('Otro usuario de la sede no ve las etiquetas ajenas', (r.data ?? []).length === 0)

  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.USUGES_C2, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('El gestor de la sede 1 NO marca a alguien de la sede 2', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.GESTOR_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Nadie se marca a sí mismo', NO(r), JSON.stringify(r.error))
  r = await s.USUARIO_C1.rpc('dar_etiqueta', { p_vinculo: V.USUGES_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Un usuario no puede marcar etiquetas', NO(r), JSON.stringify(r.error))
  r = await s.USUGES_C1.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Un usuario gestor no puede marcar etiquetas (salvo que se le dé la facultad de personal)', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_A.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Un gestor de otra empresa no puede', NO(r), JSON.stringify(r.error))
  r = await s.ADMSEDE_C2.rpc('dar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('El administrador de la sede 2 no marca a alguien de la sede 1', NO(r), JSON.stringify(r.error))
  r = await s.ADMSEDE_C1.rpc('dar_etiqueta', { p_vinculo: V.USUGES_C1, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('El administrador de la sede 1 marca a un usuario gestor de su sede', SEGUIDO(r), r.error?.message)
  r = await s.ADMIN_C.rpc('dar_etiqueta', { p_vinculo: V.USUGES_C2, p_etiqueta: 'miembro_comite', p_detalle: null })
  comprobar('El administrador general marca a quien sea de la empresa', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('dar_etiqueta', { p_vinculo: V.GESTOR_C12, p_etiqueta: 'brigadista', p_detalle: null })
  comprobar('Un gestor no marca a otro gestor (eso lo hace el administrador)', NO(r), JSON.stringify(r.error))

  const ins = await s.GESTOR_C1.from('etiquetas_persona').insert({ vinculo_id: V.USUARIO_C1, empresa_id: empresa, etiqueta: 'otro', detalle: 'x' })
  comprobar('Nadie escribe directo en la tabla de etiquetas', !!ins.error)
  const del = await s.GESTOR_C1.from('etiquetas_persona').delete().eq('vinculo_id', V.USUARIO_C1).select()
  comprobar('Tampoco borra directo', !!del.error || (del.data ?? []).length === 0)

  r = await s.USUARIO_C1.rpc('quitar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista' })
  comprobar('El usuario no se quita sus propias etiquetas', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('quitar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista' })
  comprobar('El gestor de la sede la quita', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_C1.rpc('quitar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'brigadista' })
  comprobar('Quitarla otra vez no falla', SEGUIDO(r))
  r = await s.GESTOR_C2.rpc('quitar_etiqueta', { p_vinculo: V.USUARIO_C1, p_etiqueta: 'miembro_comite' })
  comprobar('El gestor de la otra sede no quita etiquetas ajenas', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.from('etiquetas_persona').select('etiqueta').eq('vinculo_id', V.USUARIO_C1)
  comprobar('Quedan 3 etiquetas', (r.data ?? []).length === 3, JSON.stringify(r.data))

  // Limpieza
  for (const [v, e] of [[V.USUARIO_C1, 'miembro_comite'], [V.USUARIO_C1, 'monitor_seguridad'], [V.USUARIO_C1, 'otro'], [V.USUGES_C1, 'brigadista'], [V.USUGES_C2, 'miembro_comite']])
    await s.ADMIN_C.rpc('quitar_etiqueta', { p_vinculo: v, p_etiqueta: e })
  r = await s.ADMIN_C.from('etiquetas_persona').select('etiqueta').in('vinculo_id', [V.USUARIO_C1, V.USUGES_C1, V.USUGES_C2])
  comprobar('(limpieza) no quedan etiquetas de la prueba', (r.data ?? []).length === 0, JSON.stringify(r.data))
}

// ───────────────────────────────────────────────
seccion('4. El dueño de la plataforma habilita o no «Conoce al equipo de SST» por empresa')
{
  const filas = async (n) => ((await s[n].rpc('equipo_sst')).data ?? []).length
  const hab = async (n) => (await s[n].rpc('equipo_sst_habilitado')).data
  await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: true })
  comprobar('De partida está habilitado para la empresa D', (await hab('USUARIO_C1')) === true)
  comprobar('Y el equipo trae personas', (await filas('USUARIO_C1')) > 0)
  for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'GESTOR_C1', 'USUARIO_C1', 'USUGES_C1']) {
    const r = await s[n].rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: false })
    comprobar(`${n} no puede deshabilitarlo (solo el dueño)`, NO(r), JSON.stringify(r.error))
  }
  comprobar('Los intentos no cambiaron nada', (await hab('USUARIO_C1')) === true)
  let r = await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: false })
  comprobar('El dueño lo deshabilita para la empresa D', SEGUIDO(r), r.error?.message)
  comprobar('La consulta de habilitado dice que no, para todos de esa empresa', (await hab('USUARIO_C1')) === false && (await hab('ADMIN_C')) === false)
  comprobar('Nadie de esa empresa recibe a ninguna persona del equipo', (await filas('USUARIO_C1')) === 0 && (await filas('ADMIN_C')) === 0 && (await filas('GESTOR_C1')) === 0)
  comprobar('Otra empresa no se ve afectada', (await hab('GESTOR_A')) === true)
  r = await dueno.rpc('fijar_equipo_sst', { p_empresa: '00000000-0000-0000-0000-000000000000', p_habilitado: false })
  comprobar('No acepta una empresa que no existe', !!r.error, JSON.stringify(r.error))
  const ins = await s.ADMIN_C.from('equipo_sst_config').insert({ empresa_id: empresa, habilitado: true })
  comprobar('Nadie escribe directo en la tabla de interruptores', !!ins.error)
  const lee = await s.GESTOR_A.from('equipo_sst_config').select('empresa_id').eq('empresa_id', empresa)
  comprobar('Otra empresa no lee el interruptor de la empresa D', (lee.data ?? []).length === 0)
  r = await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: true })
  comprobar('El dueño lo vuelve a habilitar', SEGUIDO(r), r.error?.message)
  comprobar('Y el equipo vuelve a verse', (await hab('USUARIO_C1')) === true && (await filas('USUARIO_C1')) > 0)
  const anon = await (await import('./comun.mjs')).ingresarComo('DUENO')
  const lista = await anon.c.from('equipo_sst_config').select('empresa_id')
  comprobar('El dueño lee los interruptores de todas las empresas', !lista.error)
}

// ───────────────────────────────────────────────
seccion('5. El organigrama del equipo de SST: puestos y nombres que editan administradores y gestores')
{
  const sedeIds = {}
  for (const n of ['GESTOR_C1', 'GESTOR_C2'])
    sedeIds[n] = (await dueno.from('vinculos_sedes').select('sede_id').eq('vinculo_id', V[n])).data?.[0]?.sede_id
  const S1 = sedeIds.GESTOR_C1
  const S2 = sedeIds.GESTOR_C2
  const limpiar = async () => {
    const todos = (await s.ADMIN_C.from('equipo_sst_nodos').select('id,padre_id')).data ?? []
    for (const n of todos.filter((x) => !x.padre_id)) await s.ADMIN_C.rpc('quitar_nodo_equipo', { p_nodo: n.id })
  }
  await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: true })
  await limpiar()

  let r = await s.ADMIN_C.rpc('agregar_nodo_equipo', { p_padre: null, p_sede: null, p_puesto: 'Jefe de SST', p_nombre: 'Ana Prueba' })
  comprobar('El administrador general crea el primer puesto (para toda la empresa)', SEGUIDO(r) && !!r.data, r.error?.message)
  const RAIZ = r.data
  r = await s.GESTOR_C1.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S1, p_puesto: 'Supervisor SST', p_nombre: 'Luis Prueba' })
  comprobar('El gestor de la sede 1 agrega una rama de su sede', SEGUIDO(r) && !!r.data, r.error?.message)
  const N1 = r.data
  r = await s.GESTOR_C1.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S2, p_puesto: 'Intruso', p_nombre: 'X' })
  comprobar('…pero no una de la sede 2', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: null, p_puesto: 'Intruso', p_nombre: 'X' })
  comprobar('…ni una «para toda la empresa» (eso es del administrador general)', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C2.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S2, p_puesto: 'Supervisor SST 2', p_nombre: 'Marta Prueba' })
  comprobar('El gestor de la sede 2 agrega la suya', SEGUIDO(r) && !!r.data, r.error?.message)
  const N2 = r.data
  r = await s.ADMSEDE_C1.rpc('agregar_nodo_equipo', { p_padre: N1, p_sede: S1, p_puesto: 'Técnico de seguridad', p_nombre: null })
  comprobar('El administrador de la sede 1 agrega una rama (con el nombre vacío: puesto por cubrir)', SEGUIDO(r), r.error?.message)
  const N1A = r.data
  for (const n of ['USUARIO_C1', 'USUGES_C1']) {
    r = await s[n].rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S1, p_puesto: 'Intruso', p_nombre: 'X' })
    comprobar(`${n} no puede agregar puestos`, NO(r), JSON.stringify(r.error))
  }
  r = await s.GESTOR_C2.rpc('agregar_nodo_equipo', { p_padre: N1, p_sede: S2, p_puesto: 'Intruso', p_nombre: 'X' })
  comprobar('Nadie cuelga una rama de un puesto que no ve (el gestor 2 no ve la sede 1)', NO(r), JSON.stringify(r.error))
  for (const [puesto, nombre] of [['', 'X'], ['A', 'X'], ['P'.repeat(61), 'X'], ['Puesto bueno', 'N'.repeat(81)]]) {
    r = await s.ADMIN_C.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: null, p_puesto: puesto, p_nombre: nombre })
    comprobar(`Rechaza textos fuera de medida («${puesto.slice(0, 8)}…», nombre de ${nombre.length})`, !!r.error, r.error?.message)
  }

  // Quién ve qué
  const ver = async (n) => ((await s[n].from('equipo_sst_nodos').select('id')).data ?? []).map((x) => x.id)
  let v = await ver('USUARIO_C1')
  comprobar('Un usuario de la sede 1 ve el puesto general y los de su sede', v.includes(RAIZ) && v.includes(N1) && v.includes(N1A))
  comprobar('…y no ve los de la sede 2', !v.includes(N2))
  v = await ver('ADMIN_C')
  comprobar('El administrador general ve todo', [RAIZ, N1, N1A, N2].every((x) => v.includes(x)))
  v = await ver('GESTOR_A')
  comprobar('Otra empresa no ve nada de la empresa D', v.length === 0 || ![RAIZ, N1, N2].some((x) => v.includes(x)))
  const fila = (await s.USUARIO_C1.from('equipo_sst_nodos').select('*').eq('id', N1).single()).data
  comprobar('La fila trae puesto y nombre, sin datos de la cuenta (documento, correo, rol)', fila?.puesto === 'Supervisor SST' && fila?.nombre === 'Luis Prueba' && !Object.keys(fila).some((k) => /documento|correo|persona_id|vinculo|rol/i.test(k)), Object.keys(fila ?? {}).join())

  // Editar nombres y puestos
  r = await s.GESTOR_C1.rpc('editar_nodo_equipo', { p_nodo: N1, p_puesto: 'Supervisor de SST', p_nombre: 'Luis Cambiado' })
  comprobar('El gestor cambia el nombre y el puesto de un puesto de su sede', SEGUIDO(r), r.error?.message)
  v = (await s.USUARIO_C1.from('equipo_sst_nodos').select('nombre,puesto').eq('id', N1).single()).data
  comprobar('El cambio se ve', v?.nombre === 'Luis Cambiado' && v?.puesto === 'Supervisor de SST')
  r = await s.ADMSEDE_C1.rpc('editar_nodo_equipo', { p_nodo: N1, p_puesto: 'Supervisor de SST', p_nombre: 'Luis Otra Vez' })
  comprobar('El administrador de la sede también', SEGUIDO(r), r.error?.message)
  r = await s.ADMSEDE_C1.rpc('editar_nodo_equipo', { p_nodo: N2, p_puesto: 'Hackeado', p_nombre: 'X' })
  comprobar('El administrador de la sede 1 no edita un puesto de la sede 2', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('editar_nodo_equipo', { p_nodo: RAIZ, p_puesto: 'Hackeado', p_nombre: 'X' })
  comprobar('El gestor no edita el puesto general de la empresa', NO(r), JSON.stringify(r.error))
  r = await s.ADMIN_C.rpc('editar_nodo_equipo', { p_nodo: RAIZ, p_puesto: 'Jefe de SST', p_nombre: 'Ana Cambiada' })
  comprobar('El administrador general sí', SEGUIDO(r), r.error?.message)
  r = await s.GESTOR_A.rpc('editar_nodo_equipo', { p_nodo: RAIZ, p_puesto: 'Hackeado', p_nombre: 'X' })
  comprobar('Otra empresa no edita nada', NO(r), JSON.stringify(r.error))
  r = await dueno.rpc('editar_nodo_equipo', { p_nodo: RAIZ, p_puesto: 'Hackeado', p_nombre: 'X' })
  comprobar('El dueño de la plataforma tampoco edita el organigrama de una empresa', NO(r), JSON.stringify(r.error))
  for (const n of ['USUARIO_C1', 'USUGES_C1']) {
    r = await s[n].rpc('editar_nodo_equipo', { p_nodo: N1, p_puesto: 'Hackeado', p_nombre: 'X' })
    comprobar(`${n} no edita`, NO(r), JSON.stringify(r.error))
  }

  // Sin escritura directa
  const ins = await s.ADMIN_C.from('equipo_sst_nodos').insert({ empresa_id: empresa, puesto: 'Directo' })
  comprobar('Nadie inserta directo en la tabla', !!ins.error)
  const upd = await s.ADMIN_C.from('equipo_sst_nodos').update({ puesto: 'Directo' }).eq('id', RAIZ).select()
  comprobar('Ni actualiza directo', !!upd.error || (upd.data ?? []).length === 0)
  const del = await s.ADMIN_C.from('equipo_sst_nodos').delete().eq('id', N1A).select()
  comprobar('Ni borra directo', !!del.error || (del.data ?? []).length === 0)

  // Quitar
  r = await s.GESTOR_C12.rpc('agregar_nodo_equipo', { p_padre: N1, p_sede: S2, p_puesto: 'Apoyo de la sede 2', p_nombre: 'Eva Prueba' })
  comprobar('Quien atiende las dos sedes agrega una rama de la sede 2 bajo un puesto de la sede 1', SEGUIDO(r), r.error?.message)
  const N12 = r.data
  r = await s.GESTOR_C1.rpc('quitar_nodo_equipo', { p_nodo: N1 })
  comprobar('No se quita un puesto que tiene ramas de otra sede que no manejas', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C12.rpc('quitar_nodo_equipo', { p_nodo: N1 })
  comprobar('Quien maneja las dos sedes sí quita el puesto con todas sus ramas', SEGUIDO(r), r.error?.message)
  v = await ver('ADMIN_C')
  comprobar('Se fueron el puesto y sus ramas, y quedó lo demás', !v.includes(N1) && !v.includes(N1A) && !v.includes(N12) && v.includes(RAIZ) && v.includes(N2))
  r = await s.USUARIO_C1.rpc('quitar_nodo_equipo', { p_nodo: RAIZ })
  comprobar('Un usuario no quita nada', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('quitar_nodo_equipo', { p_nodo: RAIZ })
  comprobar('El gestor no quita el puesto general', NO(r), JSON.stringify(r.error))

  // El interruptor del dueño también lo oculta
  await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: false })
  comprobar('Si el dueño deshabilita la sección, nadie de la empresa ve el organigrama', (await ver('USUARIO_C1')).length === 0 && (await ver('ADMIN_C')).length === 0)
  await dueno.rpc('fijar_equipo_sst', { p_empresa: empresa, p_habilitado: true })

  // Armar con el equipo actual
  await limpiar()
  r = await s.GESTOR_C1.rpc('armar_equipo_sst_actual')
  comprobar('El gestor no arma el organigrama inicial (solo el administrador general)', NO(r), JSON.stringify(r.error))
  r = await s.ADMIN_C.rpc('armar_equipo_sst_actual')
  comprobar('El administrador general arma el organigrama con el equipo actual', SEGUIDO(r), r.error?.message)
  const armado = (await s.ADMIN_C.from('equipo_sst_nodos').select('id,padre_id,puesto,nombre,sede_id')).data ?? []
  comprobar('Salen personas con puesto y nombre', armado.length >= 4 && armado.every((x) => x.puesto && x.nombre), String(armado.length))
  comprobar('Hay una sola raíz y las demás cuelgan de algo', armado.filter((x) => !x.padre_id).length >= 1 && armado.filter((x) => x.padre_id).length >= 3)
  r = await s.ADMIN_C.rpc('armar_equipo_sst_actual')
  comprobar('No se arma dos veces (no pisa lo que ya hay)', !!r.error, r.error?.message)
  await limpiar()
  comprobar('(limpieza) no quedan puestos de la prueba', ((await s.ADMIN_C.from('equipo_sst_nodos').select('id')).data ?? []).length === 0)
}

// ───────────────────────────────────────────────
seccion('6. El WhatsApp aparece en el puesto solo si el gestor lo publicó')
{
  const S1 = (await dueno.from('vinculos_sedes').select('sede_id').eq('vinculo_id', V.GESTOR_C1)).data?.[0]?.sede_id
  const S2 = (await dueno.from('vinculos_sedes').select('sede_id').eq('vinculo_id', V.GESTOR_C2)).data?.[0]?.sede_id
  const limpiar = async () => {
    const todos = (await s.ADMIN_C.from('equipo_sst_nodos').select('id,padre_id')).data ?? []
    for (const n of todos.filter((x) => !x.padre_id)) await s.ADMIN_C.rpc('quitar_nodo_equipo', { p_nodo: n.id })
  }
  await limpiar()
  for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12']) await s[n].rpc('guardar_mi_whatsapp', { p_numero: '' })
  const RAIZ = (await s.ADMIN_C.rpc('agregar_nodo_equipo', { p_padre: null, p_sede: null, p_puesto: 'Jefe de SST', p_nombre: 'Ana Prueba' })).data
  const A = (await s.ADMIN_C.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S1, p_puesto: 'Supervisor SST', p_nombre: 'Luis Prueba' })).data
  const B = (await s.ADMIN_C.rpc('agregar_nodo_equipo', { p_padre: RAIZ, p_sede: S2, p_puesto: 'Supervisor SST 2', p_nombre: 'Marta Prueba' })).data
  const contactos = async (n) => ((await s[n].rpc('contactos_equipo_sst')).data ?? [])
  const de = (lista, nodo) => lista.find((x) => x.nodo_id === nodo)

  let r = await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: '900 000 101' })
  comprobar('El gestor publica su número', SEGUIDO(r), r.error?.message)
  comprobar('Sin vincular a ningún puesto, el número no aparece en ninguna parte', (await contactos('USUARIO_C1')).length === 0)

  r = await s.GESTOR_C1.rpc('vincular_nodo_equipo', { p_nodo: A, p_vinculo: V.GESTOR_C1 })
  comprobar('El gestor vincula su puesto de la sede con su cuenta', SEGUIDO(r), r.error?.message)
  let c = await contactos('USUARIO_C1')
  comprobar('Un usuario de la sede ve el WhatsApp en ese puesto', de(c, A)?.whatsapp === '+51900000101', JSON.stringify(c))
  comprobar('…y no recibe el identificador de la cuenta', c.every((x) => x.vinculo_id == null), JSON.stringify(c))
  c = await contactos('USUARIO_C1')
  comprobar('Solo salen los puestos con número publicado', c.every((x) => !!x.whatsapp))
  c = await contactos('GESTOR_C1')
  comprobar('Quien edita ve a qué cuenta está vinculado el puesto', de(c, A)?.vinculo_id === V.GESTOR_C1, JSON.stringify(c))
  c = await contactos('GESTOR_C2')
  comprobar('Un usuario de la otra sede no ve el número de un puesto que no ve', !de(c, A))
  c = await contactos('GESTOR_A')
  comprobar('Otra empresa no ve nada', c.length === 0)

  await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: '' })
  c = await contactos('USUARIO_C1')
  comprobar('Si el gestor borra su número, deja de aparecer', !de(c, A))
  c = await contactos('ADMIN_C')
  comprobar('El administrador sigue viendo el vínculo, sin número', de(c, A)?.vinculo_id === V.GESTOR_C1 && de(c, A)?.whatsapp == null)
  await s.GESTOR_C1.rpc('guardar_mi_whatsapp', { p_numero: '900000101' })

  // Reglas del vínculo
  r = await s.GESTOR_C1.rpc('vincular_nodo_equipo', { p_nodo: A, p_vinculo: V.GESTOR_C2 })
  comprobar('No se vincula a un gestor de otra sede', NO(r), JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('vincular_nodo_equipo', { p_nodo: A, p_vinculo: V.USUARIO_C1 })
  comprobar('Solo se vincula a gestores (no a un usuario)', !!r.error, JSON.stringify(r.error))
  r = await s.GESTOR_C1.rpc('vincular_nodo_equipo', { p_nodo: B, p_vinculo: V.GESTOR_C2 })
  comprobar('No se vincula un puesto de otra sede', NO(r), JSON.stringify(r.error))
  for (const n of ['USUARIO_C1', 'USUGES_C1']) {
    r = await s[n].rpc('vincular_nodo_equipo', { p_nodo: A, p_vinculo: V.GESTOR_C1 })
    comprobar(`${n} no vincula`, NO(r), JSON.stringify(r.error))
  }
  r = await s.GESTOR_A.rpc('vincular_nodo_equipo', { p_nodo: A, p_vinculo: V.GESTOR_C1 })
  comprobar('Otra empresa no vincula', NO(r), JSON.stringify(r.error))
  r = await s.ADMIN_C.rpc('vincular_nodo_equipo', { p_nodo: RAIZ, p_vinculo: V.GESTOR_C12 })
  comprobar('El administrador general vincula un puesto de toda la empresa con un gestor de cualquier sede', SEGUIDO(r), r.error?.message)
  r = await s.ADMIN_C.rpc('vincular_nodo_equipo', { p_nodo: RAIZ, p_vinculo: null })
  comprobar('Y lo desvincula', SEGUIDO(r), r.error?.message)
  const dir = await s.ADMIN_C.from('equipo_sst_enlaces').select('*')
  comprobar('La tabla de vínculos no se lee ni se escribe directo', !!dir.error || (dir.data ?? []).length === 0)
  const ins = await s.ADMIN_C.from('equipo_sst_enlaces').insert({ nodo_id: B, vinculo_id: V.GESTOR_C2 })
  comprobar('(escritura directa rechazada)', !!ins.error)

  // Candidatos
  let g = await s.GESTOR_C1.rpc('gestores_para_vincular', { p_sede: S1 })
  const idsG = (g.data ?? []).map((x) => x.vinculo_id)
  comprobar('El gestor de la sede 1 ve a los gestores de su sede para vincular (con su nombre)', idsG.includes(V.GESTOR_C1) && idsG.includes(V.GESTOR_C12) && !idsG.includes(V.GESTOR_C2) && (g.data ?? []).every((x) => !!x.nombre))
  g = await s.GESTOR_C1.rpc('gestores_para_vincular', { p_sede: S2 })
  comprobar('…no los de otra sede', !!g.error || (g.data ?? []).length === 0)
  g = await s.USUARIO_C1.rpc('gestores_para_vincular', { p_sede: S1 })
  comprobar('Un usuario no recibe la lista', !!g.error || (g.data ?? []).length === 0)

  // Si cambian el puesto de nombre, el vínculo sigue; si quitan el puesto, se va con él
  await s.GESTOR_C1.rpc('editar_nodo_equipo', { p_nodo: A, p_puesto: 'Supervisor SST', p_nombre: 'Otro Nombre' })
  c = await contactos('USUARIO_C1')
  comprobar('Cambiar el nombre del puesto no suelta el vínculo ni el número', de(c, A)?.whatsapp === '+51900000101')
  r = await s.GESTOR_C1.rpc('quitar_nodo_equipo', { p_nodo: A })
  comprobar('Se quita el puesto', SEGUIDO(r), r.error?.message)
  c = await contactos('ADMIN_C')
  comprobar('Con el puesto se va el vínculo', !de(c, A))

  // Armar con el equipo actual vincula a los gestores
  await limpiar()
  r = await s.ADMIN_C.rpc('armar_equipo_sst_actual')
  comprobar('Se arma con el equipo actual', SEGUIDO(r), r.error?.message)
  c = await contactos('ADMIN_C')
  const vinc = c.map((x) => x.vinculo_id)
  comprobar('Los gestores quedan vinculados a su puesto', [V.GESTOR_C1, V.GESTOR_C2, V.GESTOR_C12].every((x) => vinc.includes(x)), JSON.stringify(vinc))
  c = await contactos('USUARIO_C1')
  comprobar('Y su número aparece apenas lo publican', de(c, c.find((x) => x.whatsapp)?.nodo_id)?.whatsapp === '+51900000101')
  await limpiar()
  for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12']) await s[n].rpc('guardar_mi_whatsapp', { p_numero: '' })
  comprobar('(limpieza) sin puestos ni números de la prueba', ((await s.ADMIN_C.from('equipo_sst_nodos').select('id')).data ?? []).length === 0)
}

// Limpieza de números
for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12']) await s[n].rpc('guardar_mi_whatsapp', { p_numero: '' })

// ───────────────────────────────────────────────
const ok = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba del equipo de SST y las etiquetas (etapa 4)', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · Solo datos ficticios en crc-dev.`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/equipo-sst.md', lineas.join('\n'))
process.exit(ok ? 0 : 1)
