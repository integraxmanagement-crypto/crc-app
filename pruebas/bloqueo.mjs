// Prueba de la opción B: registro de intentos fallidos y bloqueo temporal por documento.
// Usa a USUARIO_B (ficticio), que queda bloqueado 15 minutos al terminar: no repetir antes de ese tiempo.
// Uso: node pruebas/bloqueo.mjs
import { comprobar, cuentas, ingresarComo, ingresarConDocumento, resumen } from './comun.mjs'

const MAL = 'Equivocada-77x'

// 1. Documento que NO existe: se comporta igual que uno que sí existe.
const inexistente = 'dni:99999991'
const respuestas = []
for (let i = 1; i <= 6; i++) respuestas.push(await ingresarConDocumento(inexistente, `${MAL}${i}`))
comprobar('Documento inexistente: los 5 primeros fallos dicen "Documento o contraseña incorrectos."',
  respuestas.slice(0, 5).every((r) => r.estado === 400 && r.error.message === 'Documento o contraseña incorrectos.'))
comprobar('Documento inexistente: el 6.º intento queda bloqueado (no revela que no existe)',
  respuestas[5].estado === 429 && /Demasiados intentos fallidos/.test(respuestas[5].error.message), respuestas[5].error.message)

// 2. Cuenta real: 5 fallos y luego la contraseña CORRECTA también es rechazada durante el bloqueo.
const fallos = []
for (let i = 1; i <= 5; i++) fallos.push(await ingresarComo('USUARIO_B', `${MAL}${i}`))
comprobar('USUARIO_B: 5 contraseñas equivocadas reciben el mensaje de siempre', fallos.every((r) => r.estado === 400))
const correcta = await ingresarComo('USUARIO_B')
comprobar('USUARIO_B: con el documento bloqueado, ni la contraseña correcta entra', correcta.estado === 429, correcta.error?.message)

// 3. El bloqueo es por documento: otra persona sigue entrando normalmente.
const otra = await ingresarComo('GESTOR_B')
comprobar('Otra persona (GESTOR_B) ingresa sin problema', !otra.error, otra.error?.message)

// 4. El registro: el dueño lo ve; un administrador de empresa no.
const { c: dueno } = await ingresarComo('DUENO')
const [, numeroB] = cuentas.USUARIO_B_DOC.split(':')
const { data: registro } = await dueno
  .from('intentos_ingreso')
  .select('resultado, ip, creado_en')
  .eq('numero_documento', numeroB)
  .order('creado_en', { ascending: false })
  .limit(6)
comprobar('El dueño ve en el registro los intentos de USUARIO_B (resultado, hora y dirección de internet)',
  registro?.[0]?.resultado === 'bloqueado' && registro.filter((r) => r.resultado === 'fallo').length === 5 && Boolean(registro[0].ip),
  registro?.map((r) => r.resultado).join(', '))
const { c: adminA } = await ingresarComo('ADMIN_A')
const ajeno = await adminA.from('intentos_ingreso').select('id').limit(5)
comprobar('Un administrador de empresa NO ve el registro', (ajeno.data?.length ?? 0) === 0, ajeno.error?.message)

// 5. Un ingreso correcto reinicia la cuenta de fallos.
const { c: _c, error: e1 } = await ingresarComo('ADMIN_B', `${MAL}a`)
const ok = await ingresarComo('ADMIN_B')
comprobar('Tras un fallo y luego un ingreso correcto, ADMIN_B entra normal', e1?.code === 'invalid_credentials' && !ok.error, ok.error?.message)

process.exit(resumen() ? 1 : 0)
