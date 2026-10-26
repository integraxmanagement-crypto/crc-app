import { MapPin, Pencil, Plus } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { type Ubicacion, cambiarVigenciaUbicacion, guardarUbicacion } from '../formatos/datos'
import { caminoUnidad, unidadesAsignables } from '../usuarios/datos'
import type { Contexto } from './Activos'

/** Ubicaciones dentro de cada sede (empresa → sede → área → ubicación), opcionalmente asociadas a un área de la estructura. */
export function Ubicaciones({ ctx }: { ctx: Contexto }) {
  const [editando, setEditando] = useState<Ubicacion | 'nueva' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const porSede = ctx.sedes.map((s) => ({ sede: s, ubicaciones: ctx.ubicaciones.filter((u) => u.sede_id === s.id) }))

  return (
    <Seccion
      titulo={`Ubicaciones (${ctx.ubicaciones.filter((u) => u.vigente).length})`}
      accion={
        ctx.puedeEditar && !editando ? (
          <button className="btn-sec" type="button" onClick={() => setEditando('nueva')}>
            <Plus size={18} aria-hidden="true" /> Agregar ubicación
          </button>
        ) : null
      }
    >
      <p className="nota">Lugares dentro de una sede, por ejemplo «Pasillo 2, junto a la puerta». El área es la de «Estructura y puestos».</p>
      <Aviso>{error}</Aviso>
      {editando && <FormUbicacion ctx={ctx} ubicacion={editando === 'nueva' ? null : editando} onListo={() => (setEditando(null), ctx.recargar())} onCancelar={() => setEditando(null)} />}
      {porSede.map(({ sede, ubicaciones }) => (
        <div key={sede.id}>
          <h3 className="subtitulo">{sede.nombre}{!sede.activa && ' (sede desactivada)'}</h3>
          {ubicaciones.length === 0 ? (
            <p className="nota">Sin ubicaciones.</p>
          ) : (
            <ul className="lista">
              {ubicaciones.map((u) => (
                <li key={u.id} className={u.vigente ? '' : 'inactiva'}>
                  <MapPin aria-hidden="true" />
                  <div>
                    <b>{u.nombre}</b>
                    {!u.vigente && <span className="chip chip-gris">Desactivada</span>}
                    {u.unidad_id && <small>{caminoUnidad(ctx.unidades, u.unidad_id).ruta}</small>}
                  </div>
                  {ctx.puedeEditar && !editando && (
                    <span className="lista-acciones">
                      <button className="btn-link" type="button" onClick={() => setEditando(u)}>
                        <Pencil size={16} aria-hidden="true" /> Editar
                      </button>
                      <button className="btn-link" type="button"
                        onClick={() => void cambiarVigenciaUbicacion(u.id, !u.vigente).then(ctx.recargar, (e) => setError((e as Error).message))}>
                        {u.vigente ? 'Desactivar' : 'Activar'}
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Seccion>
  )
}

function FormUbicacion({ ctx, ubicacion, onListo, onCancelar }: { ctx: Contexto; ubicacion: Ubicacion | null; onListo: () => void; onCancelar: () => void }) {
  const [sede, setSede] = useState(ubicacion?.sede_id ?? ctx.sedes.find((s) => s.activa)?.id ?? '')
  const [unidad, setUnidad] = useState(ubicacion?.unidad_id ?? '')
  const [nombre, setNombre] = useState(ubicacion?.nombre ?? '')
  const [error, setError] = useState<string | null>(null)
  const areas = useMemo(() => unidadesAsignables(ctx.unidades), [ctx.unidades])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await guardarUbicacion(ctx.empresaId, ubicacion?.id ?? null, sede, unidad || null, nombre)
      onListo()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="form subform" onSubmit={guardar} noValidate>
      <div className="fila3">
        <label className="field">
          <span>Sede</span>
          <select value={sede} onChange={(e) => setSede(e.target.value)}>
            {ctx.sedes.filter((s) => s.activa || s.id === sede).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Área <em className="opcional">(opcional)</em>
          </span>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            <option value="">— Sin área —</option>
            {areas.filter((a) => a.vigente || a.id === unidad).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <Campo etiqueta="Nombre de la ubicación" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Pasillo 2, junto a la puerta" />
      </div>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit">
          Guardar
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
