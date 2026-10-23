import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import {
  type Item, type Listas as TListas, type Nivel, NOMBRE_NIVEL, type Unidad, borrarPuesto, borrarUnidad, cambiarVigenciaPuesto,
  cambiarVigenciaUnidad, guardarPuesto, guardarUnidad, leerListas,
} from './datos'

const HIJO: Partial<Record<Nivel, Nivel>> = { gerencia: 'area', area: 'subarea' }
const EJEMPLO: Record<Nivel | 'puesto', string> = {
  gerencia: 'Ej.: Operaciones',
  area: 'Ej.: Producción',
  subarea: 'Ej.: Línea 1',
  puesto: 'Ej.: Supervisor de SSO',
}

/**
 * Estructura de la empresa (Gerencia → Área → Subárea o línea, tarea 3.6) y lista de puestos (3.3).
 * El administrador las edita y las elige al registrar a cada persona.
 */
export function Listas({ empresaId, onVolver }: { empresaId: string; onVolver: () => void }) {
  const [listas, setListas] = useState<TListas | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    leerListas(empresaId)
      .then((l) => {
        setListas(l)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(cargar, [cargar])

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={onVolver}>
        <ArrowLeft size={18} aria-hidden="true" /> Ficha de la empresa
      </button>
      <header className="detalle-cab">
        <h1>Estructura y puestos</h1>
        <p>Se eligen al registrar a cada persona. El puesto es un dato de la ficha: no cambia lo que la persona puede hacer.</p>
      </header>
      <Aviso>{error}</Aviso>
      {listas ? (
        <div className="listas">
          <EditorEstructura empresaId={empresaId} unidades={listas.unidades} onCambio={cargar} />
          <EditorPuestos empresaId={empresaId} items={listas.puestos} onCambio={cargar} />
        </div>
      ) : (
        !error && <p className="nota">Cargando…</p>
      )}
    </div>
  )
}

/** Acción en curso: crear dentro de una unidad (o una gerencia nueva) o renombrar una existente. */
type Edicion = { tipo: 'nueva'; nivel: Nivel; padre: string | null } | { tipo: 'renombrar'; id: string } | null

function useAccion(onCambio: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function hacer(fn: () => Promise<unknown>, alTerminar?: () => void) {
    setError(null)
    setOcupado(true)
    try {
      await fn()
      alTerminar?.()
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  return { error, setError, ocupado, hacer }
}

function FormNombre({
  etiqueta, inicial, ejemplo, ocupado, onGuardar, onCancelar,
}: { etiqueta: string; inicial: string; ejemplo: string; ocupado: boolean; onGuardar: (nombre: string) => void; onCancelar: () => void }) {
  const [nombre, setNombre] = useState(inicial)
  function enviar(e: FormEvent) {
    e.preventDefault()
    onGuardar(nombre)
  }
  return (
    <form className="form subform fila-form" onSubmit={enviar} noValidate>
      <label className="field">
        <span>{etiqueta}</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder={ejemplo} autoFocus />
      </label>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function EditorEstructura({ empresaId, unidades, onCambio }: { empresaId: string; unidades: Unidad[]; onCambio: () => void }) {
  const [edicion, setEdicion] = useState<Edicion>(null)
  const { error, setError, ocupado, hacer } = useAccion(onCambio)
  const hijos = (padre: string | null) => unidades.filter((u) => u.padre_id === padre)
  const gerencias = hijos(null)
  const subareas = unidades.filter((u) => u.nivel === 'subarea').length

  function guardar(nombre: string) {
    if (nombre.trim().length < 2) return setError('Escribe al menos 2 letras.')
    if (!edicion) return
    void hacer(
      () =>
        edicion.tipo === 'nueva'
          ? guardarUnidad(empresaId, null, edicion.nivel, edicion.padre, nombre)
          : guardarUnidad(empresaId, edicion.id, 'gerencia', null, nombre),
      () => setEdicion(null),
    )
  }

  const formNueva = (nivel: Nivel, padre: string | null) =>
    edicion?.tipo === 'nueva' && edicion.nivel === nivel && edicion.padre === padre ? (
      <li className="rama-form">
        <FormNombre
          etiqueta={`Agregar ${NOMBRE_NIVEL[nivel].toLowerCase()}`}
          inicial=""
          ejemplo={EJEMPLO[nivel]}
          ocupado={ocupado}
          onGuardar={guardar}
          onCancelar={() => setEdicion(null)}
        />
      </li>
    ) : null

  const ctx: Contexto = { hijos, edicion, setEdicion, ocupado, hacer, setError, guardar, formNueva }

  return (
    <Seccion
      titulo={`Estructura (${gerencias.length} gerencias)`}
      accion={
        edicion === null ? (
          <button className="btn-sec" type="button" onClick={() => { setError(null); setEdicion({ tipo: 'nueva', nivel: 'gerencia', padre: null }) }}>
            <Plus size={18} aria-hidden="true" /> Gerencia
          </button>
        ) : null
      }
    >
      <ul className="rama rama-raiz">
        {formNueva('gerencia', null)}
        {gerencias.map((g) => (
          <Nodo key={g.id} u={g} ctx={ctx} />
        ))}
        {!gerencias.length && edicion === null && <li className="vacio">Todavía no hay gerencias. Empieza agregando una.</li>}
      </ul>
      <Aviso>{error}</Aviso>
      <p className="nota">
        Cada persona se asigna a un área o, si existe, a una subárea o línea. Las subáreas son opcionales{subareas ? '' : ': esta empresa todavía no tiene ninguna'}.
        Solo se borra lo que nunca se usó y no tiene nada dentro; lo demás se desactiva (desactivar una gerencia o un área también desactiva lo que tiene dentro).
      </p>
    </Seccion>
  )
}

type Contexto = {
  hijos: (padre: string | null) => Unidad[]
  edicion: Edicion
  setEdicion: (e: Edicion) => void
  ocupado: boolean
  hacer: (fn: () => Promise<unknown>, alTerminar?: () => void) => Promise<void>
  setError: (e: string | null) => void
  guardar: (nombre: string) => void
  formNueva: (nivel: Nivel, padre: string | null) => ReactNode
}

function Nodo({ u, ctx }: { u: Unidad; ctx: Contexto }) {
const { hijos, edicion, setEdicion, ocupado, hacer, setError, guardar, formNueva } = ctx
  const hijo = HIJO[u.nivel]
  const dentro = hijos(u.id)
  if (edicion?.tipo === 'renombrar' && edicion.id === u.id)
    return (
      <li className="rama-form">
        <FormNombre
          etiqueta={`Nombre de la ${NOMBRE_NIVEL[u.nivel].toLowerCase()}`}
          inicial={u.nombre}
          ejemplo={EJEMPLO[u.nivel]}
          ocupado={ocupado}
          onGuardar={guardar}
          onCancelar={() => setEdicion(null)}
        />
      </li>
    )
  return (
    <li className={u.vigente ? '' : 'inactiva'}>
      <div className="rama-fila">
        <div>
          <span className="rama-nivel">{NOMBRE_NIVEL[u.nivel]}</span>
          <b>{u.nombre}</b>
          {!u.vigente && <span className="chip chip-gris">Desactivada</span>}
        </div>
        {edicion === null && (
          <span className="lista-acciones">
            {hijo && (
              <button className="btn-link" type="button" onClick={() => { setError(null); setEdicion({ tipo: 'nueva', nivel: hijo, padre: u.id }) }}>
                <Plus size={16} aria-hidden="true" /> {hijo === 'area' ? 'Área' : 'Subárea'}
              </button>
            )}
            <button className="btn-link" type="button" onClick={() => { setError(null); setEdicion({ tipo: 'renombrar', id: u.id }) }} aria-label={`Renombrar ${u.nombre}`}>
              <Pencil size={16} aria-hidden="true" /> Renombrar
            </button>
            <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => cambiarVigenciaUnidad(u.id, !u.vigente))}>
              {u.vigente ? 'Desactivar' : 'Activar'}
            </button>
            <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => borrarUnidad(u.id))} aria-label={`Borrar ${u.nombre}`}>
              <Trash2 size={16} aria-hidden="true" /> Borrar
            </button>
          </span>
        )}
      </div>
      {(dentro.length > 0 || (hijo && edicion?.tipo === 'nueva' && edicion.padre === u.id)) && (
        <ul className="rama">
          {dentro.map((h) => (
            <Nodo key={h.id} u={h} ctx={ctx} />
          ))}
          {hijo && formNueva(hijo, u.id)}
        </ul>
      )}
    </li>
  )
}

function EditorPuestos({ empresaId, items, onCambio }: { empresaId: string; items: Item[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const { error, setError, ocupado, hacer } = useAccion(onCambio)

  function guardar(nombre: string) {
    if (nombre.trim().length < 2) return setError('Escribe al menos 2 letras.')
    void hacer(() => guardarPuesto(empresaId, editando === 'nuevo' ? null : editando, nombre), () => setEditando(null))
  }

  const formulario = (inicial: string) => (
    <FormNombre
      etiqueta={editando === 'nuevo' ? 'Agregar puesto' : 'Nombre del puesto'}
      inicial={inicial}
      ejemplo={EJEMPLO.puesto}
      ocupado={ocupado}
      onGuardar={guardar}
      onCancelar={() => setEditando(null)}
    />
  )

  return (
    <Seccion
      titulo={`Puestos (${items.filter((i) => i.vigente).length})`}
      accion={
        editando === null ? (
          <button className="btn-sec" type="button" onClick={() => { setError(null); setEditando('nuevo') }}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        ) : null
      }
    >
      {editando === 'nuevo' && formulario('')}
      <ul className="lista">
        {items.map((i) =>
          editando === i.id ? (
            <li key={i.id}>{formulario(i.nombre)}</li>
          ) : (
            <li key={i.id} className={i.vigente ? '' : 'inactiva'}>
              <div>
                <b>{i.nombre}</b>
                {!i.vigente && <span className="chip chip-gris">Desactivado</span>}
              </div>
              {editando === null && (
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => { setError(null); setEditando(i.id) }} aria-label={`Renombrar ${i.nombre}`}>
                    <Pencil size={16} aria-hidden="true" /> Renombrar
                  </button>
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => cambiarVigenciaPuesto(i.id, !i.vigente))}>
                    {i.vigente ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => borrarPuesto(i.id))} aria-label={`Borrar ${i.nombre}`}>
                    <Trash2 size={16} aria-hidden="true" /> Borrar
                  </button>
                </span>
              )}
            </li>
          ),
        )}
        {!items.length && <li className="vacio">Todavía no hay puestos.</li>}
      </ul>
      <Aviso>{error}</Aviso>
      <p className="nota">Solo se borra si nunca se usó. Si ya está en la ficha de alguien (aunque esté cesado), se desactiva: deja de aparecer para elegir, pero la ficha lo conserva.</p>
    </Seccion>
  )
}
