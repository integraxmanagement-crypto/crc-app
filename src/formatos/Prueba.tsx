import { Plus, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CampoFicha, Subtipo } from './base'
import type { Lista } from './datos'
import { type Fila, type Respuesta, type Valor, evaluar, repetibleActivo, seccionesVisibles } from './motor'
import type { Punto, Receta } from './receta'

const hoy = () => new Date().toISOString().slice(0, 10)

/**
 * Probar el formato antes de publicarlo: se contesta como en una inspección (sin guardar nada) y se ve al instante
 * el resultado, el puntaje, los hallazgos que nacerían y lo que faltaría para cerrar. Usa el mismo motor de reglas
 * que la inspección real.
 */
export function Prueba({ receta, subtipos, campos, listas }: { receta: Receta; subtipos: Subtipo[]; campos: CampoFicha[]; listas: Lista[] }) {
  const [subtipo, setSubtipo] = useState<string>(subtipos[0]?.codigo ?? '')
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({})
  const [filas, setFilas] = useState<Record<string, Fila[]>>({})
  const [observacion, setObservacion] = useState('')
  const [datos, setDatos] = useState<Record<string, Valor>>({})
  const [fecha, setFecha] = useState(hoy)

  const secciones = seccionesVisibles(receta, subtipo || null)
  const ev = useMemo(
    () => evaluar(receta, { respuestas, filas, observacion, activo: { subtipo: subtipo || null, datos }, fecha }),
    [receta, respuestas, filas, observacion, subtipo, datos, fecha],
  )
  const camposVencimiento = campos.filter((c) => receta.reglas.some((g) => g.tipo === 'vencido' && g.controles.some((k) => k.campo === c.clave)))

  function reiniciar() {
    setRespuestas({})
    setFilas({})
    setObservacion('')
  }

  return (
    <section className="seccion prueba" aria-label="Prueba del formato">
      <header className="seccion-cab">
        <h2>Probar el formato</h2>
        <button className="btn-link" type="button" onClick={reiniciar}>
          <RotateCcw size={16} aria-hidden="true" /> Empezar de nuevo
        </button>
      </header>
      <p className="nota">Nada de esto se guarda. Sirve para ver cómo funcionan los puntos y las reglas con casos inventados.</p>

      <div className="fila3">
        {subtipos.length > 0 && (
          <label className="field">
            <span>Subtipo del activo</span>
            <select value={subtipo} onChange={(e) => setSubtipo(e.target.value)}>
              {subtipos.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Fecha de la inspección</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value || hoy())} />
        </label>
        {camposVencimiento.map((c) => (
          <label key={c.clave} className="field">
            <span>{c.etiqueta} (dato ficticio del activo)</span>
            <input type={c.tipo === 'mes' ? 'month' : 'number'} value={datos[c.clave] ?? ''}
              onChange={(e) => setDatos({ ...datos, [c.clave]: c.tipo === 'mes' ? e.target.value : e.target.value ? Number(e.target.value) : null })} />
          </label>
        ))}
      </div>

      <div className={`resultado-prueba ${ev.faltan.length ? 'incompleta' : ''}`} role="status">
        <p>
          Resultado: <b>{ev.resultado ?? 'Sin resultado (solo «Realizado»)'}</b>
          {ev.puntaje != null && <> · Puntaje: <b>{ev.puntaje} %</b></>} · Hallazgos que nacerían: <b>{ev.hallazgos.length}</b>
        </p>
        {ev.vencidos.length > 0 && <p>Vencido: {ev.vencidos.map((c) => campos.find((x) => x.clave === c)?.etiqueta ?? c).join(', ')}</p>}
        {ev.faltan.length > 0 && (
          <details>
            <summary>Faltan {ev.faltan.length} cosas para poder cerrar</summary>
            <ul>
              {ev.faltan.slice(0, 30).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {secciones.map((s) => (
        <div key={s.clave} className="prueba-seccion">
          <h3>{s.titulo}</h3>
          {s.repetible ? (
            repetibleActivo(s, respuestas) ? (
              <>
                {(filas[s.clave] ?? []).map((fila, i) => (
                  <div key={i} className="prueba-fila">
                    <div className="seccion-cab">
                      <b>
                        {s.titulo} {i + 1}
                      </b>
                      <button className="btn-link" type="button" onClick={() => setFilas((f) => ({ ...f, [s.clave]: f[s.clave].filter((_, k) => k !== i) }))}>
                        <X size={16} aria-hidden="true" /> Quitar
                      </button>
                    </div>
                    {s.puntos.map((p) => (
                      <PuntoPrueba key={p.clave} punto={p} listas={listas} respuesta={fila[p.clave]}
                        onCambio={(r) => setFilas((fs) => ({ ...fs, [s.clave]: fs[s.clave].map((f, k) => (k === i ? { ...f, [p.clave]: r } : f)) }))} />
                    ))}
                  </div>
                ))}
                <button className="btn-link" type="button" onClick={() => setFilas((f) => ({ ...f, [s.clave]: [...(f[s.clave] ?? []), {}] }))}>
                  <Plus size={16} aria-hidden="true" /> Agregar {s.titulo.toLowerCase()}
                </button>
              </>
            ) : (
              <p className="nota">Este bloque aparece cuando se contesta «Sí» en {s.repetible.activa_con}.</p>
            )
          ) : (
            s.puntos.map((p) => (
              <PuntoPrueba key={p.clave} punto={p} listas={listas} respuesta={respuestas[p.clave]}
                onCambio={(r) => setRespuestas((x) => ({ ...x, [p.clave]: r }))} />
            ))
          )}
        </div>
      ))}
      {receta.observacion_general && (
        <label className="field">
          <span>Observación general</span>
          <textarea rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>
      )}
    </section>
  )
}

const OPCIONES: Record<string, [string, string][]> = {
  cumple: [['si', '√'], ['no', 'X'], ['na', 'N/A']],
  si_no: [['si', 'Sí'], ['no', 'No']],
}

function PuntoPrueba({ punto: p, respuesta, listas, onCambio }: { punto: Punto; respuesta: Respuesta | undefined; listas: Lista[]; onCambio: (r: Respuesta) => void }) {
  const r = respuesta ?? { valor: null }
  const noCumple = r.valor === 'no' && (p.tipo === 'cumple' || p.tipo === 'si_no')
  const opcionesLista = p.lista ? (listas.find((l) => l.codigo === p.lista)?.valores.filter((v) => v.vigente).map((v) => v.nombre) ?? []) : (p.opciones ?? [])
  return (
    <div className={`prueba-punto ${noCumple ? 'no-cumple' : ''}`}>
      <p>
        <code>{p.clave}</code> {p.texto}
        {p.critico && <span className="chip chip-mal">Crítico</span>}
        {p.cantidad != null && <span className="chip">Cantidad: {p.cantidad}</span>}
      </p>
      {OPCIONES[p.tipo] ? (
        <div className="botones-respuesta" role="group" aria-label={p.texto}>
          {OPCIONES[p.tipo].map(([v, t]) => (
            <button key={v} type="button" aria-pressed={r.valor === v} onClick={() => onCambio({ ...r, valor: r.valor === v ? null : v })}>
              {t}
            </button>
          ))}
        </div>
      ) : p.tipo === 'numero' ? (
        <input type="number" value={r.valor ?? ''} aria-label={p.texto} placeholder={p.unidad ?? ''}
          onChange={(e) => onCambio({ ...r, valor: e.target.value === '' ? null : Number(e.target.value) })} />
      ) : p.tipo === 'lista' ? (
        <select value={(r.valor as string) ?? ''} aria-label={p.texto} onChange={(e) => onCambio({ ...r, valor: e.target.value || null })}>
          <option value="">— Elige —</option>
          {opcionesLista.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : p.tipo === 'foto' ? (
        <label className="check-linea">
          <input type="checkbox" checked={(r.fotos ?? 0) > 0} onChange={(e) => onCambio({ ...r, fotos: e.target.checked ? 1 : 0 })} />
          Ya tomé la foto (en la prueba no se toma)
        </label>
      ) : p.tipo === 'calculo' ? (
        <p className="nota">Se calcula solo.</p>
      ) : (
        <input type={p.tipo === 'fecha' ? 'date' : p.tipo === 'hora' ? 'time' : 'text'} value={(r.valor as string) ?? ''} aria-label={p.texto}
          placeholder={p.tipo === 'persona' ? 'Nombre de una persona (en la inspección se elige de la lista)' : ''}
          onChange={(e) => onCambio({ ...r, valor: e.target.value || null })} />
      )}
      {noCumple && p.obs_si_no_cumple && (
        <input type="text" value={r.obs ?? ''} placeholder="Observación (obligatoria)" aria-label="Observación" onChange={(e) => onCambio({ ...r, obs: e.target.value })} />
      )}
      {noCumple && p.pide_accion && (
        <div className="fila3">
          <input type="text" placeholder="Acción correctiva" aria-label="Acción correctiva" value={r.accion?.texto ?? ''}
            onChange={(e) => onCambio({ ...r, accion: { texto: e.target.value, responsable: r.accion?.responsable ?? null, plazo: r.accion?.plazo ?? null } })} />
          <input type="text" placeholder="Responsable" aria-label="Responsable" value={r.accion?.responsable ?? ''}
            onChange={(e) => onCambio({ ...r, accion: { texto: r.accion?.texto ?? '', responsable: e.target.value || null, plazo: r.accion?.plazo ?? null } })} />
          <input type="date" aria-label="Plazo" value={r.accion?.plazo ?? ''}
            onChange={(e) => onCambio({ ...r, accion: { texto: r.accion?.texto ?? '', responsable: r.accion?.responsable ?? null, plazo: e.target.value || null } })} />
        </div>
      )}
      {noCumple && p.foto_si_no_cumple && (
        <label className="check-linea">
          <input type="checkbox" checked={(r.fotos ?? 0) > 0} onChange={(e) => onCambio({ ...r, fotos: e.target.checked ? 1 : 0 })} />
          Foto tomada
        </label>
      )}
    </div>
  )
}
