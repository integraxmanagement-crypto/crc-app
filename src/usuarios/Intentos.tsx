import { Search } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Campo } from '../empresas/campos'
import { type FiltroIntentos, type Intento, RESULTADOS, listarIntentos } from './datos'

const inicial: FiltroIntentos = { desde: '', hasta: '', resultado: '', documento: '' }

/**
 * Registro de intentos de ingreso (solo el dueño de la plataforma, decisión 4A).
 * Contiene direcciones de internet, que son datos personales (Ley 29733): se borran solas a los 90 días.
 */
export function Intentos() {
  const [filtro, setFiltro] = useState(inicial)
  const [aplicado, setAplicado] = useState(inicial)
  const [intentos, setIntentos] = useState<Intento[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    listarIntentos(aplicado)
      .then((i) => {
        setIntentos(i)
        setError(null)
      })
      .catch((e) => {
        setIntentos([])
        setError((e as Error).message)
      })
  }, [aplicado])
  useEffect(cargar, [cargar])

  function buscar(e: FormEvent) {
    e.preventDefault()
    setIntentos(null)
    setAplicado(filtro)
  }

  const campo = (k: keyof FiltroIntentos) => (e: { target: { value: string } }) => setFiltro((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="detalle">
      <header className="detalle-cab">
        <h1>Registro de intentos de ingreso</h1>
        <p>Se guardan 90 días y luego se borran solos. Solo lo ves tú, como dueño de la plataforma.</p>
      </header>

      <form className="form filtros-intentos" onSubmit={buscar} noValidate>
        <div className="fila3">
          <Campo etiqueta="Desde" type="date" value={filtro.desde} onChange={campo('desde')} />
          <Campo etiqueta="Hasta" type="date" value={filtro.hasta} onChange={campo('hasta')} />
          <label className="field">
            <span>Resultado</span>
            <select value={filtro.resultado} onChange={campo('resultado')}>
              <option value="">Todos</option>
              {Object.entries(RESULTADOS).map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fila-form">
          <Campo etiqueta="Documento" value={filtro.documento} onChange={campo('documento')} placeholder="Número completo o parte" maxLength={12} autoComplete="off" />
          <div className="acciones">
            <button className="btn" type="submit">
              <Search size={20} aria-hidden="true" /> Buscar
            </button>
            <button className="btn-link" type="button" onClick={() => { setFiltro(inicial); setAplicado(inicial) }}>
              Limpiar
            </button>
          </div>
        </div>
      </form>

      <Aviso>{error}</Aviso>
      {intentos === null ? (
        <p className="nota">Cargando…</p>
      ) : (
        <>
          <p className="nota">
            {intentos.length === 200 ? 'Se muestran los 200 más recientes; usa los filtros para ver otros.' : `${intentos.length} intentos.`}
          </p>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Documento</th>
                  <th>Resultado</th>
                  <th>Dirección de internet</th>
                </tr>
              </thead>
              <tbody>
                {intentos.map((i) => (
                  <tr key={i.id}>
                    <td>{new Date(i.creado_en).toLocaleString('es-PE')}</td>
                    <td>
                      {i.tipo_documento.toUpperCase()} {i.numero_documento}
                    </td>
                    <td>
                      <span className={`chip ${i.resultado === 'exito' ? 'chip-ok' : i.resultado === 'fallo' ? 'chip-gris' : 'chip-mal'}`}>
                        {RESULTADOS[i.resultado] ?? i.resultado}
                      </span>
                    </td>
                    <td className="mono">{i.ip ?? '—'}</td>
                  </tr>
                ))}
                {!intentos.length && (
                  <tr>
                    <td colSpan={4} className="vacio">
                      No hay intentos con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
