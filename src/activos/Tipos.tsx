import { Pencil, Plus, Tags, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import type { Subtipo } from '../formatos/base'
import { type TipoActivo, activarTipo, cambiarVigenciaTipo, guardarTipo, listarTiposBase } from '../formatos/datos'
import type { Contexto } from './Activos'

/**
 * Tipos de activo de la empresa. Los 4 tipos base (extintor, caseta, bomba, dispositivo de alarma) se activan
 * con su ficha del anexo; la empresa también puede crear tipos propios con la ficha básica (decisión del dueño, 26/10/2026).
 * Se puede cambiar el nombre y los subtipos; la ficha no se edita en la v1.
 */
export function Tipos({ ctx }: { ctx: Contexto }) {
  const [base, setBase] = useState<TipoActivo[]>([])
  const [editando, setEditando] = useState<TipoActivo | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarTiposBase().then(setBase, (e) => setError((e as Error).message))
  }, [])

  const activo = (b: TipoActivo) => ctx.tipos.some((t) => t.base_id === b.id || t.codigo === b.codigo)
  const hacer = (p: Promise<unknown>) => void p.then(ctx.recargar, (e) => setError((e as Error).message))

  return (
    <>
      <Seccion
        titulo="Tipos de activo de la empresa"
        accion={
          ctx.puedeEditar && !editando ? (
            <button className="btn-sec" type="button" onClick={() => setEditando('nuevo')}>
              <Plus size={18} aria-hidden="true" /> Tipo propio
            </button>
          ) : null
        }
      >
        <Aviso>{error}</Aviso>
        {editando && <FormTipo ctx={ctx} tipo={editando === 'nuevo' ? null : editando} onListo={() => (setEditando(null), ctx.recargar())} onCancelar={() => setEditando(null)} />}
        {!ctx.tipos.length ? (
          <p className="nota">Todavía no hay tipos. Activa uno de los tipos base de abajo o crea uno propio.</p>
        ) : (
          <ul className="lista">
            {ctx.tipos.map((t) => (
              <li key={t.id} className={t.vigente ? '' : 'inactiva'}>
                <Tags aria-hidden="true" />
                <div>
                  <b>{t.nombre}</b>
                  {!t.vigente && <span className="chip chip-gris">Desactivado</span>}
                  {!t.base_id && <span className="chip">Propio</span>}
                  <small>
                    {t.subtipos.length ? `Subtipos: ${t.subtipos.map((s) => s.nombre).join(', ')} · ` : ''}
                    Ficha: código, sede, área, ubicación, responsable{t.campos.length ? `, ${t.campos.map((c) => c.etiqueta.toLowerCase()).join(', ')}` : ''}
                    {t.dotacion ? ' · con dotación esperada por activo' : ''}
                  </small>
                </div>
                {ctx.puedeEditar && !editando && (
                  <span className="lista-acciones">
                    <button className="btn-link" type="button" onClick={() => setEditando(t)}>
                      <Pencil size={16} aria-hidden="true" /> Editar
                    </button>
                    <button className="btn-link" type="button" onClick={() => hacer(cambiarVigenciaTipo(t.id, !t.vigente))}>
                      {t.vigente ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Seccion>
      <Seccion titulo="Tipos base de CRC">
        <ul className="lista">
          {base.map((b) => (
            <li key={b.id}>
              <Tags aria-hidden="true" />
              <div>
                <b>{b.nombre}</b>
                {activo(b) && <span className="chip chip-ok">Ya activado</span>}
                <small>{b.subtipos.length ? `Subtipos: ${b.subtipos.map((s) => s.nombre).join(', ')}` : 'Sin subtipos'}</small>
              </div>
              {ctx.puedeEditar && !activo(b) && (
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => hacer(activarTipo(ctx.empresaId, b.id))}>
                    Activar para mi empresa
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="nota">Al copiar una plantilla base, su tipo de activo se activa solo.</p>
      </Seccion>
    </>
  )
}

function FormTipo({ ctx, tipo, onListo, onCancelar }: { ctx: Contexto; tipo: TipoActivo | null; onListo: () => void; onCancelar: () => void }) {
  const [nombre, setNombre] = useState(tipo?.nombre ?? '')
  const [subtipos, setSubtipos] = useState<Subtipo[]>(tipo?.subtipos ?? [])
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setError(null)
    try {
      await guardarTipo(ctx.empresaId, tipo?.id ?? null, { nombre, subtipos })
      onListo()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="form subform">
      <Campo etiqueta="Nombre del tipo" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Luces de emergencia" />
      <fieldset>
        <legend>Subtipos (opcional)</legend>
        <ul className="lista">
          {subtipos.map((s, i) => (
            <li key={s.codigo || i}>
              <input value={s.nombre} maxLength={80} aria-label="Nombre del subtipo"
                onChange={(e) => setSubtipos(subtipos.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} />
              <button type="button" className="icono" aria-label={`Quitar ${s.nombre}`} onClick={() => setSubtipos(subtipos.filter((_, k) => k !== i))}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="fila-form">
          <Campo etiqueta="Agregar subtipo" value={nuevo} maxLength={80} onChange={(e) => setNuevo(e.target.value)} />
          <button className="btn-sec" type="button" disabled={nuevo.trim().length < 2}
            onClick={() => (setSubtipos([...subtipos, { codigo: '', nombre: nuevo.trim() }]), setNuevo(''))}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        </div>
        {tipo?.base_id && <p className="nota">Si cambias el nombre de un subtipo, los formatos lo siguen reconociendo (usan su código interno).</p>}
      </fieldset>
      {!tipo && <p className="nota">Un tipo propio tiene la ficha básica: código, sede, área, ubicación, responsable y datos técnicos (texto libre).</p>}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="button" onClick={() => void guardar()}>
          Guardar
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
