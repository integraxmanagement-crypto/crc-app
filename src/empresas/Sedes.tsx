import { MapPin, Pencil, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Aviso, Campo, Seccion } from './campos'
import { type DatosSede, type Sede, cambiarEstadoSede, guardarSede } from './datos'

const vacia: DatosSede = { nombre: '', direccion: '', distrito: '', provincia: '', departamento: '' }

/** Sedes de la empresa. El dueño agrega, edita y desactiva; el resto solo mira. */
export function Sedes({ empresaId, sedes, editable, onCambio }: { empresaId: string; sedes: Sede[]; editable: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | 'nueva' | null>(null)
  const [datos, setDatos] = useState<DatosSede>(vacia)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function abrir(sede: Sede | null) {
    setError(null)
    setEditando(sede ? sede.id : 'nueva')
    setDatos(sede ? { nombre: sede.nombre, direccion: sede.direccion, distrito: sede.distrito, provincia: sede.provincia, departamento: sede.departamento } : vacia)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      await guardarSede(empresaId, editando === 'nueva' ? null : editando, datos)
      setEditando(null)
      onCambio()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function alternar(sede: Sede) {
    setError(null)
    try {
      await cambiarEstadoSede(sede.id, !sede.activa)
      onCambio()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const campo = (k: keyof DatosSede) => (e: { target: { value: string } }) => setDatos((d) => ({ ...d, [k]: e.target.value }))

  return (
    <Seccion
      titulo={`Sedes (${sedes.filter((s) => s.activa).length} activas)`}
      accion={
        editable && editando === null ? (
          <button className="btn-sec" type="button" onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Agregar sede
          </button>
        ) : null
      }
    >
      <ul className="lista">
        {sedes.map((s) => (
          <li key={s.id} className={s.activa ? '' : 'inactiva'}>
            <MapPin aria-hidden="true" />
            <div>
              <b>{s.nombre}</b>
              {!s.activa && <span className="chip chip-gris">Desactivada</span>}
              <small>
                {s.direccion} · {s.distrito}, {s.provincia}, {s.departamento}
              </small>
            </div>
            {editable && editando === null && (
              <span className="lista-acciones">
                <button className="btn-link" type="button" onClick={() => abrir(s)} aria-label={`Editar ${s.nombre}`}>
                  <Pencil size={16} aria-hidden="true" /> Editar
                </button>
                <button className="btn-link" type="button" onClick={() => void alternar(s)}>
                  {s.activa ? 'Desactivar' : 'Activar'}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {editando !== null && (
        <form className="form subform" onSubmit={guardar} noValidate>
          <Campo etiqueta="Nombre de la sede" value={datos.nombre} onChange={campo('nombre')} maxLength={120} />
          <Campo etiqueta="Dirección" value={datos.direccion} onChange={campo('direccion')} maxLength={250} />
          <div className="fila3">
            <Campo etiqueta="Distrito" value={datos.distrito} onChange={campo('distrito')} maxLength={100} />
            <Campo etiqueta="Provincia" value={datos.provincia} onChange={campo('provincia')} maxLength={100} />
            <Campo etiqueta="Departamento" value={datos.departamento} onChange={campo('departamento')} maxLength={100} />
          </div>
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : editando === 'nueva' ? 'Agregar sede' : 'Guardar sede'}
            </button>
            <button className="btn-link" type="button" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {editando === null && <Aviso>{error}</Aviso>}
      {editable && <p className="nota">Las sedes no se borran: se desactivan, para no perder lo que ya tengan registrado.</p>}
    </Seccion>
  )
}
