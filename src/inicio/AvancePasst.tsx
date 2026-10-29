import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
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
        {programas && programas.length > 1 && (
          <select aria-label="Programa" value={id ?? ''} onChange={(e) => setElegido(e.target.value)}>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
      </header>
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="nota">El avance del programa se ve con señal.</p>
      ) : !programas ? (
        !error && <p className="nota">Cargando…</p>
      ) : !programas.length ? (
        <p className="nota">
          Todavía no hay un programa vigente de {anio}.{' '}
          <button className="btn-link" type="button" onClick={() => ir('/passt')}>
            Ir al programa anual
          </button>
        </p>
      ) : !meses || !d ? (
        !error && <p className="nota">Cargando…</p>
      ) : (
        <Carrusel key={id} meses={meses} meta={Number(d.programa.meta_cumplimiento)} anio={anio} mesActual={mesDeHoy(anio, hoy)} programaId={d.programa.id} />
      )}
    </section>
  )
}

function calcularMeses(d: DatosPrograma, hoy: string): Mes[] {
  const anio = d.programa.anio
  const estados = estadosPorActividad(d.semanas, d.ejecucion, anio, hoy)
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

function Carrusel({ meses, meta, anio, mesActual, programaId }: { meses: Mes[]; meta: number; anio: number; mesActual: number; programaId: string }) {
  const pista = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(mesActual)

  // Al abrir, se ve el mes actual; después, la persona desliza con el dedo o con las flechas.
  useEffect(() => {
    const p = pista.current
    if (p) p.scrollLeft = (mesActual - 1) * p.clientWidth
  }, [mesActual])

  const ir_a = (mes: number) => {
    const p = pista.current
    if (p) p.scrollTo({ left: (mes - 1) * p.clientWidth, behavior: 'smooth' })
  }
  const alDeslizar = () => {
    const p = pista.current
    if (p) setVisible(Math.min(12, Math.max(1, Math.round(p.scrollLeft / p.clientWidth) + 1)))
  }

  return (
    <div className="carrusel">
      <div className="carrusel-nav">
        <button className="btn-icono" type="button" aria-label="Mes anterior" disabled={visible <= 1} onClick={() => ir_a(visible - 1)}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span>
          {MESES[visible - 1]} {anio}
          {visible === mesActual && <small> · este mes</small>}
        </span>
        <button className="btn-icono" type="button" aria-label="Mes siguiente" disabled={visible >= 12} onClick={() => ir_a(visible + 1)}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="carrusel-pista" ref={pista} onScroll={alDeslizar}>
        {meses.map((m, k) => {
          // Un mes que todavía no llega no tiene % (saldría 0 %): se dice cuántas actividades hay programadas.
          const futuro = k + 1 > mesActual
          return (
          <article key={k} className="carrusel-mes" aria-label={`${MESES[k]} ${anio}`}>
            <div className="mes-total">
              <Anillo t={futuro ? { ...m.total, pct: null } : m.total} meta={meta} />
              <p>
                {futuro ? (
                  m.total.programadas ? `${m.total.programadas} programadas · mes por venir` : 'Sin actividades programadas este mes'
                ) : m.total.programadas ? (
                  <>
                    {m.total.ejecutadas} de {m.total.programadas} programadas ejecutadas
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
      <button className="btn-link" type="button" onClick={() => ir(`/passt/${programaId}`)}>
        Ver el calendario del programa
      </button>
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
