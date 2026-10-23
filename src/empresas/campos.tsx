import { Copy } from 'lucide-react'
import { type InputHTMLAttributes, type ReactNode, useState } from 'react'

/** Contraseña que se muestra UNA sola vez, con botón para copiarla y otro para ocultarla. */
export function ClaveUnica({ texto, clave, onOcultar }: { texto: ReactNode; clave: string; onOcultar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="clave-unica" role="status">
      <p>{texto}</p>
      <code>{clave}</code>
      <div className="acciones">
        <button className="btn-sec" type="button" onClick={() => void navigator.clipboard?.writeText(clave).then(() => setCopiado(true))}>
          <Copy size={18} aria-hidden="true" /> {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button className="btn-link" type="button" onClick={onOcultar}>
          Ya la anoté, ocultar
        </button>
      </div>
    </div>
  )
}

/** Lista desplegable de áreas o puestos de la empresa (solo los vigentes, más el que ya tenía la persona). */
export function SelectorLista({
  etiqueta,
  items,
  valor,
  onCambio,
}: { etiqueta: string; items: { id: string; nombre: string; vigente: boolean }[]; valor: string; onCambio: (id: string) => void }) {
  const opciones = items.filter((i) => i.vigente || i.id === valor)
  return (
    <label className="field">
      <span>
        {etiqueta} <em className="opcional">(opcional)</em>
      </span>
      <select value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">— Sin {etiqueta.toLowerCase()} —</option>
        {opciones.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nombre}
            {i.vigente ? '' : ' (desactivado)'}
          </option>
        ))}
      </select>
      {!items.length && <small className="ayuda">La lista está vacía: agrégala en «Áreas y puestos».</small>}
    </label>
  )
}

/** Campo de formulario con etiqueta y ayuda opcional. */
export function Campo({
  etiqueta,
  ayuda,
  opcional,
  ...props
}: { etiqueta: string; ayuda?: string; opcional?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>
        {etiqueta}
        {opcional && <em className="opcional"> (opcional)</em>}
      </span>
      <input {...props} />
      {ayuda && <small className="ayuda">{ayuda}</small>}
    </label>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok'; children: ReactNode }) {
  if (!children) return null
  return (
    <p className={tipo === 'ok' ? 'aviso-ok' : 'alert'} role={tipo === 'ok' ? 'status' : 'alert'}>
      {children}
    </p>
  )
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="seccion">
      <header className="seccion-cab">
        <h2>{titulo}</h2>
        {accion}
      </header>
      {children}
    </section>
  )
}

export function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor || <span className="vacio">—</span>}</dd>
    </div>
  )
}
