import { KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { type Perfil, cambiarContrasena, revisarContrasena, salir } from './sesion'

/** Cambio de contraseña. En el primer ingreso es obligatorio: no se puede usar la app sin hacerlo. */
export function CambioContrasena({
  perfil,
  claveActual,
  onListo,
}: {
  perfil: Perfil
  claveActual: string | null // la que se acaba de escribir al ingresar; si no está, se pide
  onListo: () => void
}) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const clave = claveActual ?? actual
    if (!clave) {
      setError('Escribe tu contraseña actual.')
      return
    }
    const fallo = revisarContrasena(nueva, repetida, perfil.numeroDocumento)
    if (fallo) {
      setError(fallo)
      return
    }
    setEnviando(true)
    setError(null)
    const respuesta = await cambiarContrasena(clave, nueva)
    setEnviando(false)
    if (respuesta) setError(respuesta)
    else onListo()
  }

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <h2 className="form-title">Crea tu contraseña</h2>
      <p className="form-lede">
        Hola, {perfil.apellidosNombres}. Por seguridad, cambia la contraseña que te dieron antes de continuar.
      </p>

      {/* Ayuda a los gestores de contraseñas a guardar la nueva junto al documento. */}
      <input type="text" autoComplete="username" value={perfil.numeroDocumento ?? ''} readOnly hidden />

      {!claveActual && (
        <label className="field">
          <span>Contraseña actual</span>
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" maxLength={64} />
        </label>
      )}

      <label className="field">
        <span>Nueva contraseña</span>
        <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" maxLength={64} />
      </label>

      <label className="field">
        <span>Repite la nueva contraseña</span>
        <input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" maxLength={64} />
      </label>

      <ul className="rules">
        <li>Al menos 8 caracteres.</li>
        <li>Con minúscula, mayúscula, número y símbolo (por ejemplo - ! # ?).</li>
        <li>Que no contenga tu número de documento.</li>
        <li>Nada fácil de adivinar: Abcd-1234, Peru2026!…</li>
        <li>Una frase corta es buena idea: «Arena-Roja-27».</li>
      </ul>

      <p className="alert" role="alert" aria-live="polite" hidden={!error}>
        {error}
      </p>

      <button className="btn" type="submit" disabled={enviando}>
        <KeyRound size={20} aria-hidden="true" /> {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
      <button className="btn-link" type="button" onClick={() => void salir()}>
        Salir
      </button>
    </form>
  )
}
