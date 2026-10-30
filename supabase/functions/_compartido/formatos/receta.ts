// Copia única compartida por la app (src/formatos/receta.ts la reexporta) y por las funciones del servidor.
// Formatos de inspección (tarea 3.4-B): la «receta» de cada versión de una plantilla.
// Un formato no es una pantalla programada: es esta información guardada. La misma pantalla y el mismo
// motor de reglas (motor.ts) sirven para cualquier formato. La base de datos hace la misma revisión
// que validarReceta() (función app.validar_receta), así que nadie puede guardar una receta mal armada.

/** Tipos de respuesta de un punto. */
export type TipoRespuesta =
  | 'cumple' // √ / X / N/A
  | 'si_no' // Sí / No
  | 'numero'
  | 'texto'
  | 'texto_largo'
  | 'lista'
  | 'fecha'
  | 'hora'
  | 'foto'
  | 'persona' // una persona de CRC de la empresa
  | 'calculo' // lo calcula la app (de una lista fija de cálculos)

export const NOMBRE_TIPO: Record<TipoRespuesta, string> = {
  cumple: '√ / X / N/A',
  si_no: 'Sí / No',
  numero: 'Número',
  texto: 'Texto corto',
  texto_largo: 'Texto largo',
  lista: 'Lista',
  fecha: 'Fecha',
  hora: 'Hora',
  foto: 'Foto',
  persona: 'Persona de la empresa',
  calculo: 'Cálculo automático',
}
export const TIPOS: TipoRespuesta[] = Object.keys(NOMBRE_TIPO) as TipoRespuesta[]

/** Tipos que se pueden «no cumplir» (y por eso generan hallazgos o cuentan en el puntaje). */
export const TIPOS_EVALUABLES: TipoRespuesta[] = ['cumple', 'si_no']

/** Cálculos automáticos de la v1 (fórmulas libres → v1.1). */
export type Formula = 'puntaje' | 'antiguedad'
export const NOMBRE_FORMULA: Record<Formula, string> = {
  puntaje: '% de favorables de esta inspección',
  antiguedad: 'Años desde un dato del activo (año actual − año del dato)',
}

export type CuandoHallazgo = 'nunca' | 'no_cumple' | 'fuera_rango'
export const NOMBRE_HALLAZGO: Record<CuandoHallazgo, string> = {
  nunca: 'No genera hallazgo',
  no_cumple: 'Si no cumple (X o No)',
  fuera_rango: 'Si el número sale del rango',
}

export type Punto = {
  clave: string // fija entre versiones (p. ej. EXT-07)
  texto: string
  ayuda?: string | null
  tipo: TipoRespuesta
  obligatorio: boolean
  critico: boolean
  hallazgo: CuandoHallazgo
  obs_si_no_cumple: boolean // observación obligatoria si no cumple
  foto_si_no_cumple: boolean
  pide_accion: boolean // si no cumple, pide acción correctiva, responsable y plazo al momento (LOTO)
  cantidad?: number | null // cantidad esperada (materiales); cada activo puede tener la suya
  unidad?: string | null // para números: psi, min, V…
  min?: number | null
  max?: number | null
  lista?: string | null // código de una lista de la empresa (tipo «lista»)
  opciones?: string[] | null // opciones fijas (tipo «lista» sin lista de la empresa)
  valor_defecto?: string | null // respuesta ya escrita al empezar la inspección (texto, lista); se puede cambiar
  mostrar_si?: { clave: string; valor: string } | null // el punto solo aparece si el punto «clave» tiene esa respuesta (IPF: «Otros (detallar)»)
  formula?: Formula | null // tipo «calculo»
  campo?: string | null // dato del activo que usa el cálculo «antiguedad»
  solo_subtipos?: string[] | null // vacío = todos los subtipos
  peso?: number | null // para el puntaje (1 por defecto)
  severidad?: null // reservado para la v1.1 (decisión 3 del encargo)
}

/** Un bloque repetible: se agregan las filas que hagan falta (IPF: «condición insegura»). */
export type Repetible = {
  activa_con?: string | null // clave de un punto Sí/No que lo activa con «Sí» (vacío = siempre)
  minimo: number // filas mínimas cuando está activo
  genera_hallazgo: boolean // cada fila genera un hallazgo
}

export type Seccion = {
  clave: string
  titulo: string
  solo_subtipos?: string[] | null
  repetible?: Repetible | null
  puntos: Punto[]
}

export type Firma = {
  clave: string
  titulo: string
  obligatoria: boolean
  externo: boolean // se permite un firmante externo sin cuenta (nombre y documento escritos)
  minimo: number // firmantes mínimos en este rol (IPF: 2 inspectores)
}

export type ControlVencimiento =
  | { campo: string; tipo: 'fecha_limite' } // el dato es el mes en que vence (AAAA-MM)
  | { campo: string; tipo: 'anios'; anios: number | null } // vence si pasan más de N años desde el año del dato

export type Regla =
  | { tipo: 'vencido'; etiqueta: string; controles: ControlVencimiento[] }
  | { tipo: 'x_en'; etiqueta: string; alcance: 'todos' | 'criticos' | 'claves' | 'seccion'; claves?: string[] | null; seccion?: string | null }
  | { tipo: 'respuesta'; etiqueta: string; clave: string; valor: string }
  | { tipo: 'observacion'; etiqueta: string }
  | { tipo: 'fuera_rango'; etiqueta: string }
  | { tipo: 'filas'; etiqueta: string; seccion: string }

export type TipoRegla = Regla['tipo']
export const NOMBRE_REGLA: Record<TipoRegla, string> = {
  vencido: 'Un dato del activo está vencido',
  x_en: 'Hay al menos un «no cumple» en…',
  respuesta: 'Un punto tiene una respuesta dada',
  observacion: 'Hay texto en la observación general',
  fuera_rango: 'Un número está fuera de su rango',
  filas: 'El bloque repetible tiene al menos una fila',
}

export type Receta = {
  version: 1
  secciones: Seccion[]
  firmas: Firma[]
  reglas: Regla[] // se revisan en orden; la primera que se cumple da el resultado
  resultado_defecto: string | null // si ninguna regla se cumple (vacío = «sin resultado»: solo Realizado)
  puntaje: boolean
  na_favorable: boolean
  hallazgo_vencimiento: boolean
  observacion_general: boolean
}

export const RECETA_VACIA: Receta = {
  version: 1,
  secciones: [],
  firmas: [{ clave: 'inspector', titulo: 'Inspector', obligatoria: true, externo: false, minimo: 1 }],
  reglas: [],
  resultado_defecto: null,
  puntaje: false,
  na_favorable: true,
  hallazgo_vencimiento: false,
  observacion_general: true,
}

export function puntoNuevo(clave: string): Punto {
  return {
    clave,
    texto: '',
    tipo: 'cumple',
    obligatorio: true,
    critico: false,
    hallazgo: 'no_cumple',
    obs_si_no_cumple: false,
    foto_si_no_cumple: false,
    pide_accion: false,
  }
}

/** Todos los puntos, en orden, con su sección. */
export function todosLosPuntos(r: Receta): { seccion: Seccion; punto: Punto }[] {
  return r.secciones.flatMap((seccion) => seccion.puntos.map((punto) => ({ seccion, punto })))
}

/** ¿La sección o el punto se muestra para este subtipo de activo? */
export function aplicaSubtipo(solo: string[] | null | undefined, subtipo: string | null | undefined) {
  return !solo?.length || (subtipo != null && solo.includes(subtipo))
}

/** Siguiente clave libre con un prefijo (p. ej. «EXT-14»). */
export function siguienteClave(r: Receta, prefijo: string): string {
  const usadas = new Set(todosLosPuntos(r).map((x) => x.punto.clave))
  for (let n = 1; ; n++) {
    const clave = `${prefijo}-${String(n).padStart(2, '0')}`
    if (!usadas.has(clave)) return clave
  }
}

export const LIMITES = { puntos: 300, secciones: 40, reglas: 20, firmas: 6, texto: 300, titulo: 120, etiqueta: 60 }
const RE_CLAVE = /^[A-Z0-9][A-Z0-9_-]{0,29}$/
const RE_CLAVE_SECCION = /^[a-z0-9][a-z0-9_-]{0,29}$/

/**
 * Revisa que la receta esté bien armada. Devuelve los problemas en lenguaje simple (vacío = está bien).
 * Con paraPublicar = true exige además lo necesario para usarla (al menos un punto, textos completos).
 */
export function validarReceta(r: Receta, paraPublicar = false): string[] {
  const p: string[] = []
  const claves = new Set<string>()
  const clavesSeccion = new Set<string>()
  const todos = todosLosPuntos(r)
  if (r.secciones.length > LIMITES.secciones) p.push(`Máximo ${LIMITES.secciones} secciones.`)
  if (todos.length > LIMITES.puntos) p.push(`Máximo ${LIMITES.puntos} puntos.`)
  if (paraPublicar && !todos.length) p.push('El formato no tiene ningún punto.')

  for (const s of r.secciones) {
    const nombre = s.titulo.trim() || 'sin título'
    if (!RE_CLAVE_SECCION.test(s.clave) || clavesSeccion.has(s.clave)) p.push(`La sección «${nombre}» tiene una clave interna repetida o no válida.`)
    clavesSeccion.add(s.clave)
    if (paraPublicar && s.titulo.trim().length < 2) p.push('Hay una sección sin título.')
    if (s.titulo.length > LIMITES.titulo) p.push(`El título de la sección «${nombre.slice(0, 30)}…» es muy largo.`)
    if (s.repetible) {
      if (!Number.isInteger(s.repetible.minimo) || s.repetible.minimo < 0 || s.repetible.minimo > 50)
        p.push(`La sección «${nombre}»: el mínimo de filas debe ser un número entre 0 y 50.`)
    }
    if (paraPublicar && !s.puntos.length) p.push(`La sección «${nombre}» no tiene puntos.`)
    for (const pt of s.puntos) {
      const etiqueta = pt.clave || 'sin clave'
      if (!RE_CLAVE.test(pt.clave)) p.push(`La clave «${etiqueta}» no es válida: usa mayúsculas, números y guiones (máx. 30).`)
      else if (claves.has(pt.clave)) p.push(`La clave «${pt.clave}» está repetida.`)
      claves.add(pt.clave)
      if (pt.texto.length > LIMITES.texto) p.push(`${etiqueta}: el texto es muy largo (máx. ${LIMITES.texto}).`)
      if (paraPublicar && pt.texto.trim().length < 2) p.push(`${etiqueta}: falta el texto del punto.`)
      if (!TIPOS.includes(pt.tipo)) p.push(`${etiqueta}: tipo de respuesta no válido.`)
      if (pt.hallazgo === 'no_cumple' && !TIPOS_EVALUABLES.includes(pt.tipo))
        p.push(`${etiqueta}: solo los puntos √/X/N/A o Sí/No pueden generar hallazgo «si no cumple».`)
      // Un número sin rango todavía no genera hallazgos: la empresa pone el mínimo y el máximo cuando los conozca.
      if (pt.hallazgo === 'fuera_rango' && pt.tipo !== 'numero') p.push(`${etiqueta}: «fuera de rango» solo va en puntos de tipo número.`)
      if ((pt.critico || pt.obs_si_no_cumple || pt.foto_si_no_cumple || pt.pide_accion) && !TIPOS_EVALUABLES.includes(pt.tipo))
        p.push(`${etiqueta}: crítico, observación, foto o acción «si no cumple» solo van en puntos √/X/N/A o Sí/No.`)
      if (pt.min != null && pt.max != null && pt.min > pt.max) p.push(`${etiqueta}: el mínimo es mayor que el máximo.`)
      if (pt.cantidad != null && (!Number.isInteger(pt.cantidad) || pt.cantidad < 0 || pt.cantidad > 9999))
        p.push(`${etiqueta}: la cantidad esperada debe ser un número entero entre 0 y 9999.`)
      if (pt.tipo === 'lista' && !pt.lista && !pt.opciones?.length) p.push(`${etiqueta}: elige una lista o escribe las opciones.`)
      if (pt.tipo === 'calculo' && !pt.formula) p.push(`${etiqueta}: elige qué se calcula.`)
      if (pt.tipo === 'calculo' && pt.formula === 'antiguedad' && !pt.campo) p.push(`${etiqueta}: elige el dato del activo.`)
      if (pt.peso != null && (pt.peso < 0 || pt.peso > 100)) p.push(`${etiqueta}: el peso debe estar entre 0 y 100.`)
    }
  }
  for (const s of r.secciones) {
    const activa = s.repetible?.activa_con
    if (activa && !todos.some((x) => x.punto.clave === activa && x.punto.tipo === 'si_no'))
      p.push(`La sección «${s.titulo}» se activa con un punto Sí/No que no existe.`)
  }

  const clavesFirma = new Set<string>()
  if (r.firmas.length > LIMITES.firmas) p.push(`Máximo ${LIMITES.firmas} firmas.`)
  for (const f of r.firmas) {
    if (!RE_CLAVE_SECCION.test(f.clave) || clavesFirma.has(f.clave)) p.push(`La firma «${f.titulo}» tiene una clave interna repetida o no válida.`)
    clavesFirma.add(f.clave)
    if (f.titulo.trim().length < 2 || f.titulo.length > LIMITES.titulo) p.push('Hay una firma sin título (o con un título muy largo).')
    if (!Number.isInteger(f.minimo) || f.minimo < 1 || f.minimo > 10) p.push(`Firma «${f.titulo}»: el mínimo de firmantes debe ser entre 1 y 10.`)
  }

  if (r.reglas.length > LIMITES.reglas) p.push(`Máximo ${LIMITES.reglas} reglas.`)
  for (const [i, g] of r.reglas.entries()) {
    const n = `Regla ${i + 1}`
    if (g.etiqueta.trim().length < 2 || g.etiqueta.length > LIMITES.etiqueta) p.push(`${n}: escribe el resultado que da (2 a ${LIMITES.etiqueta} letras).`)
    if (g.tipo === 'x_en' && g.alcance === 'claves' && !g.claves?.length) p.push(`${n}: elige los puntos.`)
    if (g.tipo === 'x_en' && g.alcance === 'claves' && g.claves?.some((c) => !claves.has(c))) p.push(`${n}: usa un punto que ya no existe.`)
    if (g.tipo === 'x_en' && g.alcance === 'seccion' && !r.secciones.some((s) => s.clave === g.seccion && !s.repetible))
      p.push(`${n}: elige una sección (no repetible) que exista.`)
    if (g.tipo === 'respuesta' && !claves.has(g.clave)) p.push(`${n}: usa un punto que ya no existe.`)
    if (g.tipo === 'filas' && !r.secciones.some((s) => s.clave === g.seccion && s.repetible)) p.push(`${n}: la sección repetible ya no existe.`)
    if (g.tipo === 'vencido') {
      if (!g.controles.length) p.push(`${n}: agrega al menos un dato a controlar.`)
      for (const c of g.controles)
        if (c.tipo === 'anios' && c.anios != null && (!Number.isInteger(c.anios) || c.anios < 1 || c.anios > 100))
          p.push(`${n}: los años deben ser un número entero entre 1 y 100 (o vacío).`)
    }
  }
  if (r.resultado_defecto != null && (r.resultado_defecto.trim().length < 2 || r.resultado_defecto.length > LIMITES.etiqueta))
    p.push('El resultado por defecto debe tener entre 2 y 60 letras (o quedar vacío).')
  return [...new Set(p)]
}
