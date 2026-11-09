import { Monitor, Moon, Sun } from 'lucide-react'
import { type Tema, useTema } from './tema'

const OPCIONES: { valor: Tema; nombre: string; Icono: typeof Sun }[] = [
  { valor: 'auto', nombre: 'Automático', Icono: Monitor },
  { valor: 'claro', nombre: 'Claro', Icono: Sun },
  { valor: 'oscuro', nombre: 'Oscuro', Icono: Moon },
]

/** Tres botones: automático (sigue al dispositivo), claro y oscuro. */
export function SelectorTema() {
  const [tema, elegir] = useTema()
  return (
    <div className="selector-tema" role="radiogroup" aria-label="Apariencia">
      {OPCIONES.map(({ valor, nombre, Icono }) => (
        <button key={valor} type="button" role="radio" aria-checked={tema === valor} title={nombre} onClick={() => elegir(valor)}>
          <Icono size={16} aria-hidden="true" />
          <span>{nombre}</span>
        </button>
      ))}
    </div>
  )
}
