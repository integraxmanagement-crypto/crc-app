// Reglas de contraseña de CRC (aprobadas el 22/10/2026). Se aplican en el servidor: nadie se las salta desde la app.

// Sin letras ni números que se confunden al dictarlos o copiarlos: 0/O, 1/l/I.
// Símbolos fáciles de encontrar en el teclado del celular.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#%+-!?'
const LARGO_INICIAL = 12

// Requisitos fijados en el panel de Supabase (22/10/2026): minúscula, mayúscula, número y símbolo.
// Se revisan igual que Supabase (letras sin tilde y su lista de símbolos) para dar un mensaje claro antes.
const SIMBOLOS_SUPABASE = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~'
const REQUISITOS: [RegExp | ((c: string) => boolean), string][] = [
  [/[a-z]/, 'una minúscula'],
  [/[A-Z]/, 'una mayúscula'],
  [/[0-9]/, 'un número'],
  [(c) => [...c].some((x) => SIMBOLOS_SUPABASE.includes(x)), 'un símbolo (por ejemplo - ! # ?)'],
]

/** Contraseña inicial al azar (12 caracteres, ~72 bits). Se muestra una sola vez y nunca se guarda legible. */
export function generarContrasenaInicial(numeroDocumento: string): string {
  for (;;) {
    let clave = ''
    // Muestreo con rechazo: cada carácter tiene exactamente la misma probabilidad.
    const limite = 256 - (256 % ALFABETO.length)
    while (clave.length < LARGO_INICIAL) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      for (const b of bytes) {
        if (b < limite && clave.length < LARGO_INICIAL) clave += ALFABETO[b % ALFABETO.length]
      }
    }
    if (validarContrasena(clave, numeroDocumento) === null) return clave
  }
}

/** Devuelve el motivo de rechazo en lenguaje simple, o null si la contraseña es válida. */
export function validarContrasena(clave: string, numeroDocumento: string): string | null {
  if (clave.length < 8) return 'Debe tener al menos 8 caracteres.'
  if (clave.length > 64) return 'Debe tener como máximo 64 caracteres.'
  const faltan = REQUISITOS.filter(([r]) => !(typeof r === 'function' ? r(clave) : r.test(clave))).map(([, t]) => t)
  if (faltan.length) return `Le falta: ${faltan.join(', ')}.`

  const simple = normalizar(clave)
  const doc = numeroDocumento.toLowerCase()
  if (doc && simple.includes(doc)) return 'No puede contener tu número de documento.'

  const tramos = simple.match(/\p{L}+|\p{N}+|[^\p{L}\p{N}]+/gu) ?? []
  // Hasta 3 tramos (p. ej. "abcd" + "1234" + "!"), todos repetidos o en secuencia: demasiado predecible.
  if (tramos.length <= 3 && tramos.every(esSecuenciaORepetido)) return 'Es demasiado fácil de adivinar (repeticiones o secuencias como 12345678 o abcd1234).'

  if (COMUNES.has(simple)) return 'Es una contraseña muy común. Elige otra.'
  const base = simple.replace(/[^\p{L}]+$/u, '').replace(/^[^\p{L}]+/u, '')
  if (base && PALABRAS_COMUNES.has(base) && /^[^\p{L}]*\p{L}+[^\p{L}]*$/u.test(simple)) {
    return 'Se basa en una palabra muy común. Elige otra.'
  }
  return null
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const SECUENCIAS = ['abcdefghijklmnopqrstuvwxyz', '01234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']

function esSecuenciaORepetido(tramo: string): boolean {
  if (/^(.)\1*$/u.test(tramo)) return true
  const reves = [...tramo].reverse().join('')
  return SECUENCIAS.some((s) => s.includes(tramo) || s.includes(reves))
}

// Palabras que, con números o símbolos alrededor, siguen siendo fáciles de adivinar (p. ej. "peru2026", "Lima123!").
const PALABRAS_COMUNES = new Set([
  'peru', 'lima', 'arequipa', 'cusco', 'trujillo', 'piura', 'callao', 'chiclayo', 'contrasena', 'clave', 'password',
  'passw', 'pass', 'admin', 'administrador', 'usuario', 'user', 'crc', 'centinel', 'integrax', 'seguridad', 'sst',
  'sgsst', 'bienvenido', 'bienvenida', 'hola', 'holamundo', 'qwerty', 'iloveyou', 'teamo', 'amor', 'amorcito',
  'princesa', 'dragon', 'monkey', 'master', 'sunshine', 'football', 'futbol', 'alianza', 'universitario', 'cristal',
  'barcelona', 'realmadrid', 'jesus', 'dios', 'diosesamor', 'maria', 'jose', 'juan', 'carlos', 'luis', 'miguel',
  'familia', 'mama', 'papa', 'hijo', 'hija', 'casa', 'trabajo', 'empresa', 'mina', 'minera', 'mineria', 'peligro',
  'riesgo', 'casco', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'setiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'verano', 'invierno', 'secreto', 'cambiar', 'nueva',
  'nuevo', 'prueba', 'test', 'demo', 'temporal', 'welcome', 'letmein', 'login', 'abc', 'abcd', 'qwe', 'asd', 'zxc',
])

// Contraseñas completas muy usadas (listas públicas de filtraciones), ya normalizadas a minúsculas sin tildes.
const COMUNES = new Set([
  '123456', '12345678', '123456789', '1234567890', 'password', 'password1', 'password123', 'qwerty123', 'qwerty1',
  '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'qwer1234', 'asdf1234', 'zxcv1234', 'abc12345', 'abc123456', 'a1b2c3d4',
  'aa123456', 'iloveyou1', 'contrasena1', 'contrasena123', 'clave123', 'clave1234', 'admin123', 'admin1234',
  'administrador1', 'usuario1', 'usuario123', 'peru2024', 'peru2025', 'peru2026', 'peru123', 'lima2024', 'lima2025',
  'lima2026', 'lima123', 'bienvenido1', 'bienvenido123', 'teamo123', 'princesa1', 'dragon123', 'monkey123',
  'sunshine1', 'football1', 'welcome1', 'welcome123', 'letmein1', 'passw0rd', 'p4ssw0rd', 'pa55word', 'p@ssw0rd',
  'p@ssword1', 'trustno1', 'starwars1', 'pokemon1', 'naruto123', 'batman123', 'superman1', 'michael1', 'jordan23',
  'shadow123', 'master123', 'killer123', 'hello123', 'charlie1', 'freedom1', 'whatever1', 'computer1', 'internet1',
  'samsung1', 'iphone12', 'google123', 'facebook1', 'linkedin1', 'cambiame1', 'cambiar123', 'nueva1234', 'secreto1',
  'temporal1', 'prueba123', 'test1234', 'demo1234', 'abcd1234', 'abcde12345', 'abcdef123', '11223344', '12121212',
  '12341234', '11112222', '1122334455', '147258369', '159753456', '741852963', '789456123', '987654321', '00000000',
  '88888888', '99999999', 'qazwsx123', 'qazwsxedc', '1qaz2wsx', 'zaq12wsx', 'q1w2e3r4t5', 'asdfghjkl1', 'mnbvcxz1',
  'crc12345', 'centinel1', 'integrax1', 'seguridad1', 'sst12345', 'sgsst2026', 'mama1234', 'papa1234', 'familia1',
  'jesus123', 'dios1234', 'maria123', 'jose1234', 'alianza1', 'universitario1', 'cristal1', 'barcelona1',
  'realmadrid1', 'futbol123', 'amor1234', 'teamo1234', 'te amo 123', 'iloveyou2',
])
