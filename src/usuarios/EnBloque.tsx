import { Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { NOMBRE_ROL, type ResultadoBloque, type Rol, restablecerEnBloque } from './datos'

/**
 * Restablecer contraseñas en bloque (solo el dueño de la plataforma, decisión 5A).
 * Es el plan de rescate si se pierde el secreto CRC_PIMIENTA: la lista se muestra UNA sola vez.
 */
export function EnBloque({ empresaId, onListo }: { empresaId: string; onListo: () => void }) {
  const [roles, setRoles] = useState<Rol[]>(['admin_empresa'])
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState<ResultadoBloque[] | null>(null)
  const [copiado, setCopiado] = useState(false)

  const alternar = (r: Rol) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))

  async function restablecer() {
    setError(null)
    setOcupado(true)
    try {
      const { resultados } = await restablecerEnBloque(empresaId, roles)
      setLista(resultados)
      setConfirmar(false)
      onListo()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const texto = (lista ?? [])
    .map((r) => `${r.apellidos_nombres}\t${r.tipo_documento.toUpperCase()} ${r.numero_documento}\t${r.contrasena ?? 'NO SE PUDO CAMBIAR'}`)
    .join('\n')

  return (
    <Seccion titulo="Restablecer contraseñas en bloque">
      <p className="nota">
        Solo para emergencias (por ejemplo, si se pierde el secreto del servidor). Da una contraseña nueva a todas las cuentas activas de los roles que elijas, cierra sus sesiones y les obliga a cambiarla. Tu propia cuenta no se incluye.
      </p>

      {lista ? (
        <div className="clave-unica" role="status">
          <p>
            {lista.length ? (
              <>
                Contraseñas nuevas de <b>{lista.length}</b> cuentas. Se muestran <b>una sola vez</b>: cópialas y entrégalas por un medio seguro. No las guardes en la carpeta de Drive.
              </>
            ) : (
              'No había cuentas activas con esos roles.'
            )}
          </p>
          {lista.length > 0 && (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Rol</th>
                    <th>Documento</th>
                    <th>Contraseña</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.persona_id}>
                      <td>{r.apellidos_nombres}</td>
                      <td>{NOMBRE_ROL[r.rol]}</td>
                      <td>
                        {r.tipo_documento.toUpperCase()} {r.numero_documento}
                      </td>
                      <td>{r.contrasena ? <code>{r.contrasena}</code> : <b className="texto-mal">No se pudo cambiar</b>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="acciones">
            {lista.length > 0 && (
              <button className="btn-sec" type="button" onClick={() => void navigator.clipboard?.writeText(texto).then(() => setCopiado(true))}>
                <Copy size={18} aria-hidden="true" /> {copiado ? 'Lista copiada' : 'Copiar lista'}
              </button>
            )}
            <button className="btn-link" type="button" onClick={() => { setLista(null); setCopiado(false) }}>
              Ya las entregué, ocultar
            </button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="roles">
            <legend>Roles a restablecer</legend>
            {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => (
              <label key={r} className="check-linea">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => alternar(r)} /> {NOMBRE_ROL[r]}
              </label>
            ))}
          </fieldset>
          <Aviso>{error}</Aviso>
          {!confirmar ? (
            <button className="btn-peligro" type="button" disabled={!roles.length} onClick={() => setConfirmar(true)}>
              <KeyRound size={18} aria-hidden="true" /> Restablecer en bloque
            </button>
          ) : (
            <div className="acciones">
              <button className="btn-peligro" type="button" disabled={ocupado} onClick={() => void restablecer()}>
                {ocupado ? 'Restableciendo…' : 'Sí, restablecer ahora'}
              </button>
              <button className="btn-link" type="button" onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
    </Seccion>
  )
}
