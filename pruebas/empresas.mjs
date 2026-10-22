// Tarea 3.2 · Pruebas del registro de empresas (pasos 5 y 6). Solo datos FICTICIOS en crc-dev.
// Ingresa como cada persona de prueba, por la misma puerta que la app, e intenta ver o tocar lo que no le corresponde.
// Guarda un informe en pruebas/resultados/registro-de-empresas.md
// Uso: node pruebas/empresas.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { PNG_FICTICIO, cliente, comprobar, ingresarComo, resultados, resumen } from './comun.mjs'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }
const NO_AUTORIZADO = (r) => r.error?.message === 'No autorizado' || r.error?.code === '42501' || /permission denied|row-level security|not allowed|Unauthorized/i.test(r.error?.message ?? '')

const { c: dueno } = await ingresarComo('DUENO')
const { data: todas } = await dueno.from('empresas').select('id, ruc, razon_social, logo_positivo, plan, es_prueba')
const A = todas.find((e) => e.ruc === '20000000010')
const B = todas.find((e) => e.ruc === '20000000028')
const { data: sedesB } = await dueno.from('sedes').select('id').eq('empresa_id', B.id)
const { data: sedesA } = await dueno.from('sedes').select('id').eq('empresa_id', A.id)

const sesion = {}
for (const n of ['ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  sesion[n] = c
}
const fichaDe = (e, cambios = {}) => ({ ruc: e.ruc, razon_social: e.razon_social, domicilio_direccion: 'Calle Inventada 789', domicilio_distrito: 'Miraflores',
  domicilio_provincia: 'Lima', domicilio_departamento: 'Lima', ciiu_codigo: '4100', actividad_texto: 'Intento indebido', plan: e.plan, es_prueba: e.es_prueba, ...cambios })

// ───────────────────────────────────────────────
seccion('1. Una empresa no ve la ficha, sedes, contactos ni logos de la otra')
for (const n of ['ADMIN_A', 'GESTOR_A', 'USUARIO_A2']) {
  const c = sesion[n]
  const f = await c.from('empresas').select('id').eq('id', B.id)
  comprobar(`${n}: la ficha de B no aparece (0 filas)`, f.data?.length === 0)
  const s = await c.from('sedes').select('id').eq('empresa_id', B.id)
  comprobar(`${n}: 0 sedes de B`, s.data?.length === 0)
  const k = await c.from('empresas_contactos').select('nombre').eq('empresa_id', B.id)
  comprobar(`${n}: 0 contactos de B`, k.data?.length === 0)
  const l = await c.storage.from('logos').download(B.logo_positivo)
  comprobar(`${n}: no puede descargar el logo de B`, Boolean(l.error) && !l.data, l.error?.message)
  const lista = await c.storage.from('logos').list(B.id)
  comprobar(`${n}: la carpeta de logos de B se ve vacía`, (lista.data ?? []).length === 0)
}
{
  const c = sesion.ADMIN_B
  const f = await c.from('empresas').select('id').eq('id', A.id)
  const k = await c.from('empresas_contactos').select('nombre').eq('empresa_id', A.id)
  comprobar('Al revés: ADMIN_B no ve la ficha ni los contactos de A', f.data?.length === 0 && k.data?.length === 0)
}

// ───────────────────────────────────────────────
seccion('2. El logo de A no se puede leer ni escribir desde B')
{
  const b = sesion.ADMIN_B
  const leer = await b.storage.from('logos').download(`${A.id}/positivo.png`)
  comprobar('ADMIN_B no puede leer el logo de A', Boolean(leer.error), leer.error?.message)
  const subir = await b.storage.from('logos').upload(`${A.id}/positivo.png`, PNG_FICTICIO, { contentType: 'image/png', upsert: true })
  comprobar('ADMIN_B no puede reemplazar el logo de A', Boolean(subir.error), subir.error?.message)
  const nuevo = await b.storage.from('logos').upload(`${A.id}/negativo.webp`, PNG_FICTICIO, { contentType: 'image/webp' })
  comprobar('ADMIN_B no puede subir un logo nuevo en la carpeta de A', Boolean(nuevo.error), nuevo.error?.message)
  const borrar = await b.storage.from('logos').remove([`${A.id}/positivo.png`])
  const sigue = await dueno.storage.from('logos').list(A.id)
  comprobar('ADMIN_B no puede borrar el logo de A (sigue en su lugar)', (borrar.data ?? []).length === 0 && sigue.data?.some((f) => f.name.startsWith('positivo')))
  const anotar = await b.rpc('registrar_logo', { p_empresa: A.id, p_tipo: 'positivo', p_ruta: `${A.id}/positivo.png` })
  comprobar('ADMIN_B no puede cambiar qué logo usa A', NO_AUTORIZADO(anotar), anotar.error?.message)
}

// ───────────────────────────────────────────────
seccion('3. Solo el dueño de la plataforma crea empresas y sedes')
{
  const nueva = { ruc: '20000000044', razon_social: 'EMPRESA D · Intento Ficticia S.A.C.', domicilio_direccion: 'Calle Falsa 1', domicilio_distrito: 'Lima',
    domicilio_provincia: 'Lima', domicilio_departamento: 'Lima', ciiu_codigo: '4100', actividad_texto: 'Intento', plan: 'gratuito', es_prueba: true }
  const sede = { nombre: 'Sede intento', direccion: 'Calle Falsa 1', distrito: 'Lima', provincia: 'Lima', departamento: 'Lima' }
  for (const n of ['ADMIN_A', 'GESTOR_A', 'USUARIO_A2']) {
    const r = await sesion[n].rpc('crear_empresa', { p_ficha: nueva, p_sede: sede })
    comprobar(`${n} NO puede crear empresas`, NO_AUTORIZADO(r), r.error?.message)
    const s = await sesion[n].rpc('guardar_sede', { p_empresa: A.id, p_sede: null, p_datos: sede })
    comprobar(`${n} NO puede agregar sedes (ni en su propia empresa)`, NO_AUTORIZADO(s), s.error?.message)
  }
  const anon = await cliente().rpc('crear_empresa', { p_ficha: nueva, p_sede: sede })
  comprobar('Sin iniciar sesión NO se pueden crear empresas', NO_AUTORIZADO(anon), anon.error?.message)
  const directo = await sesion.ADMIN_A.from('empresas').insert({ ruc: '20000000044', razon_social: 'Directo Ficticia' })
  comprobar('Nadie puede insertar empresas directo en la tabla', NO_AUTORIZADO(directo), directo.error?.message)
  const directoSede = await sesion.ADMIN_A.from('sedes').insert({ empresa_id: A.id, nombre: 'x', direccion: 'xxx', distrito: 'x', provincia: 'x', departamento: 'x' })
  comprobar('Nadie puede insertar sedes directo en la tabla', NO_AUTORIZADO(directoSede), directoSede.error?.message)
  const { count } = await dueno.from('empresas').select('id', { count: 'exact', head: true }).eq('ruc', '20000000044')
  comprobar('Ningún intento dejó una empresa creada', count === 0)
}

// ───────────────────────────────────────────────
seccion('4. Un administrador no puede editar otra empresa (ni la ficha de la suya)')
{
  const a = sesion.ADMIN_A
  const ficha = await a.rpc('actualizar_empresa', { p_empresa: B.id, p_ficha: fichaDe(B) })
  comprobar('ADMIN_A NO puede editar la ficha de B', NO_AUTORIZADO(ficha), ficha.error?.message)
  const cont = await a.rpc('guardar_contactos', { p_empresa: B.id, p_datos: { representante_legal: { nombre: 'Intruso Ficticio', telefono: '900000099', correo: 'x@ficticio.invalid' }, administrador: { nombre: 'Intruso Ficticio', telefono: '900000099', correo: 'x@ficticio.invalid' } } })
  comprobar('ADMIN_A NO puede cambiar los contactos de B', NO_AUTORIZADO(cont), cont.error?.message)
  const est = await a.rpc('cambiar_estado_empresa', { p_empresa: B.id, p_estado: 'suspendida' })
  comprobar('ADMIN_A NO puede suspender a B', NO_AUTORIZADO(est), est.error?.message)
  const sedeB = await a.rpc('cambiar_estado_sede', { p_sede: sedesB[0].id, p_activa: false })
  comprobar('ADMIN_A NO puede desactivar sedes de B', NO_AUTORIZADO(sedeB), sedeB.error?.message)
  const propia = await a.rpc('actualizar_empresa', { p_empresa: A.id, p_ficha: fichaDe(A) })
  comprobar('ADMIN_A NO puede editar la ficha legal de su propia empresa (solo el dueño)', NO_AUTORIZADO(propia), propia.error?.message)
  const sedePropia = await a.rpc('cambiar_estado_sede', { p_sede: sedesA[0].id, p_activa: false })
  comprobar('ADMIN_A NO puede desactivar sedes de su propia empresa (solo el dueño)', NO_AUTORIZADO(sedePropia), sedePropia.error?.message)
  const directo = await a.from('empresas').update({ razon_social: 'Cambio indebido Ficticia' }).eq('id', B.id)
  comprobar('Nadie puede modificar empresas directo en la tabla', NO_AUTORIZADO(directo), directo.error?.message)
  const { data: bSigue } = await dueno.from('empresas').select('razon_social, estado').eq('id', B.id).single()
  comprobar('La empresa B quedó intacta', bSigue.razon_social === B.razon_social && bSigue.estado === 'activa')
}

// ───────────────────────────────────────────────
seccion('5. Vista de la empresa: qué puede hacer cada rol de A con su propia empresa')
{
  const a = sesion.ADMIN_A
  const ficha = await a.from('empresas').select('razon_social, ciiu_codigo, actividad_texto').eq('id', A.id)
  comprobar('ADMIN_A ve su ficha', ficha.data?.length === 1 && Boolean(ficha.data[0].ciiu_codigo))
  const sedes = await a.from('sedes').select('id').eq('empresa_id', A.id)
  comprobar('ADMIN_A ve sus sedes', sedes.data?.length >= 1)
  const contactos = {
    representante_legal: { nombre: 'PRUEBA REPRESENTANTE A, Rosa (ficticia)', telefono: '900000001', correo: 'representante.a@ficticio.invalid' },
    administrador: { nombre: 'PRUEBA CONTACTO A, Luis (ficticio)', telefono: '900000002', correo: 'contacto.a@ficticio.invalid' },
    respaldo: { nombre: 'PRUEBA RESPALDO A, Sara (ficticia)', telefono: '900000003', correo: 'respaldo.a@ficticio.invalid' },
  }
  const g = await a.rpc('guardar_contactos', { p_empresa: A.id, p_datos: contactos })
  comprobar('ADMIN_A SÍ puede editar los contactos de su empresa', !g.error, g.error?.message)
  const vistos = await a.from('empresas_contactos').select('tipo').eq('empresa_id', A.id)
  comprobar('ADMIN_A ve los 3 contactos de su empresa', vistos.data?.length === 3)
  const up = await a.storage.from('logos').upload(`${A.id}/negativo.png`, PNG_FICTICIO, { contentType: 'image/png', upsert: true })
  const reg = up.error ? up : await a.rpc('registrar_logo', { p_empresa: A.id, p_tipo: 'negativo', p_ruta: `${A.id}/negativo.png` })
  comprobar('ADMIN_A SÍ puede cambiar los logos de su empresa', !reg.error, reg.error?.message)

  for (const n of ['GESTOR_A', 'USUARIO_A2']) {
    const c = sesion[n]
    const f = await c.from('empresas').select('razon_social').eq('id', A.id)
    comprobar(`${n} ve la ficha básica de su empresa (para encabezados)`, f.data?.length === 1)
    const k = await c.from('empresas_contactos').select('nombre').eq('empresa_id', A.id)
    comprobar(`${n} NO ve los contactos (datos personales) de su empresa`, k.data?.length === 0)
    const l = await c.storage.from('logos').download(`${A.id}/positivo.png`)
    comprobar(`${n} SÍ puede ver el logo de su empresa`, !l.error, l.error?.message)
    const gc = await c.rpc('guardar_contactos', { p_empresa: A.id, p_datos: contactos })
    comprobar(`${n} NO puede editar contactos`, NO_AUTORIZADO(gc), gc.error?.message)
    const ul = await c.storage.from('logos').upload(`${A.id}/positivo.png`, PNG_FICTICIO, { contentType: 'image/png', upsert: true })
    comprobar(`${n} NO puede cambiar logos`, Boolean(ul.error), ul.error?.message)
  }
}

// ───────────────────────────────────────────────
seccion('6. Validaciones: RUC, CIIU, marca de prueba y archivos')
{
  const base = { razon_social: 'EMPRESA X · Validación Ficticia S.A.C.', domicilio_direccion: 'Calle Falsa 1', domicilio_distrito: 'Lima', domicilio_provincia: 'Lima',
    domicilio_departamento: 'Lima', ciiu_codigo: '4100', actividad_texto: 'Validación', plan: 'gratuito', es_prueba: true }
  const sede = { nombre: 'Sede', direccion: 'Calle Falsa 1', distrito: 'Lima', provincia: 'Lima', departamento: 'Lima' }
  for (const [ruc, porque] of [['20000000037', 'dígito verificador incorrecto'], ['30000000036', 'prefijo no válido'], ['2000000003', 'solo 10 dígitos'], ['2000000003A', 'con una letra']]) {
    const r = await dueno.rpc('crear_empresa', { p_ficha: { ...base, ruc }, p_sede: sede })
    comprobar(`RUC ${ruc} rechazado (${porque})`, /RUC no es válido/.test(r.error?.message ?? ''), r.error?.message)
  }
  const ciiu = await dueno.rpc('crear_empresa', { p_ficha: { ...base, ruc: '20000000044', ciiu_codigo: '9810' }, p_sede: sede })
  comprobar('CIIU 9810 rechazado (SUNAT lo marca «NO USAR»)', /CIIU/.test(ciiu.error?.message ?? ''), ciiu.error?.message)
  const inventado = await dueno.rpc('crear_empresa', { p_ficha: { ...base, ruc: '20000000044', ciiu_codigo: '9999' }, p_sede: sede })
  comprobar('CIIU inexistente rechazado', /CIIU/.test(inventado.error?.message ?? ''), inventado.error?.message)
  const sinMarca = await dueno.rpc('crear_empresa', { p_ficha: { ...base, ruc: '20000000044', razon_social: 'EMPRESA X Real S.A.C.' }, p_sede: sede })
  comprobar('Una empresa de prueba sin «Ficticia» en la razón social se rechaza', Boolean(sinMarca.error), sinMarca.error?.message)
  const sinSede = await dueno.rpc('crear_empresa', { p_ficha: { ...base, ruc: '20000000044' }, p_sede: {} })
  comprobar('No se puede crear una empresa sin su primera sede', Boolean(sinSede.error), sinSede.error?.message)
  const { count } = await dueno.from('empresas').select('id', { count: 'exact', head: true }).eq('ruc', '20000000044')
  comprobar('Ningún intento inválido dejó una empresa a medias', count === 0)

  const a = sesion.ADMIN_A
  const texto = await a.storage.from('logos').upload(`${A.id}/positivo.png`, Buffer.from('<html>no soy imagen</html>'), { contentType: 'text/html', upsert: true })
  comprobar('El almacén rechaza archivos que no son imagen', Boolean(texto.error), texto.error?.message)
  const grande = await a.storage.from('logos').upload(`${A.id}/positivo.png`, Buffer.alloc(1100000), { contentType: 'image/png', upsert: true })
  comprobar('El almacén rechaza imágenes de más de 1 MB', Boolean(grande.error), grande.error?.message)
  const otraRuta = await a.storage.from('logos').upload(`${A.id}/otro-nombre.png`, PNG_FICTICIO, { contentType: 'image/png' })
  comprobar('Solo se aceptan los nombres positivo/negativo dentro de la carpeta de la empresa', Boolean(otraRuta.error), otraRuta.error?.message)
}

// ───────────────────────────────────────────────
seccion('7. Empresa suspendida: nadie de ella puede ingresar')
{
  const s = await dueno.rpc('cambiar_estado_empresa', { p_empresa: B.id, p_estado: 'suspendida' })
  comprobar('El dueño suspende la empresa B', !s.error, s.error?.message)
  const renov = await sesion.ADMIN_B.auth.refreshSession()
  comprobar('La sesión abierta de ADMIN_B se cerró al suspender', Boolean(renov.error), renov.error?.message)
  const ing = await ingresarComo('ADMIN_B')
  comprobar('ADMIN_B no puede ingresar mientras B está suspendida', /inhabilitada/.test(ing.error?.message ?? ''), ing.error?.message)
  const ingA = await ingresarComo('ADMIN_A')
  comprobar('La empresa A no se ve afectada', !ingA.error, ingA.error?.message)
  const r = await dueno.rpc('cambiar_estado_empresa', { p_empresa: B.id, p_estado: 'activa' })
  const vuelve = await ingresarComo('ADMIN_B')
  comprobar('Al reactivar B, ADMIN_B vuelve a ingresar', !r.error && !vuelve.error, vuelve.error?.message)
}

const fallas = resumen()
const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
let md = `# Pruebas del registro de empresas · CRC tarea 3.2\n\nEjecutadas: ${fecha} (hora de Lima) · Proyecto Supabase \`crc-dev\` · Solo datos ficticios.\n\n`
md += `**Resultado: ${resultados.length - fallas} de ${resultados.length} pruebas pasaron.**\n\n`
md += 'Cada prueba ingresa con una persona ficticia por la misma puerta que usa la app (clave pública + reglas RLS de la base de datos y del almacén de logos).\n'
grupos.forEach((g, i) => {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  md += `\n## ${g.titulo}\n\n| Resultado | Prueba | Detalle |\n|---|---|---|\n`
  for (const r of resultados.slice(g.desde, hasta)) md += `| ${r.paso ? '✅ Pasa' : '❌ Falla'} | ${r.nombre} | ${String(r.detalle ?? '').replace(/\|/g, '/')} |\n`
})
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/registro-de-empresas.md', md)
console.log('Informe: pruebas/resultados/registro-de-empresas.md')
process.exit(fallas ? 1 : 0)
