import { ArrowLeft, Boxes, History, Pencil, Plus, Tags } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { type Sede, leerEmpresa } from '../empresas/datos'
import type { CampoFicha } from '../formatos/base'
import {
  type Activo, type CambioActivo, type DatosActivo, type Lista, type PersonaLista, type TipoActivo, type Ubicacion, darBajaActivo, guardarActivo,
  historialActivo, leerPlantilla, listarActivos, listarListas, listarPersonas, listarPlantillas, listarTipos, listarUbicaciones, reactivarActivo,
} from '../formatos/datos'
import type { Rutas } from '../formatos/Formatos'
import { aplicaSubtipo, todosLosPuntos } from '../formatos/receta'
import { ir } from '../ruta'
import { type Unidad, leerListas, unidadesAsignables } from '../usuarios/datos'
import { ListasFormatos } from './ListasFormatos'
import { Tipos } from './Tipos'
import { Ubicaciones } from './Ubicaciones'

type Pestana = 'activos' | 'tipos' | 'ubicaciones' | 'listas'
const PESTANAS: [Pestana, string][] = [['activos', 'Activos'], ['tipos', 'Tipos de activo'], ['ubicaciones', 'Ubicaciones'], ['listas', 'Listas']]

export type Contexto = {
  empresaId: string
  sedes: Sede[]
  unidades: Unidad[]
  ubicaciones: Ubicacion[]
  tipos: TipoActivo[]
  listas: Lista[]
  personas: PersonaLista[]
  puedeEditar: boolean
  recargar: () => void
}

/**
 * Activos y listas de la empresa (tarea 3.4-B): catálogo de activos por tipo (extintores, casetas, bombas,
 * dispositivos de alarma…), tipos, ubicaciones dentro de cada sede y listas de los formatos.
 * Nada viene precargado con personas ni lugares: cada empresa carga lo suyo. Los activos no se borran: se dan de baja.
 */
export function Activos({ empresaId, rutas, puedeEditar, esDueno }: { empresaId: string; rutas: Rutas; puedeEditar: boolean; esDueno: boolean }) {
  const [pestana, setPestana] = useState<Pestana>('activos')
  const [ctx, setCtx] = useState<Omit<Contexto, 'recargar' | 'puedeEditar' | 'empresaId'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(() => {
    Promise.all([leerEmpresa(empresaId), leerListas(empresaId), listarUbicaciones(empresaId), listarTipos(empresaId), listarListas(empresaId), listarPersonas(empresaId, esDueno)])
      .then(([e, l, ub, t, ls, pe]) => {
        setCtx({ sedes: e.sedes, unidades: l.unidades, ubicaciones: ub, tipos: t, listas: ls, personas: pe })
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId, esDueno])
  useEffect(recargar, [recargar])

  const contexto: Contexto | null = ctx ? { ...ctx, empresaId, puedeEditar, recargar } : null

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir(rutas.formatos)}>
        <ArrowLeft size={18} aria-hidden="true" /> Formatos de inspección
      </button>
      <header className="detalle-cab">
        <h1>Activos y listas</h1>
        <p>Lo que se inspecciona y las listas que usan los formatos. Todo es de tu empresa: nada viene precargado.</p>
      </header>
      <nav className="pestanas" aria-label="Secciones">
        {PESTANAS.map(([k, t]) => (
          <button key={k} type="button" aria-pressed={pestana === k} onClick={() => setPestana(k)}>
            {t}
          </button>
        ))}
      </nav>
      <Aviso>{error}</Aviso>
      {!contexto ? (
        !error && <p className="nota">Cargando…</p>
      ) : pestana === 'activos' ? (
        <ListaActivos ctx={contexto} onIrTipos={() => setPestana('tipos')} />
      ) : pestana === 'tipos' ? (
        <Tipos ctx={contexto} />
      ) : pestana === 'ubicaciones' ? (
        <Ubicaciones ctx={contexto} />
      ) : (
        <ListasFormatos ctx={contexto} />
      )}
    </div>
  )
}

function nombreSede(ctx: Contexto, id: string | null) {
  return ctx.sedes.find((s) => s.id === id)?.nombre ?? '—'
}

function ListaActivos({ ctx, onIrTipos }: { ctx: Contexto; onIrTipos: () => void }) {
  const tipos = ctx.tipos.filter((t) => t.vigente)
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? '')
  const [activos, setActivos] = useState<Activo[] | null>(null)
  const [verBaja, setVerBaja] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState<Activo | 'nuevo' | null>(null)
  const [baja, setBaja] = useState<Activo | null>(null)
  const [historial, setHistorial] = useState<{ id: string; cambios: CambioActivo[] } | null>(null)
  const [materiales, setMateriales] = useState<{ clave: string; texto: string; cantidad: number | null }[]>([])
  const [error, setError] = useState<string | null>(null)
  const tipo = ctx.tipos.find((t) => t.id === tipoId) ?? null

  const cargar = useCallback(() => {
    if (!tipoId) return
    listarActivos(ctx.empresaId, tipoId)
      .then(setActivos)
      .catch((e) => setError((e as Error).message))
  }, [ctx.empresaId, tipoId])
  useEffect(cargar, [cargar])

  // Materiales con cantidad esperada (dotación por activo, p. ej. casetas): salen de los formatos de este tipo.
  useEffect(() => {
    if (!tipo?.dotacion) return
    listarPlantillas(ctx.empresaId)
      .then(async (ps) => {
        const vistos = new Map<string, { clave: string; texto: string; cantidad: number | null }>()
        for (const p of ps.filter((x) => x.tipo_activo_id === tipo.id)) {
          const { versiones } = await leerPlantilla(p.id)
          const v = versiones.find((x) => x.estado === 'vigente') ?? versiones[0]
          for (const { punto } of v ? todosLosPuntos(v.receta) : [])
            if ('cantidad' in punto && !vistos.has(punto.clave)) vistos.set(punto.clave, { clave: punto.clave, texto: punto.texto, cantidad: punto.cantidad ?? null })
        }
        setMateriales([...vistos.values()])
      })
      .catch(() => setMateriales([]))
  }, [ctx.empresaId, tipo])

  const visibles = (activos ?? []).filter(
    (a) => (verBaja ? a.estado === 'baja' : a.estado === 'activo') && (!buscar || a.codigo.toLowerCase().includes(buscar.toLowerCase())),
  )

  if (!tipos.length) {
    return (
      <Seccion titulo="Activos">
        <p className="nota">Primero activa un tipo de activo (extintor, caseta, bomba, dispositivo de alarma) o crea uno propio.</p>
        <button className="btn-sec" type="button" onClick={onIrTipos}>
          <Tags size={18} aria-hidden="true" /> Ir a «Tipos de activo»
        </button>
      </Seccion>
    )
  }

  return (
    <Seccion
      titulo={tipo ? `${tipo.nombre} (${(activos ?? []).filter((a) => a.estado === 'activo').length} activos)` : 'Activos'}
      accion={
        ctx.puedeEditar && !editando ? (
          <button className="btn-sec" type="button" onClick={() => setEditando('nuevo')}>
            <Plus size={18} aria-hidden="true" /> Agregar
          </button>
        ) : null
      }
    >
      <div className="fila3">
        <label className="field">
          <span>Tipo de activo</span>
          <select value={tipoId} onChange={(e) => (setTipoId(e.target.value), setEditando(null), setActivos(null))}>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <Campo etiqueta="Buscar por código" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <label className="check-linea">
          <input type="checkbox" checked={verBaja} onChange={(e) => setVerBaja(e.target.checked)} /> Ver los dados de baja
        </label>
      </div>
      <Aviso>{error}</Aviso>
      {editando && tipo && (
        <FormActivo ctx={ctx} tipo={tipo} activo={editando === 'nuevo' ? null : editando} materiales={tipo.dotacion ? materiales : []}
          onListo={() => (setEditando(null), cargar())} onCancelar={() => setEditando(null)} />
      )}
      {baja && <FormBaja activo={baja} onListo={() => (setBaja(null), cargar())} onCancelar={() => setBaja(null)} />}
      {!activos ? (
        <p className="nota">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="nota">{verBaja ? 'No hay activos dados de baja.' : 'Todavía no hay activos de este tipo.'}</p>
      ) : (
        <ul className="lista">
          {visibles.map((a) => (
            <li key={a.id} className={a.estado === 'baja' ? 'inactiva' : ''}>
              <Boxes aria-hidden="true" />
              <div>
                <b>
                  N.º {a.numero} · {a.codigo}
                </b>
                {a.subtipo && <span className="chip">{tipo?.subtipos.find((s) => s.codigo === a.subtipo)?.nombre ?? a.subtipo}</span>}
                {a.estado === 'baja' && <span className="chip chip-gris">De baja desde {a.fecha_baja}</span>}
                <small>
                  {nombreSede(ctx, a.sede_id)}
                  {a.ubicacion_id ? ` · ${ctx.ubicaciones.find((u) => u.id === a.ubicacion_id)?.nombre ?? ''}` : ''}
                  {a.responsable_id ? ` · Responsable: ${ctx.personas.find((p) => p.persona_id === a.responsable_id)?.apellidos_nombres ?? '—'}` : ''}
                  {a.estado === 'baja' && a.motivo_baja ? ` · Motivo: ${a.motivo_baja}` : ''}
                </small>
              </div>
              <span className="lista-acciones">
                {ctx.puedeEditar && a.estado === 'activo' && (
                  <>
                    <button className="btn-link" type="button" onClick={() => setEditando(a)}>
                      <Pencil size={16} aria-hidden="true" /> Editar
                    </button>
                    <button className="btn-link" type="button" onClick={() => setBaja(a)}>
                      Dar de baja
                    </button>
                  </>
                )}
                {ctx.puedeEditar && a.estado === 'baja' && (
                  <button className="btn-link" type="button" onClick={() => void reactivarActivo(a.id).then(cargar, (e) => setError((e as Error).message))}>
                    Reactivar
                  </button>
                )}
                <button className="btn-link" type="button"
                  onClick={() => historial?.id === a.id ? setHistorial(null) : void historialActivo(a.id).then((c) => setHistorial({ id: a.id, cambios: c }))}>
                  <History size={16} aria-hidden="true" /> Historial
                </button>
              </span>
              {historial?.id === a.id && (
                <ul className="historial">
                  {historial.cambios.map((c) => (
                    <li key={c.id}>
                      {new Date(c.hecho_en).toLocaleString('es-PE')} · {{ alta: 'Alta', cambio: 'Cambio', baja: 'Baja', reactivacion: 'Reactivación' }[c.accion]}
                      {c.hecho_por ? ` · ${ctx.personas.find((p) => p.persona_id === c.hecho_por)?.apellidos_nombres ?? 'otra cuenta'}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}

function siguienteMes(mes: string, meses: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + meses, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function FormActivo({
  ctx, tipo, activo, materiales, onListo, onCancelar,
}: { ctx: Contexto; tipo: TipoActivo; activo: Activo | null; materiales: { clave: string; texto: string; cantidad: number | null }[]; onListo: () => void; onCancelar: () => void }) {
  const sedesActivas = ctx.sedes.filter((s) => s.activa || s.id === activo?.sede_id)
  const [d, setD] = useState<DatosActivo>(() => ({
    tipo_id: tipo.id,
    codigo: activo?.codigo ?? '',
    subtipo: activo?.subtipo ?? tipo.subtipos[0]?.codigo ?? null,
    sede_id: activo?.sede_id ?? sedesActivas[0]?.id ?? '',
    unidad_id: activo?.unidad_id ?? null,
    ubicacion_id: activo?.ubicacion_id ?? null,
    responsable_id: activo?.responsable_id ?? null,
    datos: { ...(activo?.datos ?? {}) },
    dotacion: { ...(activo?.dotacion ?? {}) },
  }))
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const areas = useMemo(() => unidadesAsignables(ctx.unidades), [ctx.unidades])
  const ubicaciones = ctx.ubicaciones.filter((u) => u.sede_id === d.sede_id && (u.vigente || u.id === d.ubicacion_id))
  const campos = tipo.campos.filter((c) => aplicaSubtipo(c.solo_subtipos, d.subtipo))

  function setDato(c: CampoFicha, valor: string) {
    const v = valor === '' ? null : c.tipo === 'numero' || c.tipo === 'anio' ? Number(valor) : valor
    setD((x) => {
      const datos = { ...x.datos, [c.clave]: v }
      // El próximo mantenimiento se sugiere solo (+12 meses); se puede cambiar a mano.
      for (const otro of tipo.campos)
        if (otro.calcula?.desde === c.clave && typeof v === 'string') datos[otro.clave] = siguienteMes(v, otro.calcula.meses)
      return { ...x, datos }
    })
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      await guardarActivo(ctx.empresaId, activo?.id ?? null, d)
      onListo()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const valoresLista = (codigo: string | null | undefined) => ctx.listas.find((l) => l.codigo === codigo)?.valores ?? []

  return (
    <form className="form subform" onSubmit={guardar} noValidate>
      <div className="fila2">
        <Campo etiqueta="Código" value={d.codigo} maxLength={40} onChange={(e) => setD({ ...d, codigo: e.target.value })} placeholder="Ej.: EXT-001" />
        {tipo.subtipos.length > 0 && (
          <label className="field">
            <span>Subtipo</span>
            <select value={d.subtipo ?? ''} onChange={(e) => setD({ ...d, subtipo: e.target.value })}>
              {tipo.subtipos.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="fila3">
        <label className="field">
          <span>Sede</span>
          <select value={d.sede_id} onChange={(e) => setD({ ...d, sede_id: e.target.value, ubicacion_id: null })}>
            {sedesActivas.map((s) => (
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
          <select value={d.unidad_id ?? ''} onChange={(e) => setD({ ...d, unidad_id: e.target.value || null })}>
            <option value="">— Sin área —</option>
            {areas.filter((a) => a.vigente || a.id === d.unidad_id).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Ubicación <em className="opcional">(opcional)</em>
          </span>
          <select value={d.ubicacion_id ?? ''} onChange={(e) => setD({ ...d, ubicacion_id: e.target.value || null })}>
            <option value="">— Sin ubicación —</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
          {!ubicaciones.length && <small className="ayuda">Esta sede todavía no tiene ubicaciones: agrégalas en «Ubicaciones».</small>}
        </label>
      </div>
      <label className="field">
        <span>
          Responsable <em className="opcional">(opcional)</em>
        </span>
        <select value={d.responsable_id ?? ''} onChange={(e) => setD({ ...d, responsable_id: e.target.value || null })}>
          <option value="">— Sin responsable —</option>
          {ctx.personas.map((p) => (
            <option key={p.persona_id} value={p.persona_id}>
              {p.apellidos_nombres}
              {p.puesto ? ` · ${p.puesto}` : ''}
            </option>
          ))}
        </select>
      </label>
      {campos.length > 0 && (
        <fieldset>
          <legend>Ficha del {tipo.nombre.toLowerCase()}</legend>
          <div className="fila2">
            {campos.map((c) => {
              const v = d.datos[c.clave]
              const etiqueta = c.etiqueta
              if (c.tipo === 'lista')
                return (
                  <label key={c.clave} className="field">
                    <span>
                      {etiqueta} {!c.obligatorio && <em className="opcional">(opcional)</em>}
                    </span>
                    <select value={(v as string) ?? ''} onChange={(e) => setDato(c, e.target.value)}>
                      <option value="">— Elige —</option>
                      {valoresLista(c.lista).filter((x) => x.vigente || x.nombre === v).map((x) => (
                        <option key={x.id}>{x.nombre}</option>
                      ))}
                    </select>
                  </label>
                )
              if (c.tipo === 'texto_largo')
                return (
                  <label key={c.clave} className="field">
                    <span>
                      {etiqueta} {!c.obligatorio && <em className="opcional">(opcional)</em>}
                    </span>
                    <textarea rows={2} maxLength={2000} value={(v as string) ?? ''} onChange={(e) => setDato(c, e.target.value)} />
                  </label>
                )
              return (
                <Campo key={c.clave} etiqueta={etiqueta} opcional={!c.obligatorio} value={v ?? ''}
                  type={c.tipo === 'mes' ? 'month' : c.tipo === 'numero' || c.tipo === 'anio' ? 'number' : 'text'}
                  min={c.tipo === 'anio' ? 1900 : undefined} max={c.tipo === 'anio' ? 2100 : undefined} step={c.tipo === 'numero' ? 'any' : undefined}
                  ayuda={c.calcula ? `Se sugiere solo: +${c.calcula.meses} meses; se puede cambiar.` : undefined}
                  onChange={(e) => setDato(c, e.target.value)} />
              )
            })}
          </div>
        </fieldset>
      )}
      {tipo.dotacion && (
        <fieldset>
          <legend>Dotación esperada de este activo</legend>
          {!materiales.length ? (
            <p className="nota">Copia o crea un formato para este tipo (con puntos de material) para cargar su dotación.</p>
          ) : (
            <div className="fila2">
              {materiales.map((m) => (
                <Campo key={m.clave} etiqueta={`${m.clave} · ${m.texto}`} type="number" min={0} max={9999} opcional
                  value={d.dotacion[m.clave] ?? ''} placeholder={m.cantidad != null ? `${m.cantidad} (del formato)` : 'Sin definir'}
                  onChange={(e) => setD({ ...d, dotacion: { ...d.dotacion, [m.clave]: e.target.value === '' ? null : Math.round(Number(e.target.value)) } })} />
              ))}
            </div>
          )}
        </fieldset>
      )}
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          {ocupado ? 'Guardando…' : activo ? 'Guardar cambios' : 'Dar de alta'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function FormBaja({ activo, onListo, onCancelar }: { activo: Activo; onListo: () => void; onCancelar: () => void }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await darBajaActivo(activo.id, fecha, motivo)
      onListo()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <form className="form subform" onSubmit={enviar} noValidate>
      <p className="nota">
        Dar de baja {activo.codigo}: no se borra; conserva su historial y sus inspecciones. Se puede reactivar.
      </p>
      <div className="fila2">
        <Campo etiqueta="Fecha de baja" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <Campo etiqueta="Motivo" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: retirado por daño" />
      </div>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn-peligro" type="submit">
          Dar de baja
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

