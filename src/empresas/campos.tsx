import type { InputHTMLAttributes, ReactNode } from 'react'

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
