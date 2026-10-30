import { ListChecks } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SeccionResumen } from './SeccionResumen'
import { type Hallazgo, misHallazgosPendientes, vencido } from '../hallazgos/datos'
import { hoyLocal } from '../inspecciones/ayudas'
import { ir } from '../ruta'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`

/**
 * «Mis hallazgos abiertos y en proceso» del inicio (pedido del dueño, 29/10/2026): los hallazgos que tengo a mi cargo y todavía
 * debo cerrar, con su número al lado. Al tocar la sección se abre una ventana con la lista.
 */
export function MisHallazgos({ empresaId, cuenta, online }: { empresaId: string; cuenta: string; online: boolean }) {
  const [lista, setLista] = useState<Hallazgo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hoy = hoyLocal()

  useEffect(() => {
    if (!online) return
    misHallazgosPendientes(empresaId, cuenta).then(setLista, (e) => setError((e as Error).message))
  }, [empresaId, cuenta, online])

  return (
    <SeccionResumen icono={<ListChecks size={18} />} titulo="Mis hallazgos abiertos y en proceso" etiqueta="Mis hallazgos abiertos y en proceso" cantidad={lista ? lista.length : null} tono={lista?.length ? 'aviso' : 'ok'}
      vacio="No tienes hallazgos por cerrar." online={online} sinSenal="Tus hallazgos se ven con señal." cargando={!lista} error={error} tituloDetalle={`Mis hallazgos por cerrar (${lista?.length ?? 0})`}>
      <ul className="lista">
        {(lista ?? []).map((h) => (
          <li key={h.id}>
            <ListChecks aria-hidden="true" className={vencido(h, hoy) ? 'icono-mal' : ''} />
            <div>
              <b>{h.texto}</b>
              {vencido(h, hoy) && <span className="chip chip-mal">Vencido</span>}
              <small>
                {h.activo_codigo ? `${h.activo_codigo} · ` : ''}
                {h.plantillas?.nombre}
                {h.inspeccion_numero ? ` · Inspección N.º ${h.inspeccion_numero}` : ''} · {h.sedes?.nombre}
              </small>
              <small>
                {h.estado === 'en_proceso' ? 'En proceso' : 'Abierto'} · Plazo: {h.plazo ? fechaCorta(h.plazo) : 'sin plazo'}
                {h.accion ? ` · Acción: ${h.accion}` : ''}
              </small>
            </div>
          </li>
        ))}
      </ul>
      <div className="acciones">
        <button className="btn" type="button" onClick={() => ir('/hallazgos')}>
          Ir a cerrarlos
        </button>
      </div>
    </SeccionResumen>
  )
}
