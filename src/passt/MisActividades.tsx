import { ArrowLeft, CalendarCheck2, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso } from '../empresas/campos'
import { hoyLocal } from '../inspecciones/ayudas'
import { semanaIso } from '../inspecciones/periodos'
import { ir } from '../ruta'
import { estadosPorActividad, semanaActual, textoPct, totalesActividad } from './calculo'
import { type DatosPrograma, leerPrograma, listarProgramas } from './datos'
import { numerar } from './numeracion'

type Fila = { programa: DatosPrograma['programa']; id: string; numero: string; texto: string; vinculada: boolean; plantilla: string | null; unidad: string | null; estaSemana: string; vencidas: number[]; proxima: number | null; pct: string }

/**
 * Mis actividades del programa anual (tarea 3.4-E): las que tiene a su cargo el administrador o el gestor, con lo de
 * esta semana, lo vencido y lo próximo. Las vinculadas a un formato se ejecutan solas con la inspección.
 */
export function MisActividades({ empresaId, cuenta, online }: { empresaId: string; cuenta: string; online: boolean }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    const hoy = hoyLocal()
    const anio = semanaIso(hoy).anio
    ;(async () => {
      const programas = (await listarProgramas(empresaId)).filter((p) => p.vigente && p.anio === anio)
      const salida: Fila[] = []
      for (const p of programas) {
        const d = await leerPrograma(p.id)
        const estados = estadosPorActividad(d.semanas, d.ejecucion, p.anio, hoy)
        const actual = semanaActual(p.anio, hoy)
        for (const n of numerar(d.nodos).filter((x) => x.tipo === 'actividad' && x.responsable_id === cuenta)) {
          const e = estados.get(n.id)
          const ahora = e?.get(actual)
          salida.push({
            programa: d.programa, id: n.id, numero: n.numero, texto: n.texto, vinculada: Boolean(n.plantilla_id), plantilla: n.plantilla_id, unidad: n.unidad_id,
            estaSemana: ahora?.programada ? (ahora.ejecutada ? 'Ejecutada' : 'Programada esta semana') : ahora?.ejecutada ? 'Ejecutada (sin programar)' : '—',
            vencidas: [...(e?.entries() ?? [])].filter(([, x]) => x.vencida).map(([w]) => w).sort((a, b) => a - b),
            proxima: [...(e?.entries() ?? [])].filter(([w, x]) => x.programada && !x.ejecutada && w > actual).map(([w]) => w).sort((a, b) => a - b)[0] ?? null,
            pct: textoPct(totalesActividad(e, actual)),
          })
        }
      }
      setFilas(salida)
    })().catch((e) => setError((e as Error).message))
  }, [empresaId, cuenta, online])

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/passt')}>
        <ArrowLeft size={18} aria-hidden="true" /> Programas
      </button>
      <header className="detalle-cab">
        <h1>Mis actividades del programa</h1>
        <p>Las actividades del programa de este año que están a tu cargo. Semana actual: {semanaIso(hoyLocal()).semana}.</p>
      </header>
      <Aviso>{error}</Aviso>
      {!online ? (
        <p className="aviso-suave">Se ve con señal.</p>
      ) : !filas ? (
        !error && <p className="nota">Cargando…</p>
      ) : !filas.length ? (
        <p className="nota">No tienes actividades a tu cargo en los programas de este año.</p>
      ) : (
        <ul className="lista">
          {filas.map((f) => (
            <li key={f.id}>
              <CalendarCheck2 aria-hidden="true" className={f.vencidas.length ? 'icono-mal' : ''} />
              <div>
                <b>{f.numero} {f.texto}</b>
                {f.vencidas.length > 0 && <span className="chip chip-mal">{f.vencidas.length} vencida(s)</span>}
                <small>
                  {f.programa.nombre} · Esta semana: {f.estaSemana} · Próxima: {f.proxima ? `semana ${f.proxima}` : '—'} · Cumplimiento a la fecha: {f.pct}
                </small>
                {f.vencidas.length > 0 && <small>Semanas vencidas: {f.vencidas.join(', ')}</small>}
                <small>{f.vinculada ? 'Se ejecuta sola al cerrar la inspección del formato vinculado.' : 'Se marca a mano en el calendario, con un comentario.'}</small>
              </div>
              <span className="lista-acciones">
                {f.vinculada && (
                  <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/nueva/${f.plantilla}${f.unidad ? `/${f.unidad}` : ''}`)}>
                    <ClipboardList size={16} aria-hidden="true" /> Realizar
                  </button>
                )}
                <button className="btn-link" type="button" onClick={() => ir(`/passt/${f.programa.id}`)}>
                  Calendario
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
