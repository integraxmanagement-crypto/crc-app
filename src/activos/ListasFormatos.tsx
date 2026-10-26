import { List, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { type Lista, type ValorLista, cambiarVigenciaValor, copiarListaBase, crearLista, guardarValorLista, listarListas } from '../formatos/datos'
import type { Contexto } from './Activos'

/**
 * Listas que usan los formatos y las fichas (agentes extintores, unidades, tipos de soporte, tipos de bloqueo…).
 * Cada empresa edita las suyas; las listas base de CRC no cambian. Un valor en uso se desactiva en vez de borrarse.
 */
export function ListasFormatos({ ctx }: { ctx: Contexto }) {
  const [base, setBase] = useState<Lista[]>([])
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarListas(null).then(setBase, (e) => setError((e as Error).message))
  }, [])

  const hacer = (p: Promise<unknown>, alTerminar?: () => void) =>
    void p.then(() => (alTerminar?.(), ctx.recargar()), (e) => setError((e as Error).message))
  const faltan = base.filter((b) => !ctx.listas.some((l) => l.codigo === b.codigo))

  return (
    <>
      <Aviso>{error}</Aviso>
      {ctx.listas.map((l) => (
        <EditorLista key={l.id} lista={l} puedeEditar={ctx.puedeEditar} onError={setError} onCambio={ctx.recargar} />
      ))}
      {!ctx.listas.length && <p className="nota">Todavía no hay listas. Se copian solas al activar un tipo de activo o copiar una plantilla.</p>}
      {ctx.puedeEditar && (
        <Seccion titulo="Agregar una lista">
          <div className="fila-form">
            <Campo etiqueta="Nombre de la lista nueva" value={nueva} maxLength={120} onChange={(e) => setNueva(e.target.value)} placeholder="Ej.: Tipos de peligro" />
            <button className="btn-sec" type="button" disabled={nueva.trim().length < 2} onClick={() => hacer(crearLista(ctx.empresaId, nueva), () => setNueva(''))}>
              <Plus size={18} aria-hidden="true" /> Crear
            </button>
          </div>
          {faltan.length > 0 && (
            <ul className="lista">
              {faltan.map((b) => (
                <li key={b.id}>
                  <List aria-hidden="true" />
                  <div>
                    <b>{b.nombre}</b>
                    <small>Lista base de CRC: {b.valores.map((v) => v.nombre).join(', ')}</small>
                  </div>
                  <span className="lista-acciones">
                    <button className="btn-link" type="button" onClick={() => hacer(copiarListaBase(ctx.empresaId, b.codigo))}>
                      Copiar a mi empresa
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
    </>
  )
}

function EditorLista({ lista, puedeEditar, onError, onCambio }: { lista: Lista; puedeEditar: boolean; onError: (m: string) => void; onCambio: () => void }) {
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<ValorLista | null>(null)
  const [texto, setTexto] = useState('')
  const hacer = (p: Promise<unknown>, alTerminar?: () => void) => void p.then(() => (alTerminar?.(), onCambio()), (e) => onError((e as Error).message))

  return (
    <Seccion titulo={`${lista.nombre} (${lista.valores.filter((v) => v.vigente).length})`}>
      <ul className="chips valores">
        {lista.valores.map((v) =>
          editando?.id === v.id ? (
            <li key={v.id} className="fila-form">
              <input value={texto} maxLength={120} autoFocus aria-label="Nuevo nombre" onChange={(e) => setTexto(e.target.value)} />
              <button className="btn-sec" type="button" onClick={() => hacer(guardarValorLista(lista.id, v.id, texto), () => setEditando(null))}>
                Guardar
              </button>
              <button className="btn-link" type="button" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </li>
          ) : (
            <li key={v.id} className={`chip ${v.vigente ? '' : 'chip-gris'}`}>
              {v.nombre}
              {!v.vigente && ' (desactivado)'}
              {puedeEditar && (
                <>
                  <button type="button" className="icono" aria-label={`Renombrar ${v.nombre}`} onClick={() => (setEditando(v), setTexto(v.nombre))}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="btn-link mini" onClick={() => hacer(cambiarVigenciaValor(v.id, !v.vigente))}>
                    {v.vigente ? 'Desactivar' : 'Activar'}
                  </button>
                </>
              )}
            </li>
          ),
        )}
      </ul>
      {puedeEditar && (
        <div className="fila-form">
          <Campo etiqueta="Agregar valor" value={nuevo} maxLength={120} onChange={(e) => setNuevo(e.target.value)} />
          <button className="btn-sec" type="button" disabled={!nuevo.trim()} onClick={() => hacer(guardarValorLista(lista.id, null, nuevo), () => setNuevo(''))}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        </div>
      )}
    </Seccion>
  )
}
