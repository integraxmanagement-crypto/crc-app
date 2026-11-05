import { useId, useMemo, useRef, useState, type ReactNode } from 'react'

import { type OpcionCombo, filtrarOpciones, sinTildes } from './comboAyuda'

/**
 * Campo para escribir y elegir de una lista que se va filtrando (pedido del dueño, 05/11/2026). Si lo escrito no está en la lista,
 * muestra «Crear …» cuando se le da `crear`. `elegido` es el identificador ya elegido (o null si solo hay texto escrito).
 */
export function Combo({ etiqueta, marca, opciones, texto, elegido, onTexto, onElegir, requerido, crear, placeholder, vacio = 'No hay coincidencias.' }: {
  etiqueta: string
  marca?: ReactNode
  opciones: OpcionCombo[]
  texto: string
  elegido: string | null
  onTexto: (t: string) => void
  onElegir: (o: OpcionCombo | null) => void
  requerido?: boolean
  /** Si se da, aparece «Crear …» al final cuando lo escrito no coincide exactamente con ninguna opción. */
  crear?: { rotulo: (escrito: string) => string; onCrear: (escrito: string) => void }
  placeholder?: string
  vacio?: string
}) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const cierre = useRef<number | null>(null)
  const lista = useMemo(() => filtrarOpciones(opciones, texto), [opciones, texto])
  const exacta = opciones.some((o) => sinTildes(o.texto) === sinTildes(texto))
  const puedeCrear = Boolean(crear && texto.trim().length >= 2 && !exacta)
  const total = lista.length + (puedeCrear ? 1 : 0)

  const elegir = (i: number) => {
    if (i < lista.length) {
      // Primero el texto y después la elección: el texto escrito siempre borra la elección anterior.
      onTexto(lista[i].texto)
      onElegir(lista[i])
    } else if (puedeCrear) crear!.onCrear(texto.trim())
    setAbierto(false)
  }
  return (
    <div className="field combo">
      <label htmlFor={id}>
        <span>{etiqueta}{marca}</span>
      </label>
      <input
        id={id} type="text" role="combobox" aria-expanded={abierto} aria-controls={`${id}-lista`} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={abierto && total ? `${id}-o${activo}` : undefined} required={requerido} placeholder={placeholder} value={texto}
        data-elegido={elegido ? 'si' : 'no'}
        onChange={(e) => { onTexto(e.target.value); if (elegido) onElegir(null); setAbierto(true); setActivo(0) }}
        onFocus={() => { if (cierre.current) window.clearTimeout(cierre.current); setAbierto(true) }}
        onBlur={() => { cierre.current = window.setTimeout(() => setAbierto(false), 150) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, Math.max(total - 1, 0))) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && abierto && total) { e.preventDefault(); elegir(Math.min(activo, total - 1)) }
          else if (e.key === 'Escape' && abierto) { e.stopPropagation(); setAbierto(false) }
        }}
      />
      {abierto && (
        <ul id={`${id}-lista`} role="listbox" aria-label={etiqueta} className="combo-lista">
          {lista.map((o, i) => (
            <li key={o.id} id={`${id}-o${i}`} role="option" aria-selected={activo === i} className={activo === i ? 'activa' : ''}
              onMouseDown={(e) => { e.preventDefault(); elegir(i) }}>
              {o.texto}{o.detalle && <small> · {o.detalle}</small>}
            </li>
          ))}
          {puedeCrear && (
            <li id={`${id}-o${lista.length}`} role="option" aria-selected={activo === lista.length} className={`combo-crear ${activo === lista.length ? 'activa' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); elegir(lista.length) }}>
              + {crear!.rotulo(texto.trim())}
            </li>
          )}
          {!lista.length && !puedeCrear && <li className="combo-vacio" role="presentation">{vacio}</li>}
        </ul>
      )}
    </div>
  )
}
