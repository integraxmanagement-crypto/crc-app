import { AlertTriangle, CalendarClock, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SeccionResumen } from './SeccionResumen'
import { hoyLocal } from '../inspecciones/ayudas'
import { semanaIso, semanasConMes } from '../inspecciones/periodos'
import { estadosPorActividad, mesDeHoy, semanaActual } from '../passt/calculo'
import { areasDeEmpresa, leerPrograma, listarProgramas } from '../passt/datos'
import { numerar } from '../passt/numeracion'
import { ir } from '../ruta'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

type Pendiente = { id: string; programaId: string; programa: string; numero: string; texto: string; vinculada: boolean; porMes: boolean; plantilla: string | null; unidad: string | null; area: string | null; semanas: { semana: number; lunes: string; mes: number; vencida: boolean; actual: boolean }[] }

/**
 * Pendientes del mes en el inicio (revisión de diseño, obs. 6): las actividades del programa anual que tengo a mi cargo,
 * programadas en una semana de este mes y todavía sin ejecutar. Misma regla del calendario: cada semana cuenta en el
 * mes de su jueves. Las vinculadas a un formato se cierran con la inspección; las demás se marcan en el calendario.
 * Debajo, los atrasados (obs. 7): lo programado en meses anteriores del año que sigue sin ejecutar.
 */
export function PendientesMes({ empresaId, cuenta, online }: { empresaId: string; cuenta: string; online: boolean }) {
  const hoy = hoyLocal()
  const anio = semanaIso(hoy).anio
  const mes = mesDeHoy(anio, hoy)
  const [listas, setListas] = useState<{ mes: Pendiente[]; atrasados: Pendiente[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!online) return
    ;(async () => {
      const actual = semanaActual(anio, hoy)
      const semanasAnio = semanasConMes(anio)
      const salida = { mes: [] as Pendiente[], atrasados: [] as Pendiente[] }
      const areas = new Map((await areasDeEmpresa(empresaId)).map((a) => [a.id, a.nombre]))
      for (const p of (await listarProgramas(empresaId)).filter((x) => x.vigente && x.anio === anio)) {
        const d = await leerPrograma(p.id)
        const estados = estadosPorActividad(d.semanas, d.ejecucion, anio, hoy, p.seguimiento)
        for (const n of numerar(d.nodos).filter((x) => x.tipo === 'actividad' && x.responsable_id === cuenta)) {
          const e = estados.get(n.id)
          const sinHacer = semanasAnio
            .filter((w) => w.mes <= mes && e?.get(w.semana)?.programada && !e.get(w.semana)?.ejecutada)
            .map((w) => ({ semana: w.semana, lunes: w.lunes, mes: w.mes, vencida: w.semana < actual, actual: w.semana === actual }))
          const base = { id: n.id, programaId: p.id, programa: p.nombre, numero: n.numero, texto: n.texto, vinculada: Boolean(n.plantilla_id), porMes: p.seguimiento === 'mes',
            plantilla: n.plantilla_id, unidad: n.unidad_id, area: n.unidad_id ? (areas.get(n.unidad_id) ?? null) : null }
          const delMes = sinHacer.filter((w) => w.mes === mes)
          const antes = sinHacer.filter((w) => w.mes < mes)
          if (delMes.length) salida.mes.push({ ...base, semanas: delMes })
          if (antes.length) salida.atrasados.push({ ...base, semanas: antes })
        }
      }
      setListas(salida)
    })().catch((e) => setError((e as Error).message))
  }, [empresaId, cuenta, online, anio, mes, hoy])

  const comun = { online, sinSenal: 'Tus pendientes se ven con señal.', cargando: !listas, error }
  return (
    <>
      <SeccionResumen {...comun} icono={<CalendarClock size={18} />} titulo={`Mis pendientes de ${MESES[mes - 1]}`} etiqueta="Pendientes del mes" cantidad={listas ? listas.mes.length : null} tono="aviso"
        vacio="No tienes actividades pendientes este mes." tituloDetalle={`Mis pendientes de ${MESES[mes - 1]} (${listas?.mes.length ?? 0})`}>
        <Lista items={listas?.mes ?? []} />
      </SeccionResumen>
      <SeccionResumen {...comun} icono={<AlertTriangle size={18} />} titulo="Atrasados de meses anteriores" etiqueta="Pendientes atrasados" cantidad={listas ? listas.atrasados.length : null} tono="mal"
        vacio="No tienes actividades atrasadas." tituloDetalle={`Atrasados de meses anteriores (${listas?.atrasados.length ?? 0})`}>
        <Lista items={listas?.atrasados ?? []} conMes />
      </SeccionResumen>
    </>
  )
}

function Lista({ items, conMes = false }: { items: Pendiente[]; conMes?: boolean }) {
  return (
    <ul className="lista">
      {items.map((p) => (
        <li key={p.id}>
          <CalendarClock aria-hidden="true" className={p.semanas.some((w) => w.vencida) ? 'icono-mal' : ''} />
          <div>
            <b>
              {p.numero} {p.texto}
            </b>
            <small>
              {p.semanas.map((w, k) => (
                <span key={w.semana}>
                  {k > 0 && ', '}
                  {p.porMes ? `mes de ${MESES[w.mes - 1]}` : `semana ${w.semana} (desde el ${Number(w.lunes.slice(8, 10))}/${Number(w.lunes.slice(5, 7))}${conMes ? `, ${MESES[w.mes - 1]}` : ''})`}
                  {!conMes && (w.actual ? ' · esta semana' : w.vencida ? ' · ya pasó' : '')}
                </span>
              ))}
            </small>
            <small>{p.area ? `Área: ${p.area} · ` : ''}{p.programa}</small>
          </div>
          <span className="lista-acciones">
            {p.vinculada ? (
              // «Realizar» abre la inspección con el formato y el área de la actividad ya elegidos (revisión LOTO).
              <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/nueva/${p.plantilla}${p.unidad ? `/${p.unidad}` : ''}`)}>
                <ClipboardList size={16} aria-hidden="true" /> Realizar
              </button>
            ) : (
              <button className="btn-link" type="button" onClick={() => ir(`/passt/${p.programaId}`)}>
                Marcar en el calendario
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
