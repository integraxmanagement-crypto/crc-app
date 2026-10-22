import { Copy, UserPlus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { TIPOS_DOCUMENTO, type TipoDocumento, normalizarDocumento } from '../sesion'
import { Aviso, Campo, Seccion } from './campos'
import { type Administrador, crearAdministrador, listarAdministradores } from './datos'

const hoy = () => new Date().toLocaleDateString('en-CA')

/** Administradores de la empresa. Solo el dueño de la plataforma los crea (con la función crear-cuenta de la 3.1). */
export function Administradores({ empresaId, puedeCrear }: { empresaId: string; puedeCrear: boolean }) {
  const [lista, setLista] = useState<Administrador[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoDocumento>('dni')
  const [numero, setNumero] = useState('')
  const [nombres, setNombres] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [puesto, setPuesto] = useState('')
  const [area, setArea] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ nombre: string; clave?: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const [vuelta, setVuelta] = useState(0)
  const cargar = () => setVuelta((v) => v + 1)
  useEffect(() => {
    listarAdministradores(empresaId).then(setLista).catch(() => setLista([]))
  }, [empresaId, vuelta])

  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)!

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = normalizarDocumento(numero)
    if (!tipoDoc.patron.test(n)) return setError(`Revisa el número de documento (${tipoDoc.ayuda}).`)
    if (nombres.trim().length < 3) return setError('Escribe apellidos y nombres.')
    setOcupado(true)
    try {
      const r = await crearAdministrador(empresaId, {
        tipo_documento: tipo, numero_documento: n, apellidos_nombres: nombres, fecha_ingreso: fecha, puesto, area,
      })
      setResultado({ nombre: nombres.trim(), clave: r.contrasena_inicial })
      setAbierto(false)
      setNumero('')
      setNombres('')
      setPuesto('')
      setArea('')
      cargar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Seccion
      titulo="Administrador de la empresa"
      accion={
        puedeCrear && !abierto ? (
          <button className="btn-sec" type="button" onClick={() => { setResultado(null); setError(null); setAbierto(true) }}>
            <UserPlus size={18} aria-hidden="true" /> Crear administrador
          </button>
        ) : null
      }
    >
      {lista === null ? (
        <p className="nota">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="nota">Todavía no tiene administrador.</p>
      ) : (
        <ul className="lista">
          {lista.map((a) => (
            <li key={a.id} className={a.estado === 'activo' ? '' : 'inactiva'}>
              <div>
                <b>{a.personas?.apellidos_nombres}</b>
                {a.estado !== 'activo' && <span className="chip chip-gris">Cesado</span>}
                <small>
                  {a.personas?.tipo_documento.toUpperCase()} {a.personas?.numero_documento}
                  {a.puesto ? ` · ${a.puesto}` : ''}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resultado && (
        <div className="clave-unica" role="status">
          {resultado.clave ? (
            <>
              <p>
                Cuenta creada para <b>{resultado.nombre}</b>. Esta es su <b>contraseña inicial</b>. Se muestra <b>una sola vez</b>: entrégasela en persona o por un medio seguro. Deberá cambiarla al ingresar.
              </p>
              <code>{resultado.clave}</code>
              <div className="acciones">
                <button className="btn-sec" type="button" onClick={() => void navigator.clipboard?.writeText(resultado.clave!).then(() => setCopiado(true))}>
                  <Copy size={18} aria-hidden="true" /> {copiado ? 'Copiada' : 'Copiar'}
                </button>
                <button className="btn-link" type="button" onClick={() => { setResultado(null); setCopiado(false) }}>
                  Ya la anoté, ocultar
                </button>
              </div>
            </>
          ) : (
            <p>
              <b>{resultado.nombre}</b> ya tenía cuenta en CRC (cambió de empresa): se le dio de alta aquí y sigue usando su contraseña de siempre.
            </p>
          )}
        </div>
      )}

      {abierto && (
        <form className="form subform" onSubmit={crear} noValidate>
          <div className="fila2">
            <label className="field">
              <span>Tipo de documento</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <Campo
              etiqueta="Número"
              value={numero}
              onChange={(e) => setNumero(tipo === 'dni' ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase())}
              inputMode={tipo === 'dni' ? 'numeric' : 'text'}
              maxLength={tipo === 'dni' ? 8 : 12}
              placeholder={tipoDoc.ayuda}
              autoComplete="off"
            />
          </div>
          <Campo etiqueta="Apellidos y nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} maxLength={200} autoComplete="off" />
          <div className="fila3">
            <Campo etiqueta="Fecha de ingreso" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <Campo etiqueta="Puesto" opcional value={puesto} onChange={(e) => setPuesto(e.target.value)} maxLength={120} />
            <Campo etiqueta="Área" opcional value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} />
          </div>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>
              <UserPlus size={20} aria-hidden="true" /> {ocupado ? 'Creando…' : 'Crear cuenta'}
            </button>
            <button className="btn-link" type="button" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Seccion>
  )
}
