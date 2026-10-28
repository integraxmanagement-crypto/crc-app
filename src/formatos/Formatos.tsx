import { ArrowLeft, ClipboardCheck, Copy, Eye, FilePlus2, Pencil } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { ir } from '../ruta'
import type { Frecuencia } from './base'
import {
  NOMBRE_ESTADO, NOMBRE_FRECUENCIA, type Plantilla, type TipoActivo, copiarPlantilla, listarPlantillas, listarPlantillasBase, listarTipos,
  nuevaPlantilla,
} from './datos'

/** Rutas de las pantallas de formatos y activos: «/formatos» (administrador y gestor) o «/empresas/<id>/formatos» (dueño). */
export type Rutas = { formatos: string; activos: string; volver: string | null }

/** Las plantillas base en el orden del anexo de textos base. */
const ORDEN_BASE = ['extintores', 'car', 'bombas', 'daci', 'loto', 'ipf']

function estadoDe(p: Plantilla) {
  const vigente = p.versiones.find((v) => v.estado === 'vigente')
  const borrador = p.versiones.find((v) => v.estado === 'borrador')
  return { vigente, borrador }
}

/**
 * Formatos de inspección de la empresa (tarea 3.4-B): los suyos y las 6 plantillas base de CRC para copiar.
 * Copiar no cambia la base: la empresa recibe un borrador propio que adapta en el constructor.
 */
export function Formatos({ empresaId, rutas, puedeEditar }: { empresaId: string; rutas: Rutas; puedeEditar: boolean }) {
  const [propias, setPropias] = useState<Plantilla[] | null>(null)
  const [base, setBase] = useState<Plantilla[]>([])
  const [tipos, setTipos] = useState<TipoActivo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)

  const cargar = useCallback(() => {
    Promise.all([listarPlantillas(empresaId), listarPlantillasBase(), listarTipos(empresaId)])
      .then(([p, b, t]) => {
        setPropias(p)
        setBase(b.sort((x, y) => ORDEN_BASE.indexOf(x.codigo ?? '') - ORDEN_BASE.indexOf(y.codigo ?? '')))
        setTipos(t)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(cargar, [cargar])

  async function copiar(origen: string) {
    setOcupado(origen)
    setError(null)
    try {
      const id = await copiarPlantilla(empresaId, origen)
      ir(`${rutas.formatos}/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setOcupado(null)
    }
  }

  const copiasDe = (baseId: string) => propias?.filter((p) => p.base_id === baseId).length ?? 0

  return (
    <div className="detalle">
      {rutas.volver && (
        <button className="btn-link volver" type="button" onClick={() => ir(rutas.volver!)}>
          <ArrowLeft size={18} aria-hidden="true" /> Ficha de la empresa
        </button>
      )}
      <header className="detalle-cab fila-entre">
        <div>
          <h1>Formatos de inspección</h1>
          <p>Cada formato es una plantilla con sus secciones, puntos y reglas. Al publicar una versión queda congelada.</p>
        </div>
        <button className="btn-sec" type="button" onClick={() => ir(rutas.activos)}>
          <ClipboardCheck size={18} aria-hidden="true" /> Activos y listas
        </button>
      </header>
      <Aviso>{error}</Aviso>

      <Seccion
        titulo="Formatos de la empresa"
        accion={
          puedeEditar && !nueva ? (
            <button className="btn-sec" type="button" onClick={() => setNueva(true)}>
              <FilePlus2 size={18} aria-hidden="true" /> Formato desde cero
            </button>
          ) : null
        }
      >
        {nueva && <NuevaPlantilla empresaId={empresaId} tipos={tipos} rutas={rutas} onCancelar={() => setNueva(false)} />}
        {!propias ? (
          !error && <p className="nota">Cargando…</p>
        ) : propias.length === 0 ? (
          <p className="nota">Todavía no hay formatos. Copia una plantilla base de abajo y adáptala.</p>
        ) : (
          <ul className="lista">
            {propias.map((p) => {
              const { vigente, borrador } = estadoDe(p)
              return (
                <li key={p.id} className={p.vigente ? '' : 'inactiva'}>
                  <ClipboardCheck aria-hidden="true" />
                  <div>
                    <b>{p.nombre}</b>
                    {vigente && <span className="chip chip-ok">v{vigente.numero} vigente</span>}
                    {borrador && <span className="chip chip-aviso">v{borrador.numero} en borrador</span>}
                    {!p.vigente && <span className="chip chip-gris">Desactivado</span>}
                    <small>
                      {p.aplica_a === 'activo' ? `Activo: ${p.tipos_activo?.nombre ?? '—'}` : 'Se aplica a un área'} · {NOMBRE_FRECUENCIA[p.frecuencia]}
                    </small>
                  </div>
                  <span className="lista-acciones">
                    <button className="btn-link" type="button" onClick={() => ir(`${rutas.formatos}/${p.id}`)}>
                      {puedeEditar ? <Pencil size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />} {puedeEditar ? 'Abrir' : 'Ver'}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Plantillas base de CRC">
        <p className="nota">
          Textos base genéricos de CRC. Al copiar una, tu empresa recibe un borrador propio para adaptar (textos, orden, puntos críticos,
          cantidades, código, versión, fecha de aprobación y logo). La plantilla base no cambia.
        </p>
        <ul className="lista">
          {base.map((p) => {
            const copias = copiasDe(p.id)
            const n = estadoDe(p).vigente?.numero
            return (
              <li key={p.id}>
                <ClipboardCheck aria-hidden="true" />
                <div>
                  <b>{p.nombre}</b>
                  {copias > 0 && <span className="chip chip-ok">{copias === 1 ? 'Ya tienes una copia' : `${copias} copias`}</span>}
                  <small>
                    {p.descripcion} · Frecuencia inicial: {NOMBRE_FRECUENCIA[p.frecuencia].toLowerCase()}
                    {n ? ` · ${NOMBRE_ESTADO.vigente} v${n}` : ''}
                  </small>
                </div>
                <span className="lista-acciones">
                  <button className="btn-link" type="button" onClick={() => ir(`${rutas.formatos}/${p.id}`)}>
                    <Eye size={16} aria-hidden="true" /> Ver
                  </button>
                  {puedeEditar && (
                    <button className="btn-link" type="button" disabled={ocupado !== null} onClick={() => void copiar(p.id)}>
                      <Copy size={16} aria-hidden="true" /> {ocupado === p.id ? 'Copiando…' : 'Copiar a mi empresa'}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </Seccion>
    </div>
  )
}

function NuevaPlantilla({ empresaId, tipos, rutas, onCancelar }: { empresaId: string; tipos: TipoActivo[]; rutas: Rutas; onCancelar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [aplica, setAplica] = useState<'activo' | 'area'>('area')
  const [tipo, setTipo] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('sin_frecuencia')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const vigentes = tipos.filter((t) => t.vigente)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (nombre.trim().length < 3) return setError('Escribe el nombre del formato (al menos 3 letras).')
    if (aplica === 'activo' && !tipo) return setError('Elige el tipo de activo.')
    setOcupado(true)
    try {
      const id = await nuevaPlantilla(empresaId, { nombre, aplica_a: aplica, tipo_activo_id: aplica === 'activo' ? tipo : null, frecuencia })
      ir(`${rutas.formatos}/${id}`)
    } catch (err) {
      setError((err as Error).message)
      setOcupado(false)
    }
  }

  return (
    <form className="form subform" onSubmit={crear} noValidate>
      <Campo etiqueta="Nombre del formato" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={160} placeholder="Ej.: Inspección de luces de emergencia" />
      <div className="fila2">
        <label className="field">
          <span>Se aplica a</span>
          <select value={aplica} onChange={(e) => setAplica(e.target.value as 'activo' | 'area')}>
            <option value="area">Un área</option>
            <option value="activo">Un activo (equipo del catastro)</option>
          </select>
        </label>
        {aplica === 'activo' && (
          <label className="field">
            <span>Tipo de activo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">— Elige —</option>
              {vigentes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {!vigentes.length && <small className="ayuda">Primero activa o crea un tipo en «Activos y listas».</small>}
          </label>
        )}
        <label className="field">
          <span>Frecuencia</span>
          <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}>
            {Object.entries(NOMBRE_FRECUENCIA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado}>
          {ocupado ? 'Creando…' : 'Crear borrador'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
