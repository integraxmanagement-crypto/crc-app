import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Ciiu, buscarCiiu } from './datos'

/** Elegir la actividad del catálogo oficial CIIU, buscando por código o por palabras. */
export function BuscadorCiiu({ valor, descripcion, onElegir }: { valor: string | null; descripcion: string | null; onElegir: (c: Ciiu) => void }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Ciiu[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (texto.trim().length < 2) return
    let vigente = true
    const t = setTimeout(() => {
      setBuscando(true)
      buscarCiiu(texto)
        .then((r) => vigente && setResultados(r))
        .catch(() => vigente && setResultados([]))
        .finally(() => vigente && setBuscando(false))
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [texto])

  return (
    <div className="field">
      <span>Actividad económica (CIIU Rev. 4 de SUNAT)</span>
      {valor && (
        <p className="ciiu-elegido">
          <b>{valor}</b> · {descripcion}
        </p>
      )}
      <span className="buscador">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={valor ? 'Buscar otro código o palabra…' : 'Escribe un código o una palabra (p. ej. minería)'}
          aria-label="Buscar actividad CIIU"
        />
      </span>
      {texto.trim().length >= 2 && (
        <ul className="ciiu-resultados" role="listbox" aria-label="Resultados del catálogo CIIU">
          {buscando && !resultados.length && <li className="vacio">Buscando…</li>}
          {!buscando && !resultados.length && <li className="vacio">Sin resultados. Prueba con otra palabra.</li>}
          {resultados.map((c) => (
            <li key={c.codigo}>
              <button
                type="button"
                role="option"
                aria-selected={c.codigo === valor}
                onClick={() => {
                  onElegir(c)
                  setTexto('')
                }}
              >
                <b>{c.codigo}</b> {c.descripcion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
