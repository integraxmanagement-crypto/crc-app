import { ArrowLeft, Camera, Check, PenLine, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Aviso } from '../empresas/campos'
import { type Fila, type Respuesta, evaluar, puntoVisible, textoVencido, repetibleActivo, seccionesVisibles, sinOcultas } from '../formatos/motor'
import type { Punto } from '../formatos/receta'
import { useOnline } from '../hooks'
import { ir } from '../ruta'
import { type Borrador, type CopiaLocal, type Firmante, type FotoLocal, cerrar, guardarBorrador, guardarFoto, leerArchivo, leerBorrador, leerCopia, quitarArchivo } from './campo'
import { BuscarFirmante } from './BuscarFirmante'
import { PanelFirma } from './Firma'
import { faltanFirmantes, hoyLocal } from './ayudas'
import { prepararFoto } from './imagen'

const OPCIONES: Record<string, [string, string][]> = {
  cumple: [['si', '√'], ['no', 'X'], ['na', 'N/A']],
  si_no: [['si', 'Sí'], ['no', 'No']],
}

/** Cantidad de fotos de cada punto, a partir de las fotos guardadas (así el motor sabe si falta alguna). */
function conFotos(b: Borrador): { respuestas: Record<string, Respuesta>; filas: Record<string, Fila[]> } {
  const respuestas: Record<string, Respuesta> = {}
  for (const [k, r] of Object.entries(b.respuestas)) respuestas[k] = { ...r, fotos: 0 }
  const filas: Record<string, Fila[]> = {}
  for (const [s, lista] of Object.entries(b.filas)) filas[s] = lista.map((f) => Object.fromEntries(Object.entries(f).map(([k, r]) => [k, { ...r, fotos: 0 }])))
  for (const f of b.fotos) {
    if (f.fila == null) {
      respuestas[f.punto_clave] ??= { valor: null }
      respuestas[f.punto_clave].fotos = (respuestas[f.punto_clave].fotos ?? 0) + 1
    } else
      for (const lista of Object.values(filas)) {
        const fila = lista[f.fila]
        if (!fila) continue
        fila[f.punto_clave] ??= { valor: null }
        fila[f.punto_clave].fotos = (fila[f.punto_clave].fotos ?? 0) + 1
      }
  }
  return { respuestas, filas }
}

/**
 * Llenar una inspección (tarea 3.4-C). Funciona igual con o sin señal: todo se guarda en el equipo a cada cambio
 * y al cerrarla pasa a la cola de envío. El resultado, el puntaje y los hallazgos se ven al instante con el mismo
 * motor de reglas que usa el servidor.
 */
export function Llenar({ id, cuenta, sinEspacio }: { id: string; cuenta: string; sinEspacio: boolean }) {
  const [b, setB] = useState<Borrador | null>(null)
  const [copia, setCopia] = useState<CopiaLocal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [firmando, setFirmando] = useState<string | null>(null)
  const [intentoCierre, setIntentoCierre] = useState(false)
  const online = useOnline()
  const [cerrando, setCerrando] = useState(false)
  const pendiente = useRef<Borrador | null>(null)

  useEffect(() => {
    void leerBorrador(id).then(async (x) => {
      if (!x || x.cuenta !== cuenta) return setError('Esta inspección no está en este equipo (o ya se cerró).')
      setB(x)
      setCopia((await leerCopia(cuenta, x.empresa_id)) ?? null)
    })
  }, [id, cuenta])

  // Se guarda sola: 300 ms después del último cambio, y al salir de la pantalla.
  useEffect(() => {
    if (!pendiente.current) return
    const t = setTimeout(() => {
      if (pendiente.current) void guardarBorrador(pendiente.current).catch((e) => setError((e as Error).message))
      pendiente.current = null
    }, 300)
    return () => clearTimeout(t)
  }, [b])
  useEffect(() => {
    const guardarYa = () => {
      if (pendiente.current) void guardarBorrador(pendiente.current)
      pendiente.current = null
    }
    window.addEventListener('pagehide', guardarYa)
    return () => {
      guardarYa()
      window.removeEventListener('pagehide', guardarYa)
    }
  }, [])

  function cambiar(f: (x: Borrador) => Borrador) {
    setB((x) => {
      if (!x) return x
      const nuevo = f(x)
      pendiente.current = nuevo
      return nuevo
    })
  }

  const contados = useMemo(() => (b ? conFotos(b) : null), [b])
  const ev = useMemo(
    () =>
      b && contados
        ? evaluar(b.receta, {
            ...contados,
            observacion: b.observacion,
            activo: b.activo_foto ? { subtipo: b.activo_foto.subtipo, datos: b.activo_foto.datos } : null,
            fecha: b.fecha,
          })
        : null,
    [b, contados],
  )

  if (error && !b) return <Aviso>{error}</Aviso>
  if (!b || !ev) return <p className="nota">Abriendo…</p>

  const receta = b.receta
  const secciones = seccionesVisibles(receta, b.activo_foto?.subtipo ?? null)
  const personas = copia?.personas ?? []
  // DACI, motobomba y electrobomba: el cargo sale solo al elegir a la persona (pedido del dueño, 30/10/2026).
  const esDaci = receta.secciones.some((x) => x.puntos.some((q) => /^(DACI|MB|EB)-/.test(q.clave)))
  const listas = copia?.listas ?? []
  const faltaFirmas = faltanFirmantes(receta, b.firmantes)
  const faltan = [...ev.faltan, ...faltaFirmas]

  async function agregarFoto(punto: string, fila: number | null, archivo: File) {
    setError(null)
    try {
      const { blob, tipo, sha256 } = await prepararFoto(archivo)
      const idFoto = crypto.randomUUID()
      await guardarFoto(cuenta, idFoto, blob)
      const foto: FotoLocal = { id: idFoto, punto_clave: punto, fila, bytes: blob.size, tipo_mime: tipo, sha256 }
      cambiar((x) => ({ ...x, fotos: [...x.fotos, foto] }))
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar la foto en el equipo.')
    }
  }
  function quitarFoto(f: FotoLocal) {
    void quitarArchivo(f.id)
    cambiar((x) => ({ ...x, fotos: x.fotos.filter((y) => y.id !== f.id) }))
  }

  async function guardarMiFirma(rol: string, png: Blob) {
    const idFirma = crypto.randomUUID()
    if (b!.mi_firma) await quitarArchivo(b!.mi_firma.archivo_id)
    await guardarFoto(cuenta, idFirma, png)
    cambiar((x) => ({ ...x, mi_firma: { rol_clave: rol, archivo_id: idFirma, bytes: png.size, firmado_en: new Date().toISOString() } }))
    setFirmando(null)
  }

  async function cerrarYa() {
    if (faltan.length) return
    setCerrando(true)
    pendiente.current = null
    try {
      await cerrar({ ...b!, respuestas: contados!.respuestas, filas: contados!.filas })
      ir('/inspecciones')
    } catch (e) {
      setError((e as Error).message)
      setCerrando(false)
    }
  }

  const cantidadDe = (p: Punto) => b.activo_foto?.dotacion?.[p.clave] ?? p.cantidad ?? null
  const calculo = (p: Punto) => {
    if (p.formula === 'puntaje') return ev.puntaje != null ? `${ev.puntaje} %` : '—'
    if (p.formula === 'antiguedad' && p.campo) {
      const v = Number(b.activo_foto?.datos?.[p.campo])
      return Number.isFinite(v) && v > 0 ? `${Number(b.fecha.slice(0, 4)) - v} años` : '—'
    }
    return '—'
  }
  const fotosDe = (punto: string, fila: number | null) => b.fotos.filter((f) => f.punto_clave === punto && f.fila === fila)

  const punto = (p: Punto, r: Respuesta | undefined, fila: number | null, onCambio: (r: Respuesta) => void) => (
    <PuntoCampo key={p.clave} punto={p} respuesta={r} listas={listas} personas={personas} cantidad={cantidadDe(p)} calculo={calculo(p)}
      fotos={fotosDe(p.clave, fila)} sinEspacio={sinEspacio} onCambio={onCambio}
      onFoto={(a) => void agregarFoto(p.clave, fila, a)} onQuitarFoto={quitarFoto} />
  )

  return (
    <div className="detalle llenar">
      <button className="btn-link volver" type="button" onClick={() => ir('/inspecciones')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inspecciones
      </button>
      <header className="detalle-cab">
        <h1>{b.nombre_formato}</h1>
        <p>
          {b.activo_foto ? `${b.activo_foto.tipo} ${b.activo_foto.codigo}` : 'Inspección de área'} · Se guarda sola en este equipo, aun sin señal.
        </p>
      </header>

      <label className="field campo-fecha">
        <span>Fecha de la inspección</span>
        <input type="date" value={b.fecha} max={hoyLocal()} onChange={(e) => e.target.value && cambiar((x) => ({ ...x, fecha: e.target.value }))} />
      </label>
      {ev.vencidos.length > 0 && <p className="aviso-suave">Inoperativo por: {ev.vencidos.map((c) => textoVencido(c, receta)).join('; ')}.</p>}

      {secciones.map((s) => (
        <div key={s.clave} className="prueba-seccion">
          <h3>{s.titulo}</h3>
          {s.repetible ? (
            repetibleActivo(s, contados!.respuestas) ? (
              <>
                {(b.filas[s.clave] ?? []).map((fila, i) => (
                  <div key={i} className="prueba-fila">
                    <div className="seccion-cab">
                      <b>{s.titulo} {i + 1}</b>
                      <button className="btn-link" type="button"
                        onClick={() => cambiar((x) => ({
                          ...x,
                          filas: { ...x.filas, [s.clave]: x.filas[s.clave].filter((_, k) => k !== i) },
                          // Las fotos de las filas siguientes bajan un lugar.
                          fotos: x.fotos.filter((f) => !(f.fila === i && s.puntos.some((p) => p.clave === f.punto_clave)))
                            .map((f) => (f.fila != null && f.fila > i && s.puntos.some((p) => p.clave === f.punto_clave) ? { ...f, fila: f.fila - 1 } : f)),
                        }))}>
                        <X size={16} aria-hidden="true" /> Quitar
                      </button>
                    </div>
                    {s.puntos.map((p) => punto(p, fila[p.clave], i, (r) =>
                      cambiar((x) => ({ ...x, filas: { ...x.filas, [s.clave]: x.filas[s.clave].map((f, k) => (k === i ? { ...f, [p.clave]: r } : f)) } }))))}
                  </div>
                ))}
                <button className="btn-link" type="button" onClick={() => cambiar((x) => ({ ...x, filas: { ...x.filas, [s.clave]: [...(x.filas[s.clave] ?? []), {}] } }))}>
                  <Plus size={16} aria-hidden="true" /> Agregar {s.titulo.toLowerCase()}
                </button>
              </>
            ) : (
              <p className="nota">Este bloque aparece cuando se contesta «Sí» en la pregunta que lo activa.</p>
            )
          ) : (
            s.puntos.filter((p) => puntoVisible(p, b.respuestas)).map((p) => punto(p, b.respuestas[p.clave], null, (r) =>
              cambiar((x) => ({ ...x, respuestas: sinOcultas(receta, { ...x.respuestas, [p.clave]: r }) }))))
          )}
        </div>
      ))}

      {receta.observacion_general && (
        <label className="field">
          <span>Observación general</span>
          <textarea rows={3} maxLength={4000} value={b.observacion} onChange={(e) => cambiar((x) => ({ ...x, observacion: e.target.value }))} />
        </label>
      )}

      {receta.firmas.length > 0 && (
        <section className="prueba-seccion" aria-label="Firmas">
          <h3>Firmas</h3>
          <p className="nota">
            Busca a cada firmante en la lista o, si el formato lo permite, escribe su nombre. Cada persona de CRC firma desde su propia cuenta (le aparecerá en «Mis firmas»); quien no está en la lista firma a mano en la hoja impresa.
          </p>
          {receta.firmas.map((rol) => {
            const deRol = b.firmantes.filter((f) => f.rol_clave === rol.clave)
            return (
              <div key={rol.clave} className="firmantes">
                <b>
                  {rol.titulo} {rol.obligatoria ? `(mínimo ${rol.minimo})` : '(opcional)'}
                </b>
                {deRol.map((f) => {
                  const k = b.firmantes.indexOf(f)
                  const cambiarF = (c: Partial<Firmante>) => cambiar((x) => ({ ...x, firmantes: x.firmantes.map((y, j) => (j === k ? { ...y, ...c } : y)) }))
                  const externo = f.persona_id === null && f.externo_nombre != null
                  return (
                    <div key={k} className="firmante">
                      {externo ? (
                        <div className="externo-escrito">
                          <div className="fila2">
                            <input type="text" placeholder="Nombre y apellido" aria-label={`Nombre escrito a mano: ${rol.titulo}`} maxLength={200} value={f.externo_nombre ?? ''}
                              onChange={(e) => cambiarF({ externo_nombre: e.target.value })} />
                            <input type="text" placeholder="Documento (DNI, CE…)" aria-label={`Documento: ${rol.titulo}`} maxLength={20} value={f.externo_documento ?? ''}
                              onChange={(e) => cambiarF({ externo_documento: e.target.value || null })} />
                          </div>
                          <small className="nota">
                            No está en la lista de CRC: firma a mano en la hoja impresa.{' '}
                            <button className="btn-link" type="button" onClick={() => cambiarF({ externo_nombre: null, externo_documento: null })}>
                              Buscar en la lista
                            </button>
                          </small>
                        </div>
                      ) : (
                        // Búsqueda rápida en la lista o nombre escrito a mano (revisión de diseño, obs. 9).
                        <BuscarFirmante personas={personas} elegido={f.persona_id ?? null} cuenta={cuenta} rolTitulo={rol.titulo} permiteExterno={rol.externo}
                          ocupados={new Set(b.firmantes.filter((y, j) => j !== k && y.rol_clave === rol.clave && y.persona_id).map((y) => y.persona_id!))}
                          onPersona={(id) => {
                            // DACI: el cargo sale solo con el puesto de la persona elegida (se puede corregir). Otros formatos: se escribe a mano.
                            const puesto = esDaci ? (personas.find((q) => q.persona_id === id)?.puesto ?? null) : null
                            const quita = f.persona_id === cuenta && f.persona_id !== id && b.mi_firma?.rol_clave === rol.clave
                            if (quita) void quitarArchivo(b.mi_firma!.archivo_id)
                            cambiar((x) => ({ ...x, mi_firma: quita ? null : x.mi_firma, firmantes: x.firmantes.map((y, j) => (j === k ? { ...y, persona_id: id, externo_nombre: null, externo_documento: null, ...(esDaci && puesto ? { cargo: puesto } : {}) } : y)) }))
                          }}
                          onExterno={(nombre) => {
                            const quita = f.persona_id === cuenta && b.mi_firma?.rol_clave === rol.clave
                            if (quita) void quitarArchivo(b.mi_firma!.archivo_id)
                            cambiar((x) => ({ ...x, mi_firma: quita ? null : x.mi_firma, firmantes: x.firmantes.map((y, j) => (j === k ? { ...y, persona_id: null, externo_nombre: nombre, externo_documento: null } : y)) }))
                          }} />
                      )}
                      <input type="text" className="firmante-cargo" placeholder="Cargo (escríbelo)" aria-label={`Cargo: ${rol.titulo}`} maxLength={120} value={f.cargo ?? ''}
                        onChange={(e) => cambiarF({ cargo: e.target.value || null })} />
                      {f.persona_id === cuenta && (
                        b.mi_firma?.rol_clave === rol.clave ? (
                          <span className="chip chip-ok"><Check size={14} aria-hidden="true" /> Firmaste</span>
                        ) : b.mi_firma ? (
                          <span className="nota">Ya firmaste en otro rol.</span>
                        ) : (
                          <button className="btn-sec" type="button" onClick={() => setFirmando(rol.clave)}>
                            <PenLine size={16} aria-hidden="true" /> Firmar ahora
                          </button>
                        )
                      )}
                      <button className="btn-link" type="button" aria-label="Quitar firmante"
                        onClick={() => {
                          const quita = f.persona_id === cuenta && b.mi_firma?.rol_clave === rol.clave
                          if (quita) void quitarArchivo(b.mi_firma!.archivo_id)
                          cambiar((x) => ({ ...x, mi_firma: quita ? null : x.mi_firma, firmantes: x.firmantes.filter((_, j) => j !== k) }))
                        }}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
                {firmando === rol.clave && <PanelFirma onListo={(png) => void guardarMiFirma(rol.clave, png)} onCancelar={() => setFirmando(null)} />}
                <div className="acciones">
                  <button className="btn-link" type="button"
                    onClick={() => cambiar((x) => ({ ...x, firmantes: [...x.firmantes, { rol_clave: rol.clave, rol_titulo: rol.titulo, orden: deRol.length + 1, persona_id: null }] }))}>
                    <Plus size={16} aria-hidden="true" /> Agregar firmante
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <div className={`resultado-prueba cierre ${faltan.length ? 'incompleta' : ''}`} role="status">
        <p>
          Resultado: <b>{ev.resultado ?? 'Sin resultado (solo «Realizado»)'}</b>
          {ev.puntaje != null && <> · Puntaje: <b>{ev.puntaje} %</b></>} · Hallazgos: <b>{ev.hallazgos.length}</b> · Fotos: <b>{b.fotos.length}</b>
        </p>
        {/* La lista de lo que falta solo sale si se intenta cerrar con cosas pendientes (pedido del dueño, 29/10/2026). */}
        {intentoCierre && faltan.length > 0 && (
          <details open>
            <summary>Faltan {faltan.length} cosas para poder cerrar</summary>
            <ul>
              {faltan.slice(0, 40).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </details>
        )}
        <Aviso>{error}</Aviso>
        <button className="btn" type="button" disabled={cerrando} onClick={() => (faltan.length ? setIntentoCierre(true) : void cerrarYa())}>
          {cerrando ? 'Cerrando…' : 'Cerrar inspección'}
        </button>
        {!online && <p className="nota">Sin señal: la información se guardará en este equipo y se cargará cuando te conectes a una red de nuevo.</p>}
      </div>
    </div>
  )
}

function MiniFoto({ foto, onQuitar }: { foto: FotoLocal; onQuitar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    void leerArchivo(foto.id).then((blob) => {
      if (blob) setUrl((u = URL.createObjectURL(blob)))
    })
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [foto.id])
  return (
    <span className="mini-foto">
      {url ? <img src={url} alt="Foto tomada" /> : <span className="mini-vacia" />}
      <button type="button" aria-label="Quitar foto" onClick={onQuitar}>
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  )
}

type PropsPunto = {
  punto: Punto
  respuesta: Respuesta | undefined
  listas: CopiaLocal['listas']
  personas: CopiaLocal['personas']
  cantidad: number | null
  calculo: string
  fotos: FotoLocal[]
  sinEspacio: boolean
  sinFotos?: boolean // al corregir con señal: las fotos ya enviadas no se cambian
  onCambio: (r: Respuesta) => void
  onFoto: (archivo: File) => void
  onQuitarFoto: (f: FotoLocal) => void
}

export function PuntoCampo({ punto: p, respuesta, listas, personas, cantidad, calculo, fotos, sinEspacio, sinFotos, onCambio, onFoto, onQuitarFoto }: PropsPunto) {
  const r = respuesta ?? { valor: null }
  const noCumple = r.valor === 'no' && (p.tipo === 'cumple' || p.tipo === 'si_no')
  const opcionesLista = p.lista ? (listas.find((l) => l.codigo === p.lista)?.valores ?? []) : (p.opciones ?? [])
  const pideFoto = !sinFotos && (p.tipo === 'foto' || (noCumple && p.foto_si_no_cumple) || fotos.length > 0)
  const accion = (c: Partial<NonNullable<Respuesta['accion']>>) =>
    onCambio({ ...r, accion: { texto: r.accion?.texto ?? '', responsable: r.accion?.responsable ?? null, plazo: r.accion?.plazo ?? null, ...c } })
  return (
    <div className={`prueba-punto ${noCumple ? 'no-cumple' : ''}`}>
      <p>
        <code>{p.clave}</code> {p.texto}
        {p.obligatorio && p.tipo !== 'calculo' && <span className="obligatorio" aria-label="obligatorio"> *</span>}
        {p.critico && <span className="chip chip-mal">Crítico</span>}
        {cantidad != null && <span className="chip">Cantidad: {cantidad}</span>}
      </p>
      {p.ayuda && <small className="ayuda">{p.ayuda}</small>}
      {OPCIONES[p.tipo] ? (
        <div className="botones-respuesta" role="group" aria-label={p.texto}>
          {OPCIONES[p.tipo].map(([v, t]) => (
            <button key={v} type="button" aria-pressed={r.valor === v} onClick={() => onCambio({ ...r, valor: r.valor === v ? null : v })}>
              {t}
            </button>
          ))}
        </div>
      ) : p.tipo === 'numero' ? (
        <input type="number" inputMode="decimal" value={r.valor ?? ''} aria-label={p.texto} placeholder={p.unidad ?? ''}
          onChange={(e) => onCambio({ ...r, valor: e.target.value === '' ? null : Number(e.target.value) })} />
      ) : p.tipo === 'lista' ? (
        <select value={(r.valor as string) ?? ''} aria-label={p.texto} onChange={(e) => onCambio({ ...r, valor: e.target.value || null })}>
          <option value="">— Elige —</option>
          {opcionesLista.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : p.tipo === 'persona' ? (
        <select value={(r.valor as string) ?? ''} aria-label={p.texto} onChange={(e) => onCambio({ ...r, valor: e.target.value || null })}>
          <option value="">— Elige a la persona —</option>
          {personas.map((x) => (
            <option key={x.persona_id} value={x.persona_id}>
              {x.apellidos_nombres}
            </option>
          ))}
        </select>
      ) : p.tipo === 'calculo' ? (
        <p className="calculo">{calculo}</p>
      ) : p.tipo === 'texto_largo' ? (
        <textarea rows={2} maxLength={2000} value={(r.valor as string) ?? ''} aria-label={p.texto} onChange={(e) => onCambio({ ...r, valor: e.target.value || null })} />
      ) : p.tipo === 'foto' ? null : (
        <input type={p.tipo === 'fecha' ? 'date' : p.tipo === 'hora' ? 'time' : 'text'} maxLength={300} value={(r.valor as string) ?? ''} aria-label={p.texto}
          onChange={(e) => onCambio({ ...r, valor: e.target.value || null })} />
      )}
      {noCumple && (p.obs_si_no_cumple || r.obs) && (
        <input type="text" maxLength={500} value={r.obs ?? ''} placeholder={p.obs_si_no_cumple ? 'Observación (obligatoria)' : 'Observación'} aria-label="Observación"
          onChange={(e) => onCambio({ ...r, obs: e.target.value })} />
      )}
      {noCumple && p.pide_accion && (
        <div className="fila3">
          <input type="text" placeholder="Acción correctiva" aria-label="Acción correctiva" maxLength={300} value={r.accion?.texto ?? ''} onChange={(e) => accion({ texto: e.target.value })} />
          <select aria-label="Responsable" value={r.accion?.responsable ?? ''} onChange={(e) => accion({ responsable: e.target.value || null })}>
            <option value="">— Responsable —</option>
            {personas.map((x) => (
              <option key={x.persona_id} value={x.persona_id}>
                {x.apellidos_nombres}
              </option>
            ))}
          </select>
          <input type="date" aria-label="Plazo" value={r.accion?.plazo ?? ''} onChange={(e) => accion({ plazo: e.target.value || null })} />
        </div>
      )}
      {pideFoto && (
        <div className="fotos-punto">
          {fotos.map((f) => (
            <MiniFoto key={f.id} foto={f} onQuitar={() => onQuitarFoto(f)} />
          ))}
          {sinEspacio ? (
            <span className="nota">El espacio de fotos de la empresa está lleno: avisa al administrador.</span>
          ) : (
            <label className="btn-sec boton-foto">
              <Camera size={16} aria-hidden="true" /> {fotos.length ? 'Otra foto' : 'Tomar foto'}
              <input type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => {
                  const a = e.target.files?.[0]
                  if (a) onFoto(a)
                  e.target.value = ''
                }} />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
