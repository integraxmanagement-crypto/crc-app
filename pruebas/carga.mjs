// Pruebas de la carga de personal desde Excel (tarea 3.6): permisos, todo o nada, hoja de entrega,
// actualizaciones y reactivaciones. Solo datos FICTICIOS; nunca imprime contraseñas.
// Las filas se arman aquí mismo (la lectura del Excel se prueba aparte); cada corrida usa DNI nuevos al azar
// en el rango 71xxxxxx, así que deja unas pocas cuentas ficticias más en crc-dev.
import { randomInt } from 'node:crypto'
import { cliente, comprobar, cuentas, ingresarComo, ingresarConDocumento, llamarFuncion, resumen } from './comun.mjs'

const { c: dueno } = await ingresarComo('DUENO')
const { c: adminA } = await ingresarComo('ADMIN_A')
const { c: adminB } = await ingresarComo('ADMIN_B')
const { c: gestorA } = await ingresarComo('GESTOR_A')
const { data: empresas } = await dueno.from('empresas').select('id, ruc')
const empresa = (ruc) => empresas.find((e) => e.ruc === ruc).id
const A = empresa('20000000010')
const B = empresa('20000000028')

const base = 71_000_000 + randomInt(900_000)
const dni = (i) => String(base + i * 7)
const fila = (n, i, extra = {}) => ({
  fila: n, tipo: 'DNI', numero: dni(i), nombres: `Prueba Carga ${i}, Ficticia`, fecha: '2024-05-02',
  puesto: 'Operaria', gerencia: 'General (ficticia)', area: 'Planta', subarea: '', rol: 'usuario', ...extra,
})
const buenas = [fila(2, 1), fila(3, 2, { rol: 'gestor', puesto: 'Supervisor SSO', area: 'Seguridad' }), fila(4, 3)]
const grabar = (c, empresaId, filas, otros = {}) => llamarFuncion(c, 'carga-personal', { modo: 'grabar', empresa_id: empresaId, filas, ...otros })
const revisar = (c, empresaId, filas) => llamarFuncion(c, 'carga-personal', { modo: 'revisar', empresa_id: empresaId, filas })
const cuantas = async () => (await dueno.from('personas').select('id', { count: 'exact', head: true }).in('numero_documento', [1, 2, 3, 4].map(dni))).count

console.log('\n1. Permisos')
comprobar('Sin sesión no puede grabar', (await grabar(cliente(), A, buenas)).estado === 401)
comprobar('Un gestor no puede grabar', (await grabar(gestorA, A, buenas)).estado === 403)
comprobar('El administrador de A no puede grabar en B', (await grabar(adminA, B, buenas)).estado === 403)
comprobar('Nada se creó con esos intentos', (await cuantas()) === 0)

console.log('\n2. Todo o nada')
const conError = await grabar(adminA, A, [...buenas, fila(5, 4, { fecha: '2022-02-31' })])
comprobar('Con una fila con error no se graba (409)', conError.estado === 409)
comprobar('El rechazo trae la revisión para mostrarla', conError.datos?.revision?.filas?.length === 4)
const conFalta = await grabar(adminA, A, [...buenas, fila(5, 4, { puesto: 'Puesto que no existe' })])
comprobar('Con un puesto que falta en la lista no se graba (409)', conFalta.estado === 409)
comprobar('Ninguna de esas filas quedó grabada', (await cuantas()) === 0)

console.log('\n3. Grabar y hoja de entrega')
const r1 = await grabar(adminA, A, buenas)
comprobar('El administrador de A graba 3 personas nuevas', r1.estado === 200 && r1.datos?.resumen?.nuevas === 3)
const entregas = r1.datos?.entregas ?? []
comprobar('La hoja de entrega trae 3 contraseñas de 12 caracteres', entregas.length === 3 && entregas.every((e) => e.contrasena?.length === 12))
comprobar('La hoja de entrega está en el orden del Excel', entregas.map((e) => e.fila).join() === '2,3,4')
const { data: vinculos } = await adminA.from('vinculos').select('rol, estado, puesto, area, fecha_ingreso, personas!inner(numero_documento)')
  .in('personas.numero_documento', [1, 2, 3].map(dni))
comprobar('Las 3 quedaron activas en A con su puesto y área', vinculos?.length === 3 && vinculos.every((v) => v.estado === 'activo' && v.puesto && v.area?.includes('›')))
comprobar('El gestor quedó como gestor', vinculos?.some((v) => v.rol === 'gestor' && v.area === 'General (ficticia) › Seguridad'))
const nueva = entregas.find((e) => e.fila === 2)
const ingreso = await ingresarConDocumento(`dni:${dni(1)}`, nueva?.contrasena)
comprobar('La persona nueva puede ingresar con su contraseña inicial', !ingreso.error)
const { data: yo } = await ingreso.c.from('personas').select('debe_cambiar_contrasena').maybeSingle()
comprobar('…y se le pide cambiarla al primer ingreso', yo?.debe_cambiar_contrasena === true)
const { data: cargasA } = await adminA.from('cargas_personal').select('nuevas, filas, hecha_por').eq('id', r1.datos?.carga_id)
comprobar('El registro de la carga queda (quién y cuántas), visible para el administrador de A', cargasA?.length === 1 && cargasA[0].nuevas === 3)
const { data: cargasB } = await adminB.from('cargas_personal').select('id').eq('id', r1.datos?.carga_id)
comprobar('El administrador de B no ve las cargas de A', cargasB?.length === 0)
const { data: columnas } = await adminA.from('cargas_personal').select('*').eq('id', r1.datos?.carga_id)
comprobar('El registro no guarda contraseñas ni nombres', !JSON.stringify(columnas).includes(nueva?.contrasena) && !JSON.stringify(columnas).includes('Prueba Carga'))

console.log('\n4. Volver a cargar el mismo Excel')
const r2 = await grabar(adminA, A, buenas)
comprobar('Sin cambios: no hay nada que grabar (400)', r2.estado === 400)
const otra = await ingresarConDocumento(`dni:${dni(1)}`, nueva?.contrasena)
comprobar('La persona conserva su contraseña', !otra.error)

console.log('\n5. Actualizar')
const cambiadas = [fila(2, 1, { nombres: 'Prueba Carga 1, Ficticia Corregida', puesto: 'Almacenera', area: 'Logística' }), buenas[1], buenas[2]]
const rev = await revisar(adminA, A, cambiadas)
comprobar('La revisión muestra 1 por actualizar y 2 sin cambios', rev.datos?.filas?.filter((f) => f.estado === 'actualizar').length === 1
  && rev.datos.filas.filter((f) => f.estado === 'sin_cambios').length === 2)
const r3 = await grabar(adminA, A, cambiadas)
comprobar('Se graba la actualización y no hay contraseñas nuevas', r3.estado === 200 && r3.datos?.resumen?.actualizadas === 1 && r3.datos.entregas.length === 0)
const { data: p1 } = await adminA.from('vinculos').select('puesto, area, personas!inner(apellidos_nombres, numero_documento)')
  .eq('personas.numero_documento', dni(1)).eq('estado', 'activo').maybeSingle()
comprobar('Nombre, puesto y área quedaron cambiados', p1?.personas?.apellidos_nombres.endsWith('Corregida') && p1.puesto === 'Almacenera' && p1.area === 'General (ficticia) › Logística')

console.log('\n6. Administradores y reactivación')
const filaAdmin = { ...fila(5, 9), numero: cuentas.ADMIN_A2_DOC.split(':')[1], nombres: 'Otro Nombre, Para El Administrador', rol: 'gestor' }
const conAdmin = await revisar(adminA, A, [...cambiadas, filaAdmin])
comprobar('Un administrador que aparece en el Excel queda como «no se toca»', conAdmin.datos?.filas?.[3]?.estado === 'administrador')
const { data: adminAntes } = await adminA.from('vinculos').select('rol, personas!inner(apellidos_nombres, numero_documento)').eq('personas.numero_documento', filaAdmin.numero).eq('estado', 'activo').single()
const { data: v3 } = await adminA.from('vinculos').select('id, personas!inner(numero_documento)').eq('personas.numero_documento', dni(3)).maybeSingle()
const cese = await adminA.rpc('cesar_vinculo', { p_vinculo: v3?.id, p_fecha_cese: '2026-10-20', p_motivo: 'Prueba de reactivación (ficticia)' })
comprobar('Se cesa a una persona para probar la reactivación', !cese.error)
const sinMarcar = await grabar(adminA, A, cambiadas)
comprobar('Si no se marca «reactivar», no hay nada que grabar', sinMarcar.estado === 400)
const { data: sigue } = await adminA.from('vinculos').select('estado').eq('id', v3?.id).single()
comprobar('…y sigue cesada', sigue?.estado === 'cesado')
const marcada = await grabar(adminA, A, [...cambiadas, filaAdmin], { reactivar: [4] })
comprobar('Marcada, se reactiva', marcada.estado === 200 && marcada.datos?.resumen?.reactivadas === 1)
const { data: reactivada } = await adminA.from('vinculos').select('estado, fecha_cese, motivo_cese').eq('id', v3?.id).single()
comprobar('…activa otra vez y sin datos de cese', reactivada?.estado === 'activo' && !reactivada.fecha_cese && !reactivada.motivo_cese)
const { data: adminDespues } = await adminA.from('vinculos').select('rol, personas!inner(apellidos_nombres, numero_documento)').eq('personas.numero_documento', filaAdmin.numero).eq('estado', 'activo').single()
comprobar('El administrador no cambió (ni rol ni nombre)', adminDespues?.rol === 'admin_empresa' && adminDespues.personas.apellidos_nombres === adminAntes?.personas?.apellidos_nombres)

console.log('\n7. Otra empresa')
const ajena = await grabar(adminB, B, [fila(2, 1, { puesto: 'Operaria', area: 'Obras' })])
comprobar('Una persona activa en A no se puede cargar en B', ajena.estado === 409
  && ajena.datos?.revision?.filas?.[0]?.motivos?.some((m) => m.includes('otra empresa')))

resumen()
