import { Users } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Aviso, Seccion } from './campos'
import { db, mensaje, rpc } from './datos'

/**
 * N.º de trabajadores del centro laboral (pedido del dueño, 29/10/2026). Dos modos: «automático» (CRC cuenta al personal
 * activo de la empresa) o «manual» (se digita). Ese número sale solo en todos los formatos y en el PASST que lo piden:
 * no se escribe a mano en cada uno. Lo cambia el administrador de la empresa o Integrax.
 */
export function Trabajadores({ empresaId, modo, manual, editable, onCambio }: { empresaId: string; modo: 'automatico' | 'manual'; manual: number | null; editable: boolean; onCambio: () => void }) {
  const [elegido, setElegido] = useState(modo)
  const [cantidad, setCantidad] = useState(manual == null ? '' : String(manual))
  const [automatico, setAutomatico] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    db().from('vinculos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('estado', 'activo')
      .then(({ count }) => setAutomatico(count ?? null), () => {})
  }, [empresaId])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (elegido === 'manual' && !/^\d{1,7}$/.test(cantidad.trim())) return setError('Escribe la cantidad de trabajadores (solo números).')
    setOcupado(true)
    try {
      await rpc('guardar_trabajadores', { p_empresa: empresaId, p_modo: elegido, p_cantidad: elegido === 'manual' ? Number(cantidad) : null })
      setOk(true)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : mensaje(err as { message?: string }))
    } finally {
      setOcupado(false)
    }
  }

  const actual = modo === 'manual' ? manual : automatico
  return (
    <Seccion titulo="N.º de trabajadores">
      <p className="nota">
        <Users size={16} aria-hidden="true" /> Hoy se usa: <b>{actual ?? '—'}</b> ({modo === 'manual' ? 'digitado a mano' : 'contado automáticamente del personal activo'}). Este número sale solo en
        todos los formatos y en el PASST que lo piden.
      </p>
      {editable && (
        <form className="form subform" onSubmit={guardar} noValidate>
          <label className="check-linea">
            <input type="radio" name="trabajadores" checked={elegido === 'automatico'} onChange={() => setElegido('automatico')} /> Automático: contar el personal activo de la empresa
            {automatico != null && <small> (hoy: {automatico})</small>}
          </label>
          <label className="check-linea">
            <input type="radio" name="trabajadores" checked={elegido === 'manual'} onChange={() => setElegido('manual')} /> Manual: escribir la cantidad
          </label>
          {elegido === 'manual' && (
            <label className="field">
              <span>Cantidad de trabajadores</span>
              <input type="text" inputMode="numeric" maxLength={7} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </label>
          )}
          <Aviso>{error}</Aviso>
          {ok && <Aviso tipo="ok">Guardado.</Aviso>}
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </Seccion>
  )
}
