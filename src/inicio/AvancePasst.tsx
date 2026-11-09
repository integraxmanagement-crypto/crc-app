import { Esqueleto } from '../Esqueleto'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Aviso } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { semanaIso } from '../inspecciones/periodos'
import { estadosPorActividad, mesDeHoy, type Totales, textoPct, totalesPorMes } from '../passt/calculo'
import { type DatosPrograma, type Programa, leerPrograma, listarProgramas } from '../passt/datos'
import { numerar } from '../passt/numeracion'
import { ir } from '../ruta'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type Mes = { total: Totales; objetivos: { id: string; numero: string; texto: string; total: Totales }[] }

/**
 * Avance del programa anual en el inicio (revisión de diseño, obs. 5): una tarjeta por mes que se desliza a los lados.
 * Cada mes muestra el % de cumplimiento de lo programado ese mes (ejecutadas ÷ programadas, la misma cuenta del
 * calendario del PASST) y el % de cada objetivo específico. Lo ven el administrador y el gestor (permiso passt.ver).
 */
export function AvancePasst({ empresaId, online }: { empresaId: string; online: boolean }) {
  const hoy = hoyLocal()
  const anio = semanaIso(hoy).anio
  const [programas, setProgramas] = useState<Programa[] | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [datos, setDatos] = useState<{ id: string; d: DatosPrograma } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    listarProgramas(empresaId).then(
      (l) => setProgramas(l.filter((p) => p.vigente && p.anio === anio)),
      (e) => setError((e as Error).message),
    )
  }, [empresaId, online, anio])

  const id = elegido ?? programas?.[0]?.id ?? null
  useEffect(() => {
    if (!online || !id) return
    leerPrograma(id).then((d) => setDatos({ id, d }), (e) => setError((e as Error).message))
  }, [id, online])

  const d = datos?.id === id ? datos.d : null
  const meses = useMemo(() => (d ? calcularMeses(d, hoy) : null), [d, hoy])

  return (
    <section className="avance-passt" aria-label="Avance del programa anual de SST">
      <header className="avance-passt-cab">
        <h2>
          <CalendarDays size={18} aria-hidden="true" /> Programa anual de SST {anio}
        </h2>
        {programas && programas.length > 0 && id && (
          <div className="avance-passt-acciones">
            {programas.length > 1 && (
              <select aria-label="Programa" value={id} onChange={(e) => setElegido(e.target.value)}>
                {programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
            <button className="btn-calendario" type="button" onClick={() => ir(`/passt/${id}`)}>
              <CalendarRange size={16} aria-hidden="true" /> Ver calendario
            </button>
          </div>
        )}
      </header>
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="nota">El avance del programa se ve con señal.</p>
      ) : !programas ? (
        !error && <Esqueleto forma="tarjetas" filas={1} />
      ) : !programas.length ? (
        <p className="nota">
          Todavía no hay un programa vigente de {anio}.{' '}
          <button className="btn-link" type="button" onClick={() => ir('/passt')}>
            Ir al programa anual
          </button>
        </p>
      ) : !meses || !d ? (
        !error && <Esqueleto forma="tarjetas" filas={1} />
      ) : (
        <Carrusel key={id} meses={meses} meta={Number(d.programa.meta_cumplimiento)} anio={anio} mesActual={mesDeHoy(anio, hoy)} />
      )}
    </section>
  )
}

function calcularMeses(d: DatosPrograma, hoy: string): Mes[] {
  const anio = d.programa.anio
  const estados = estadosPorActividad(d.semanas, d.ejecucion, anio, hoy, d.programa.seguimiento)
  const nodos = numerar(d.nodos)
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const objetivoDe = (padre: string | null): string | null => {
    for (let n = padre ? porId.get(padre) : undefined; n; n = n.padre_id ? porId.get(n.padre_id) : undefined) if (n.tipo === 'objetivo_especifico') return n.id
    return null
  }
  const actividades = nodos.filter((n) => n.tipo === 'actividad')
  const objetivos = nodos.filter((n) => n.tipo === 'objetivo_especifico')
  const total = totalesPorMes(estados, actividades.map((a) => a.id), anio)
  const porObjetivo = objetivos.map((o) => ({
    o,
    meses: totalesPorMes(estados, actividades.filter((a) => objetivoDe(a.padre_id) === o.id).map((a) => a.id), anio),
  }))
  return total.map((t, k) => ({ total: t, objetivos: porObjetivo.map(({ o, meses }) => ({ id: o.id, numero: o.numero, texto: o.texto, total: meses[k] })) }))
}

/** Resorte amortiguado (ω₀ 15, ζ 0,68): sube de 0 a 1 con un rebote de ~3 %, como el gesto del diseño del dueño. */
function resorteF(t: number) {
  if (t <= 0) return 0
  const w0 = 15
  const z = 0.68
  const wd = w0 * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

/**
 * Carrusel de meses (06/11/2026): tarjetas anchas donde se asoman las vecinas a los lados, deslizables con el dedo o
 * arrastrando con el mouse; al soltar, un resorte lleva la tarjeta a su lugar. Debajo, puntos que siguen el deslizamiento:
 * el activo se estira en una píldora de turquesa a cian.
 */
function Carrusel({ meses, meta, anio, mesActual }: { meses: Mes[]; meta: number; anio: number; mesActual: number }) {
  const pista = useRef<HTMLDivElement>(null)
  const animacion = useRef(0)
  const arrastre = useRef<{ x: number; scroll: number; movido: boolean } | null>(null)
  // Posición fraccionaria: 0 = enero, 1 = febrero, 1,5 = entre febrero y marzo…
  const [p, setP] = useState(mesActual - 1)
  const visible = Math.min(12, Math.max(1, Math.round(p) + 1))

  /** Scroll que deja centrada la tarjeta k y paso entre tarjetas. */
  const medidas = () => {
    const el = pista.current
    const tarjetas = el ? (Array.from(el.children) as HTMLElement[]) : []
    if (!el || !tarjetas.length) return null
    const paso = tarjetas.length > 1 ? tarjetas[1].offsetLeft - tarjetas[0].offsetLeft : el.clientWidth
    const base = tarjetas[0].offsetLeft - (el.clientWidth - tarjetas[0].offsetWidth) / 2
    return { el, paso, base }
  }
  const destinoDe = (k: number) => {
    const m = medidas()
    return m ? m.base + k * m.paso : 0
  }

  useEffect(() => {
    const m = medidas()
    if (m) {
      m.el.scrollLeft = destinoDe(mesActual - 1)
      setP(mesActual - 1) // eslint-disable-line react-hooks/set-state-in-effect
    }
    return () => cancelAnimationFrame(animacion.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesActual])

  function llevarA(k: number) {
    const m = medidas()
    if (!m) return
    const mes = Math.min(11, Math.max(0, k))
    const fin = destinoDe(mes)
    cancelAnimationFrame(animacion.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      m.el.scrollLeft = fin
      return
    }
    const ini = m.el.scrollLeft
    const t0 = performance.now()
    m.el.style.scrollSnapType = 'none'
    const cuadro = (ahora: number) => {
      const t = (ahora - t0) / 1000
      m.el.scrollLeft = ini + (fin - ini) * resorteF(t)
      if (t < 1.1) animacion.current = requestAnimationFrame(cuadro)
      else {
        m.el.scrollLeft = fin
        m.el.style.scrollSnapType = ''
      }
    }
    animacion.current = requestAnimationFrame(cuadro)
  }

  const alDeslizar = () => {
    const m = medidas()
    if (m) setP(Math.min(11, Math.max(0, (m.el.scrollLeft - m.base) / m.paso)))
  }

  // Con el mouse se arrastra la tarjeta; con el dedo manda el deslizamiento nativo.
  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !pista.current) return
    cancelAnimationFrame(animacion.current)
    pista.current.style.scrollSnapType = 'none'
    arrastre.current = { x: e.clientX, scroll: pista.current.scrollLeft, movido: false }
  }
  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    if (!a || !pista.current) return
    const dx = e.clientX - a.x
    if (Math.abs(dx) > 4) a.movido = true
    if (a.movido) {
      pista.current.setPointerCapture?.(e.pointerId)
      pista.current.scrollLeft = a.scroll - dx
    }
  }
  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current
    arrastre.current = null
    const m = medidas()
    if (!a || !m) return
    if (!a.movido) {
      m.el.style.scrollSnapType = ''
      return
    }
    // Se pasa a la vecina si se arrastró más de ~15 % de una tarjeta (como el gesto del diseño: 40 % y resorte).
    const dx = e.clientX - a.x
    const origen = Math.round((a.scroll - m.base) / m.paso)
    const salto = Math.abs(dx) > m.paso * 0.15 ? (dx < 0 ? 1 : -1) : 0
    llevarA(origen + salto)
  }

  return (
    <div className="carrusel">
      <div className="carrusel-pista" ref={pista} onScroll={alDeslizar} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}>
        {meses.map((m, k) => {
          // Un mes que todavía no llega no tiene % (saldría 0 %): se dice cuántas actividades hay programadas.
          const futuro = k + 1 > mesActual
          const lejos = Math.min(1, Math.abs(k - p))
          return (
          <article key={k} className="carrusel-mes" aria-label={`${MESES[k]} ${anio}`} style={{ opacity: 1 - 0.5 * lejos, transform: `scale(${1 - 0.04 * lejos})` }}>
            <h3 className="mes-titulo">
              {MESES[k]} <span>{anio}</span>
              {k + 1 === mesActual && <em>este mes</em>}
            </h3>
            <div className="mes-total">
              <Anillo t={futuro ? { ...m.total, pct: null } : m.total} meta={meta} />
              <p>
                {futuro ? (
                  m.total.programadas ? `${m.total.programadas} programadas · mes por venir` : 'Sin actividades programadas este mes'
                ) : m.total.programadas ? (
                  <>
                    {m.total.ejecutadas} de {m.total.programadas} ejecutadas
                  </>
                ) : (
                  'Sin actividades programadas este mes'
                )}
                <small>Meta {meta} %</small>
              </p>
            </div>
            <ul className="mes-objetivos">
              {m.objetivos.map((o) => (
                <li key={o.id}>
                  <span className="mes-obj-texto" title={o.texto}>
                    <b>Objetivo {o.numero}</b> {o.texto}
                  </span>
                  <span className="mes-obj-barra" aria-hidden="true">
                    <span style={{ width: `${futuro ? 0 : (o.total.pct ?? 0)}%` }} data-bien={o.total.pct != null && o.total.pct >= meta} />
                  </span>
                  <span className="mes-obj-pct">{futuro ? '—' : textoPct(o.total)}</span>
                </li>
              ))}
              {!m.objetivos.length && <li className="nota">El programa todavía no tiene objetivos específicos.</li>}
            </ul>
          </article>
          )
        })}
      </div>
      <div className="carrusel-pie">
        <button className="btn-icono" type="button" aria-label="Mes anterior" disabled={visible <= 1} onClick={() => llevarA(visible - 2)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="carrusel-puntos" role="tablist" aria-label="Meses">
        {meses.map((_, k) => {
          const a = Math.max(0, 1 - Math.abs(p - k))
          return (
            <button key={k} type="button" role="tab" aria-selected={Math.round(p) === k} aria-label={MESES[k]} className="punto" style={{ width: `${0.5 + 1.1 * a}rem`, background: `color-mix(in srgb, var(--ink) ${Math.round(a * 55)}%, var(--rule))` }} onClick={() => llevarA(k)}>
              <span style={{ opacity: a > 0.5 ? 2 * a - 1 : 0 }} />
            </button>
          )
        })}
        </div>
        <button className="btn-icono" type="button" aria-label="Mes siguiente" disabled={visible >= 12} onClick={() => llevarA(visible)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** Gráfico sencillo: anillo con el % del mes (verde si llega a la meta, ámbar si no; gris si no hay programadas). */
function Anillo({ t, meta }: { t: Totales; meta: number }) {
  const r = 34
  const largo = 2 * Math.PI * r
  const pct = t.pct ?? 0
  const tono = t.pct == null ? 'nada' : t.pct >= meta ? 'bien' : 'bajo'
  return (
    <svg className="anillo" data-tono={tono} viewBox="0 0 80 80" role="img" aria-label={`Cumplimiento del mes: ${textoPct(t)}`}>
      <circle cx="40" cy="40" r={r} className="anillo-fondo" />
      {pct > 0 && <circle cx="40" cy="40" r={r} className="anillo-valor" strokeDasharray={`${(largo * pct) / 100} ${largo}`} transform="rotate(-90 40 40)" />}
      <text x="40" y="45" textAnchor="middle">
        {textoPct(t)}
      </text>
    </svg>
  )
}
