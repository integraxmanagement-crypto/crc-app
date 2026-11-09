import { useEffect, useId, useRef } from 'react'

/**
 * Botón de eliminar que se mantiene pulsado (06/11/2026): un aro se llena alrededor del botón (unos 1,9 s), el bote de
 * basura tiembla al final y se vuelve un visto; ahí recién se elimina. Si se suelta antes, el aro se vacía y no pasa nada.
 * Sirve con el dedo, el mouse y el teclado (Enter o Espacio sostenidos). Los colores salen de la paleta de la página.
 * Tiempos y curvas: los del diseño del dueño (anillo 0,08–2,0 s, visto 2,0–2,25 s, resorte ω₀ 18, ζ 0,55).
 */
type Props = {
  /** Qué se elimina, para lectores de pantalla (por ejemplo «Borrar Unidad 1»). */
  etiqueta: string
  /** Lo que se elimina, en infinitivo: sale en «Mantén para …». */
  verbo?: string
  onEliminar: () => void
  disabled?: boolean
  /** Solo el botón redondo, sin el texto al lado (para filas angostas). */
  compacto?: boolean
}

const lim = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (e: number, a: number, b: number) => lim((e - a) / (b - a))
const salida = (k: number) => 1 - (1 - k) ** 3
function resorte(t: number) {
  const w0 = 18
  const z = 0.55
  const wd = w0 * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

type Fase = 'reposo' | 'sostener' | 'soltar' | 'hecho'

export function BotonEliminar({ etiqueta, verbo = 'eliminar', onEliminar, disabled, compacto }: Props) {
  const id = useId().replace(/:/g, '')
  const raiz = useRef<SVGGElement>(null)
  const cuerpo = useRef<SVGGElement>(null)
  const arco = useRef<SVGCircleElement>(null)
  const listo = useRef<SVGCircleElement>(null)
  const basura = useRef<SVGGElement>(null)
  const visto = useRef<SVGPathElement>(null)
  const pulso = useRef<SVGCircleElement>(null)
  const cap1 = useRef<HTMLSpanElement>(null)
  const cap2 = useRef<HTMLSpanElement>(null)
  const fase = useRef<Fase>('reposo')
  const k = useRef(0)
  const t0 = useRef(0)
  const antes = useRef(0)
  const pdSuelta = useRef(0)
  const avisado = useRef(false)
  const raf = useRef(0)
  const alEliminar = useRef(onEliminar)
  useEffect(() => {
    alEliminar.current = onEliminar
  })
  const quieto = useRef(false)
  useEffect(() => {
    quieto.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return () => cancelAnimationFrame(raf.current)
  }, [])

  function pintar(kk: number, c: number, pd: number, pop: number, temblor: number, pulsoQ: number | null) {
    const esc = (1 - 0.08 * pd) * (1 + 0.12 * pop)
    raiz.current?.setAttribute('transform', `translate(${temblor.toFixed(2)} 0)`)
    cuerpo.current?.setAttribute('transform', `scale(${esc.toFixed(4)})`)
    if (cuerpo.current) cuerpo.current.style.filter = `drop-shadow(0 0 ${(2 + 3 * kk).toFixed(1)}px rgb(var(--teal-rgb) / ${(0.25 + 0.35 * kk).toFixed(2)}))`
    if (arco.current) {
      arco.current.style.strokeDashoffset = String(100 * (1 - kk))
      arco.current.style.opacity = kk > 0.002 ? '1' : '0'
      arco.current.style.filter = `drop-shadow(0 0 ${(2 + 2.5 * c).toFixed(1)}px rgb(var(--cyan-rgb) / 0.75))`
    }
    listo.current?.setAttribute('opacity', c.toFixed(3))
    if (basura.current) {
      basura.current.setAttribute('transform', `scale(${(1 - 0.3 * c).toFixed(3)})`)
      basura.current.style.opacity = String(1 - c)
      basura.current.style.stroke = `color-mix(in srgb, #fff ${(kk * 100).toFixed(0)}%, var(--mal))`
    }
    if (visto.current) {
      visto.current.style.opacity = String(c > 0 ? 1 : 0)
      visto.current.style.strokeDashoffset = String(100 * (1 - (c > 0 ? seg(c, 0, 1) : 0)))
    }
    if (pulso.current) {
      pulso.current.setAttribute('r', String(67 + 26 * (pulsoQ ?? 0)))
      pulso.current.style.opacity = pulsoQ === null ? '0' : String(1 - pulsoQ)
    }
    const la = lim(1 - 2 * c)
    const lb = lim(2 * c - 1)
    if (cap1.current) {
      cap1.current.style.opacity = String(la)
      cap1.current.style.transform = `translateY(${-3 * (1 - la)}px)`
    }
    if (cap2.current) {
      cap2.current.style.opacity = String(lb)
      cap2.current.style.transform = `translateY(${3 * (1 - lb)}px)`
    }
  }

  function cuadro(ahora: number) {
    const dt = Math.min(0.05, (ahora - antes.current) / 1000)
    antes.current = ahora
    const f = fase.current
    if (f === 'sostener') {
      const t = (ahora - t0.current) / 1000
      const kk = seg(t, 0.08, 2.0)
      k.current = kk
      const pd = salida(seg(t, 0, 0.1))
      const temblor = quieto.current ? 0 : Math.sin(70 * t) * 2.2 * seg(kk, 0.72, 1)
      pintar(kk, 0, pd, 0, temblor, null)
      if (kk >= 1) {
        fase.current = 'hecho'
        t0.current = ahora
        avisado.current = false
      }
    } else if (f === 'soltar') {
      k.current = Math.max(0, k.current - dt * 2)
      pdSuelta.current = Math.max(0, pdSuelta.current - dt / 0.15)
      pintar(k.current, 0, pdSuelta.current, 0, 0, null)
      if (k.current <= 0 && pdSuelta.current <= 0) fase.current = 'reposo'
    } else if (f === 'hecho') {
      const te = (ahora - t0.current) / 1000
      if (!avisado.current && te >= 0.5) {
        avisado.current = true
        alEliminar.current()
      }
      const pd = lim(1 - resorte(te), -0.5, 1)
      const kk = te < 0.9 ? 1 : 1 - salida(seg(te, 0.9, 1.3))
      const c = te < 0.9 ? seg(te, 0, 0.14) : 1 - seg(te, 1.0, 1.35)
      const pop = quieto.current ? 0 : Math.sin(Math.PI * seg(te, 0, 0.3))
      const q = te < 0.6 && !quieto.current ? salida(te / 0.6) : null
      pintar(kk, c, quieto.current ? 0 : pd, pop, 0, q)
      if (te >= 1.35) {
        fase.current = 'reposo'
        k.current = 0
        pintar(0, 0, 0, 0, 0, null)
      }
    }
    if (fase.current === 'reposo') return
    raf.current = requestAnimationFrame(cuadro)
  }

  function empezar() {
    if (disabled) return
    if (fase.current !== 'reposo' && fase.current !== 'soltar') return
    const ahora = performance.now()
    t0.current = ahora - (k.current > 0 ? 0.08 + k.current * 1.92 : 0) * 1000
    antes.current = ahora
    fase.current = 'sostener'
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(cuadro)
  }

  function soltar() {
    if (fase.current !== 'sostener') return
    pdSuelta.current = 1
    fase.current = 'soltar'
  }

  const texto = `Mantén para ${verbo}`
  return (
    <button
      type="button"
      className={`btn-eliminar${compacto ? ' be-compacto' : ''}`}
      disabled={disabled}
      aria-label={`${etiqueta}: ${texto.toLowerCase()} pulsado`}
      title={texto}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        empezar()
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault()
          empezar()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') soltar()
      }}
      onBlur={soltar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="be-svg" viewBox="-80 -80 160 160" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" x1="-52" y1="-52" x2="52" y2="52">
            <stop offset="0" stopColor="var(--teal)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
          <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1="-52" y1="-52" x2="52" y2="52">
            <stop offset="0" stopColor="var(--teal-ink)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <g ref={raiz}>
          <circle className="be-pista" r="67" />
          <circle ref={arco} className="be-arco" r="67" pathLength="100" transform="rotate(-90)" stroke={`url(#${id}a)`} />
          <circle ref={pulso} className="be-pulso" r="67" />
          <g ref={cuerpo}>
            <circle className="be-cuerpo" r="52" />
            <circle ref={listo} r="52" fill={`url(#${id}b)`} opacity="0" />
            <g ref={basura} className="be-basura">
              <path d="M-20 -13 L20 -13 M-7 -13 L-5 -20 L5 -20 L7 -13 M-15 -7 L-12 20 L12 20 L15 -7 M-4 -1 L-3 13 M4 -1 L3 13" />
            </g>
            <path ref={visto} className="be-visto" pathLength="100" d="M-25.2 -0.3 L-7.6 17.3 L26.9 -18.8" />
          </g>
        </g>
      </svg>
      {!compacto && (
        <span className="be-cap" aria-hidden="true">
          <span ref={cap1}>{texto}</span>
          <span ref={cap2} className="be-hecho" style={{ opacity: 0 }}>
            Eliminado
          </span>
        </span>
      )}
    </button>
  )
}
