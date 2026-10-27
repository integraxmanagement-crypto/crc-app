import { Eye, PenLine } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Aviso } from '../empresas/campos'
import { ir } from '../ruta'
import { type FirmaPendiente, firmar, misFirmasPendientes } from './datos'
import { PanelFirma } from './Firma'

/**
 * Mis firmas pendientes (tarea 3.4-C): cada persona de CRC designada como firmante firma desde su propia cuenta
 * (firma de nivel 1, decisión del dueño 26/10/2026). Necesita señal.
 */
export function MisFirmas({ cuenta, online }: { cuenta: string; online: boolean }) {
  const [firmas, setFirmas] = useState<FirmaPendiente[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [hecha, setHecha] = useState<string | null>(null)

  const cargar = useCallback(() => {
    misFirmasPendientes(cuenta).then((f) => setFirmas(f.filter((x) => x.inspecciones?.estado === 'cerrada')), (e) => setError((e as Error).message))
  }, [cuenta])
  useEffect(() => {
    if (online) cargar()
  }, [online, cargar])

  async function guardar(f: FirmaPendiente, png: Blob) {
    setError(null)
    try {
      await firmar(f, f.inspecciones!.empresa_id, png)
      setAbierta(null)
      setHecha(`Firmaste la inspección N.º ${f.inspecciones?.numero}.`)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="detalle">
      <header className="detalle-cab">
        <h1>Mis firmas</h1>
        <p>Inspecciones en las que te designaron como firmante. Revisa la inspección y firma desde tu cuenta.</p>
      </header>
      <Aviso>{error}</Aviso>
      {hecha && <p className="aviso-ok" role="status">{hecha}</p>}
      {!online ? (
        <p className="nota">Para firmar necesitas señal.</p>
      ) : !firmas ? (
        <p className="nota">Cargando…</p>
      ) : !firmas.length ? (
        <p className="nota">No tienes firmas pendientes.</p>
      ) : (
        <ul className="lista">
          {firmas.map((f) => (
            <li key={f.id} className="con-panel">
              <PenLine aria-hidden="true" />
              <div>
                <b>
                  N.º {f.inspecciones?.numero} · {f.inspecciones?.plantillas?.nombre}
                </b>
                <small>
                  Firmas como «{f.rol_titulo}» · {f.inspecciones?.fecha.split('-').reverse().join('/')}
                </small>
                {abierta === f.id && <PanelFirma texto="Firmar" onListo={(png) => void guardar(f, png)} onCancelar={() => setAbierta(null)} />}
              </div>
              {abierta !== f.id && (
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => ir(`/inspecciones/${f.inspeccion_id}`)}>
                    <Eye size={16} aria-hidden="true" /> Ver
                  </button>
                  <button className="btn-sec" type="button" onClick={() => setAbierta(f.id)}>
                    Firmar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
