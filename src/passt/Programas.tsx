import { CalendarDays, Copy, FilePlus2, ListTodo } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { db, mensaje } from '../empresas/datos'
import { ir } from '../ruta'
import { type Programa, crearPrograma, duplicarPrograma, listarProgramas } from './datos'

const ANIO = new Date().getFullYear()

/**
 * Programas anuales de SST de la empresa (tarea 3.4-E, D-41): uno general para todas las sedes o uno por sede.
 * Se crea desde cero o duplicando otro (copia el árbol y las semanas programadas, no lo ejecutado).
 */
export function Programas({ empresaId, online }: { empresaId: string; online: boolean }) {
  const [lista, setLista] = useState<Programa[] | null>(null)
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ modo: 'nuevo' } | { modo: 'duplicar'; origen: Programa } | null>(null)

  const cargar = useCallback(() => {
    listarProgramas(empresaId).then(setLista, (e) => setError((e as Error).message))
    db().from('sedes').select('id, nombre').eq('empresa_id', empresaId).eq('activa', true).order('nombre')
      .then(({ data, error: e }) => (e ? setError(mensaje(e)) : setSedes(data ?? [])))
  }, [empresaId])
  useEffect(() => {
    if (online) cargar()
  }, [online, cargar])

  const fila = (p: Programa) => (
              <li key={p.id} className={p.vigente ? '' : 'inactiva'}>
                <CalendarDays aria-hidden="true" />
                <div>
                  <b>{p.nombre}</b>
                  <span className={`chip ${p.estado === 'aprobado' ? 'chip-ok' : 'chip-aviso'}`}>{p.estado === 'aprobado' ? 'Aprobado' : 'Borrador'}</span>
                  {!p.vigente && <span className="chip chip-gris">Desactivado</span>}
                  <small>
                    {p.anio} · {p.sede_id ? `Sede ${p.sedes?.nombre ?? ''}` : 'General (todas las sedes)'} · meta {Number(p.meta_cumplimiento)} %
                  </small>
                </div>
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => ir(`/passt/${p.id}`)}>
                    Abrir
                  </button>
                  <button className="btn-link" type="button" disabled={!online} onClick={() => setForm({ modo: 'duplicar', origen: p })}>
                    <Copy size={16} aria-hidden="true" /> Duplicar
                  </button>
                </span>
              </li>
  )

  return (
    <div className="detalle">
      <header className="detalle-cab fila-entre">
        <div>
          <h1>Programa anual de SST</h1>
          <p>Objetivos, metas y actividades del año, con lo programado y lo ejecutado por semana.</p>
        </div>
        <span className="acciones">
          <button className="btn-sec" type="button" onClick={() => ir('/passt/mis-actividades')}>
            <ListTodo size={18} aria-hidden="true" /> Mis actividades
          </button>
          <button className="btn" type="button" disabled={!online} onClick={() => setForm({ modo: 'nuevo' })}>
            <FilePlus2 size={18} aria-hidden="true" /> Nuevo programa
          </button>
        </span>
      </header>
      <Aviso>{error}</Aviso>
      {!online && <p className="aviso-suave">El programa anual se ve y se edita con señal.</p>}
      {form && <FormPrograma empresaId={empresaId} sedes={sedes} origen={form.modo === 'duplicar' ? form.origen : null} onCancelar={() => setForm(null)} />}
      <Seccion titulo="Programas">
        {!lista ? (
          online && !error && <p className="nota">Cargando…</p>
        ) : !lista.length ? (
          <p className="nota">Todavía no hay programas. Crea el de este año.</p>
        ) : (
          <>
            <ul className="lista">{lista.filter((p) => p.vigente).map(fila)}</ul>
            {lista.some((p) => !p.vigente) && (
              <details className="desactivados">
                <summary>Programas desactivados ({lista.filter((p) => !p.vigente).length})</summary>
                <ul className="lista">{lista.filter((p) => !p.vigente).map(fila)}</ul>
              </details>
            )}
          </>
        )}
      </Seccion>
    </div>
  )
}

function FormPrograma({ empresaId, sedes, origen, onCancelar }: { empresaId: string; sedes: { id: string; nombre: string }[]; origen: Programa | null; onCancelar: () => void }) {
  const [anio, setAnio] = useState(origen ? origen.anio + 1 : ANIO)
  const [sede, setSede] = useState(origen?.sede_id ?? '')
  const [nombre, setNombre] = useState('')
  const [seguimiento, setSeguimiento] = useState<'semana' | 'mes'>(origen?.seguimiento ?? 'semana')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const sugerido = `Programa anual de SST ${anio}${sede ? ` · ${sedes.find((s) => s.id === sede)?.nombre ?? ''}` : ''}`

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const datos = { anio, sede_id: sede || null, nombre: nombre.trim() || sugerido }
      const id = origen ? await duplicarPrograma(origen.id, datos) : await crearPrograma(empresaId, { ...datos, seguimiento })
      ir(`/passt/${id}`)
    } catch (err) {
      setError((err as Error).message)
      setOcupado(false)
    }
  }

  return (
    <form className="form subform" onSubmit={enviar} noValidate>
      <h3>{origen ? `Duplicar «${origen.nombre}»` : 'Nuevo programa'}</h3>
      {origen && <p className="nota">Se copian los objetivos, metas, secciones, actividades y las semanas programadas. Lo ejecutado no se copia. Queda en borrador.</p>}
      <div className="fila3">
        <label className="field">
          <span>Año</span>
          <input type="number" min={2020} max={2100} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Alcance</span>
          <select value={sede} onChange={(e) => setSede(e.target.value)}>
            <option value="">General (todas las sedes)</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                Sede {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <Campo etiqueta="Nombre" opcional value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={160} placeholder={sugerido} />
      </div>
      {/* Cómo se hace el seguimiento (pedido del dueño, 29/10/2026): una casilla por semana o una por mes. Se elige al crear. */}
      <fieldset className="seguimiento">
        <legend>Seguimiento del programa</legend>
        <label className="check-linea">
          <input type="radio" name="seguimiento" disabled={Boolean(origen)} checked={seguimiento === 'semana'} onChange={() => setSeguimiento('semana')} /> Por semana (una casilla por semana)
        </label>
        <label className="check-linea">
          <input type="radio" name="seguimiento" disabled={Boolean(origen)} checked={seguimiento === 'mes'} onChange={() => setSeguimiento('mes')} /> Por mes (una casilla por mes)
        </label>
        {origen && <p className="nota">Un programa duplicado conserva el seguimiento del original.</p>}
      </fieldset>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          {ocupado ? 'Creando…' : origen ? 'Duplicar' : 'Crear'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
