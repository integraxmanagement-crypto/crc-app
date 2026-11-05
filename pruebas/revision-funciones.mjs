// Prueba de los arreglos de la revisión de funciones del servidor (05/11/2026). Solo cuentas y empresas FICTICIAS.
//  1. ingresar: una dirección de internet inventada (x-forwarded-for) no se anota ni sirve para esquivar el bloqueo por dirección.
//     Se usa con pruebas/ip-ingreso.sql (prepara 30 fallos para una dirección de documentación 203.0.113.50 y luego los borra).
//  2. registrar-inspeccion: una cuenta de otra empresa no obtiene ningún texto de un formato ni de una inspección ajenos.
//  3. carga-personal: la vista previa no muestra el nombre de una persona de otra sede.
//  4. dar-contrasena en bloque: dueño, administrador general y de sede; cada uno solo sobre las personas que le tocan.
// Por defecto NO cambia ninguna contraseña. Con «--restablecer» el administrador de la sede 2 de la empresa D restablece
// en bloque a los usuarios gestores de su sede (solo USUGES_C2) y la prueba le pone enseguida una contraseña nueva
// guardada en .env.pruebas.local (nunca se imprime).
// Uso: node pruebas/revision-funciones.mjs [--restablecer]
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { URL, CLAVE_PUBLICA, claveFuerte, comprobar, cuentas, guardarCuenta, ingresarComo, ingresarConDocumento, llamarFuncion, resultados, resumen } from './comun.mjs'

const RESTABLECER = process.argv.includes('--restablecer')
const IP_INVENTADA = '203.0.113.50' // rango reservado para documentación (RFC 5737): no es de nadie
const OTRA_SEDE = 'Este documento ya existe en otra sede de la empresa: no puedes cambiarlo desde esta carga.'
const s = {}
for (const n of ['DUENO', 'ADMIN_A', 'ADMIN_B', 'ADMIN_C', 'ADMSEDE_C1', 'ADMSEDE_C2', 'GESTOR_C2', 'USUGES_C1']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`No se pudo ingresar como ${n}: ${error.message}`)
  s[n] = c
}

// ───── 1. Dirección de internet ─────
console.log('\n1. ingresar: dirección de internet')
const docFicticio = '99' + String(Date.now()).slice(-6)
const intento = await fetch(`${URL}/functions/v1/ingresar`, {
  method: 'POST',
  headers: { apikey: CLAVE_PUBLICA, 'Content-Type': 'application/json', 'X-Forwarded-For': IP_INVENTADA },
  body: JSON.stringify({ tipo_documento: 'dni', numero_documento: docFicticio, contrasena: 'NoEs-La-Clave9' }),
})
comprobar('Con la dirección inventada bloqueada (30 fallos, ver ip-ingreso.sql) el intento NO sale bloqueado: se usa la dirección real', intento.status === 400, `HTTP ${intento.status}`)
const anotado = (await s.DUENO.from('intentos_ingreso').select('ip, resultado').eq('numero_documento', docFicticio)).data ?? []
comprobar('El intento quedó anotado una vez, como fallo', anotado.length === 1 && anotado[0].resultado === 'fallo')
comprobar('La dirección anotada NO es la inventada', anotado.length === 1 && Boolean(anotado[0].ip) && anotado[0].ip !== IP_INVENTADA)

// ───── 2. registrar-inspeccion ─────
console.log('\n2. registrar-inspeccion: formato e inspección de otra empresa')
const empresaA = (await s.ADMIN_A.from('vinculos').select('empresa_id').eq('estado', 'activo').limit(1).single()).data.empresa_id
const versionA = (await s.ADMIN_A.from('plantillas_versiones').select('id').eq('empresa_id', empresaA).eq('estado', 'vigente').limit(1).single()).data?.id
const inspeccionA = (await s.ADMIN_A.from('inspecciones').select('id').eq('empresa_id', empresaA).limit(1).single()).data?.id
comprobar('Hay un formato publicado y una inspección de la empresa A para probar', Boolean(versionA && inspeccionA))
const pedido = (version) => ({ modo: 'registrar', id: randomUUID(), version_id: version, fecha: new Date().toISOString().slice(0, 10), cerrada_en_equipo: new Date().toISOString(), respuestas: {}, filas: {}, firmantes: [{ rol_clave: 'no-existe', persona_id: null, externo_nombre: 'X' }] })
const ajeno = await llamarFuncion(s.ADMIN_B, 'registrar-inspeccion', pedido(versionA))
const inexistente = await llamarFuncion(s.ADMIN_B, 'registrar-inspeccion', pedido(randomUUID()))
comprobar('Formato de otra empresa: «El formato no existe» (422)', ajeno.estado === 422 && ajeno.datos?.error === 'El formato no existe', `HTTP ${ajeno.estado}`)
comprobar('La respuesta es idéntica a la de un formato que no existe (sin textos del formato)', JSON.stringify(ajeno) === JSON.stringify(inexistente))
comprobar('La respuesta no trae lista de puntos faltantes', !('faltan' in (ajeno.datos ?? {})))
const corrAjena = await llamarFuncion(s.ADMIN_B, 'registrar-inspeccion', { modo: 'corregir', id: inspeccionA, edicion: 1, motivo: 'Prueba', respuestas: {}, filas: {} })
const corrInexistente = await llamarFuncion(s.ADMIN_B, 'registrar-inspeccion', { modo: 'corregir', id: randomUUID(), edicion: 1, motivo: 'Prueba', respuestas: {}, filas: {} })
comprobar('Corregir una inspección de otra empresa: «No autorizado» (403)', corrAjena.estado === 403 && corrAjena.datos?.error === 'No autorizado', `HTTP ${corrAjena.estado}`)
comprobar('Igual que corregir una inspección que no existe (sin textos)', JSON.stringify(corrAjena) === JSON.stringify(corrInexistente))
// La misma empresa sí llega hasta el cálculo (el formato se lee): con respuestas vacías faltan datos o falla la firma.
const propio = await llamarFuncion(s.ADMIN_A, 'registrar-inspeccion', pedido(versionA))
comprobar('Con un formato de su propia empresa la función sí lo lee (responde con el problema de la firma)', propio.estado === 422 && propio.datos?.error !== 'El formato no existe', propio.datos?.error ?? '')

// ───── 3. carga-personal: vista previa ─────
console.log('\n3. carga-personal: vista previa con alguien de otra sede')
const empresaD = (await s.ADMIN_C.from('vinculos').select('empresa_id').eq('estado', 'activo').limit(1).single()).data.empresa_id
const sedesD = (await s.DUENO.from('sedes').select('id, nombre').eq('empresa_id', empresaD)).data ?? []
const S1 = sedesD.find((x) => x.nombre.startsWith('Sede 1'))?.id
const S2 = sedesD.find((x) => x.nombre.startsWith('Sede 2'))?.id
const fila = (numero, rol) => ({ fila: 1, tipo: 'DNI', numero, nombres: 'NOMBRE INVENTADO PARA LA PRUEBA', fecha: '2026-01-05', puesto: 'Prueba', gerencia: 'Gerencia General', area: 'Seguridad', subarea: '', rol })
const nombreGestorC2 = 'GESTOR SEDE 2'
const previa = await llamarFuncion(s.ADMSEDE_C1, 'carga-personal', { modo: 'revisar', empresa_id: empresaD, filas: [fila(cuentas.GESTOR_C2_DOC.split(':')[1], 'gestor')], sedes: [S1] })
const f1 = previa.datos?.filas?.[0]
comprobar('Administrador de la sede 1 + documento de un gestor de la sede 2: fila en error', previa.estado === 200 && f1?.estado === 'error', f1?.estado)
comprobar('El motivo es «ya existe en otra sede»', Boolean(f1?.motivos?.includes(OTRA_SEDE)))
comprobar('La respuesta no trae el nombre actual ni el identificador de la persona', !JSON.stringify(previa.datos).includes(nombreGestorC2) && !f1?.persona_id && !f1?.vinculo_id)
const previaPropia = await llamarFuncion(s.ADMSEDE_C1, 'carga-personal', { modo: 'revisar', empresa_id: empresaD, filas: [fila(cuentas.USUARIO_C1_DOC.split(':')[1], 'usuario')], sedes: [S1] })
const f2 = previaPropia.datos?.filas?.[0]
comprobar('Con alguien de SU sede la vista previa sigue igual (reconoce a la persona y muestra qué cambiaría)', f2 && !f2.motivos?.includes(OTRA_SEDE) && Boolean(f2.persona_id), f2?.estado)
const previaGeneral = await llamarFuncion(s.ADMIN_C, 'carga-personal', { modo: 'revisar', empresa_id: empresaD, filas: [fila(cuentas.GESTOR_C2_DOC.split(':')[1], 'gestor')], sedes: [S2] })
const f3 = previaGeneral.datos?.filas?.[0]
comprobar('El administrador general sí ve a la persona de la sede 2 (ve toda la empresa)', f3 && !f3.motivos?.includes(OTRA_SEDE) && Boolean(f3.persona_id), f3?.estado)

// ───── 4. dar-contrasena en bloque ─────
console.log('\n4. dar-contrasena en bloque')
const bloque = (c, empresa, roles) => llamarFuncion(c, 'dar-contrasena', { empresa_id: empresa, roles })
const g = await bloque(s.GESTOR_C2, empresaD, ['usuario'])
comprobar('Un gestor no puede restablecer en bloque (403)', g.estado === 403, `HTTP ${g.estado}`)
const ug = await bloque(s.USUGES_C1, empresaD, ['usuario'])
comprobar('Un usuario gestor no puede restablecer en bloque (403)', ug.estado === 403, `HTTP ${ug.estado}`)
const otra = await bloque(s.ADMSEDE_C1, empresaA, ['usuario'])
comprobar('Un administrador de sede no puede restablecer en otra empresa (403)', otra.estado === 403, `HTTP ${otra.estado}`)
const otraGeneral = await bloque(s.ADMIN_C, empresaA, ['usuario'])
comprobar('Un administrador general no puede restablecer en otra empresa (403)', otraGeneral.estado === 403, `HTTP ${otraGeneral.estado}`)
const fuera = await bloque(s.ADMSEDE_C2, empresaD, ['usuario'])
comprobar('Administrador de la sede 2: los usuarios de la sede 1 no se tocan (0 resultados)', fuera.estado === 200 && fuera.datos?.resultados?.length === 0, `HTTP ${fuera.estado}, ${fuera.datos?.resultados?.length ?? '?'} resultados`)
const admins = await bloque(s.ADMSEDE_C2, empresaD, ['admin_empresa', 'admin_sede'])
comprobar('Administrador de sede: a los administradores no los toca (0 resultados)', admins.estado === 200 && admins.datos?.resultados?.length === 0, `HTTP ${admins.estado}, ${admins.datos?.resultados?.length ?? '?'} resultados`)
const rescateFalso = await fetch(`${URL}/functions/v1/dar-contrasena`, {
  method: 'POST', headers: { apikey: CLAVE_PUBLICA, Authorization: `Bearer ${'x'.repeat(40)}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ tipo_documento: 'dni', numero_documento: cuentas.DUENO_DOC.split(':')[1] }),
})
comprobar('El rescate sigue exigiendo la clave secreta: con otra cosa, 401 y nada cambia', rescateFalso.status === 401, `HTTP ${rescateFalso.status}`)

if (RESTABLECER) {
  const r = await bloque(s.ADMSEDE_C2, empresaD, ['usuario_gestor'])
  const lista = r.datos?.resultados ?? []
  const esUsuges = (x) => `${x.tipo_documento}:${x.numero_documento}` === cuentas.USUGES_C2_DOC
  comprobar('Administrador de la sede 2 restablece en bloque a los usuarios gestores: solo el de su sede (USUGES_C2)', r.estado === 200 && lista.length === 1 && esUsuges(lista[0]), `${lista.length} resultado(s)`)
  comprobar('No toca al usuario gestor de la sede 1 (USUGES_C1)', !lista.some((x) => `${x.tipo_documento}:${x.numero_documento}` === cuentas.USUGES_C1_DOC))
  const dada = lista.find(esUsuges)?.contrasena
  if (dada) {
    // Se deja la cuenta lista para las demás pruebas: ingresa con la contraseña dada y la cambia por una nueva guardada en el archivo local.
    const { c } = await ingresarConDocumento(cuentas.USUGES_C2_DOC, dada)
    const nueva = claveFuerte()
    const cambio = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: dada, contrasena_nueva: nueva })
    if (cambio.estado === 200) guardarCuenta('USUGES_C2', cuentas.USUGES_C2_DOC, nueva)
    comprobar('USUGES_C2 quedó con una contraseña nueva guardada en el archivo local (no se imprime)', cambio.estado === 200, `HTTP ${cambio.estado}`)
  }
} else console.log('(Sin --restablecer: no se cambió ninguna contraseña.)')

const fallas = resumen()
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/revision-funciones.md', [
  '# Resultado: arreglos de la revisión de funciones del servidor', '',
  `Fecha: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${resultados.length - fallas} de ${resultados.length} pasaron${RESTABLECER ? ' · con --restablecer' : ''}.`, '',
  ...resultados.map((r) => `- ${r.paso ? '✅' : '❌'} ${r.nombre}${r.detalle ? ` (${r.detalle})` : ''}`), '',
].join('\n'))
process.exit(fallas ? 1 : 0)
