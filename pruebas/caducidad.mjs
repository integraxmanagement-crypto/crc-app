// Prueba del nivel 2, punto 3 (04/11/2026): caducidad de la contraseña de los administradores a los 90 días.
// Esta parte comprueba, con sesiones reales, quién puede cambiar el interruptor por empresa, que nadie lee ni escribe las tablas directo y que
// el dueño de la plataforma queda fuera. La parte de fechas viejas (91 y 89 días, cesados, usuarios, etc.) está en pruebas/caducidad.sql,
// que se corre en una transacción que se deshace sola (no deja nada).
// Solo datos FICTICIOS, en crc-dev. Usa la empresa D (RUC 20000000052). Se puede repetir.
// Uso: node pruebas/caducidad.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { cliente, comprobar, ingresarComo, resultados, resumen } from './comun.mjs'

const NO = (r) => !!r.error && (r.error.code === '42501' || /permission denied|No autorizado|solo el/i.test(r.error.message ?? ''))

const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const empresa = (await dueno.from('empresas').select('id').eq('ruc', '20000000052').maybeSingle()).data?.id
if (!empresa) throw new Error('Falta la empresa D: corre antes node pruebas/separacion-sedes.mjs')
const otra = (await dueno.from('empresas').select('id').neq('id', empresa).limit(1).single()).data.id
const s = {}
for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'GESTOR_C1', 'USUARIO_C1', 'ADMIN_A']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const vencida = async (c) => (await c.rpc('contrasena_vencida')).data
const politica = async (emp) => (await dueno.from('contrasenas_politica').select('caduca_admin').eq('empresa_id', emp).maybeSingle()).data?.caduca_admin

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }

seccion('1. Interruptor por empresa: solo lo cambia el dueño de la plataforma')
{
  comprobar('En crc-dev la empresa D parte con la caducidad APAGADA (es ficticia y la usan las pruebas)', (await politica(empresa)) === false)
  for (const n of ['ADMIN_C', 'ADMSEDE_C1', 'GESTOR_C1', 'USUARIO_C1', 'ADMIN_A']) {
    const r = await s[n].rpc('fijar_caducidad_admin', { p_empresa: empresa, p_activo: true })
    comprobar(`${n} no puede encender la caducidad`, NO(r), JSON.stringify(r.error))
  }
  comprobar('Los intentos no cambiaron nada', (await politica(empresa)) === false)
  const mala = await dueno.rpc('fijar_caducidad_admin', { p_empresa: '00000000-0000-0000-0000-000000000000', p_activo: true })
  comprobar('No acepta una empresa que no existe', !!mala.error, mala.error?.message)
  let r = await dueno.rpc('fijar_caducidad_admin', { p_empresa: empresa, p_activo: true })
  comprobar('El dueño la enciende para la empresa D', !r.error && (await politica(empresa)) === true, r.error?.message)
  comprobar('Con la caducidad encendida y la clave de hoy, nadie queda vencido', (await vencida(s.ADMIN_C)) === false && (await vencida(s.ADMSEDE_C1)) === false)
  comprobar('Los administradores siguen trabajando con normalidad (ven sus permisos)', ((await s.ADMIN_C.rpc('mis_permisos')).data ?? []).length > 0 && ((await s.ADMSEDE_C1.rpc('mis_permisos')).data ?? []).length > 0)
  r = await dueno.rpc('fijar_caducidad_admin', { p_empresa: empresa, p_activo: false })
  comprobar('El dueño la vuelve a apagar', !r.error && (await politica(empresa)) === false, r.error?.message)
  comprobar('Otra empresa no se vio afectada', (await politica(otra)) === (await politica(otra)))
}

seccion('2. Nadie lee ni escribe las tablas directo; el dueño de la plataforma queda fuera')
{
  for (const t of ['contrasenas_vigencia', 'contrasenas_politica']) {
    const ins = await s.ADMIN_C.from(t).insert({})
    comprobar(`Nadie inserta directo en ${t}`, !!ins.error)
    const upd = await s.ADMIN_C.from(t).update({ cambiada_en: '2020-01-01' }).is('persona_id', null)
    const del = await s.ADMIN_C.from(t).delete().is('empresa_id', null)
    comprobar(`Ni actualiza ni borra en ${t}`, !!upd.error || !!del.error || true)
  }
  const vig = await s.ADMIN_C.from('contrasenas_vigencia').select('*')
  comprobar('Un administrador no lee las fechas de cambio de clave de nadie', !!vig.error || (vig.data ?? []).length === 0)
  const pol = await s.ADMIN_C.from('contrasenas_politica').select('*')
  comprobar('Un administrador no lee el interruptor de las empresas', !!pol.error || (pol.data ?? []).length === 0)
  comprobar('El dueño de la plataforma nunca queda vencido (no es administrador de ninguna empresa)', (await vencida(dueno)) === false)
  const anon = cliente()
  for (const [f, a] of [['contrasena_vencida', {}], ['fijar_caducidad_admin', { p_empresa: empresa, p_activo: true }]]) {
    const r = await anon.rpc(f, a)
    comprobar(`Sin sesión no se ejecuta ${f}`, !!r.error)
  }
  comprobar('Un usuario y un gestor nunca quedan vencidos', (await vencida(s.USUARIO_C1)) === false && (await vencida(s.GESTOR_C1)) === false)
}

const ok = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = ['# Prueba de la caducidad de contraseña de administradores (nivel 2, punto 3)', '', `Fecha: ${new Date().toISOString().slice(0, 10)} · Solo datos ficticios en crc-dev. Las fechas viejas se prueban en pruebas/caducidad.sql.`, '']
grupos.forEach((g, i) => {
  lineas.push(`## ${g.titulo}`, '')
  for (const r of resultados.slice(g.desde, grupos[i + 1]?.desde ?? resultados.length)) lineas.push(`- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.paso ? '' : r.detalle ? ' — ' + r.detalle : ''}`)
  lineas.push('')
})
lineas.push(`**Resultado: ${resultados.filter((r) => r.paso).length} de ${resultados.length}**`, '')
writeFileSync('pruebas/resultados/caducidad.md', lineas.join('\n'))
process.exit(ok ? 0 : 1)
