import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Aviso, Seccion } from '../empresas/campos'
import type { Grabado } from './datos'

const ROL: Record<string, string> = { gestor: 'Gestor', usuario: 'Usuario' }
const APP = 'crc-app-phi.vercel.app'

/**
 * Resultado de una carga grabada y hoja de entrega de contraseñas (tarea 3.6, decisión 6).
 * Las contraseñas iniciales llegan del servidor una sola vez y solo viven en esta pantalla:
 * al cerrarla se pierden (si alguien no recibió la suya, se le da una nueva desde Usuarios).
 * Se imprime en dos partes: una lista de control para firmar (sin contraseñas) y una tarjeta recortable por persona,
 * para que nadie vea la contraseña de otro.
 */
export function HojaEntrega({ grabado, empresa, onCerrar }: { grabado: Grabado; empresa: string; onCerrar: () => void }) {
  const [seguro, setSeguro] = useState(false)
  const { resumen, entregas } = grabado
  // Fecha y hora de la carga (Lima), fijada al mostrarse la hoja.
  const [fecha] = useState(() => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }).format(new Date()))

  // Si se intenta salir con las contraseñas en pantalla, el navegador pide confirmación.
  useEffect(() => {
    if (!entregas.length) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [entregas.length])

  const partes = [
    resumen.nuevas && `${resumen.nuevas} cuenta${resumen.nuevas === 1 ? '' : 's'} nueva${resumen.nuevas === 1 ? '' : 's'}`,
    resumen.altas && `${resumen.altas} alta${resumen.altas === 1 ? '' : 's'} de personas que ya tenían cuenta`,
    resumen.actualizadas && `${resumen.actualizadas} actualizada${resumen.actualizadas === 1 ? '' : 's'}`,
    resumen.reactivadas && `${resumen.reactivadas} reactivada${resumen.reactivadas === 1 ? '' : 's'}`,
    resumen.por_revisar && `${resumen.por_revisar} ${resumen.por_revisar === 1 ? 'persona quedó' : 'personas quedaron'} «por revisar»`,
  ].filter(Boolean)

  return (
    <Seccion titulo="Carga grabada">
      <Aviso tipo="ok">Se grabó todo{partes.length ? `: ${partes.join(', ')}` : ''}.</Aviso>
      {resumen.por_revisar > 0 && (
        <p className="nota">Las personas «por revisar» siguen activas: confirma su cese o que siguen desde Usuarios, filtro «Por revisar».</p>
      )}

      {entregas.length > 0 ? (
        <>
          <div className="clave-unica" role="status">
            <p>
              Las contraseñas iniciales de las <b>{entregas.length}</b> personas nuevas se muestran <b>una sola vez</b>. Imprime la hoja de entrega
              (o guárdala como PDF desde la ventana de impresión) y entrega a cada persona su tarjeta en mano. No la envíes por correo ni la guardes en Drive.
            </p>
            <p>Al primer ingreso, cada persona deberá cambiar su contraseña.</p>
          </div>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Apellidos y nombres</th>
                  <th>Documento</th>
                  <th>Rol</th>
                  <th>Contraseña inicial</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.fila}>
                    <td>{e.apellidos_nombres}</td>
                    <td className="mono">
                      {e.tipo} {e.numero}
                    </td>
                    <td>{ROL[e.rol] ?? e.rol}</td>
                    <td>
                      <code>{e.contrasena}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => window.print()}>
              <Printer size={18} aria-hidden="true" /> Imprimir hoja de entrega
            </button>
            {!seguro ? (
              <button className="btn-link" type="button" onClick={() => setSeguro(true)}>
                Ya la imprimí, cerrar
              </button>
            ) : (
              <>
                <button className="btn-sec" type="button" onClick={onCerrar}>
                  Sí, cerrar: ya no las veré más
                </button>
                <button className="btn-link" type="button" onClick={() => setSeguro(false)}>
                  Todavía no
                </button>
              </>
            )}
          </div>
          <p className="nota">Si alguien no recibe su contraseña, dale una nueva desde Usuarios: elige a la persona y pulsa «Contraseña nueva».</p>
          {createPortal(
            <div className="hoja-entrega">
              <section className="hoja-control">
                <h1>Entrega de contraseñas iniciales · CRC</h1>
                <p>
                  {empresa} · {fecha}
                </p>
                <p>Lista de control: cada persona firma al recibir su tarjeta. Esta lista no lleva contraseñas.</p>
                <table>
                  <thead>
                    <tr>
                      <th>N.°</th>
                      <th>Apellidos y nombres</th>
                      <th>Documento</th>
                      <th>Firma de recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map((e, i) => (
                      <tr key={e.fila}>
                        <td>{i + 1}</td>
                        <td>{e.apellidos_nombres}</td>
                        <td>
                          {e.tipo} {e.numero}
                        </td>
                        <td className="firma" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="hoja-tarjetas">
                {entregas.map((e) => (
                  <div key={e.fila} className="tarjeta-entrega">
                    <p className="tarjeta-titulo">CRC · Centinel Risk Control</p>
                    <p>
                      <b>{e.apellidos_nombres}</b>
                      <br />
                      {e.tipo} {e.numero} · {empresa}
                    </p>
                    <p>
                      Contraseña inicial: <span className="tarjeta-clave">{e.contrasena}</span>
                    </p>
                    <p className="tarjeta-pasos">
                      Ingresa en {APP} con tu tipo y número de documento y esta contraseña. Al primer ingreso deberás cambiarla. Es personal: no la compartas.
                    </p>
                  </div>
                ))}
              </section>
            </div>,
            document.body,
          )}
        </>
      ) : (
        <>
          <p className="nota">No hubo cuentas nuevas: nadie recibe contraseña y quienes ya tenían cuenta siguen con la de siempre.</p>
          <div className="acciones">
            <button className="btn-sec" type="button" onClick={onCerrar}>
              Listo
            </button>
          </div>
        </>
      )}
    </Seccion>
  )
}
