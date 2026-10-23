import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { type Item, type Lista, borrarItem, cambiarVigencia, guardarItem, leerListas } from './datos'

const TITULO: Record<Lista, { titulo: string; uno: string; ejemplo: string }> = {
  areas: { titulo: 'Áreas', uno: 'área', ejemplo: 'Ej.: Operaciones' },
  puestos: { titulo: 'Puestos', uno: 'puesto', ejemplo: 'Ej.: Supervisor de SSO' },
}

/** Listas de áreas y puestos de la empresa (decisión 5A). El administrador las edita y las elige al registrar personas. */
export function Listas({ empresaId, onVolver }: { empresaId: string; onVolver: () => void }) {
  const [listas, setListas] = useState<Record<Lista, Item[]> | null>(null)
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
        <h1>Áreas y puestos</h1>
        <p>Se eligen al registrar a cada persona. El puesto es un dato de la ficha: no cambia lo que la persona puede hacer.</p>
      </header>
      <Aviso>{error}</Aviso>
      {listas ? (
        <div className="listas">
          <EditorLista lista="areas" empresaId={empresaId} items={listas.areas} onCambio={cargar} />
          <EditorLista lista="puestos" empresaId={empresaId} items={listas.puestos} onCambio={cargar} />
        </div>
      ) : (
        !error && <p className="nota">Cargando…</p>
      )}
    </div>
  )
}

function EditorLista({ lista, empresaId, items, onCambio }: { lista: Lista; empresaId: string; items: Item[]; onCambio: () => void }) {
  const t = TITULO[lista]
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function hacer(fn: () => Promise<unknown>) {
    setError(null)
    setOcupado(true)
    try {
      await fn()
      setEditando(null)
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    if (nombre.trim().length < 2) return setError('Escribe al menos 2 letras.')
    void hacer(() => guardarItem(lista, empresaId, editando === 'nuevo' ? null : editando, nombre))
  }

  const abrir = (item: Item | null) => {
    setError(null)
    setEditando(item ? item.id : 'nuevo')
    setNombre(item?.nombre ?? '')
  }

  const formulario = (
    <form className="form subform fila-form" onSubmit={guardar} noValidate>
      <label className="field">
        <span>{editando === 'nuevo' ? `Agregar ${t.uno}` : `Nombre del ${t.uno}`}</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder={t.ejemplo} autoFocus />
      </label>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn-link" type="button" onClick={() => setEditando(null)}>
          Cancelar
        </button>
      </div>
    </form>
  )

  return (
    <Seccion
      titulo={`${t.titulo} (${items.filter((i) => i.vigente).length})`}
      accion={
        editando === null ? (
          <button className="btn-sec" type="button" onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        ) : null
      }
    >
      {editando === 'nuevo' && formulario}
      <ul className="lista">
        {items.map((i) =>
          editando === i.id ? (
            <li key={i.id}>{formulario}</li>
          ) : (
            <li key={i.id} className={i.vigente ? '' : 'inactiva'}>
              <div>
                <b>{i.nombre}</b>
                {!i.vigente && <span className="chip chip-gris">Desactivado</span>}
              </div>
              {editando === null && (
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => abrir(i)} aria-label={`Renombrar ${i.nombre}`}>
                    <Pencil size={16} aria-hidden="true" /> Renombrar
                  </button>
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => cambiarVigencia(lista, i.id, !i.vigente))}>
                    {i.vigente ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => void hacer(() => borrarItem(lista, i.id))} aria-label={`Borrar ${i.nombre}`}>
                    <Trash2 size={16} aria-hidden="true" /> Borrar
                  </button>
                </span>
              )}
            </li>
          ),
        )}
        {!items.length && <li className="vacio">Todavía no hay {t.titulo.toLowerCase()}.</li>}
      </ul>
      <Aviso>{error}</Aviso>
      <p className="nota">Solo se borra si nunca se usó. Si ya está en la ficha de alguien (aunque esté cesado), se desactiva: deja de aparecer para elegir, pero la ficha lo conserva.</p>
    </Seccion>
  )
}
