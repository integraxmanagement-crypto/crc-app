import { Check, Eye, EyeOff } from 'lucide-react'
import { type CSSProperties, type InputHTMLAttributes, type ReactNode, useEffect, useId, useRef, useState } from 'react'

/**
 * Campos de la pantalla de ingreso (05/11/2026): etiqueta que sube hasta abrir un hueco en el contorno, validación en vivo con pista roja y
 * visto, y ojo que convierte los puntos de la contraseña en letras una por una (y de vuelta).
 * Solo se usan en el ingreso; el resto de los formularios sigue con `.field`.
 */

export type EstadoCampo = 'neutro' | 'valido' | 'invalido'

type PropsCampo = { etiqueta: string; estado?: EstadoCampo; pista?: string; derecha?: ReactNode } & InputHTMLAttributes<HTMLInputElement>

/** Pista bajo el campo: ocupa lugar solo cuando hay texto (la altura se anima, el formulario no salta). */
function Pista({ id, texto }: { id: string; texto?: string }) {
  return (
    <div className="flota-pista" data-abierta={Boolean(texto)} aria-live="polite">
      <p id={id}>{texto}</p>
    </div>
  )
}

export function CampoFlotante({ etiqueta, estado = 'neutro', pista, derecha, className, ...props }: PropsCampo) {
  const id = useId()
  return (
    <div className={`flota ${className ?? ''}`} data-estado={estado}>
      <div className="flota-caja">
        <input id={id} placeholder=" " aria-invalid={estado === 'invalido'} aria-describedby={`${id}-pista`} {...props} />
        <label htmlFor={id}>{etiqueta}</label>
        {estado === 'valido' && (
          <span className="flota-visto" aria-hidden="true">
            <Check />
          </span>
        )}
        {derecha}
      </div>
      <Pista id={`${id}-pista`} texto={pista} />
    </div>
  )
}

/** Lista desplegable con la misma etiqueta flotante (siempre arriba, porque siempre tiene un valor). */
export function SelectorFlotante({ etiqueta, children, ...props }: { etiqueta: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className="flota flota-select">
      <div className="flota-caja">
        <select id={id} {...props}>
          {children}
        </select>
        <label htmlFor={id}>{etiqueta}</label>
      </div>
    </div>
  )
}

type Fase = 'oculta' | 'revelando' | 'visible' | 'ocultando'
type Medidas = { punto: number; letras: number[]; paso: number }

/** Mide el punto y cada letra con la misma tipografía del campo, para que los puntos se ensanchen hasta el ancho de su letra. */
function medir(input: HTMLInputElement, texto: string) {
  const cs = getComputedStyle(input)
  const lienzo = document.createElement('canvas').getContext('2d')
  if (!lienzo) return null
  lienzo.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const punto = lienzo.measureText('•').width
  const letras = [...texto].map((c) => lienzo.measureText(c).width)
  const util = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  return { punto, letras, entra: Math.max(letras.reduce((a, b) => a + b, 0), punto * letras.length) <= util }
}

const DURACION = 260

export function CampoClave({ etiqueta, valor, onCambio, ...props }: { etiqueta: string; valor: string; onCambio: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const id = useId()
  const refInput = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('oculta')
  const [medidas, setMedidas] = useState<Medidas | null>(null)
  const reloj = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(reloj.current), [])

  const animando = fase === 'revelando' || fase === 'ocultando'

  // Cambiar el tipo del campo (puntos ↔ letras) manda el cursor al inicio: se guarda y se devuelve a su lugar.
  const seleccion = useRef<[number, number] | null>(null)
  useEffect(() => {
    const el = refInput.current
    if (el && seleccion.current && document.activeElement === el) el.setSelectionRange(seleccion.current[0], seleccion.current[1])
  }, [fase])

  function alternar() {
    if (animando) return
    seleccion.current = refInput.current ? [refInput.current.selectionStart ?? valor.length, refInput.current.selectionEnd ?? valor.length] : null
    const mostrar = fase === 'oculta'
    const destino: Fase = mostrar ? 'visible' : 'oculta'
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const m = refInput.current && valor ? medir(refInput.current, valor) : null
    // Sin texto, con movimiento reducido o con una clave más larga que el campo: cambia de golpe (nada que animar).
    if (!m || !m.entra || reducido) {
      setFase(destino)
      return
    }
    const paso = Math.min(45, 520 / [...valor].length)
    setMedidas({ punto: m.punto, letras: m.letras, paso })
    setFase(mostrar ? 'revelando' : 'ocultando')
    reloj.current = window.setTimeout(() => setFase(destino), ([...valor].length - 1) * paso + DURACION + 60)
  }

  const letrasValor = [...valor]
  return (
    <div className="flota flota-clave" data-fase={fase}>
      <div className="flota-caja">
        <input
          ref={refInput}
          id={id}
          type={fase === 'oculta' ? 'password' : 'text'}
          placeholder=" "
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          data-animando={animando}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          {...props}
        />
        <label htmlFor={id}>{etiqueta}</label>
        {animando && medidas && (
          <span className="clave-ov" data-fase={fase} aria-hidden="true">
            {letrasValor.map((c, i) => (
              <span
                key={i}
                className="clave-ch"
                style={{ '--wb': `${medidas.punto}px`, '--wl': `${medidas.letras[i] ?? medidas.punto}px`, '--d': `${i * medidas.paso}ms`, '--dur': `${DURACION}ms` } as CSSProperties}
              >
                <i>•</i>
                <b>{c}</b>
              </span>
            ))}
          </span>
        )}
        <button
          type="button"
          className="flota-ojo"
          onMouseDown={(e) => e.preventDefault() /* el campo conserva el foco: en el celular no se cierra el teclado */}
          onClick={alternar}
          aria-label={fase === 'oculta' || fase === 'ocultando' ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          aria-pressed={fase === 'visible' || fase === 'revelando'}
        >
          {fase === 'oculta' || fase === 'ocultando' ? <Eye key="ver" aria-hidden="true" /> : <EyeOff key="ocultar" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
