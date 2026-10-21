import { CircleCheck, Database, Download, Smartphone, Wifi, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useInstall, useOnline } from './hooks'

function Mark() {
  return (
    <svg className="mark" viewBox="96 96 320 320" aria-hidden="true">
      <path
        className="mark-arc"
        d="M355.6 172.4 A130 130 0 1 0 355.6 339.6"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={56}
      />
      <circle className="mark-dot" cx="256" cy="256" r="42" />
    </svg>
  )
}

type Tone = 'ok' | 'idle'

function Check({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note?: string; tone: Tone }) {
  return (
    <li className="check" data-tone={tone}>
      <span className="check-icon">{icon}</span>
      <span className="check-label">
        {label}
        {note && <small>{note}</small>}
      </span>
      <span className="check-value" key={value}>
        {value}
      </span>
    </li>
  )
}

function Install() {
  const { state, install } = useInstall()

  if (state === 'installed') {
    return (
      <p className="install-note">
        <CircleCheck size={18} aria-hidden="true" /> Instalada en este equipo
      </p>
    )
  }
  if (state === 'available') {
    return (
      <button className="install" type="button" onClick={install}>
        <Download size={20} aria-hidden="true" /> Instalar en este equipo
      </button>
    )
  }
  return (
    <p className="install-note">
      <Smartphone size={18} aria-hidden="true" />
      {state === 'ios'
        ? 'Para instalar: botón Compartir → “Agregar a inicio”.'
        : 'Para instalar: menú del navegador → “Instalar aplicación”.'}
    </p>
  )
}

export default function App() {
  const online = useOnline()

  return (
    <main className="screen">
      <header className="sign">
        <Mark />
        <h1 className="brand">
          CRC
          <span>Centinel Risk Control</span>
        </h1>
      </header>

      <section className="panel" aria-labelledby="estado">
        <p className="lede">Sistema de gestión de seguridad y salud en el trabajo.</p>

        <h2 id="estado">Estado del sistema</h2>
        <ul className="checks">
          <Check icon={<CircleCheck />} label="Aplicación" value="Lista" tone="ok" />
          <Check
            icon={online ? <Wifi /> : <WifiOff />}
            label="Internet"
            value={online ? 'En línea' : 'Sin conexión'}
            note={online ? undefined : 'La app sigue disponible'}
            tone={online ? 'ok' : 'idle'}
          />
          <Check icon={<Database />} label="Base de datos" value="Por conectar" tone="idle" />
        </ul>

        <Install />

        <footer className="foot">Versión 0.1 · Base técnica</footer>
      </section>
    </main>
  )
}
