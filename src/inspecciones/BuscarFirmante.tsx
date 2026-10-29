import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { normalizar } from '../empresas/datos'
import type { CopiaLocal } from './campo'

type Persona = CopiaLocal['personas'][number]

/**
 * Elegir firmante con búsqueda rápida (revisión de diseño, obs. 9): se escribe parte del nombre y salen las personas
 * de la empresa que coinciden (sin importar tildes ni mayúsculas). Si el nombre no está en la lista y el rol permite
 * externos, se usa lo escrito como externo (firma en papel, con documento). Funciona sin señal: usa la copia local.
 */
export function BuscarFirmante({ personas, elegido, cuenta, ocupados, permiteExterno, rolTitulo, onPersona, onExterno }: {
  personas: Persona[]
  elegido: string | null
  cuenta: string
  ocupados: Set<string>
  permiteExterno: boolean
  rolTitulo: string
  onPersona: (personaId: string) => void
  onExterno: (nombre: string) => void
}) {
  const actual = personas.find((p) => p.persona_id === elegido)
  const [texto, setTexto] = useState(actual?.apellidos_nombres ?? '')
  const [abierto, setAbierto] = useState(false)
  const buscado = normalizar(texto)
  const opciones = (buscado ? personas.filter((p) => normalizar(`${p.apellidos_nombres} ${p.puesto ?? ''}`).includes(buscado)) : personas).slice(0, 8)
  const exacta = personas.some((p) => normalizar(p.apellidos_nombres) === buscado)

  return (
    <div className="buscar-firmante">
      <label className="buscar-firmante-campo">
        <Search size={16} aria-hidden="true" />
        <input type="text" role="combobox" aria-expanded={abierto} aria-label={`Firmante: ${rolTitulo}`} maxLength={200} autoComplete="off"
          placeholder={permiteExterno ? 'Busca en la lista o escribe el nombre' : 'Busca a la persona por su nombre'}
          value={texto}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onChange={(e) => {
            setTexto(e.target.value)
            setAbierto(true)
          }} />
      </label>
      {abierto && (
        <ul className="buscar-firmante-lista" role="listbox">
          {opciones.map((p) => (
            <li key={p.persona_id}>
              <button type="button" role="option" aria-selected={p.persona_id === elegido} disabled={ocupados.has(p.persona_id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTexto(p.apellidos_nombres)
                  setAbierto(false)
                  onPersona(p.persona_id)
                }}>
                <b>
                  {p.apellidos_nombres}
                  {p.persona_id === cuenta ? ' (yo)' : ''}
                </b>
                {p.puesto && <small>{p.puesto}</small>}
              </button>
            </li>
          ))}
          {!opciones.length && <li className="nota">No hay nadie con ese nombre en la lista.</li>}
          {permiteExterno && buscado.length >= 3 && !exacta && (
            <li>
              <button type="button" className="buscar-firmante-externo" onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAbierto(false)
                  onExterno(texto.trim())
                }}>
                <UserPlus size={16} aria-hidden="true" /> Usar «{texto.trim()}» (no está en la lista: firma en papel)
              </button>
            </li>
          )}
          {!permiteExterno && buscado.length >= 3 && !exacta && (
            <li className="nota">En este formato, «{rolTitulo}» solo admite personas de CRC. El administrador puede permitir nombres escritos a mano en el formato.</li>
          )}
        </ul>
      )}
    </div>
  )
}
