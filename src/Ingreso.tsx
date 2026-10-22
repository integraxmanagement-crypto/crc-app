import { Eye, EyeOff, LogIn } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { TIPOS_DOCUMENTO, type TipoDocumento, ingresar, normalizarDocumento } from './sesion'

/** Pantalla de ingreso: tipo de documento, número y contraseña. Nada de correo ni teléfono. */
export function Ingreso({ aviso, onIngreso }: { aviso?: string; onIngreso: (clave: string) => void }) {
  const [tipo, setTipo] = useState<TipoDocumento>('dni')
  const [numero, setNumero] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)!
  const esDni = tipo === 'dni'

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = normalizarDocumento(numero)
    if (!tipoDoc.patron.test(n)) {
      setError(`Revisa el número de documento (${tipoDoc.ayuda}).`)
      return
    }
    if (!clave) {
      setError('Escribe tu contraseña.')
      return
    }
    setEnviando(true)
    setError(null)
    const fallo = await ingresar(tipo, n, clave)
    setEnviando(false)
    if (fallo) setError(fallo)
    else onIngreso(clave)
  }

  const mensaje = error ?? aviso

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <h2 className="form-title">Ingresar</h2>

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

      <label className="field">
        <span>Número de documento</span>
        <input
          value={numero}
          onChange={(e) => setNumero(esDni ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase())}
          inputMode={esDni ? 'numeric' : 'text'}
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={esDni ? 8 : 12}
          placeholder={tipoDoc.ayuda}
          required
        />
      </label>

      <label className="field">
        <span>Contraseña</span>
        <span className="field-pass">
          <input
            type={verClave ? 'text' : 'password'}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            maxLength={64}
            required
          />
          <button
            type="button"
            className="field-eye"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {verClave ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </span>
      </label>

      <p className="alert" role="alert" aria-live="polite" hidden={!mensaje}>
        {mensaje}
      </p>

      <button className="btn" type="submit" disabled={enviando}>
        <LogIn size={20} aria-hidden="true" /> {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>

      <p className="form-note">¿Olvidaste tu contraseña? Pide al administrador de tu empresa que te dé una nueva.</p>
    </form>
  )
}
