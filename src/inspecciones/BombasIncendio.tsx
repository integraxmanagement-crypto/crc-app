import { ArrowLeft, ClipboardCheck, FilePlus2, FileSpreadsheet, FileText, ListChecks, Search, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CargaMasivaEquipos } from '../activos/CargaMasiva'
import { useContextoActivos } from '../activos/Activos'
import { Aviso, Seccion } from '../empresas/campos'
import { type Activo, listarActivos } from '../formatos/datos'
import { Hallazgos } from '../hallazgos/Hallazgos'
import { ir } from '../ruta'
import { hoyLocal } from './ayudas'
import { type CopiaLocal, type FormatoLocal, leerCopia } from './campo'
import { type FilaAvance, type UltimaInspeccion, avancePeriodo, ultimasInspecciones } from './datos'
import { BuscadorExtintor } from './Extintores'
import { periodosHasta } from './periodos'
import { Ventana } from './Ventana'

/** Los formatos que forman «Inspección de bomba contra incendio» (se reconocen por su nombre). */
export const esBombaIncendio = (nombre: string) => /^inspecci[oó]n de (moto|electro)bomba/i.test(nombre)

type Clave = 'electrobomba' | 'motobomba'
type Grupo = { clave: Clave; nombre: string; formato: FormatoLocal; activos: Activo[]; filas: FilaAvance[]; ultimas: Map<string, UltimaInspeccion> }
type Vista = 'ninguna' | 'catastro' | 'inspeccion' | 'registro' | 'hallazgos'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const NOMBRES: Record<Clave, string> = { electrobomba: 'Electrobomba', motobomba: 'Motobomba' }

/**
 * «Inspección de bomba contra incendio» (pedido del dueño, 30/10/2026): una sola pantalla para las dos bombas, con el filtro de semana,
 * las tarjetas de cumplimiento general y de hallazgos, y los botones catastro (separado por tipo), realizar inspección, generar registro
 * y ver hallazgos (acumulado de las dos). La frecuencia semanal es la del programa anual de SST.
 */
export function BombasIncendio({ empresaId, cuenta, gestiona, online }: { empresaId: string; cuenta: string; gestiona: boolean; online: boolean }) {
  const [copia, setCopia] = useState<CopiaLocal | null | undefined>(undefined)
  useEffect(() => {
    void leerCopia(cuenta, empresaId).then((c) => setCopia(c ?? null), () => setCopia(null))
  }, [cuenta, empresaId])
  const formatos = useMemo(
    () => (['electrobomba', 'motobomba'] as Clave[]).flatMap((k) => {
      const f = copia?.formatos.find((x) => new RegExp(`^inspecci[oó]n de ${k}`, 'i').test(x.plantilla.nombre))
      return f ? [{ clave: k, formato: f }] : []
    }),
    [copia],
  )
  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/inspecciones')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inspecciones
      </button>
      <header className="detalle-cab">
        <h1>Inspección de bomba contra incendio</h1>
        <p>Electrobomba y motobomba: cada bomba se inspecciona una vez por semana, según el programa anual de SST.</p>
      </header>
      {copia === undefined ? (
        <p className="nota">Cargando…</p>
      ) : !copia || !formatos.length ? (
        <Aviso>No hay formatos de bomba contra incendio en este equipo. Vuelve a Inspecciones y pulsa «Actualizar».</Aviso>
      ) : !online ? (
        <p className="nota">La pantalla de bombas necesita señal. Sin señal, empieza una inspección desde «Nueva inspección» en Inspecciones.</p>
      ) : (
        <Panel empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} copia={copia} formatos={formatos} />
      )}
    </div>
  )
}

function Panel({ empresaId, cuenta, gestiona, online, copia, formatos }: { empresaId: string; cuenta: string; gestiona: boolean; online: boolean; copia: CopiaLocal; formatos: { clave: Clave; formato: FormatoLocal }[] }) {
  const hoy = hoyLocal()
  const semanas = useMemo(() => periodosHasta(hoy, 'semanal', 13), [hoy])
  const [semana, setSemana] = useState(semanas[0]?.clave ?? '')
  const periodo = semanas.find((s) => s.clave === semana) ?? semanas[0]
  const [sede, setSede] = useState(copia.sedes[0]?.id ?? '')
  const [vista, setVista] = useState<Vista>('ninguna')
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState<'elegir' | Clave | null>(null)
  const [version, setVersion] = useState(0)
  const { contexto } = useContextoActivos(empresaId, true, false)
  const nombrePersona = useMemo(() => new Map(copia.personas.map((p) => [p.persona_id, p.apellidos_nombres])), [copia])
  const nombreArea = (id: string | null) => copia.unidades.find((u) => u.id === id)?.nombre ?? ''
  const nombreUbic = (id: string | null) => copia.ubicaciones.find((u) => u.id === id)?.nombre ?? ''

  const cargar = useCallback(() => {
    if (!sede || !periodo) return
    setGrupos(null)
    Promise.all(
      formatos.map(async ({ clave, formato }): Promise<Grupo> => {
        const tipoId = formato.plantilla.tipo_activo_id
        const [activos, filas, ultimas] = await Promise.all([
          tipoId ? listarActivos(empresaId, tipoId).then((a) => a.filter((x) => x.estado === 'activo')) : Promise.resolve([] as Activo[]),
          avancePeriodo(formato.plantilla.id, sede, periodo.desde, periodo.hasta),
          ultimasInspecciones(formato.plantilla.id).catch(() => new Map<string, UltimaInspeccion>()),
        ])
        return { clave, nombre: NOMBRES[clave], formato, activos, filas, ultimas }
      }),
    ).then(setGrupos, (e) => setError((e as Error).message))
  }, [empresaId, formatos, sede, periodo])
  useEffect(cargar, [cargar, version])

  if (!grupos) return <>{error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>}</>

  const total = grupos.reduce((n, g) => n + g.filas.length, 0)
  const hechos = grupos.reduce((n, g) => n + g.filas.filter((f) => f.inspeccion_id).length, 0)
  const pct = total ? Math.round((100 * hechos) / total) : 0
  const hallazgos = grupos.reduce((n, g) => n + g.filas.reduce((m, f) => m + (f.hallazgos ?? 0), 0), 0)
  const alternar = (v: Vista) => setVista((x) => (x === v ? 'ninguna' : v))
  const recargar = () => (setVersion((v) => v + 1), contexto?.recargar())

  return (
    <>
      <Aviso>{error}</Aviso>
      <div className="acciones no-imprimir">
        <button className="btn-sec" type="button" onClick={() => setCargando('elegir')}>
          <Upload size={18} aria-hidden="true" /> Cargar equipos
        </button>
        <button className="btn" type="button" onClick={() => setVista('inspeccion')}>
          <FilePlus2 size={18} aria-hidden="true" /> Nueva inspección
        </button>
      </div>
      {cargando === 'elegir' && (
        <Ventana titulo="Cargar equipos" onCerrar={() => setCargando(null)}>
          <p className="nota">¿Qué tipo de bomba vas a cargar?</p>
          <div className="acciones">
            {grupos.map((g) => <button key={g.clave} className="btn-sec" type="button" onClick={() => setCargando(g.clave)}>{g.nombre}s</button>)}
          </div>
        </Ventana>
      )}
      {cargando && cargando !== 'elegir' && (() => {
        const g = grupos.find((x) => x.clave === cargando)
        return g?.formato.plantilla.tipo_activo_id ? (
          <CargaMasivaEquipos empresaId={empresaId} empresaNombre={copia.empresa.razon_social} tipoId={g.formato.plantilla.tipo_activo_id} exigirTodo={false}
            onCerrar={() => setCargando(null)} onListo={recargar} />
        ) : null
      })()}

      <div className="fila2 no-imprimir">
        {copia.sedes.length > 1 && (
          <label className="field">
            <span>Sede</span>
            <select value={sede} onChange={(e) => setSede(e.target.value)}>
              {copia.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        )}
        <label className="field">
          <span>Semana</span>
          <select value={semana} onChange={(e) => setSemana(e.target.value)}>
            {semanas.map((s) => <option key={s.clave} value={s.clave}>{s.etiqueta}</option>)}
          </select>
        </label>
      </div>

      <div className="tarjetas-ext">
        <div className="tarjeta-ext">
          <small>Cumplimiento general de la semana</small>
          <b>{pct} %</b>
          <span>{hechos} de {total} bombas inspeccionadas ({grupos.map((g) => `${g.filas.filter((f) => f.inspeccion_id).length}/${g.filas.length} ${g.nombre.toLowerCase()}s`).join(' · ')})</span>
        </div>
        <button type="button" className={`tarjeta-ext ${hallazgos ? 'mal' : ''}`} aria-pressed={vista === 'hallazgos'} onClick={() => alternar('hallazgos')}>
          <small>Hallazgos de la semana</small>
          <b>{hallazgos}</b>
          <span>encontrados en las inspecciones de la semana elegida</span>
        </button>
      </div>

      {contexto && <Buscador grupos={grupos} contexto={contexto} copia={copia} nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} semanaActual={semanas[0]?.clave === semana} onCambio={recargar} />}

      <div className="acciones no-imprimir">
        <button className="btn-sec" type="button" aria-pressed={vista === 'catastro'} onClick={() => alternar('catastro')}>
          <Search size={18} aria-hidden="true" /> Ver catastro
        </button>
        <button className="btn-sec" type="button" aria-pressed={vista === 'inspeccion'} onClick={() => alternar('inspeccion')}>
          <ClipboardCheck size={18} aria-hidden="true" /> Realizar inspección
        </button>
        <button className="btn-sec" type="button" aria-pressed={vista === 'registro'} onClick={() => alternar('registro')}>
          <FileSpreadsheet size={18} aria-hidden="true" /> Generar registro
        </button>
        <button className="btn-sec" type="button" aria-pressed={vista === 'hallazgos'} onClick={() => alternar('hallazgos')}>
          <ListChecks size={18} aria-hidden="true" /> Ver hallazgos
        </button>
      </div>

      {vista === 'catastro' && grupos.map((g) => <Catastro key={g.clave} g={g} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} />)}
      {vista === 'inspeccion' && <TablaInspeccion grupos={grupos} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} />}
      {vista === 'registro' && <Registro grupos={grupos} periodo={periodo?.etiqueta ?? ''} nombreUbic={nombreUbic} />}
      {vista === 'hallazgos' && (
        <Hallazgos empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} fuentes={grupos.map((g) => g.formato.plantilla.nombre)} />
      )}
    </>
  )
}

/** Buscador por código: se elige el tipo de bomba y se escribe el código (ficha, modificar, eliminar o agregar). */
function Buscador({ grupos, contexto, copia, nombreArea, nombreUbic, hoy, semanaActual, onCambio }: {
  grupos: Grupo[]; contexto: NonNullable<ReturnType<typeof useContextoActivos>['contexto']>; copia: CopiaLocal
  nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string; hoy: string; semanaActual: boolean; onCambio: () => void
}) {
  const [clave, setClave] = useState<Clave>(grupos[0].clave)
  const g = grupos.find((x) => x.clave === clave) ?? grupos[0]
  return (
    <>
      {grupos.length > 1 && (
        <div className="filtros no-imprimir" role="group" aria-label="Tipo de bomba">
          {grupos.map((x) => <button key={x.clave} type="button" aria-pressed={clave === x.clave} onClick={() => setClave(x.clave)}>{x.nombre}</button>)}
        </div>
      )}
      <BuscadorExtintor key={g.clave} variante="bomba" subtipos={[]} activos={g.activos} filas={g.filas} ultimas={g.ultimas} formato={g.formato} contexto={contexto} copia={copia}
        nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} semanaActual={semanaActual} onCambio={onCambio} />
    </>
  )
}

/** Catastro de un tipo de bomba, con sus características al lado. */
function Catastro({ g, nombrePersona, nombreArea, nombreUbic }: { g: Grupo; nombrePersona: Map<string, string>; nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string }) {
  const electro = g.clave === 'electrobomba'
  const ficha = (a: Activo, q: 'principal' | 'jockey') =>
    [a.datos[`${q}_marca`], a.datos[`${q}_potencia`], a.datos[`${q}_caudal`], a.datos[`${q}_presion_nominal`] && `${a.datos[`${q}_presion_nominal`]}`, a.datos[`${q}_arranque_parada`], a.datos[`${q}_alimentacion`]]
      .filter(Boolean).join(' · ') || '—'
  return (
    <Seccion titulo={`Catastro de ${g.nombre.toLowerCase()}s (${g.activos.length})`}>
      {!g.activos.length ? <p className="nota">No hay {g.nombre.toLowerCase()}s registradas.</p> : (
        <div className="tabla-scroll">
          <table className="tabla-catastro">
            <thead>
              <tr>
                <th>Código</th><th>Ubicación</th><th>Área</th><th>Responsable</th>
                {electro && <><th>Electrobomba principal (marca · potencia · caudal · presión · arranque/parada · alimentación)</th><th>Electrobomba Jockey</th></>}
              </tr>
            </thead>
            <tbody>
              {g.activos.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.codigo}</b></td>
                  <td>{nombreUbic(a.ubicacion_id)}</td>
                  <td>{nombreArea(a.unidad_id)}</td>
                  <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                  {electro && <><td>{ficha(a, 'principal')}</td><td>{ficha(a, 'jockey')}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  )
}

/** Realizar inspección: todas las bombas con su estado en la semana, con filtro por tipo. */
function TablaInspeccion({ grupos, nombrePersona, nombreArea, nombreUbic }: { grupos: Grupo[]; nombrePersona: Map<string, string>; nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string }) {
  const [tipo, setTipo] = useState<'todas' | Clave>('todas')
  const [estado, setEstado] = useState<'todos' | 'pendiente' | 'realizado'>('todos')
  const [buscar, setBuscar] = useState('')
  const filas = grupos.filter((g) => tipo === 'todas' || g.clave === tipo).flatMap((g) => g.activos.map((a) => ({ g, a, f: g.filas.find((x) => x.activo_id === a.id) })))
  const lista = filas.filter(({ a, f }) => (estado === 'todos' || (estado === 'realizado') === Boolean(f?.inspeccion_id)) && (!buscar || a.codigo.toLowerCase().includes(buscar.trim().toLowerCase())))
  return (
    <Seccion titulo={`Realizar inspección (${lista.length} de ${filas.length})`}>
      <div className="fila3 no-imprimir">
        <label className="field">
          <span>Tipo de bomba</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="todas">Electrobomba y motobomba</option>
            {grupos.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Solo pendientes</option>
            <option value="realizado">Solo realizados</option>
          </select>
        </label>
        <label className="field">
          <span>Buscar por código</span>
          <input type="search" autoComplete="off" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej.: EB-001" />
        </label>
      </div>
      {!lista.length ? <p className="nota">No hay bombas con este filtro.</p> : (
        <div className="tabla-scroll">
          <table className="tabla-catastro tabla-clic">
            <thead>
              <tr><th>Tipo</th><th>Código</th><th>Ubicación</th><th>Área</th><th>Responsable</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {lista.map(({ g, a, f }) => {
                const hecho = Boolean(f?.inspeccion_id)
                return (
                  <tr key={a.id} tabIndex={0} onClick={() => ir(hecho ? `/inspecciones/${f!.inspeccion_id}` : `/inspecciones/nueva/${g.formato.plantilla.id}/-/${a.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLElement).click()}>
                    <td>{g.nombre}</td>
                    <td><b>{a.codigo}</b></td>
                    <td>{nombreUbic(a.ubicacion_id)}</td>
                    <td>{nombreArea(a.unidad_id)}</td>
                    <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                    <td><span className={`chip ${hecho ? 'chip-ok' : 'chip-aviso'}`}>{hecho ? 'Inspeccionada' : 'Pendiente'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">Toca una fila: si está pendiente empieza su inspección; si ya está inspeccionada, la abre.</p>
    </Seccion>
  )
}

/**
 * Generar registro: se elige el tipo de bomba y el equipo; el formato del dueño es de una bomba (con sus dos firmas), así que se baja
 * el Excel o el PDF de su inspección de la semana elegida.
 */
function Registro({ grupos, periodo, nombreUbic }: { grupos: Grupo[]; periodo: string; nombreUbic: (id: string | null) => string }) {
  const [clave, setClave] = useState<Clave>(grupos[0].clave)
  const g = grupos.find((x) => x.clave === clave) ?? grupos[0]
  const [equipo, setEquipo] = useState('')
  const a = g.activos.find((x) => x.id === equipo) ?? g.activos[0]
  const f = a ? g.filas.find((x) => x.activo_id === a.id) : undefined
  return (
    <Seccion titulo={`Generar registro · ${periodo.split(' · ')[0]}`}>
      <p className="nota">Elige el tipo de bomba y el equipo: se baja el Excel o el PDF de su inspección de la semana elegida arriba.</p>
      <div className="fila2">
        <label className="field">
          <span>Tipo de bomba</span>
          <select value={clave} onChange={(e) => (setClave(e.target.value as Clave), setEquipo(''))}>
            {grupos.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Equipo</span>
          <select value={a?.id ?? ''} onChange={(e) => setEquipo(e.target.value)} disabled={!g.activos.length}>
            {g.activos.map((x) => <option key={x.id} value={x.id}>{x.codigo}{nombreUbic(x.ubicacion_id) ? ` · ${nombreUbic(x.ubicacion_id)}` : ''}</option>)}
          </select>
        </label>
      </div>
      {!a ? <p className="nota">No hay {g.nombre.toLowerCase()}s registradas.</p> : !f?.inspeccion_id ? (
        <p className="nota">{a.codigo} no tiene inspección en esta semana.</p>
      ) : (
        <>
          <p className="aviso-ok">{a.codigo} · inspeccionada el {fechaCorta(f.fecha ?? '')}.</p>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => ir(`/inspecciones/${f.inspeccion_id}/excel`)}><FileSpreadsheet size={18} aria-hidden="true" /> Generar en Excel</button>
            <button className="btn" type="button" onClick={() => ir(`/inspecciones/${f.inspeccion_id}/pdf`)}><FileText size={18} aria-hidden="true" /> Generar en PDF</button>
          </div>
        </>
      )}
    </Seccion>
  )
}
