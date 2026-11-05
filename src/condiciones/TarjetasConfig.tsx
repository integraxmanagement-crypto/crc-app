import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { guardarTarjeta, quitarTarjeta } from './datos'
import type { Columna, Tarjeta } from './reglas'

const OPERADORES: [string, string][] = [['vacia', 'está vacía (sin dato)'], ['igual', 'es igual a'], ['distinto', 'es distinta de']]
const NOMBRE_ESTADOS: [string, string][] = [['pendiente', 'Pendiente'], ['atrasado', 'Atrasado'], ['dentro_plazo', 'Realizado dentro de plazo'], ['fuera_plazo', 'Realizado fuera de plazo']]

/** Tarjetas del encabezado de la matriz: cuentan las condiciones según una columna. Las dos fijas no se cambian. Solo administradores. */
export function TarjetasConfig({ sedeId, columnas, tarjetas, online, onCambio }: { sedeId: string; columnas: Columna[]; tarjetas: Tarjeta[]; online: boolean; onCambio: () => Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  const [t, setT] = useState({ id: null as string | null, titulo: '', columna: '', operador: 'vacia', valor: '' })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const col = columnas.find((c) => c.clave === t.columna)
  const columnasTarjeta = columnas.filter((c) => c.tipo !== 'foto')
  async function hacer(f: () => Promise<unknown>) {
    setError(null)
    setOcupado(true)
    try {
      await f()
      setAbierto(false)
      await onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const describir = (x: Tarjeta) => `Columna «${columnas.find((c) => c.clave === x.columna)?.nombre ?? x.columna}» ${OPERADORES.find(([o]) => o === x.operador)?.[1] ?? ''}${x.valor ? ` «${x.valor}»` : ''}`
  return (
    <Seccion titulo="Tarjetas del encabezado">
      <p className="nota">Cada tarjeta cuenta las condiciones según una columna. Las dos primeras son fijas; agrega las que necesites.</p>
      <ul className="lista">
        {tarjetas.map((x) => (
          <li key={x.id}>
            <div>
              <b>{x.titulo}</b>
              <small>{x.fija ? 'Fija' : describir(x)}</small>
            </div>
            {!x.fija && online && (
              <span className="acciones">
                <button className="btn-link" type="button" disabled={ocupado} onClick={() => { setT({ id: x.id, titulo: x.titulo, columna: x.columna, operador: x.operador, valor: x.valor ?? '' }); setAbierto(true); setError(null) }}>Editar</button>
                <button className="btn-link" type="button" disabled={ocupado} onClick={() => { if (window.confirm(`¿Quitar la tarjeta «${x.titulo}»?`)) void hacer(() => quitarTarjeta(x.id)) }}>Quitar</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {!online && <p className="aviso-suave">Para crear o cambiar tarjetas necesitas señal.</p>}
      {online && !abierto && (
        <div className="acciones">
          <button className="btn" type="button" onClick={() => { setT({ id: null, titulo: '', columna: columnasTarjeta[0]?.clave ?? '', operador: 'vacia', valor: '' }); setAbierto(true); setError(null) }}>
            <Plus size={18} aria-hidden="true" /> Agregar tarjeta
          </button>
        </div>
      )}
      {abierto && (
        <form className="subform" onSubmit={(e) => { e.preventDefault(); void hacer(() => guardarTarjeta(sedeId, t.id, { titulo: t.titulo, columna: t.columna, operador: t.operador, valor: t.operador === 'vacia' ? null : t.valor })) }}>
          <label className="field"><span>Título de la tarjeta</span><input type="text" maxLength={80} value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} /></label>
          <label className="field"><span>Columna</span>
            <select value={t.columna} onChange={(e) => setT({ ...t, columna: e.target.value, valor: '' })}>
              {columnasTarjeta.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
            </select></label>
          <label className="field"><span>Cuenta las condiciones cuya columna…</span>
            <select value={t.operador} onChange={(e) => setT({ ...t, operador: e.target.value })}>
              {OPERADORES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select></label>
          {t.operador !== 'vacia' && (col?.tipo === 'estado' || col?.tipo === 'lista' ? (
            <label className="field"><span>Valor</span>
              <select value={t.valor} onChange={(e) => setT({ ...t, valor: e.target.value })}>
                <option value="">— Elige —</option>
                {(col.tipo === 'estado' ? NOMBRE_ESTADOS : col.opciones.map((o) => [o, o] as [string, string])).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select></label>
          ) : (
            <label className="field"><span>Valor</span><input type="text" maxLength={120} value={t.valor} onChange={(e) => setT({ ...t, valor: e.target.value })} /></label>
          ))}
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar tarjeta'}</button>
            <button className="btn-sec" type="button" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      )}
      {!abierto && <Aviso>{error}</Aviso>}
    </Seccion>
  )
}
