// Prueba de formatos de inspección, activos y listas (tarea 3.4-B). Solo cuentas y datos FICTICIOS de crc-dev.
// Ingresa como cada persona de prueba por la misma puerta que usa la app (clave pública + RLS) e intenta ver o
// tocar lo que no le corresponde. Cada corrida deja unos pocos datos ficticios más (códigos al azar).
// Guarda un informe en pruebas/resultados/. Uso: node pruebas/formatos.mjs
import { randomInt } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PLANTILLAS_BASE } from '../src/formatos/base.ts'
import { cliente, comprobar, ingresarComo, resultados, resumen } from './comun.mjs'

const grupos = []
function seccion(titulo) {
  grupos.push({ titulo, desde: resultados.length })
  console.log(`\n── ${titulo}`)
}
const NO_AUTORIZADO = (r) => r.error?.code === '42501' || /No autorizado|permission denied/i.test(r.error?.message ?? '')
const RECHAZADO = (r) => Boolean(r.error)
const SUFIJO = String(randomInt(10000, 99999))
const TABLAS = ['listas', 'listas_valores', 'tipos_activo', 'ubicaciones', 'activos', 'activos_historial', 'plantillas', 'plantillas_versiones']

/** JSON con las claves ordenadas (la base de datos reordena las claves de jsonb). */
const canon = (v) =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v

const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  s[n] = c
}
const { data: empresas } = await s.DUENO.from('empresas').select('id, ruc')
const A = empresas.find((e) => e.ruc === '20000000010').id
const B = empresas.find((e) => e.ruc === '20000000028').id
const sedeDe = async (emp) => (await s.DUENO.from('sedes').select('id').eq('empresa_id', emp).eq('activa', true).limit(1).single()).data.id
const areaDe = async (emp) => (await s.DUENO.from('unidades').select('id').eq('empresa_id', emp).eq('nivel', 'area').limit(1).single()).data.id
const personaActiva = async (emp, rol) =>
  (await s.DUENO.from('vinculos').select('persona_id').eq('empresa_id', emp).eq('estado', 'activo').eq('rol', rol).limit(1).single()).data.persona_id
const SEDE_A = await sedeDe(A)
const SEDE_B = await sedeDe(B)
const AREA_A = await areaDe(A)
const AREA_B = await areaDe(B)
const PERSONA_A = await personaActiva(A, 'gestor')
const PERSONA_B = await personaActiva(B, 'gestor')
const base = (await s.ADMIN_A.from('plantillas').select('id, codigo, tipo_activo_id').is('empresa_id', null)).data
const baseId = (codigo) => base.find((p) => p.codigo === codigo).id
const tiposBase = (await s.ADMIN_A.from('tipos_activo').select('id, codigo').is('empresa_id', null)).data
const tipoBase = (codigo) => tiposBase.find((t) => t.codigo === codigo).id

// ───────────────────────────────────────────────
seccion('1. Sin sesión no se ve nada')
{
  const anon = cliente()
  for (const t of TABLAS) {
    const r = await anon.from(t).select('*').limit(1)
    comprobar(`Sin sesión: ${t} no devuelve filas`, Boolean(r.error) || r.data.length === 0, r.error?.message ?? `${r.data.length} filas`)
  }
  const r = await anon.rpc('copiar_plantilla', { p_empresa: A, p_origen: baseId('extintores') })
  comprobar('Sin sesión: no se puede llamar a ninguna acción (copiar plantilla)', RECHAZADO(r), r.error?.message)
}

// ───────────────────────────────────────────────
seccion('2. Contenido base de CRC: lo ven todos, nadie de una empresa lo cambia')
{
  const u = s.USUARIO_A2
  const pl = await u.from('plantillas').select('codigo').is('empresa_id', null)
  comprobar('Usuario A2 ve las 6 plantillas base', pl.data?.length === 6, `${pl.data?.length}`)
  const vs = await s.ADMIN_B.from('plantillas_versiones').select('receta, huella, estado, plantillas(codigo)').is('empresa_id', null)
  const iguales = PLANTILLAS_BASE.every((p) => {
    const v = vs.data.find((x) => x.plantillas.codigo === p.codigo)
    return v && v.estado === 'vigente' && v.huella && JSON.stringify(canon(v.receta)) === JSON.stringify(canon(p.receta))
  })
  comprobar('Las 6 recetas guardadas son idénticas al anexo (src/formatos/base.ts) y están publicadas con huella', iguales)
  const tipos = await u.from('tipos_activo').select('codigo').is('empresa_id', null)
  comprobar('Hay 4 tipos de activo base', tipos.data?.length === 4)
  const vbase = (await s.ADMIN_A.from('plantillas_versiones').select('id').is('empresa_id', null).limit(1).single()).data.id
  const r1 = await s.ADMIN_A.rpc('guardar_borrador', { p_version: vbase, p_datos: { receta: PLANTILLAS_BASE[0].receta } })
  comprobar('Admin A no puede editar una versión base', NO_AUTORIZADO(r1), r1.error?.message)
  const r2 = await s.ADMIN_A.rpc('nuevo_borrador', { p_plantilla: baseId('extintores') })
  comprobar('Admin A no puede abrir un borrador de una plantilla base', NO_AUTORIZADO(r2), r2.error?.message)
  const r3 = await s.ADMIN_A.rpc('publicar_version', { p_version: vbase })
  comprobar('Admin A no puede publicar una versión base', NO_AUTORIZADO(r3), r3.error?.message)
}

// ───────────────────────────────────────────────
seccion('3. Nadie escribe directo en las tablas nuevas')
for (const t of TABLAS) {
  const ins = await s.ADMIN_A.from(t).insert({ empresa_id: A }).select()
  comprobar(`Admin A no puede insertar directo en ${t}`, RECHAZADO(ins), ins.error?.message)
  const upd = await s.DUENO.from(t).update({ empresa_id: A }).is('empresa_id', null).select()
  comprobar(`Ni el dueño puede cambiar directo ${t}`, RECHAZADO(upd) || upd.data.length === 0, upd.error?.message)
  const del = await s.DUENO.from(t).delete().not('id', 'is', null).select()
  comprobar(`Ni el dueño puede borrar directo en ${t}`, RECHAZADO(del) || del.data.length === 0, del.error?.message)
}

// ───────────────────────────────────────────────
seccion('4. Copiar una plantilla base y editarla (constructor)')
let plantillaA, versionA
{
  const huellaAntes = (await s.ADMIN_A.from('plantillas_versiones').select('huella').eq('plantilla_id', baseId('extintores')).single()).data.huella
  const r = await s.GESTOR_A.rpc('copiar_plantilla', { p_empresa: A, p_origen: baseId('extintores') })
  comprobar('Gestor A puede copiar la plantilla base de extintores a su empresa', !r.error && Boolean(r.data), r.error?.message)
  plantillaA = r.data
  const v = (await s.GESTOR_A.from('plantillas_versiones').select('id, numero, estado, receta').eq('plantilla_id', plantillaA).single()).data
  versionA = v.id
  comprobar('La copia nace como borrador v1', v.numero === 1 && v.estado === 'borrador')
  const tipoA = await s.GESTOR_A.from('tipos_activo').select('id, base_id').eq('empresa_id', A).eq('codigo', 'extintor')
  comprobar('Al copiar, la empresa recibe su propio tipo «extintor»', tipoA.data?.length === 1 && tipoA.data[0].base_id === tipoBase('extintor'))
  const listasA = await s.GESTOR_A.from('listas').select('codigo').eq('empresa_id', A)
  const codigos = listasA.data?.map((l) => l.codigo) ?? []
  comprobar('…y sus listas (agentes, unidades, soportes)', ['agentes_extintores', 'unidades_capacidad', 'tipos_soporte'].every((c) => codigos.includes(c)), codigos.join(', '))

  const receta = structuredClone(v.receta)
  receta.secciones[0].puntos[0].texto = 'Está en su lugar asignado (texto adaptado por la empresa ficticia A)'
  receta.secciones[0].puntos.push({ ...receta.secciones[0].puntos[0], clave: 'EXT-14', texto: 'Punto propio de la empresa ficticia A' })
  receta.reglas[0].controles[1].anios = 5 // la empresa pone su plazo de prueba hidrostática
  const g = await s.GESTOR_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta, logo: 'negativo', codigo_formato: `FIC-EXT-${SUFIJO}`, version_formato: '01', fecha_aprobacion: '2026-10-26' } })
  comprobar('Gestor A puede editar el borrador (texto, punto nuevo, plazo, código, versión, fecha y logo)', !g.error, g.error?.message)
  const huellaDespues = (await s.ADMIN_A.from('plantillas_versiones').select('huella, receta').eq('plantilla_id', baseId('extintores')).single()).data
  comprobar('La plantilla base no cambió (misma huella y mismo texto)', huellaDespues.huella === huellaAntes && huellaDespues.receta.secciones[0].puntos.length === 13)

  const dup = structuredClone(receta)
  dup.secciones[0].puntos.push({ ...dup.secciones[0].puntos[1] })
  const r1 = await s.GESTOR_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: dup } })
  comprobar('No se puede guardar una clave repetida', /repetida/.test(r1.error?.message ?? ''), r1.error?.message)
  const sev = structuredClone(receta)
  sev.secciones[0].puntos[0].severidad = 'alta'
  const r2 = await s.GESTOR_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: sev } })
  comprobar('No se puede poner severidad (queda para la v1.1)', /severidad/.test(r2.error?.message ?? ''), r2.error?.message)
  const malRegla = structuredClone(receta)
  malRegla.reglas.push({ tipo: 'respuesta', etiqueta: 'X', clave: 'NO-EXISTE', valor: 'no' })
  const r3 = await s.GESTOR_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: malRegla } })
  comprobar('No se puede guardar una regla que usa un punto inexistente', RECHAZADO(r3), r3.error?.message)
  const malTipo = structuredClone(receta)
  malTipo.secciones[0].puntos[0].tipo = 'codigo_libre'
  const r4 = await s.GESTOR_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: malTipo } })
  comprobar('No se puede guardar un tipo de respuesta que no existe', RECHAZADO(r4), r4.error?.message)
}

// ───────────────────────────────────────────────
seccion('5. Publicar y versiones (lo publicado no cambia)')
{
  const r1 = await s.GESTOR_A.rpc('publicar_version', { p_version: versionA })
  comprobar('Gestor A NO puede publicar (solo el administrador)', NO_AUTORIZADO(r1), r1.error?.message)
  const r2 = await s.USUARIO_A2.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: PLANTILLAS_BASE[0].receta } })
  comprobar('Usuario A2 no puede editar formatos', NO_AUTORIZADO(r2), r2.error?.message)
  const r3 = await s.ADMIN_A.rpc('publicar_version', { p_version: versionA })
  comprobar('Admin A publica la v1', !r3.error, r3.error?.message)
  const v1 = (await s.ADMIN_A.from('plantillas_versiones').select('estado, huella, receta, publicado_por').eq('id', versionA).single()).data
  comprobar('La v1 queda vigente, con huella y con quién la publicó', v1.estado === 'vigente' && /^[0-9a-f]{64}$/.test(v1.huella) && Boolean(v1.publicado_por))
  const r4 = await s.ADMIN_A.rpc('guardar_borrador', { p_version: versionA, p_datos: { receta: v1.receta } })
  comprobar('Una versión publicada no se puede editar', RECHAZADO(r4), r4.error?.message)
  const r5 = await s.ADMIN_A.rpc('descartar_borrador', { p_version: versionA })
  comprobar('Una versión publicada no se puede descartar', RECHAZADO(r5), r5.error?.message)
  const nb = await s.GESTOR_A.rpc('nuevo_borrador', { p_plantilla: plantillaA })
  comprobar('Gestor A abre un borrador v2 copiando la v1', !nb.error, nb.error?.message)
  const v2 = (await s.GESTOR_A.from('plantillas_versiones').select('id, numero, receta').eq('id', nb.data).single()).data
  comprobar('El borrador es la v2 y trae la receta de la v1', v2.numero === 2 && JSON.stringify(canon(v2.receta)) === JSON.stringify(canon(v1.receta)))
  const otra = await s.GESTOR_A.rpc('nuevo_borrador', { p_plantilla: plantillaA })
  comprobar('Pedir otro borrador devuelve el mismo (solo hay uno a la vez)', otra.data === nb.data)
  v2.receta.secciones[0].titulo = 'Verificación (v2 ficticia)'
  await s.GESTOR_A.rpc('guardar_borrador', { p_version: v2.id, p_datos: { receta: v2.receta, codigo_formato: `FIC-EXT-${SUFIJO}`, version_formato: '02', fecha_aprobacion: '2026-10-27' } })
  const r6 = await s.ADMIN_A.rpc('publicar_version', { p_version: v2.id })
  comprobar('Admin A publica la v2', !r6.error, r6.error?.message)
  const ambas = (await s.ADMIN_A.from('plantillas_versiones').select('numero, estado, huella, receta').eq('plantilla_id', plantillaA).order('numero')).data
  comprobar('La v1 queda retirada sin ningún cambio (misma huella y receta) y la v2 vigente',
    ambas[0].estado === 'retirada' && ambas[0].huella === v1.huella && ambas[0].receta.secciones[0].titulo !== 'Verificación (v2 ficticia)' && ambas[1].estado === 'vigente')
  const sinCodigo = await s.ADMIN_A.rpc('copiar_plantilla', { p_empresa: A, p_origen: baseId('car') })
  const vCar = (await s.ADMIN_A.from('plantillas_versiones').select('id').eq('plantilla_id', sinCodigo.data).single()).data.id
  const r7 = await s.ADMIN_A.rpc('publicar_version', { p_version: vCar })
  comprobar('No se publica sin código, versión y fecha de aprobación del formato', /código, la versión y la fecha/.test(r7.error?.message ?? ''), r7.error?.message)
  const r8 = await s.ADMIN_A.rpc('descartar_borrador', { p_version: vCar })
  const sigue = await s.ADMIN_A.from('plantillas').select('id').eq('id', sinCodigo.data)
  comprobar('Descartar el único borrador descarta la copia entera', !r8.error && sigue.data?.length === 0, r8.error?.message)
}

// ───────────────────────────────────────────────
seccion('6. Separación entre empresas en los formatos')
{
  for (const n of ['ADMIN_B', 'GESTOR_B']) {
    const ver = await s[n].from('plantillas').select('id').eq('id', plantillaA)
    comprobar(`${n} no ve la plantilla de A`, ver.data?.length === 0)
    const vv = await s[n].from('plantillas_versiones').select('id').eq('empresa_id', A)
    comprobar(`${n} no ve las versiones de A`, vv.data?.length === 0)
  }
  const nb = await s.ADMIN_B.rpc('nuevo_borrador', { p_plantilla: plantillaA })
  comprobar('Admin B no puede abrir borradores de A', NO_AUTORIZADO(nb), nb.error?.message)
  const cp = await s.ADMIN_B.rpc('copiar_plantilla', { p_empresa: B, p_origen: plantillaA })
  comprobar('Admin B no puede copiar a su empresa una plantilla de A', NO_AUTORIZADO(cp), cp.error?.message)
  const cp2 = await s.ADMIN_B.rpc('copiar_plantilla', { p_empresa: A, p_origen: baseId('daci') })
  comprobar('Admin B no puede crear plantillas en la empresa A', NO_AUTORIZADO(cp2), cp2.error?.message)
  const vig = await s.ADMIN_B.rpc('cambiar_vigencia_plantilla', { p_plantilla: plantillaA, p_vigente: false })
  comprobar('Admin B no puede desactivar una plantilla de A', NO_AUTORIZADO(vig), vig.error?.message)
  const listaA = (await s.ADMIN_A.from('listas').select('id').eq('empresa_id', A).eq('codigo', 'tipos_soporte').single()).data.id
  const lv = await s.ADMIN_B.rpc('guardar_valor_lista', { p_lista: listaA, p_id: null, p_nombre: 'Valor intruso' })
  comprobar('Admin B no puede agregar valores a una lista de A', NO_AUTORIZADO(lv), lv.error?.message)
  const ve = await s.ADMIN_B.from('listas').select('id').eq('empresa_id', A)
  comprobar('Admin B no ve las listas de A', ve.data?.length === 0)
  const lvb = await s.ADMIN_A.rpc('guardar_valor_lista', { p_lista: listaA, p_id: null, p_nombre: `Soporte ficticio ${SUFIJO}` })
  comprobar('Admin A sí agrega valores a su lista', !lvb.error, lvb.error?.message)
  const base = await s.ADMIN_A.from('listas_valores').select('id').is('empresa_id', null).like('nombre', 'Soporte ficticio%')
  comprobar('…y la lista base no cambia', base.data?.length === 0)
}

// ───────────────────────────────────────────────
seccion('7. Activos, ubicaciones y tipos')
{
  const tipoExt = (await s.ADMIN_A.from('tipos_activo').select('id').eq('empresa_id', A).eq('codigo', 'extintor').single()).data.id
  const tipoDaci = (await s.ADMIN_A.rpc('activar_tipo_activo', { p_empresa: A, p_tipo_base: tipoBase('dispositivo_alarma') })).data
  comprobar('Admin A activa el tipo DACI para su empresa', Boolean(tipoDaci))
  const act2 = await s.ADMIN_A.rpc('activar_tipo_activo', { p_empresa: A, p_tipo_base: tipoBase('dispositivo_alarma') })
  comprobar('Activarlo otra vez no lo duplica', act2.data === tipoDaci)
  const tb = await s.ADMIN_B.rpc('activar_tipo_activo', { p_empresa: A, p_tipo_base: tipoBase('bomba') })
  comprobar('Admin B no puede activar tipos en A', NO_AUTORIZADO(tb), tb.error?.message)
  const nuevo = await s.GESTOR_A.rpc('guardar_tipo_activo', { p_empresa: A, p_id: null, p_datos: { nombre: `Luces de emergencia ${SUFIJO}`, subtipos: [] } })
  comprobar('Gestor A crea un tipo nuevo («luces de emergencia») con la ficha básica', !nuevo.error, nuevo.error?.message)

  const ub = await s.GESTOR_A.rpc('guardar_ubicacion', { p_empresa: A, p_id: null, p_sede: SEDE_A, p_unidad: AREA_A, p_nombre: `Pasillo ficticio ${SUFIJO}` })
  comprobar('Gestor A crea una ubicación en su sede y área', !ub.error, ub.error?.message)
  const ubB = await s.ADMIN_A.rpc('guardar_ubicacion', { p_empresa: A, p_id: null, p_sede: SEDE_B, p_unidad: null, p_nombre: 'Ubicación intrusa' })
  comprobar('Admin A no puede crear una ubicación en una sede de B', RECHAZADO(ubB), ubB.error?.message)
  const ubAr = await s.ADMIN_A.rpc('guardar_ubicacion', { p_empresa: A, p_id: null, p_sede: SEDE_A, p_unidad: AREA_B, p_nombre: 'Ubicación con área ajena' })
  comprobar('…ni asociarla a un área de B', RECHAZADO(ubAr), ubAr.error?.message)

  const ficha = (codigo, extra = {}) => ({
    tipo_id: tipoExt, codigo, sede_id: SEDE_A, unidad_id: AREA_A, ubicacion_id: ub.data, responsable_id: PERSONA_A,
    datos: { numero_serie: 'SER-FICTICIA', agente: 'PQS', capacidad: 6, capacidad_unidad: 'kg', anio_fabricacion: 2020, ultimo_mantenimiento: '2026-03' },
    ...extra,
  })
  const e1 = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-F${SUFIJO}`) })
  comprobar('Gestor A da de alta un extintor', !e1.error, e1.error?.message)
  const ext = (await s.GESTOR_A.from('activos').select('numero, datos, estado').eq('id', e1.data).single()).data
  comprobar('El próximo mantenimiento se calcula solo (+12 meses: 2027-03)', ext.datos.proximo_mantenimiento === '2027-03', ext.datos.proximo_mantenimiento)
  const dupl = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`ext-f${SUFIJO}`) })
  comprobar('No se repite el código en el mismo tipo (sin importar mayúsculas)', /Ya existe/.test(dupl.error?.message ?? ''), dupl.error?.message)
  const malLista = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-L${SUFIJO}`, { datos: { ...ficha('').datos, agente: 'Agente inventado' } }) })
  comprobar('Un agente que no está en la lista de la empresa se rechaza', RECHAZADO(malLista), malLista.error?.message)
  const falta = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-S${SUFIJO}`, { datos: { agente: 'PQS' } }) })
  comprobar('Sin los datos obligatorios de la ficha se rechaza', /Falta/.test(falta.error?.message ?? ''), falta.error?.message)
  const respB = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-R${SUFIJO}`, { responsable_id: PERSONA_B }) })
  comprobar('El responsable no puede ser de otra empresa', RECHAZADO(respB), respB.error?.message)
  const sedeB = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-B${SUFIJO}`, { sede_id: SEDE_B, ubicacion_id: null }) })
  comprobar('La sede no puede ser de otra empresa', RECHAZADO(sedeB), sedeB.error?.message)
  const usu = await s.USUARIO_A2.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: ficha(`EXT-U${SUFIJO}`) })
  comprobar('Usuario A2 no puede dar de alta activos', NO_AUTORIZADO(usu), usu.error?.message)
  const enB = await s.ADMIN_B.rpc('guardar_activo', { p_empresa: null, p_id: e1.data, p_datos: ficha(`EXT-F${SUFIJO}`) })
  comprobar('Admin B no puede editar un activo de A', NO_AUTORIZADO(enB), enB.error?.message)
  const verB = await s.ADMIN_B.from('activos').select('id').eq('empresa_id', A)
  comprobar('Admin B no ve los activos de A', verB.data?.length === 0)
  const histB = await s.ADMIN_B.from('activos_historial').select('id').eq('activo_id', e1.data)
  comprobar('Admin B no ve el historial de los activos de A', histB.data?.length === 0)

  const sinModelo = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipoDaci, codigo: `P-${SUFIJO}`, subtipo: 'panel', sede_id: SEDE_A } })
  comprobar('Un panel DACI sin modelo se rechaza (obligatorio solo para panel)', /Modelo/.test(sinModelo.error?.message ?? ''), sinModelo.error?.message)
  const d1 = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipoDaci, codigo: `S1-${SUFIJO}`, subtipo: 'pulsador', sede_id: SEDE_A } })
  const d2 = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipoDaci, codigo: `S2-${SUFIJO}`, subtipo: 'pulsador', sede_id: SEDE_A } })
  const nums = (await s.GESTOR_A.from('activos').select('id, numero').in('id', [d1.data, d2.data])).data
  const n1 = nums.find((x) => x.id === d1.data)?.numero
  const n2 = nums.find((x) => x.id === d2.data)?.numero
  comprobar('Los pulsadores reciben número de ítem correlativo', n1 != null && n2 === n1 + 1, `${n1} → ${n2}`)
  const sinSub = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: A, p_id: null, p_datos: { tipo_id: tipoDaci, codigo: `X-${SUFIJO}`, sede_id: SEDE_A } })
  comprobar('Un dispositivo DACI sin subtipo se rechaza', /subtipo/.test(sinSub.error?.message ?? ''), sinSub.error?.message)

  const baja = await s.GESTOR_A.rpc('dar_baja_activo', { p_id: e1.data, p_fecha: '2026-10-26', p_motivo: 'Baja ficticia de prueba' })
  comprobar('Gestor A da de baja el extintor (con fecha y motivo)', !baja.error, baja.error?.message)
  const sigue = await s.GESTOR_A.from('activos').select('estado').eq('id', e1.data).single()
  comprobar('El activo no se borra: queda «baja»', sigue.data?.estado === 'baja')
  const editarBaja = await s.GESTOR_A.rpc('guardar_activo', { p_empresa: null, p_id: e1.data, p_datos: ficha(`EXT-F${SUFIJO}`) })
  comprobar('Un activo de baja no se edita', RECHAZADO(editarBaja), editarBaja.error?.message)
  const reac = await s.GESTOR_A.rpc('reactivar_activo', { p_id: e1.data })
  comprobar('Se puede reactivar', !reac.error, reac.error?.message)
  const hist = (await s.GESTOR_A.from('activos_historial').select('accion').eq('activo_id', e1.data).order('id')).data.map((h) => h.accion)
  comprobar('El historial guarda alta, baja y reactivación', hist.join(',') === 'alta,baja,reactivacion', hist.join(', '))
  const delDir = await s.ADMIN_A.from('activos').delete().eq('id', e1.data).select()
  comprobar('Nadie puede borrar el activo directo', RECHAZADO(delDir) || delDir.data.length === 0)
}

// ───────────────────────────────────────────────
const fallas = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
const lineas = [
  '# Formatos de inspección, activos y listas (tarea 3.4-B)',
  '',
  `Fecha: ${new Date().toISOString().slice(0, 10)} · Resultado: **${resultados.length - fallas} de ${resultados.length}** · Cuentas y datos ficticios de crc-dev.`,
  '',
]
for (const [i, g] of grupos.entries()) {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  lineas.push(`## ${g.titulo}`, '', '| Prueba | Resultado |', '|---|---|')
  for (const r of resultados.slice(g.desde, hasta)) lineas.push(`| ${r.nombre} | ${r.paso ? '✅' : `❌ ${String(r.detalle).replace(/\|/g, '/')}`} |`)
  lineas.push('')
}
writeFileSync('pruebas/resultados/formatos-y-activos.md', lineas.join('\n'))
process.exit(fallas ? 1 : 0)
