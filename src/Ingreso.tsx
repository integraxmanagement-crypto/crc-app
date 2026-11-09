import { SelectorTema } from './SelectorTema'
import { LogIn } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { CampoClave, CampoFlotante, type EstadoCampo, SelectorFlotante } from './CamposIngreso'
import { TIPOS_DOCUMENTO, type TipoDocumento, ingresar, normalizarDocumento } from './sesion'

/** Pantalla de ingreso: tipo de documento, número y contraseña. Nada de correo ni teléfono. */
export function Ingreso({ aviso, onIngreso }: { aviso?: string; onIngreso: (clave: string) => void }) {
  const [tipo, setTipo] = useState<TipoDocumento>('dni')
  const [numero, setNumero] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const tipoDoc = TIPOS_DOCUMENTO.find((t) => t.codigo === tipo)!
  const esDni = tipo === 'dni'

  // Validación en vivo del documento: pista roja mientras no sea válido (desde que empieza a escribir) y un visto cuando lo es.
  const limpio = normalizarDocumento(numero)
  const estadoDoc: EstadoCampo = !numero ? 'neutro' : tipoDoc.patron.test(limpio) ? 'valido' : 'invalido'
  const faltan = (esDni ? 8 : 6) - limpio.length
  const pistaDoc =
    estadoDoc !== 'invalido'
      ? undefined
      : !/^[A-Z0-9]*$/.test(limpio)
        ? 'Usa solo letras y números.'
        : faltan > 0
          ? esDni
            ? `Faltan ${faltan} ${faltan === 1 ? 'dígito' : 'dígitos'}.`
            : `Faltan ${faltan} ${faltan === 1 ? 'carácter' : 'caracteres'} (${tipoDoc.ayuda}).`
          : `Revisa el número (${tipoDoc.ayuda}).`

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

      <SelectorFlotante etiqueta="Tipo de documento" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
        {TIPOS_DOCUMENTO.map((t) => (
          <option key={t.codigo} value={t.codigo}>
            {t.nombre}
          </option>
        ))}
      </SelectorFlotante>

      <CampoFlotante
        etiqueta="Número de documento"
        value={numero}
        onChange={(e) => setNumero(esDni ? e.target.value.replace(/D/g, '') : e.target.value.toUpperCase())}
        estado={estadoDoc}
        pista={pistaDoc}
        inputMode={esDni ? 'numeric' : 'text'}
        autoComplete="username"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={esDni ? 8 : 12}
        required
      />

      <CampoClave etiqueta="Contraseña" valor={clave} onCambio={setClave} autoComplete="current-password" maxLength={64} required />

      <p className="alert" role="alert" aria-live="polite" hidden={!mensaje}>
        {mensaje}
      </p>

      <button className="btn" type="submit" disabled={enviando}>
        <LogIn size={20} aria-hidden="true" /> {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>

      <p className="form-note">¿Olvidaste tu contraseña? Pide al administrador de tu empresa que te dé una nueva.</p>
      <SelectorTema />
    </form>
  )
}
