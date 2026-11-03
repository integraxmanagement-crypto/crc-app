// Segunda parte de la demo de dos sedes (FICTICIA, solo crc-dev): le pone a la empresa DEMO (RUC 20000000061) los mismos formatos
// de inspección que ya se revisaron en la empresa A (extintores, DACI, motobomba, electrobomba, CAR, LOTO, IPF; «bomba contra incendio» se hace con motobomba y electrobomba),
// con equipos, una inspección por formato en cada sede (algunas con plan de acción) y esos formatos vinculados al programa anual de cada sede.
// Antes hay que correr: node pruebas/demo-dos-sedes.mjs. Se puede repetir: lo que ya existe no se vuelve a crear.
// Uso: node pruebas/demo-dos-sedes-formatos.mjs
import { createHash, randomUUID } from 'node:crypto'
import { PNG_FICTICIO, formatoDeEmpresa, ingresarComo, llamarFuncion } from './comun.mjs'
import { puntoVisible, seccionesVisibles } from '../src/formatos/motor.ts'

const HOY = new Date().toISOString().slice(0, 10)
const ANIO = new Date().getFullYear()
const sha = (b) => createHash('sha256').update(b).digest('hex')
const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}

const NOMBRES = ['DEMO_GENERAL', 'DEMO_ADMSEDE_NORTE', 'DEMO_ADMSEDE_SUR', 'DEMO_GESTOR_NORTE', 'DEMO_GESTOR_SUR', 'DEMO_USUARIO_NORTE', 'DEMO_USUARIO_SUR']
const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)
const s = {}
const ID = {}
for (const n of NOMBRES) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar (¿corriste demo-dos-sedes.mjs?): ${error.message}`)
  s[n] = c
  ID[n] = (await c.auth.getUser()).data.user.id
}
const empresa = falla(await dueno.from('empresas').select('id').eq('ruc', '20000000061').single(), 'empresa demo').id
const sedes = [
  { nombre: 'Norte', id: (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', 'Sede Norte (demo)').single()).data.id,
    admin: 'DEMO_ADMSEDE_NORTE', gestor: 'DEMO_GESTOR_NORTE', usuario: 'DEMO_USUARIO_NORTE' },
  { nombre: 'Sur', id: (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', 'Sede Sur (demo)').single()).data.id,
    admin: 'DEMO_ADMSEDE_SUR', gestor: 'DEMO_GESTOR_SUR', usuario: 'DEMO_USUARIO_SUR' },
]
const AREA = (await dueno.from('unidades').select('id').eq('empresa_id', empresa).eq('nivel', 'area').eq('nombre', 'Seguridad').single()).data.id

// Equipos de cada formato (por sede): [código, subtipo, datos]
const EXT = { numero_serie: 'SER-FICTICIA', agente: 'PQS', capacidad: 6, capacidad_unidad: 'kg', anio_fabricacion: 2022, anio_prueba_hidrostatica: 2024, ultimo_mantenimiento: HOY.slice(0, 7) }
const ficha = (c) => Object.fromEntries(['principal', 'jockey'].flatMap((q) => [['marca', q === 'principal' ? 'Weg' : 'Pedrollo'], ['potencia', q === 'principal' ? '30 HP' : '2 HP'], ['caudal', q === 'principal' ? '25 L/s' : '1.5 L/s'], ['presion_nominal', '100 psi'], ['arranque_parada', q === 'principal' ? 'Arranque 80 psi / Parada manual' : 'Arranque 90 psi / Parada 110 psi'], ['alimentacion', 'Trifásico 220 V / 3550 RPM']].map(([k, v]) => [`${q}_${k}`, `${v} (${c})`])))
const FORMATOS = [
  { codigo: 'extintores', texto: 'Inspección de extintores', equipos: (n) => [['EXT-1', null, EXT], ['EXT-2', null, EXT], ['EXT-3', null, EXT]].map(([c, st, d]) => [`${c}-${n}`, st, d]) },
  { codigo: 'daci', texto: 'Inspección del sistema DACI', equipos: (n) => [['DACI-PAN', 'panel', { modelo: 'X1 (ficticio)' }], ['DACI-DET', 'detector', {}], ['DACI-SIR', 'sirena', {}]].map(([c, st, d]) => [`${c}-${n}`, st, d]) },
  { codigo: 'motobomba', texto: 'Inspección de motobomba', equipos: null },
  { codigo: 'electrobomba', texto: 'Inspección de electrobomba', equipos: (n) => [[`EB-${n}-1`, null, ficha(`EB-${n}-1`)]] },
  { codigo: 'car', texto: 'Inspección de caseta de ataque rápido (CAR)', equipos: (n) => [1, 2, 3].map((k) => [`CAR-${n}-${k}`, null, {}]) },
  { codigo: 'loto', texto: 'Eficacia del programa de bloqueo y etiquetado (LOTO)', equipos: null },
  { codigo: 'ipf', texto: 'Inspección de seguridad ocupacional (IPF)', equipos: null },
]

// ── Respuestas, firmantes y registro
const LISTAS = { tipos_bloqueo: 'Individual' }
async function opcionDeLista(lista) {
  if (LISTAS[lista]) return LISTAS[lista]
  const l = (await dueno.from('listas').select('id').eq('codigo', lista).maybeSingle()).data
  const it = l ? (await dueno.from('listas_items').select('nombre').eq('lista_id', l.id).limit(1)).data?.[0] : null
  return (LISTAS[lista] = it?.nombre ?? 'Dato ficticio')
}
async function llenar(receta, subtipo, quien, conFalla) {
  const r = {}
  let falloPuesto = false
  for (const sec of seccionesVisibles(receta, subtipo).filter((x) => !x.repetible)) {
    for (const p of sec.puntos) {
      if (!puntoVisible(p, r)) continue
      let valor = null
      if (p.tipo === 'cumple' || p.tipo === 'si_no') valor = 'si'
      else if (p.tipo === 'numero') valor = 3
      else if (p.tipo === 'hora') valor = '10:00'
      else if (p.tipo === 'fecha') valor = HOY
      else if (p.tipo === 'persona') valor = ID[quien]
      else if (p.tipo === 'lista') valor = await opcionDeLista(p.lista)
      else if (p.tipo === 'texto' || p.tipo === 'texto_largo') valor = 'Dato ficticio'
      r[p.clave] = { valor }
      if (conFalla && !falloPuesto && p.pide_accion && (p.tipo === 'cumple' || p.tipo === 'si_no')) {
        falloPuesto = true
        r[p.clave] = { valor: 'no', obs: 'Observación de la demo (ficticia)', accion: { texto: `Corregir «${p.texto.slice(0, 60)}» (ficticio)`, responsable: ID[quien], plazo: '2026-12-31' } }
      }
    }
  }
  return r
}
function firmantesDe(receta, quien, x) {
  const f = []
  for (const g of receta.firmas ?? []) {
    if (g.clave === 'observado') f.push({ rol_clave: g.clave, rol_titulo: g.titulo, orden: f.length + 1, externo_nombre: 'Trabajador Externo Ficticio', externo_documento: '00000000' })
    else if (g.clave === 'custodia' || g.clave === 'responsable_area') f.push({ rol_clave: g.clave, rol_titulo: g.titulo, orden: f.length + 1, persona_id: ID[x.usuario] })
    else f.push({ rol_clave: g.clave, rol_titulo: g.titulo, orden: f.length + 1, persona_id: ID[quien] })
  }
  return f
}
async function registrar({ quien, x, version, receta, activo, conFalla }) {
  const id = randomUUID()
  const firmantes = firmantesDe(receta, quien, x)
  const propia = firmantes.find((g) => g.persona_id === ID[quien])
  const rutaFirma = propia ? `${empresa}/${id}/firma-${ID[quien]}-${propia.rol_clave}.png` : null
  if (rutaFirma) {
    const up = await s[quien].storage.from('evidencias').upload(rutaFirma, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
    if (up.error) throw new Error(`No se pudo subir la firma: ${up.error.message}`)
  }
  // Secciones repetibles (IPF: condiciones inseguras): una fila con todos sus datos y su foto.
  const filas = {}
  const archivos = []
  for (const sec of receta.secciones.filter((q) => q.repetible)) {
    const fila = {}
    for (const p of sec.puntos) {
      fila[p.clave] = { valor: p.tipo === 'persona' ? ID[quien] : p.tipo === 'fecha' ? HOY : p.tipo === 'foto' ? null : p.tipo === 'numero' ? 3 : 'Condición insegura de la demo (ficticia)' }
      if (p.tipo === 'foto') {
        const foto = randomUUID()
        const ruta = `${empresa}/${id}/${foto}.png`
        const up = await s[quien].storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
        if (up.error) throw new Error(`No se pudo subir la foto: ${up.error.message}`)
        archivos.push({ id: foto, punto_clave: p.clave, fila: 0, ruta, bytes: PNG_FICTICIO.length, tipo_mime: 'image/png', sha256: sha(PNG_FICTICIO) })
      }
    }
    filas[sec.clave] = [fila]
  }
  const cuerpo = {
    modo: 'registrar', id, version_id: version, sede_id: x.id, fecha: HOY,
    respuestas: await llenar(receta, activo?.subtipo ?? null, quien, conFalla), observacion: null, filas, archivos,
    iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(), dispositivo: 'Demo',
    firmantes, mi_firma: rutaFirma ? { rol_clave: propia.rol_clave, ruta: rutaFirma, bytes: PNG_FICTICIO.length } : null,
    ...(activo ? { activo_id: activo.id, activo_foto: { codigo: activo.codigo, numero: activo.numero, subtipo: activo.subtipo, datos: activo.datos, dotacion: activo.dotacion } } : { unidad_id: AREA }),
  }
  const r = await llamarFuncion(s[quien], 'registrar-inspeccion', cuerpo)
  if (r.estado !== 200) throw new Error(`Inspección ${quien}: ${r.estado} ${r.datos?.error ?? ''} ${JSON.stringify(r.datos?.faltan ?? '')}`)
  return id
}

// ── Formatos, equipos e inspecciones
const copias = {}
for (const f of FORMATOS) {
  const c = await formatoDeEmpresa(dueno, empresa, f.codigo, `${ANIO}-01-15`)
  // Si la base tiene una versión más nueva (p. ej. la CAR con el formato del dueño), la copia de la empresa se publica de nuevo con ella.
  const canon = (o) => JSON.stringify(o, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
  const baseV = (await dueno.from('plantillas').select('versiones:plantillas_versiones(estado, receta)').is('empresa_id', null).eq('codigo', f.codigo).single()).data.versiones.find((x) => x.estado === 'vigente')
  if (canon(baseV.receta) !== canon(c.version.receta)) {
    const borrador = falla(await dueno.rpc('nuevo_borrador', { p_plantilla: c.id }), 'nuevo borrador')
    const actual = (await dueno.from('plantillas_versiones').select('codigo_formato, version_formato, fecha_aprobacion').eq('id', borrador).single()).data
    falla(await dueno.rpc('guardar_borrador', { p_version: borrador, p_datos: { receta: baseV.receta, ...actual, logo: 'positivo' } }), 'guardar borrador')
    falla(await dueno.rpc('publicar_version', { p_version: borrador }), 'publicar')
    console.log(`${f.codigo}: se publicó la versión nueva del formato en la copia de la empresa.`)
  }
  const pl =(await dueno.from('plantillas').select('tipo_activo_id').eq('id', c.id).single()).data
  const v = (await dueno.from('plantillas_versiones').select('id, receta').eq('plantilla_id', c.id).eq('estado', 'vigente').single()).data
  copias[f.codigo] = { plantilla: c.id, tipo: pl.tipo_activo_id, version: v.id, receta: v.receta }
  const hechas = (await dueno.from('inspecciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa).in('version_id', ((await dueno.from('plantillas_versiones').select('id').eq('plantilla_id', c.id)).data ?? []).map((x) => x.id))).count
  let nuevas = 0
  for (const [i, x] of sedes.entries()) {
    let equipos = []
    if (f.equipos) {
      const ub = (await dueno.from('ubicaciones').select('id').eq('empresa_id', empresa).eq('sede_id', x.id).limit(1)).data?.[0]?.id ?? null
      const ya = (await dueno.from('activos').select('codigo').eq('empresa_id', empresa).eq('tipo_id', pl.tipo_activo_id).eq('sede_id', x.id)).data ?? []
      for (const [codigo, subtipo, datos] of f.equipos(x.nombre.toUpperCase())) {
        if (ya.some((a) => a.codigo === codigo)) continue
        falla(await s[x.admin].rpc('guardar_activo', { p_empresa: empresa, p_id: null, p_datos: { tipo_id: pl.tipo_activo_id, codigo, sede_id: x.id, unidad_id: AREA, ubicacion_id: ub, ...(subtipo ? { subtipo } : {}), datos } }), `equipo ${codigo}`)
      }
      equipos = (await s[x.admin].from('activos').select('id, codigo, numero, subtipo, datos, dotacion').eq('empresa_id', empresa).eq('tipo_id', pl.tipo_activo_id).eq('sede_id', x.id).order('codigo')).data ?? []
    }
    if (hechas > 0 || f.codigo === 'motobomba') continue // motobomba ya tiene sus inspecciones de la primera parte
    const objetivos = f.equipos ? equipos.slice(0, 2) : [null]
    for (const [j, activo] of objetivos.entries()) {
      await registrar({ quien: j === 0 ? x.gestor : x.admin, x, version: v.id, receta: v.receta, activo, conFalla: j === 1 || !f.equipos })
      nuevas++
    }
  }
  console.log(`${f.codigo}: formato listo, ${nuevas} inspección(es) nueva(s).`)
}

// ── Programa anual de cada sede: una actividad por formato, con la frecuencia que trae el formato
for (const x of sedes) {
  const P = (await s[x.admin].from('passt_programas').select('id').eq('empresa_id', empresa).eq('sede_id', x.id).eq('anio', ANIO).eq('vigente', true).limit(1)).data?.[0]?.id
  if (!P) throw new Error(`No hay programa de la sede ${x.nombre}`)
  const nodos = (await s[x.admin].from('passt_nodos').select('id, tipo, texto, plantilla_id').eq('programa_id', P).eq('vigente', true)).data ?? []
  const sec = nodos.find((n) => n.tipo === 'seccion')
  for (const f of FORMATOS) {
    if (nodos.some((n) => n.tipo === 'actividad' && n.plantilla_id === copias[f.codigo].plantilla)) continue
    const frec = (await dueno.from('plantillas').select('frecuencia').is('empresa_id', null).eq('codigo', f.codigo).single()).data?.frecuencia ?? 'mensual'
    falla(await s[x.admin].rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'actividad', padre_id: sec.id, texto: `${f.texto} (demo)`, responsable_id: ID[x.gestor], plantilla_id: copias[f.codigo].plantilla, frecuencia: frec, motivo: 'Demo (ficticio)' } }), `actividad ${f.codigo}`)
  }
  console.log(`Programa de la sede ${x.nombre}: ${FORMATOS.length} formatos vinculados.`)
}
console.log('\nListo: la empresa DEMO tiene los mismos formatos que la empresa A, con datos de ejemplo en cada sede.')
