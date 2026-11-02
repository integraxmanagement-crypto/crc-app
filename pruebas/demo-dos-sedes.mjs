// Demo FICTICIA de una empresa con DOS SEDES (etapa 1 del punto 2), solo en crc-dev, para que el dueño la pruebe en la app.
// Empresa DEMO (RUC 20000000061) con: 1 administrador general, 1 administrador por sede, 1 gestor por sede y 1 usuario por sede.
// Cada sede tiene 2 activos (motobombas) con una inspección sin observaciones y otra con un plan de acción abierto,
// más un programa anual de SST por sede y uno general. Se puede repetir: lo que ya existe no se vuelve a crear.
// Las contraseñas se guardan en .env.pruebas.local (archivo local, no se sube a GitHub) y NUNCA se imprimen.
// Uso: node pruebas/demo-dos-sedes.mjs
import { createHash, randomUUID } from 'node:crypto'
import { PNG_FICTICIO, claveFuerte, cuentas, formatoDeEmpresa, guardarCuenta, ingresarComo, llamarFuncion } from './comun.mjs'

const RUC = '20000000061'
const HOY = new Date().toISOString().slice(0, 10)
const sha = (b) => createHash('sha256').update(b).digest('hex')
const falla = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.data
}

const { c: dueno, error: errDueno } = await ingresarComo('DUENO')
if (errDueno) throw new Error('El dueño ficticio no pudo ingresar: ' + errDueno.message)

// ── Empresa, sedes, listas
let empresa = (await dueno.from('empresas').select('id').eq('ruc', RUC).maybeSingle()).data?.id
if (!empresa) {
  empresa = falla(await dueno.rpc('crear_empresa', {
    p_ficha: { ruc: RUC, razon_social: 'DEMO · Constructora Dos Sedes S.A.C. (ficticia)', domicilio_direccion: 'Av. Demo 100', domicilio_distrito: 'Callao',
      domicilio_provincia: 'Callao', domicilio_departamento: 'Callao', ciiu_codigo: '4100', actividad_texto: 'Construcción de edificios (ficticia)', plan: 'gratuito', es_prueba: true },
    p_sede: { nombre: 'Sede Norte (demo)', direccion: 'Av. Demo 100', distrito: 'Callao', provincia: 'Callao', departamento: 'Callao' },
  }), 'crear la empresa demo')
}
const sedeNombre = async (nombre, direccion) => {
  const ya = (await dueno.from('sedes').select('id').eq('empresa_id', empresa).eq('nombre', nombre).maybeSingle()).data?.id
  if (ya) return ya
  return falla(await dueno.rpc('guardar_sede', { p_empresa: empresa, p_sede: null, p_datos: { nombre, direccion, distrito: 'Lima', provincia: 'Lima', departamento: 'Lima' } }), `crear la sede ${nombre}`)
}
const S1 = await sedeNombre('Sede Norte (demo)', 'Av. Demo 100')
const S2 = await sedeNombre('Sede Sur (demo)', 'Av. Demo 200')

if (!(await dueno.from('puestos').select('id').eq('empresa_id', empresa).eq('nombre', 'Supervisor SST').maybeSingle()).data)
  falla(await dueno.rpc('guardar_item_lista', { p_lista: 'puestos', p_empresa: empresa, p_id: null, p_nombre: 'Supervisor SST' }), 'crear el puesto')
let AREA = (await dueno.from('unidades').select('id').eq('empresa_id', empresa).eq('nivel', 'area').eq('nombre', 'Seguridad').maybeSingle()).data?.id
if (!AREA) {
  const g = falla(await dueno.rpc('guardar_unidad', { p_empresa: empresa, p_id: null, p_nivel: 'gerencia', p_padre: null, p_nombre: 'Gerencia General' }), 'crear la gerencia')
  AREA = falla(await dueno.rpc('guardar_unidad', { p_empresa: empresa, p_id: null, p_nivel: 'area', p_padre: g, p_nombre: 'Seguridad' }), 'crear el área')
}

// ── Cuentas
const PERSONAS = [
  // [nombre, documento, apellidos y nombres, rol, sedes, quién la crea]
  ['DEMO_GENERAL', 'dni:42000001', 'DEMO ADMIN GENERAL, Gabriela (ficticia)', 'admin_empresa', null, 'DUENO'],
  ['DEMO_ADMSEDE_NORTE', 'dni:42000002', 'DEMO ADMIN NORTE, Hugo (ficticio)', 'admin_sede', [S1], 'DUENO'],
  ['DEMO_ADMSEDE_SUR', 'dni:42000003', 'DEMO ADMIN SUR, Irene (ficticia)', 'admin_sede', [S2], 'DUENO'],
  ['DEMO_GESTOR_NORTE', 'dni:42000004', 'DEMO GESTOR NORTE, Julio (ficticio)', 'gestor', [S1], 'DEMO_ADMSEDE_NORTE'],
  ['DEMO_GESTOR_SUR', 'dni:42000005', 'DEMO GESTOR SUR, Karen (ficticia)', 'gestor', [S2], 'DEMO_ADMSEDE_SUR'],
  ['DEMO_USUARIO_NORTE', 'dni:42000006', 'DEMO USUARIO NORTE, Luis (ficticio)', 'usuario', [S1], 'DEMO_ADMSEDE_NORTE'],
  ['DEMO_USUARIO_SUR', 'dni:42000007', 'DEMO USUARIO SUR, Marta (ficticia)', 'usuario', [S2], 'DEMO_ADMSEDE_SUR'],
]
for (const [nombre, documento, nombres, rol, sedes, creador] of PERSONAS) {
  if (cuentas[`${nombre}_CLAVE`]) continue
  const { c, error } = await ingresarComo(creador)
  if (error) throw new Error(`${creador} no pudo ingresar: ${error.message}`)
  const [tipo, numero] = documento.split(':')
  const r = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: empresa, rol, tipo_documento: tipo, numero_documento: numero, apellidos_nombres: nombres, fecha_ingreso: '2026-01-15',
    puesto: 'Supervisor SST', area: 'Seguridad', ...(sedes ? { sedes } : {}),
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ${nombre}: ${r.datos?.error}`)
  const inicial = r.datos.contrasena_inicial
  guardarCuenta(nombre, documento, inicial)
  // Primer ingreso: la contraseña inicial se cambia por una propia, para que la cuenta quede lista para usar.
  const primera = await ingresarComo(nombre, inicial)
  if (primera.error) throw new Error(`${nombre} no pudo hacer su primer ingreso: ${primera.error.message}`)
  const nueva = claveFuerte()
  const cambio = await llamarFuncion(primera.c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
  if (cambio.estado !== 200) throw new Error(`${nombre} no pudo cambiar su contraseña: ${cambio.datos?.error}`)
  guardarCuenta(nombre, documento, nueva)
}
const s = { DUENO: dueno }
const ID = {}
for (const [nombre] of PERSONAS) {
  const { c, error } = await ingresarComo(nombre)
  if (error) throw new Error(`${nombre} no pudo ingresar: ${error.message}`)
  s[nombre] = c
  ID[nombre] = (await c.auth.getUser()).data.user.id
}

// ── Datos de ejemplo (solo si la empresa aún no tiene inspecciones)
const hay = (await dueno.from('inspecciones').select('id', { count: 'exact', head: true }).eq('empresa_id', empresa)).count
if (hay > 0) {
  console.log(`La demo ya tenía ${hay} inspecciones: no se agregó nada. Las cuentas quedan listas.`)
} else {
  const tipoBase = falla(await dueno.from('tipos_activo').select('id').is('empresa_id', null).eq('codigo', 'motobomba').single(), 'tipo de activo').id
  const tipo = falla(await dueno.rpc('activar_tipo_activo', { p_empresa: empresa, p_tipo_base: tipoBase }), 'activar el tipo')
  const { version } = await formatoDeEmpresa(dueno, empresa, 'motobomba', HOY)
  const receta = (await dueno.from('plantillas_versiones').select('receta').eq('id', version.id).single()).data.receta
  const todoSi = Object.fromEntries(receta.secciones.flatMap((sec) => sec.puntos.map((p) =>
    [p.clave, { valor: p.tipo === 'si_no' ? 'si' : p.tipo === 'hora' ? '10:00' : p.obligatorio ? 'Dato ficticio' : null }])))

  const registrar = async (quien, sede, activo, custodia, extra = {}) => {
    const id = randomUUID()
    const foto = randomUUID()
    const rutaFoto = `${empresa}/${id}/${foto}.png`
    const rutaFirma = `${empresa}/${id}/firma-${ID[quien]}-inspector.png`
    const subir = (ruta) => s[quien].storage.from('evidencias').upload(ruta, new Blob([PNG_FICTICIO], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
    const [u1, u2] = [await subir(rutaFoto), await subir(rutaFirma)]
    if (u1.error || u2.error) throw new Error(`No se pudieron subir las fotos: ${(u1.error ?? u2.error).message}`)
    const r = await llamarFuncion(s[quien], 'registrar-inspeccion', {
      modo: 'registrar', id, version_id: version.id, sede_id: sede, activo_id: activo,
      activo_foto: { codigo: 'X', numero: 1, subtipo: null, datos: {}, dotacion: {} },
      respuestas: { ...todoSi, ...(extra.respuestas ?? {}) }, observacion: null, fecha: HOY,
      iniciada_en_equipo: new Date(Date.now() - 600000).toISOString(), cerrada_en_equipo: new Date().toISOString(), dispositivo: 'Demo',
      archivos: [{ id: foto, punto_clave: 'MB-A01', fila: null, ruta: rutaFoto, bytes: PNG_FICTICIO.length, tipo_mime: 'image/png', sha256: sha(PNG_FICTICIO) }],
      firmantes: [{ rol_clave: 'inspector', rol_titulo: 'Inspector', orden: 1, persona_id: ID[quien] }, { rol_clave: 'custodia', rol_titulo: 'Custodia', orden: 2, persona_id: ID[custodia] }],
      mi_firma: { rol_clave: 'inspector', ruta: rutaFirma, bytes: PNG_FICTICIO.length },
    })
    if (r.estado !== 200) throw new Error(`Inspección de ${quien}: ${r.estado} ${r.datos?.error ?? ''}`)
    return id
  }

  const sedes = [
    { nombre: 'Norte', sede: S1, admin: 'DEMO_ADMSEDE_NORTE', gestor: 'DEMO_GESTOR_NORTE', usuario: 'DEMO_USUARIO_NORTE' },
    { nombre: 'Sur', sede: S2, admin: 'DEMO_ADMSEDE_SUR', gestor: 'DEMO_GESTOR_SUR', usuario: 'DEMO_USUARIO_SUR' },
  ]
  for (const x of sedes) {
    const ub = falla(await s[x.admin].rpc('guardar_ubicacion', { p_empresa: empresa, p_id: null, p_sede: x.sede, p_unidad: AREA, p_nombre: `Cuarto de bombas ${x.nombre}` }), 'ubicación')
    const activo = async (n) => falla(await s[x.admin].rpc('guardar_activo', { p_empresa: empresa, p_id: null, p_datos: { tipo_id: tipo, codigo: `MB-${x.nombre.toUpperCase()}-0${n}`, sede_id: x.sede, unidad_id: AREA, ubicacion_id: ub, datos: {} } }), 'activo')
    const a1 = await activo(1)
    const a2 = await activo(2)
    // Una inspección sin observaciones (la hace el gestor) y otra con un punto en «No» y su plan de acción (la hace el administrador de la sede).
    await registrar(x.gestor, x.sede, a1, x.usuario)
    await registrar(x.admin, x.sede, a2, x.usuario, {
      respuestas: { 'MB-B01': { valor: 'no', obs: `Sin flujo de agua en la sede ${x.nombre} (ficticio)`, accion: { texto: `Revisar el tablero de la sede ${x.nombre} (ficticio)`, responsable: ID[x.gestor], plazo: '2026-12-31' } } },
    })
    // El plan de acción de la sede lo pone en proceso su responsable.
    const hz = (await s[x.admin].from('hallazgos').select('id').eq('empresa_id', empresa).eq('sede_id', x.sede)).data ?? []
    for (const h of hz) falla(await s[x.gestor].rpc('hallazgo_en_proceso', { p_id: h.id }), 'plan de acción en proceso')
  }

  // Programa anual de SST: uno general (solo lo edita el administrador general) y uno por sede.
  const ANIO = new Date().getFullYear()
  const programa = async (quien, sede, nombre, objetivo, actividad, resp) => {
    const P = falla(await s[quien].rpc('crear_programa', { p_empresa: empresa, p_datos: { anio: ANIO, sede_id: sede, nombre, seguimiento: 'semana' } }), `programa ${nombre}`)
    const og = (await dueno.from('passt_nodos').select('id').eq('programa_id', P).eq('tipo', 'objetivo_general').single()).data.id
    const oe = falla(await s[quien].rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'objetivo_especifico', padre_id: og, texto: objetivo } }), 'objetivo')
    const sec = falla(await s[quien].rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'seccion', padre_id: oe, texto: 'Actividades (ficticias)' } }), 'sección')
    falla(await s[quien].rpc('guardar_nodo', { p_programa: P, p_id: null, p_datos: { tipo: 'actividad', padre_id: sec, texto: actividad, responsable_id: resp } }), 'actividad')
  }
  await programa('DEMO_GENERAL', null, `Programa general ${ANIO} (demo)`, 'Reducir accidentes en toda la empresa (ficticio)', 'Charla de seguridad para todas las sedes', ID.DEMO_GENERAL)
  for (const x of sedes) await programa(x.admin, x.sede, `Programa de la sede ${x.nombre} ${ANIO} (demo)`, `Cumplir la capacitación de la sede ${x.nombre} (ficticio)`, `Capacitación en extintores, sede ${x.nombre}`, ID[x.gestor])
  console.log('Datos de ejemplo creados: 2 activos, 2 inspecciones y 1 plan de acción por sede, 1 programa general y 1 por sede.')
}

console.log('\nEmpresa DEMO (RUC 20000000061) lista en crc-dev. Cuentas (documento; la contraseña está en .env.pruebas.local, clave NOMBRE_CLAVE):')
for (const [nombre, documento, , rol, sedes] of PERSONAS) console.log(`  ${nombre.padEnd(20)} ${documento.padEnd(13)} ${rol.padEnd(14)} ${sedes ? (sedes[0] === S1 ? 'Sede Norte' : 'Sede Sur') : 'todas las sedes'}`)
