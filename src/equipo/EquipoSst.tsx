import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { ir } from '../ruta'
import { type MiembroEquipo, guardarMiWhatsapp, leerMiWhatsapp, listarEquipoSst } from './datos'

/** «+51987654321» → «+51 987 654 321» (solo para mostrar). */
function conEspacios(n: string) {
  return n.startsWith('+51') && n.length === 12 ? `+51 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : n
}

function Tarjeta({ m }: { m: MiembroEquipo }) {
  return (
    <li>
      <div>
        <b>{m.nombre}</b>
        <small>{[m.puesto, m.sedes.join(', ')].filter(Boolean).join(' · ')}</small>
        {m.whatsapp ? (
          <small>
            <a className="btn-link" href={`https://wa.me/${m.whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp {conEspacios(m.whatsapp)}
            </a>
          </small>
        ) : <small>Sin WhatsApp registrado</small>}
      </div>
    </li>
  )
}

/**
 * «Conoce al equipo de SST» (etapa 4, 04/11/2026): los gestores de tus sedes, con su puesto y, si ellos lo quisieron, su WhatsApp.
 * Con `inicio` es la tarjeta del inicio de las personas que no son del equipo SSO; sin él, la pantalla completa.
 */
export function EquipoSst({ online, inicio = false, esGestor = false }: { online: boolean; inicio?: boolean; esGestor?: boolean }) {
  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (online) listarEquipoSst().then(setEquipo, (e) => setError((e as Error).message))
  }, [online])

  const lista = !equipo ? <p className="nota">{online ? 'Cargando…' : 'El equipo se ve con señal.'}</p>
    : !equipo.length ? <p className="nota">Todavía no hay gestores asignados a tu sede.</p>
    : <ul className="lista">{equipo.map((m) => <Tarjeta key={m.vinculo_id} m={m} />)}</ul>

  if (inicio) {
    return (
      <Seccion titulo="Conoce al equipo de SST">
        <Aviso>{error}</Aviso>
        {lista}
      </Seccion>
    )
  }
  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inicio
      </button>
      <header className="detalle-cab">
        <h1>Equipo de SST</h1>
        <p>Las personas de seguridad y salud en el trabajo de tus sedes. Escríbeles si tienes una duda o quieres avisar de algo.</p>
      </header>
      {esGestor && <MiWhatsapp online={online} onGuardado={() => listarEquipoSst().then(setEquipo, () => {})} />}
      <Aviso>{error}</Aviso>
      {lista}
    </div>
  )
}

/** El gestor escribe su propio WhatsApp (es opcional; se puede borrar). Nadie más lo escribe. */
function MiWhatsapp({ online, onGuardado }: { online: boolean; onGuardado: () => void }) {
  const [numero, setNumero] = useState('')
  const [cargado, setCargado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'ok'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    if (online) leerMiWhatsapp().then((n) => { setNumero(n); setCargado(true) }, (e) => setAviso({ tipo: 'error', texto: (e as Error).message }))
  }, [online])
  async function guardar(valor: string) {
    setAviso(null)
    setOcupado(true)
    try {
      await guardarMiWhatsapp(valor)
      setNumero(valor ? (await leerMiWhatsapp()) : '')
      setAviso({ tipo: 'ok', texto: valor ? 'Tu número quedó guardado.' : 'Tu número se borró.' })
      onGuardado()
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Seccion titulo="Tu WhatsApp">
      <p className="nota">Es opcional. Si lo escribes, lo verán las personas de tus sedes en esta pantalla. Solo tú puedes cambiarlo o borrarlo.</p>
      <div className="form">
        <Campo etiqueta="Número" type="tel" inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} placeholder="987 654 321" disabled={!cargado || ocupado} />
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
        <div className="acciones">
          <button className="btn" type="button" disabled={!online || !cargado || ocupado || !numero.trim()} onClick={() => void guardar(numero)}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          <button className="btn-link" type="button" disabled={!online || !cargado || ocupado || !numero} onClick={() => void guardar('')}>Borrar mi número</button>
        </div>
      </div>
    </Seccion>
  )
}
