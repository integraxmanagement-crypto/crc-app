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
for (const n of ['GESTOR_C1', 'GESTOR_C2', 'GESTOR_C12', 'USUARIO_C1', 'USUGES_C1', 'USUGES_C2'])
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
  comprobar('No ve usuarios gestores ni usuarios (solo gestores)', !ids(e).includes(V.USUGES_C1) && !ids(e).includes(V.USUARIO_C1))
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
