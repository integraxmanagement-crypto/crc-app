import { Phone } from 'lucide-react'
import { useMenu } from '../hooks'

/** Números de emergencia de Perú (pedido del dueño, 30/10/2026): cada uno llama al tocarlo. */
const NUMEROS = [
  { numero: '116', nombre: 'Bomberos' },
  { numero: '106', nombre: 'SAMU · Ambulancia' },
  { numero: '105', nombre: 'Policía Nacional' },
  { numero: '119', nombre: 'Mensaje de voz ante emergencia' },
]

/** Teléfono rojo de la barra, junto a la campana: abre la lista de números de emergencia. */
export function Emergencias() {
  const { abierto, setAbierto, caja } = useMenu<HTMLDivElement>()
  return (
    <div className="perfil-menu emergencias" ref={caja}>
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} title="Números de emergencia" aria-label="Números de emergencia" onClick={() => setAbierto((a) => !a)}>
        <Phone size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="perfil-lista" role="menu">
          <p className="perfil-quien">
            <b>Números de emergencia</b>
            <small>Toca un número para llamar</small>
          </p>
          {NUMEROS.map((n) => (
            <a key={n.numero} className="emergencia-fila" role="menuitem" href={`tel:${n.numero}`} onClick={() => setAbierto(false)}>
              <Phone size={18} aria-hidden="true" />
              <span>{n.nombre}</span>
              <b>{n.numero}</b>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
