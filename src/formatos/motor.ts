// Motor de reglas de los formatos (tarea 3.4-B). Calcula el resultado, el puntaje y los hallazgos de una
// inspección a partir de la receta, las respuestas y los datos del activo. No sabe de qué inspección se trata:
// todo lo dice la receta. Lo usan la vista previa del constructor (3.4-B), la pantalla de inspección en el
// celular, también sin señal (3.4-C), y el servidor, que vuelve a calcular al recibir la inspección.
import { aplicaSubtipo, type Punto, type Receta, type Seccion, TIPOS_EVALUABLES } from './receta.ts'

export type Valor = string | number | null
export type Respuesta = {
  valor: Valor // cumple: 'si' | 'no' | 'na' · si_no: 'si' | 'no' · número · texto · fecha AAAA-MM-DD…
  obs?: string | null
  fotos?: number // cantidad de fotos tomadas para el punto
  accion?: { texto: string; responsable: string | null; plazo: string | null } | null
}
export type Fila = Record<string, Respuesta>

export type Entrada = {
  respuestas: Record<string, Respuesta>
  filas?: Record<string, Fila[]> // bloques repetibles, por clave de sección
  observacion?: string | null
  activo?: { subtipo?: string | null; datos?: Record<string, Valor> } | null
  fecha: string // día de la inspección, AAAA-MM-DD
}

export type Hallazgo = {
  origen: 'no_cumple' | 'fuera_rango' | 'vencido' | 'fila'
  clave: string | null // punto (o sección, en un bloque repetible)
  fila: number | null
  texto: string
  accion?: Respuesta['accion']
}

export type Evaluacion = {
  resultado: string | null // null = sin resultado (solo «Realizado»)
  regla: number | null // índice de la regla que dio el resultado
  puntaje: number | null
  hallazgos: Hallazgo[]
  vencidos: string[] // datos del activo vencidos (para mostrarlos)
  faltan: string[] // lo que falta para poder cerrar, en lenguaje simple
}

const noCumple = (p: Punto, v: Valor) => TIPOS_EVALUABLES.includes(p.tipo) && v === 'no'
const vacio = (v: Valor | undefined) => v == null || (typeof v === 'string' && v.trim() === '')
const fueraDeRango = (p: Punto, v: Valor) =>
  p.tipo === 'numero' && typeof v === 'number' && ((p.min != null && v < p.min) || (p.max != null && v > p.max))

/** Secciones y puntos que corresponden al subtipo del activo (bombas: electrobomba o motobomba; DACI: panel…). */
export function seccionesVisibles(r: Receta, subtipo: string | null | undefined): Seccion[] {
  return r.secciones
    .filter((s) => aplicaSubtipo(s.solo_subtipos, subtipo))
    .map((s) => ({ ...s, puntos: s.puntos.filter((p) => aplicaSubtipo(p.solo_subtipos, subtipo)) }))
}

/** ¿El bloque repetible está activo? (IPF: solo si «¿Se identificaron condiciones inseguras?» = Sí). */
export function repetibleActivo(s: Seccion, respuestas: Record<string, Respuesta>) {
  if (!s.repetible) return false
  const clave = s.repetible.activa_con
  return !clave || respuestas[clave]?.valor === 'si'
}

/** Año y mes (AAAA-MM) de una fecha AAAA-MM-DD. */
const mesDe = (fecha: string) => fecha.slice(0, 7)

/** Datos del activo que están vencidos en la fecha de la inspección, según una regla «vencido». */
export function datosVencidos(controles: Extract<Receta['reglas'][number], { tipo: 'vencido' }>['controles'], datos: Record<string, Valor>, fecha: string) {
  const vencidos: string[] = []
  const anio = Number(fecha.slice(0, 4))
  for (const c of controles) {
    const v = datos[c.campo]
    if (c.tipo === 'fecha_limite') {
      // Sin fecha también cuenta como vencido: no se puede saber si está al día.
      if (vacio(v) || String(v) < mesDe(fecha)) vencidos.push(c.campo)
    } else if (c.anios != null) {
      if (vacio(v) || anio - Number(v) > c.anios) vencidos.push(c.campo)
    }
  }
  return vencidos
}

/** Calcula todo lo de una inspección. Misma entrada → mismo resultado, en el celular y en el servidor. */
export function evaluar(r: Receta, e: Entrada): Evaluacion {
  const subtipo = e.activo?.subtipo ?? null
  const datos = e.activo?.datos ?? {}
  const secciones = seccionesVisibles(r, subtipo)
  const fijas = secciones.filter((s) => !s.repetible)
  const puntos = fijas.flatMap((s) => s.puntos)
  const hallazgos: Hallazgo[] = []
  const faltan: string[] = []

  // 1. Lo que falta para cerrar
  const revisar = (p: Punto, resp: Respuesta | undefined, donde: string) => {
    if (p.tipo === 'calculo') return
    const v = resp?.valor ?? null
    if (p.tipo === 'foto') {
      if (p.obligatorio && !(resp?.fotos ?? 0)) faltan.push(`${donde}: falta la foto.`)
      return
    }
    if (p.obligatorio && vacio(v)) faltan.push(`${donde}: falta la respuesta.`)
    if (noCumple(p, v)) {
      if (p.obs_si_no_cumple && vacio(resp?.obs ?? null)) faltan.push(`${donde}: escribe la observación.`)
      if (p.foto_si_no_cumple && !(resp?.fotos ?? 0)) faltan.push(`${donde}: toma una foto.`)
      if (p.pide_accion) {
        const a = resp?.accion
        if (!a || vacio(a.texto) || !a.responsable || !a.plazo) faltan.push(`${donde}: completa la acción correctiva, el responsable y el plazo.`)
      }
    }
    if (p.tipo === 'numero' && !vacio(v) && typeof v !== 'number') faltan.push(`${donde}: escribe un número.`)
  }
  for (const p of puntos) revisar(p, e.respuestas[p.clave], p.clave)

  // 2. Bloques repetibles
  const filasActivas: Record<string, Fila[]> = {}
  for (const s of secciones.filter((x) => x.repetible)) {
    const filas = repetibleActivo(s, e.respuestas) ? (e.filas?.[s.clave] ?? []) : []
    filasActivas[s.clave] = filas
    if (repetibleActivo(s, e.respuestas) && filas.length < (s.repetible?.minimo ?? 0))
      faltan.push(`${s.titulo}: agrega al menos ${s.repetible?.minimo} fila(s).`)
    filas.forEach((fila, i) => {
      for (const p of s.puntos) revisar(p, fila[p.clave], `${s.titulo} ${i + 1} · ${p.texto || p.clave}`)
      if (s.repetible?.genera_hallazgo) {
        const textos = s.puntos.filter((p) => p.tipo === 'texto' || p.tipo === 'texto_largo').map((p) => fila[p.clave]?.valor).filter((v) => !vacio(v))
        const responsable = s.puntos.find((p) => p.tipo === 'persona')
        const plazo = s.puntos.find((p) => p.tipo === 'fecha')
        hallazgos.push({
          origen: 'fila',
          clave: s.clave,
          fila: i,
          texto: textos.join(' · ') || s.titulo,
          accion: {
            texto: String(textos[textos.length - 1] ?? ''),
            responsable: responsable ? (fila[responsable.clave]?.valor as string | null) ?? null : null,
            plazo: plazo ? (fila[plazo.clave]?.valor as string | null) ?? null : null,
          },
        })
      }
    })
  }

  // 3. Hallazgos de los puntos
  for (const p of puntos) {
    const resp = e.respuestas[p.clave]
    const v = resp?.valor ?? null
    if ((p.hallazgo === 'no_cumple' && noCumple(p, v)) || (p.hallazgo === 'fuera_rango' && fueraDeRango(p, v))) {
      hallazgos.push({
        origen: p.hallazgo === 'fuera_rango' ? 'fuera_rango' : 'no_cumple',
        clave: p.clave,
        fila: null,
        texto: [p.texto, resp?.obs].filter((t) => !vacio(t ?? null)).join(' · '),
        accion: resp?.accion ?? null,
      })
    }
  }

  // 4. Vencimientos (para el resultado y, si la plantilla lo pide, como hallazgo)
  const vencidos = [
    ...new Set(r.reglas.flatMap((g) => (g.tipo === 'vencido' ? datosVencidos(g.controles, datos, e.fecha) : []))),
  ]
  if (r.hallazgo_vencimiento)
    for (const campo of vencidos) hallazgos.push({ origen: 'vencido', clave: campo, fila: null, texto: `Vencido: ${campo}` })

  // 5. Resultado: la primera regla que se cumple
  let regla: number | null = null
  for (const [i, g] of r.reglas.entries()) {
    let cumple = false
    if (g.tipo === 'vencido') cumple = datosVencidos(g.controles, datos, e.fecha).length > 0
    else if (g.tipo === 'x_en') {
      const enSeccion = new Set(fijas.find((s) => s.clave === g.seccion)?.puntos.map((p) => p.clave) ?? [])
      const elegidos = puntos.filter((p) =>
        g.alcance === 'todos' ? true : g.alcance === 'criticos' ? p.critico : g.alcance === 'seccion' ? enSeccion.has(p.clave) : g.claves?.includes(p.clave),
      )
      cumple = elegidos.some((p) => noCumple(p, e.respuestas[p.clave]?.valor ?? null))
    } else if (g.tipo === 'respuesta') cumple = e.respuestas[g.clave]?.valor === g.valor
    else if (g.tipo === 'observacion') cumple = !vacio(e.observacion ?? null)
    else if (g.tipo === 'fuera_rango') cumple = puntos.some((p) => fueraDeRango(p, e.respuestas[p.clave]?.valor ?? null))
    else if (g.tipo === 'filas') cumple = (filasActivas[g.seccion]?.length ?? 0) > 0
    if (cumple) {
      regla = i
      break
    }
  }
  const resultado = regla != null ? r.reglas[regla].etiqueta : r.resultado_defecto

  return { resultado, regla, puntaje: r.puntaje ? calcularPuntaje(r, puntos, e.respuestas) : null, hallazgos, vencidos, faltan }
}

/** % de favorables: (Sí + N/A si cuenta) ÷ contestados, ponderado por el peso de cada punto, redondeado. */
export function calcularPuntaje(r: Receta, puntos: Punto[], respuestas: Record<string, Respuesta>): number | null {
  let favorables = 0
  let total = 0
  for (const p of puntos) {
    if (!TIPOS_EVALUABLES.includes(p.tipo)) continue
    const v = respuestas[p.clave]?.valor
    if (v !== 'si' && v !== 'no' && v !== 'na') continue
    if (v === 'na' && !r.na_favorable) continue
    const peso = p.peso ?? 1
    total += peso
    if (v !== 'no') favorables += peso
  }
  return total ? Math.round((100 * favorables) / total) : null
}
