// Tarea 3.3 · Pruebas de usuarios y roles por empresa (paso 5). Solo datos FICTICIOS en crc-dev.
// Ingresa como cada persona de prueba, por la misma puerta que la app, e intenta ver o hacer lo que no le corresponde.
// Crea (una sola vez) dos cuentas ficticias propias de esta prueba en la empresa A: ADMIN_A2 y USUARIO_A3.
// Nunca imprime contraseñas: las de prueba se guardan solo en .env.pruebas.local (excluido de GitHub).
// Guarda un informe en pruebas/resultados/usuarios-y-roles.md
// Uso: node pruebas/usuarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { claveFuerte, cliente, comprobar, cuentas, guardarCuenta, ingresarComo, llamarFuncion, resultados, resumen } from './comun.mjs'

const grupos = []
const seccion = (titulo) => { grupos.push({ titulo, desde: resultados.length }); console.log(`\n── ${titulo}`) }
const NO_AUTORIZADO = (r) => r.error?.message === 'No autorizado' || r.error?.code === '42501' || /permission denied/i.test(r.error?.message ?? '')
const RECHAZO_FUNCION = (r) => r.estado === 401 || r.estado === 403

// ───── Datos de referencia (los ve completos solo el dueño) ─────
const { c: dueno } = await ingresarComo('DUENO')
const { data: empresas } = await dueno.from('empresas').select('id, ruc, razon_social')
const A = empresas.find((e) => e.ruc === '20000000010')
const B = empresas.find((e) => e.ruc === '20000000028')
const C = empresas.find((e) => e.ruc === '20000000036')
const doc = (n) => cuentas[`${n}_DOC`].split(':')[1]

async function vinculos() {
  const { data } = await dueno.from('vinculos').select('id, persona_id, empresa_id, rol, estado, personas(numero_documento)')
  return data
}
let todos = await vinculos()
const vinculoDe = (n) => todos.find((v) => v.personas.numero_documento === doc(n) && v.estado === 'activo')

// ───── Cuentas propias de esta prueba (se crean solo la primera vez) ─────
async function primerIngreso(nombre, documento, inicial) {
  guardarCuenta(nombre, documento, inicial)
  const { c } = await ingresarComo(nombre)
  const nueva = claveFuerte()
  const r = await llamarFuncion(c, 'cambiar-contrasena', { contrasena_actual: inicial, contrasena_nueva: nueva })
  if (r.estado !== 200) throw new Error(`${nombre} no pudo cambiar su contraseña inicial: ${r.datos?.error}`)
  guardarCuenta(nombre, documento, nueva)
}
if (!cuentas.ADMIN_A2_CLAVE) {
  const r = await llamarFuncion(dueno, 'crear-cuenta', {
    empresa_id: A.id, rol: 'admin_empresa', tipo_documento: 'dni', numero_documento: '20000006',
    apellidos_nombres: 'PRUEBA ADMIN A2, Andrea (ficticia)', fecha_ingreso: '2026-03-01', puesto: 'Jefa de SSO', area: 'Seguridad',
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear ADMIN_A2: ${r.datos?.error}`)
  await primerIngreso('ADMIN_A2', 'dni:20000006', r.datos.contrasena_inicial)
}
const { c: adminA } = await ingresarComo('ADMIN_A')
if (!cuentas.USUARIO_A3_CLAVE) {
  const r = await llamarFuncion(adminA, 'crear-cuenta', {
    empresa_id: A.id, rol: 'usuario', tipo_documento: 'dni', numero_documento: '20000007',
    apellidos_nombres: 'PRUEBA USUARIO A3, Abel (ficticio)', fecha_ingreso: '2026-04-01', puesto: 'Almacenera', area: 'Logística',
  })
  if (r.estado !== 200) throw new Error(`No se pudo crear USUARIO_A3: ${r.datos?.error}`)
  await primerIngreso('USUARIO_A3', 'dni:20000007', r.datos.contrasena_inicial)
}
todos = await vinculos()

const sesion = { ADMIN_A: adminA }
for (const n of ['ADMIN_A2', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B', 'GESTOR_B', 'USUARIO_B']) {
  const { c, error } = await ingresarComo(n)
  if (error) throw new Error(`${n} no pudo ingresar: ${error.message}`)
  sesion[n] = c
}

// ───────────────────────────────────────────────
seccion('1. Un administrador de A no ve, crea, cesa, corrige ni da contraseña a nadie de B')
{
  const p = await adminA.from('personas').select('numero_documento')
  comprobar('ADMIN_A no ve a ninguna persona de B', !p.data?.some((x) => [doc('ADMIN_B'), doc('GESTOR_B'), doc('USUARIO_B')].includes(x.numero_documento)), `${p.data?.length} personas visibles`)
  const v = await adminA.from('vinculos').select('id').eq('empresa_id', B.id)
  comprobar('ADMIN_A ve 0 cuentas de B', v.data?.length === 0)
  const crear = await llamarFuncion(adminA, 'crear-cuenta', {
    empresa_id: B.id, rol: 'usuario', tipo_documento: 'dni', numero_documento: '30000099',
    apellidos_nombres: 'PRUEBA INTRUSA, Ivana (ficticia)', fecha_ingreso: '2026-05-01',
  })
  comprobar('ADMIN_A no puede crear una cuenta en B', RECHAZO_FUNCION(crear), `${crear.estado} ${crear.datos?.error ?? ''}`)
  const cese = await adminA.rpc('cesar_vinculo', { p_vinculo: vinculoDe('USUARIO_B').id, p_fecha_cese: '2026-10-22', p_motivo: 'Intento indebido' })
  comprobar('ADMIN_A no puede cesar a USUARIO_B', NO_AUTORIZADO(cese), cese.error?.message)
  const react = await adminA.rpc('reactivar_vinculo', { p_vinculo: vinculoDe('USUARIO_B').id })
  comprobar('ADMIN_A no puede reactivar cuentas de B', NO_AUTORIZADO(react), react.error?.message)
  const corr = await adminA.rpc('actualizar_persona', { p_vinculo: vinculoDe('GESTOR_B').id, p_datos: { apellidos_nombres: 'Nombre cambiado' } })
  comprobar('ADMIN_A no puede corregir datos de GESTOR_B', NO_AUTORIZADO(corr), corr.error?.message)
  for (const n of ['USUARIO_B', 'GESTOR_B']) {
    const r = await llamarFuncion(adminA, 'dar-contrasena', { persona_id: vinculoDe(n).persona_id })
    comprobar(`ADMIN_A no puede dar contraseña nueva a ${n}`, r.estado === 403, `${r.estado}`)
  }
  const permiso = await adminA.rpc('puedo_dar_contrasena', { p_persona: vinculoDe('USUARIO_B').persona_id })
  comprobar('La base de datos responde «no» a ADMIN_A para USUARIO_B', permiso.data === null && !permiso.error)
}

// ───────────────────────────────────────────────
seccion('2. Reglas de administradores')
{
  const a2 = vinculoDe('ADMIN_A2')
  const r1 = await llamarFuncion(adminA, 'dar-contrasena', { persona_id: a2.persona_id })
  comprobar('ADMIN_A no puede dar contraseña nueva a otro administrador (ADMIN_A2)', r1.estado === 403, `${r1.estado}`)
  const r2 = await adminA.rpc('cesar_vinculo', { p_vinculo: a2.id, p_fecha_cese: '2026-10-22', p_motivo: 'Intento indebido' })
  comprobar('ADMIN_A no puede cesar a otro administrador', NO_AUTORIZADO(r2), r2.error?.message)
  const r3 = await adminA.rpc('actualizar_persona', { p_vinculo: a2.id, p_datos: { rol: 'gestor' } })
  comprobar('ADMIN_A no puede quitarle el rol a otro administrador', NO_AUTORIZADO(r3), r3.error?.message)
  const yo = vinculoDe('ADMIN_A')
  const r4 = await adminA.rpc('cesar_vinculo', { p_vinculo: yo.id, p_fecha_cese: '2026-10-22', p_motivo: 'Me voy' })
  comprobar('ADMIN_A no puede cesarse a sí mismo', NO_AUTORIZADO(r4), r4.error?.message)
  const r5 = await llamarFuncion(adminA, 'dar-contrasena', { persona_id: yo.persona_id })
  comprobar('ADMIN_A no puede darse contraseña nueva a sí mismo (usa «cambiar contraseña»)', r5.estado === 403, `${r5.estado}`)
  const u = vinculoDe('USUARIO_A2')
  const r6 = await adminA.rpc('actualizar_persona', { p_vinculo: u.id, p_datos: { rol: 'admin_empresa' } })
  comprobar('ADMIN_A no puede convertir a alguien en administrador', NO_AUTORIZADO(r6), r6.error?.message)

  // El único administrador activo no se puede cesar, ni siquiera el dueño (decisión 3A).
  const bAdmin = vinculoDe('ADMIN_B')
  const r7 = await dueno.rpc('cesar_vinculo', { p_vinculo: bAdmin.id, p_fecha_cese: '2026-10-22', p_motivo: 'Prueba' })
  comprobar('Nadie puede cesar al único administrador activo de B (ni el dueño)', /único administrador/.test(r7.error?.message ?? ''), r7.error?.message)
  const r8 = await dueno.rpc('actualizar_persona', { p_vinculo: bAdmin.id, p_datos: { rol: 'gestor' } })
  comprobar('Nadie puede quitar el rol al único administrador activo de B', /único administrador/.test(r8.error?.message ?? ''), r8.error?.message)

  // Con dos administradores en A, el dueño sí puede cesar a uno y luego reactivarlo.
  const r9 = await dueno.rpc('cesar_vinculo', { p_vinculo: a2.id, p_fecha_cese: '2026-10-22', p_motivo: 'Prueba con dos administradores' })
  comprobar('Con dos administradores, el dueño puede cesar a uno', !r9.error, r9.error?.message)
  const r10 = await dueno.rpc('reactivar_vinculo', { p_vinculo: a2.id })
  comprobar('…y reactivarlo', !r10.error, r10.error?.message)
}

// ───────────────────────────────────────────────
seccion('3. El gestor y el usuario no crean cuentas ni dan contraseñas')
for (const n of ['GESTOR_A', 'USUARIO_A2']) {
  const c = sesion[n]
  const crear = await llamarFuncion(c, 'crear-cuenta', {
    empresa_id: A.id, rol: 'usuario', tipo_documento: 'dni', numero_documento: '20000098',
    apellidos_nombres: 'PRUEBA INTRUSO, Iván (ficticio)', fecha_ingreso: '2026-05-01',
  })
  comprobar(`${n} no puede crear cuentas`, RECHAZO_FUNCION(crear), `${crear.estado}`)
  const dar = await llamarFuncion(c, 'dar-contrasena', { persona_id: vinculoDe('USUARIO_A3').persona_id })
  comprobar(`${n} no puede dar contraseñas nuevas`, dar.estado === 403, `${dar.estado}`)
  const cese = await c.rpc('cesar_vinculo', { p_vinculo: vinculoDe('USUARIO_A3').id, p_fecha_cese: '2026-10-22', p_motivo: 'Intento indebido' })
  comprobar(`${n} no puede cesar cuentas`, NO_AUTORIZADO(cese), cese.error?.message)
  const corr = await c.rpc('actualizar_persona', { p_vinculo: vinculoDe('USUARIO_A3').id, p_datos: { apellidos_nombres: 'Cambio indebido' } })
  comprobar(`${n} no puede corregir datos de otras personas`, NO_AUTORIZADO(corr), corr.error?.message)
  const lista = await c.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: A.id, p_id: null, p_nombre: 'Área indebida' })
  comprobar(`${n} no puede editar las listas de áreas y puestos`, NO_AUTORIZADO(lista), lista.error?.message)
  const bloque = await llamarFuncion(c, 'dar-contrasena', { empresa_id: A.id, roles: ['usuario'] })
  comprobar(`${n} no puede restablecer en bloque`, bloque.estado === 403, `${bloque.estado}`)
}
{
  const bloque = await llamarFuncion(adminA, 'dar-contrasena', { empresa_id: A.id, roles: ['usuario'] })
  comprobar('Tampoco el administrador puede restablecer en bloque (solo el dueño)', bloque.estado === 403, `${bloque.estado}`)
  const sin = await llamarFuncion(cliente(), 'dar-contrasena', { persona_id: vinculoDe('USUARIO_A3').persona_id })
  comprobar('Sin iniciar sesión no se puede dar contraseñas', RECHAZO_FUNCION(sin), `${sin.estado}`)
  const rescate = await llamarFuncion(cliente(), 'dar-contrasena', { tipo_documento: 'dni', numero_documento: doc('DUENO') })
  comprobar('El rescate no funciona con la clave pública de la app', RECHAZO_FUNCION(rescate), `${rescate.estado}`)
}

// ───────────────────────────────────────────────
seccion('4. La contraseña nueva se muestra una sola vez, obliga a cambiarla y cierra las sesiones')
{
  const a3 = vinculoDe('USUARIO_A3')
  const antes = await ingresarComo('USUARIO_A3')
  comprobar('USUARIO_A3 tiene una sesión abierta antes', !antes.error, antes.error?.message)
  const claveAnterior = cuentas.USUARIO_A3_CLAVE

  const r = await llamarFuncion(adminA, 'dar-contrasena', { persona_id: a3.persona_id })
  const nueva = r.datos?.contrasena
  comprobar('ADMIN_A da una contraseña nueva a un usuario de su empresa', r.estado === 200 && typeof nueva === 'string', `${r.estado}`)
  comprobar('La contraseña nueva tiene 12 caracteres', nueva?.length === 12)

  const renovar = await antes.c.auth.refreshSession()
  comprobar('La sesión que tenía abierta queda cerrada', Boolean(renovar.error), renovar.error?.message)
  const vieja = await ingresarComo('USUARIO_A3', claveAnterior)
  comprobar('La contraseña anterior deja de funcionar', Boolean(vieja.error), vieja.error?.message)

  const despues = await ingresarComo('USUARIO_A3', nueva)
  comprobar('Con la contraseña nueva puede ingresar', !despues.error, despues.error?.message)
  const { data: yo } = await despues.c.auth.getUser()
  const ficha = await despues.c.from('personas').select('debe_cambiar_contrasena').eq('id', yo.user.id).single()
  comprobar('Queda obligado a cambiarla en este ingreso', ficha.data?.debe_cambiar_contrasena === true)
  const empresa = await despues.c.from('empresas').select('id')
  comprobar('Mientras no la cambie, no ve los datos de su empresa', (empresa.data ?? []).length === 0)

  const registro = await adminA.from('contrasenas_dadas').select('*').eq('persona_id', a3.persona_id).order('dado_en', { ascending: false }).limit(1)
  const fila = registro.data?.[0] ?? {}
  comprobar('Queda anotado quién la dio y cuándo', fila.dado_por === vinculoDe('ADMIN_A').persona_id && fila.modo === 'individual' && Boolean(fila.dado_en))
  comprobar('El registro no guarda la contraseña (ningún campo la contiene)', !Object.values(fila).some((v) => String(v).includes(nueva)), Object.keys(fila).join(', '))
  const otraVez = await llamarFuncion(adminA, 'dar-contrasena', { persona_id: a3.persona_id })
  comprobar('No hay forma de volver a verla: pedirla otra vez genera una distinta', otraVez.estado === 200 && otraVez.datos?.contrasena !== nueva)

  // Deja la cuenta lista para la próxima vez: cambia la última contraseña dada por una fuerte y la guarda.
  const ultima = otraVez.datos?.contrasena ?? nueva
  guardarCuenta('USUARIO_A3', cuentas.USUARIO_A3_DOC, ultima)
  const s = await ingresarComo('USUARIO_A3')
  const fuerte = claveFuerte()
  const cambio = await llamarFuncion(s.c, 'cambiar-contrasena', { contrasena_actual: ultima, contrasena_nueva: fuerte })
  if (cambio.estado === 200) guardarCuenta('USUARIO_A3', cuentas.USUARIO_A3_DOC, fuerte)
  comprobar('Al cambiarla, vuelve a ver los datos de su empresa', cambio.estado === 200 && (await (await ingresarComo('USUARIO_A3')).c.from('empresas').select('id')).data?.length === 1)

  const ajeno = await sesion.ADMIN_B.from('contrasenas_dadas').select('id').eq('empresa_id', A.id)
  comprobar('ADMIN_B no ve el registro de contraseñas dadas en A', ajeno.data?.length === 0)
  const gestor = await sesion.GESTOR_A.from('contrasenas_dadas').select('id')
  comprobar('El gestor no ve el registro de contraseñas dadas', gestor.data?.length === 0)

  // En bloque (solo el dueño), en la empresa C, que no usan las demás pruebas.
  const bloque = await llamarFuncion(dueno, 'dar-contrasena', { empresa_id: C.id, roles: ['gestor'] })
  const lista = bloque.datos?.resultados ?? []
  comprobar('El dueño restablece en bloque los gestores de C', bloque.estado === 200 && lista.length > 0 && lista.every((x) => x.contrasena?.length === 12 && x.rol === 'gestor'), `${lista.length} cuentas`)
  const sinAdmin = lista.every((x) => x.rol !== 'admin_empresa')
  comprobar('El restablecimiento en bloque respeta los roles elegidos', sinAdmin)
}

// ───────────────────────────────────────────────
seccion('5. Solo el dueño de la plataforma ve el registro de intentos de ingreso')
{
  const propio = await dueno.from('intentos_ingreso').select('id', { count: 'exact', head: true })
  comprobar('El dueño ve los intentos', (propio.count ?? 0) > 0, `${propio.count} intentos`)
  for (const n of ['ADMIN_A', 'GESTOR_A', 'USUARIO_A2', 'ADMIN_B']) {
    const r = await sesion[n].from('intentos_ingreso').select('id')
    comprobar(`${n} ve 0 intentos`, (r.data ?? []).length === 0)
  }
  const anon = await cliente().from('intentos_ingreso').select('id')
  comprobar('Sin iniciar sesión no se ve ningún intento', (anon.data ?? []).length === 0, anon.error?.message)
  const borrar = await dueno.from('intentos_ingreso').delete().lt('creado_en', '2000-01-01').select('id')
  comprobar('Nadie puede borrar intentos desde la app (ni el dueño)', Boolean(borrar.error) || (borrar.data ?? []).length === 0, borrar.error?.message)
}

// ───────────────────────────────────────────────
seccion('6. Áreas y puestos: cada empresa tiene los suyos')
{
  const { data: areasA } = await dueno.from('areas').select('id, nombre').eq('empresa_id', A.id)
  for (const n of ['ADMIN_B', 'GESTOR_B', 'USUARIO_B']) {
    const a = await sesion[n].from('areas').select('empresa_id')
    const p = await sesion[n].from('puestos').select('empresa_id')
    comprobar(`${n}: las áreas y puestos de A no aparecen`, [...(a.data ?? []), ...(p.data ?? [])].every((x) => x.empresa_id === B.id), `${a.data?.length} áreas, ${p.data?.length} puestos`)
  }
  const mias = await adminA.from('areas').select('empresa_id')
  comprobar('ADMIN_A ve las áreas de su empresa', mias.data?.length === areasA.length && mias.data.every((x) => x.empresa_id === A.id), `${mias.data?.length}`)

  const ajena = await sesion.ADMIN_B.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: A.id, p_id: null, p_nombre: 'Área intrusa' })
  comprobar('ADMIN_B no puede agregar áreas en A', NO_AUTORIZADO(ajena), ajena.error?.message)
  const renombrar = await sesion.ADMIN_B.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: B.id, p_id: areasA[0].id, p_nombre: 'Renombrada' })
  comprobar('ADMIN_B no puede renombrar un área de A', NO_AUTORIZADO(renombrar), renombrar.error?.message)
  const desact = await sesion.ADMIN_B.rpc('cambiar_vigencia_item_lista', { p_lista: 'areas', p_id: areasA[0].id, p_vigente: false })
  comprobar('ADMIN_B no puede desactivar un área de A', NO_AUTORIZADO(desact), desact.error?.message)
  const borrar = await sesion.ADMIN_B.rpc('borrar_item_lista', { p_lista: 'puestos', p_id: (await dueno.from('puestos').select('id').eq('empresa_id', A.id).limit(1)).data[0].id })
  comprobar('ADMIN_B no puede borrar un puesto de A', NO_AUTORIZADO(borrar), borrar.error?.message)

  // El administrador maneja las listas de su empresa.
  const nombre = `Área de prueba ${Date.now() % 100000}`
  const nueva = await adminA.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: A.id, p_id: null, p_nombre: nombre })
  comprobar('ADMIN_A agrega un área en su empresa', !nueva.error && Boolean(nueva.data), nueva.error?.message)
  const repetida = await adminA.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: A.id, p_id: null, p_nombre: ` ${nombre.toLowerCase()} ` })
  comprobar('No acepta un nombre repetido (aunque cambien mayúsculas o espacios)', /Ya existe/.test(repetida.error?.message ?? ''), repetida.error?.message)
  const cambia = await adminA.rpc('guardar_item_lista', { p_lista: 'areas', p_empresa: A.id, p_id: nueva.data, p_nombre: `${nombre} (renombrada)` })
  comprobar('ADMIN_A renombra el área', !cambia.error, cambia.error?.message)
  const off = await adminA.rpc('cambiar_vigencia_item_lista', { p_lista: 'areas', p_id: nueva.data, p_vigente: false })
  comprobar('ADMIN_A desactiva el área', !off.error, off.error?.message)
  const usarOff = await adminA.rpc('actualizar_persona', { p_vinculo: vinculoDe('USUARIO_A3').id, p_datos: { area_id: nueva.data } })
  comprobar('No se puede asignar un área desactivada', /desactivada/.test(usarOff.error?.message ?? ''), usarOff.error?.message)
  const fuera = await adminA.rpc('actualizar_persona', { p_vinculo: vinculoDe('USUARIO_A3').id, p_datos: { area_id: (await dueno.from('areas').select('id').eq('empresa_id', B.id).limit(1)).data[0].id } })
  comprobar('No se puede asignar un área de otra empresa', /lista de la empresa/.test(fuera.error?.message ?? ''), fuera.error?.message)
  const sinLista = await llamarFuncion(adminA, 'crear-cuenta', {
    empresa_id: A.id, rol: 'usuario', tipo_documento: 'dni', numero_documento: '20000097',
    apellidos_nombres: 'PRUEBA SIN LISTA, Saúl (ficticio)', fecha_ingreso: '2026-05-01', puesto: 'Puesto que no existe',
  })
  comprobar('No se crea una cuenta con un puesto que no está en la lista', sinLista.estado === 400, `${sinLista.estado}`)
  const fuera2 = await adminA.rpc('borrar_item_lista', { p_lista: 'areas', p_id: nueva.data })
  comprobar('ADMIN_A borra el área que nunca se usó', !fuera2.error, fuera2.error?.message)
  const enUso = await adminA.rpc('borrar_item_lista', { p_lista: 'areas', p_id: areasA.find((x) => x.nombre === 'Logística').id })
  comprobar('Un área en uso no se borra: hay que desactivarla', /en uso/.test(enUso.error?.message ?? ''), enUso.error?.message)
}

// ───────────────────────────────────────────────
seccion('7. El administrador corrige datos de su gente y el historial lo anota')
{
  const a3 = vinculoDe('USUARIO_A3')
  const { data: puestosA } = await adminA.from('puestos').select('id, nombre')
  const destino = puestosA.find((p) => p.nombre === 'Operaria') ?? puestosA[0]
  const r = await adminA.rpc('actualizar_persona', { p_vinculo: a3.id, p_datos: { rol: 'gestor', puesto_id: destino.id } })
  comprobar('ADMIN_A cambia el rol (usuario → gestor) y el puesto', !r.error, r.error?.message)
  const leido = await adminA.from('vinculos').select('rol, puesto').eq('id', a3.id).single()
  comprobar('Se guardó el cambio y el nombre del puesto', leido.data?.rol === 'gestor' && leido.data?.puesto === destino.nombre, JSON.stringify(leido.data))
  const hist = await adminA.from('vinculos_historial').select('accion, rol, puesto').eq('vinculo_id', a3.id).order('hecho_en', { ascending: false }).limit(1)
  comprobar('El historial anota la corrección', hist.data?.[0]?.accion === 'cambio' && hist.data?.[0]?.rol === 'gestor', JSON.stringify(hist.data?.[0]))
  const vuelve = await adminA.rpc('actualizar_persona', { p_vinculo: a3.id, p_datos: { rol: 'usuario' } })
  comprobar('…y lo devuelve a usuario', !vuelve.error, vuelve.error?.message)
  const malFecha = await adminA.rpc('actualizar_persona', { p_vinculo: a3.id, p_datos: { fecha_ingreso: 'ayer' } })
  comprobar('Rechaza una fecha de ingreso no válida', /Fecha/.test(malFecha.error?.message ?? ''), malFecha.error?.message)
  const directo = await adminA.from('vinculos').update({ rol: 'admin_empresa' }).eq('id', a3.id).select('id')
  comprobar('Nadie escribe directo en la tabla de cuentas', Boolean(directo.error) || (directo.data ?? []).length === 0, directo.error?.message)
}

const fallas = resumen()

const fecha = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })
let md = `# Usuarios y roles por empresa · CRC tarea 3.3\n\nEjecutada: ${fecha} (hora de Lima) · Proyecto Supabase \`crc-dev\` · Solo datos ficticios.\n\n`
md += `**Resultado: ${resultados.length - fallas} de ${resultados.length} pruebas pasaron.**\n\n`
md += 'Cada prueba ingresa con una persona de prueba por la misma puerta que usa la app e intenta ver o hacer lo que no le corresponde. Las contraseñas nunca se imprimen.\n'
md += '\nEl borrado automático de los intentos de más de 90 días se comprueba aparte, en la base de datos: ver `borrado-de-intentos-90-dias.md`.\n'
grupos.forEach((g, i) => {
  const hasta = grupos[i + 1]?.desde ?? resultados.length
  md += `\n## ${g.titulo}\n\n| Resultado | Prueba | Detalle |\n|---|---|---|\n`
  for (const r of resultados.slice(g.desde, hasta)) md += `| ${r.paso ? '✅ Pasa' : '❌ Falla'} | ${r.nombre} | ${String(r.detalle ?? '').replace(/\|/g, '/')} |\n`
})
mkdirSync('pruebas/resultados', { recursive: true })
writeFileSync('pruebas/resultados/usuarios-y-roles.md', md)
console.log('Informe: pruebas/resultados/usuarios-y-roles.md')
process.exit(fallas ? 1 : 0)
