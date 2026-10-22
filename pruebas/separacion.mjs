// Paso 5 · Prueba de separación entre empresas (tarea 3.1). Solo datos FICTICIOS.
// Ingresa como cada persona de prueba, por la misma puerta que usa la app (clave pública + RLS),
// e intenta ver o tocar lo que no le corresponde. Guarda un informe en pruebas/resultados/.
// Uso: node pruebas/separacion.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { cliente, comprobar, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}

const RUC_A = '20000000010'
const RUC_B = '20000000028'
const SIN_PERMISO = (r) => r.error?.code === '42501' || /permission denied|No autorizado/i.test(r.error?.message ?? '')

// Datos de referencia que solo el dueño puede ver completos.
const { c: dueno } = await ingresarComo('DUENO')
const { data: empresas } = await dueno.from('empresas').select('id, ruc')
const ID = Object.fromEntries(empresas.map((e) => [e.ruc, e.id]))
const { data: vinculosTodos } = await dueno.from('vinculos').select('id, empresa_id, estado, personas(numero_documento)')
const vinculoDe = (doc) => vinculosTodos.find((v) => v.personas.numero_documento === doc && v.estado === 'activo')

const sesion = {}
for (const n of ['ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B', 'USUARIO_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  sesion[n] = c
}

// ───────────────────────────────────────────────
seccion('1. Una persona de la empresa A no ve nada de la empresa B')
for (const n of ['USUARIO_A2', 'GESTOR_A', 'ADMIN_A']) {
  const c = sesion[n]
  const emp = await c.from('empresas').select('ruc')
  comprobar(`${n}: solo ve su empresa (A)`, emp.data?.length === 1 && emp.data[0].ruc === RUC_A, `ve ${emp.data?.map((e) => e.ruc).join(', ')}`)
  const empB = await c.from('empresas').select('ruc').eq('id', ID[RUC_B])
  comprobar(`${n}: si pide la empresa B por su código, recibe 0 filas`, empB.data?.length === 0)
  const vincB = await c.from('vinculos').select('id').eq('empresa_id', ID[RUC_B])
  comprobar(`${n}: 0 vínculos de B`, vincB.data?.length === 0)
  const perB = await c.from('personas').select('id').in('numero_documento', ['30000001', '30000002', 'CE300003'])
  comprobar(`${n}: 0 personas de B`, perB.data?.length === 0)
  const histB = await c.from('vinculos_historial').select('id').eq('empresa_id', ID[RUC_B])
  comprobar(`${n}: 0 registros del historial de B`, histB.data?.length === 0)
}

// ───────────────────────────────────────────────
seccion('2. Dentro de la empresa A, cada rol ve solo lo que le toca')
{
  const u = sesion.USUARIO_A2
  const per = await u.from('personas').select('numero_documento')
  comprobar('Usuario A2: solo ve su propia ficha', per.data?.length === 1 && per.data[0].numero_documento === 'PA200004', `${per.data?.length} ficha(s)`)
  const lista = await u.rpc('personas_de_mi_empresa')
  comprobar('Usuario A2: NO recibe la lista de personas de su empresa', (lista.data?.length ?? 0) === 0)

  const g = sesion.GESTOR_A
  const gl = await g.rpc('personas_de_mi_empresa')
  const columnas = Object.keys(gl.data?.[0] ?? {}).sort().join(', ')
  comprobar('Gestor A: recibe la lista de personas activas de A', gl.data?.length >= 3, `${gl.data?.length} personas`)
  comprobar('Gestor A: la lista trae solo nombres, puesto y área (sin documento)', columnas === 'apellidos_nombres, area, persona_id, puesto', columnas)
  comprobar('Gestor A: la lista no incluye a nadie de B', !gl.data?.some((p) => /ADMIN B|GESTOR B|USUARIO B/.test(p.apellidos_nombres)))
  const gp = await g.from('personas').select('numero_documento')
  comprobar('Gestor A: no puede leer los documentos de otras personas', gp.data?.length === 1)

  const a = sesion.ADMIN_A
  const ap = await a.from('personas').select('numero_documento')
  const docs = ap.data?.map((p) => p.numero_documento) ?? []
  comprobar('Administrador A: ve las fichas de las personas de A', docs.includes('20000002') && docs.includes('PA200004'), `${docs.length} fichas`)
  comprobar('Administrador A: ninguna ficha es de B', !docs.some((d) => ['30000001', '30000002', 'CE300003'].includes(d)))
}

// ───────────────────────────────────────────────
seccion('3. Un administrador de A no puede crear ni leer cuentas de B')
{
  const a = sesion.ADMIN_A
  const datos = { tipo_documento: 'dni', apellidos_nombres: 'PRUEBA INTRUSA, Nadia (ficticia)', fecha_ingreso: '2026-10-22' }
  const enB = await llamarFuncion(a, 'crear-cuenta', { ...datos, empresa_id: ID[RUC_B], rol: 'usuario', numero_documento: '99000001' })
  comprobar('Admin A NO puede crear un usuario en la empresa B', enB.estado === 403, enB.datos?.error)
  const otroAdmin = await llamarFuncion(a, 'crear-cuenta', { ...datos, empresa_id: ID[RUC_A], rol: 'admin_empresa', numero_documento: '99000002' })
  comprobar('Admin A NO puede crear otro administrador (solo el dueño)', otroAdmin.estado === 403, otroAdmin.datos?.error)
  const gestorCrea = await llamarFuncion(sesion.GESTOR_A, 'crear-cuenta', { ...datos, empresa_id: ID[RUC_A], rol: 'usuario', numero_documento: '99000003' })
  comprobar('Gestor A NO puede crear cuentas', gestorCrea.estado === 403, gestorCrea.datos?.error)
  const usuarioCrea = await llamarFuncion(sesion.USUARIO_A2, 'crear-cuenta', { ...datos, empresa_id: ID[RUC_A], rol: 'usuario', numero_documento: '99000004' })
  comprobar('Usuario A2 NO puede crear cuentas', usuarioCrea.estado === 403, usuarioCrea.datos?.error)
  const sinSesion = await llamarFuncion(cliente(), 'crear-cuenta', { ...datos, empresa_id: ID[RUC_A], rol: 'usuario', numero_documento: '99000005' })
  comprobar('Sin iniciar sesión NO se puede crear cuentas', sinSesion.estado === 401, sinSesion.datos?.error)

  const vB = vinculoDe('30000002')
  const leer = await a.from('vinculos').select('id').eq('id', vB.id)
  comprobar('Admin A NO puede leer la cuenta del gestor B aunque conozca su código', leer.data?.length === 0)
  const cesar = await a.rpc('cesar_vinculo', { p_vinculo: vB.id, p_fecha_cese: '2026-10-22', p_motivo: 'Intento indebido' })
  comprobar('Admin A NO puede cesar la cuenta del gestor B', cesar.error?.message === 'No autorizado', cesar.error?.message)

  const insertar = await a.from('vinculos').insert({ persona_id: vB.id, empresa_id: ID[RUC_A], rol: 'usuario', fecha_ingreso: '2026-10-22' })
  comprobar('Nadie puede escribir directo en las tablas desde la app (insertar)', SIN_PERMISO(insertar), insertar.error?.message)
  const cambiar = await a.from('empresas').update({ razon_social: 'Cambio indebido' }).eq('id', ID[RUC_B])
  comprobar('Nadie puede escribir directo en las tablas desde la app (modificar)', SIN_PERMISO(cambiar), cambiar.error?.message)
  const borrar = await a.from('personas').delete().eq('numero_documento', '30000002')
  comprobar('Nadie puede escribir directo en las tablas desde la app (borrar)', SIN_PERMISO(borrar), borrar.error?.message)

  // Y al revés: B tampoco ve a quienes solo trabajaron en A.
  // (20000003 no cuenta: en la sección 6 pasa a B, así que también es ex trabajadora de B.)
  const bp = await sesion.ADMIN_B.from('personas').select('numero_documento')
  comprobar('Admin B tampoco ve fichas de personas que solo estuvieron en A', !bp.data?.some((p) => ['20000001', '20000002', 'PA200004'].includes(p.numero_documento)))
}

// ───────────────────────────────────────────────
seccion('4. Una persona cesada no puede ingresar')
{
  const { error } = await ingresarComo('USUARIO_A')
  comprobar('USUARIO_A (cesada) no puede ingresar', /inhabilitada/.test(error?.message ?? ''), error?.message)
}

// ───────────────────────────────────────────────
seccion('5. Sin iniciar sesión no se ve nada')
{
  const anon = cliente()
  for (const t of ['empresas', 'personas', 'vinculos', 'vinculos_historial', 'roles']) {
    const r = await anon.from(t).select('*').limit(1)
    comprobar(`Sin sesión: la tabla ${t} no entrega datos`, SIN_PERMISO(r) || r.data?.length === 0, r.error?.message ?? `${r.data?.length} filas`)
  }
}

// ───────────────────────────────────────────────
seccion('6. Cambio de empresa: la persona pasa de A a B y el historial se conserva')
{
  const persona = 'USUARIO_A' // cesada en A en el paso 4
  const alta = await llamarFuncion(sesion.ADMIN_B, 'crear-cuenta', {
    empresa_id: ID[RUC_B], rol: 'usuario', tipo_documento: 'dni', numero_documento: '20000003',
    apellidos_nombres: 'PRUEBA USUARIO A, Carla (ficticia)', fecha_ingreso: '2026-10-22', puesto: 'Operaria', area: 'Obras',
  })
  comprobar('Admin B da de alta en B a la persona cesada en A (misma cuenta, sin contraseña nueva)', alta.estado === 200 && alta.datos?.cuenta_nueva === false, alta.datos?.error)

  const doble = await llamarFuncion(sesion.ADMIN_A, 'crear-cuenta', {
    empresa_id: ID[RUC_A], rol: 'usuario', tipo_documento: 'dni', numero_documento: '20000003',
    apellidos_nombres: 'PRUEBA USUARIO A, Carla (ficticia)', fecha_ingreso: '2026-10-22',
  })
  comprobar('No puede estar activa en dos empresas a la vez', doble.estado === 409, doble.datos?.error)

  const { c, error } = await ingresarComo(persona)
  comprobar('Ahora puede ingresar otra vez (activa en B)', !error, error?.message)
  if (!error) {
    const emp = await c.from('empresas').select('ruc')
    comprobar('Ve solo la empresa B, ya no la A', emp.data?.length === 1 && emp.data[0].ruc === RUC_B)
  }
  const histA = await sesion.ADMIN_A.from('vinculos_historial').select('accion').eq('persona_id', alta.datos?.persona_id)
  comprobar('Admin A conserva el historial de su ex trabajadora (alta y cese en A)', histA.data?.some((h) => h.accion === 'cese'))
  const vinB = await sesion.ADMIN_A.from('vinculos').select('id').eq('persona_id', alta.datos?.persona_id).eq('empresa_id', ID[RUC_B])
  comprobar('Admin A NO ve su nuevo vínculo en B', vinB.data?.length === 0)
  const histB = await sesion.ADMIN_B.from('vinculos_historial').select('empresa_id').eq('persona_id', alta.datos?.persona_id)
  comprobar('Admin B NO ve su historial en A', histB.data?.every((h) => h.empresa_id === ID[RUC_B]))

  // Se deja como estaba: cesada también en B, para que el paso 4 se pueda repetir.
  await sesion.ADMIN_B.rpc('cesar_vinculo', { p_vinculo: alta.datos?.vinculo_id, p_fecha_cese: '2026-10-22', p_motivo: 'Fin de la prueba de cambio de empresa (ficticio)' })
}

// ───────────────────────────────────────────────
seccion('7. El dueño de la plataforma ve todas las empresas')
{
  const r = await dueno.from('empresas').select('ruc')
  const rucs = r.data?.map((e) => e.ruc) ?? []
  comprobar('El dueño ve A y B (y las demás empresas de prueba)', rucs.includes(RUC_A) && rucs.includes(RUC_B), `${rucs.length} empresas`)
}

// ───────────────────────────────────────────────
seccion('8. Ampliación 3.2: sedes, contactos y logos tampoco cruzan entre empresas')
{
  const { data: logoB } = await dueno.from('empresas').select('logo_positivo').eq('id', ID[RUC_B]).single()
  for (const [n, propia, ajena] of [['ADMIN_A', RUC_A, RUC_B], ['GESTOR_A', RUC_A, RUC_B], ['USUARIO_A2', RUC_A, RUC_B], ['ADMIN_B', RUC_B, RUC_A], ['GESTOR_B', RUC_B, RUC_A]]) {
    const c = sesion[n]
    const sedes = await c.from('sedes').select('empresa_id')
    comprobar(`${n}: solo ve sedes de su empresa`, sedes.data?.length > 0 && sedes.data.every((s) => s.empresa_id === ID[propia]), `${sedes.data?.length} sedes`)
    const contactos = await c.from('empresas_contactos').select('empresa_id')
    comprobar(`${n}: ningún contacto de la otra empresa`, !contactos.data?.some((k) => k.empresa_id === ID[ajena]))
    const carpeta = await c.storage.from('logos').list(ID[ajena])
    comprobar(`${n}: la carpeta de logos de la otra empresa se ve vacía`, (carpeta.data ?? []).length === 0)
  }
  const robo = await sesion.ADMIN_A.storage.from('logos').download(logoB.logo_positivo)
  comprobar('ADMIN_A no puede descargar el logo de B', Boolean(robo.error), robo.error?.message)
  const anon = await cliente().storage.from('logos').download(logoB.logo_positivo)
  comprobar('Sin iniciar sesión no se puede descargar ningún logo', Boolean(anon.error), anon.error?.message)
}

const fallas = resumen()

// Informe legible
const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
let md = `# Prueba de separación entre empresas · CRC tarea 3.1\n\nEjecutada: ${fecha} (hora de Lima) · Proyecto Supabase \`crc-dev\` · Solo datos ficticios.\n\n`
md += `**Resultado: ${resultados.length - fallas} de ${resultados.length} pruebas pasaron.**\n\n`
md += 'Cada prueba ingresa con una persona de prueba por la misma puerta que usa la app (clave pública + reglas RLS) e intenta ver o tocar lo que no le corresponde.\n'
grupos.forEach((g, i) => {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  md += `\n## ${g.titulo}\n\n| Resultado | Prueba | Detalle |\n|---|---|---|\n`
  for (const r of resultados.slice(g.desde, hasta)) md += `| ${r.paso ? '✅ Pasa' : '❌ Falla'} | ${r.nombre} | ${String(r.detalle ?? '').replace(/\|/g, '/')} |\n`
})
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/separacion-entre-empresas.md', md)
console.log('Informe: pruebas/resultados/separacion-entre-empresas.md')
process.exit(fallas ? 1 : 0)
