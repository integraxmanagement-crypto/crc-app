import { ClipboardCheck, FileSpreadsheet, FileText, ListChecks, PenLine, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FormActivo, FormBaja, useContextoActivos } from '../activos/Activos'
import { Aviso, Seccion } from '../empresas/campos'
import { Hallazgos } from '../hallazgos/Hallazgos'
import { type Activo, listarActivos } from '../formatos/datos'
import { todosLosPuntos } from '../formatos/receta'
import { ir } from '../ruta'
import { hoyLocal } from './ayudas'
import type { CopiaLocal, FormatoLocal } from './campo'
import { type FilaAvance, type UltimaInspeccion, avancePeriodo, ultimasInspecciones } from './datos'
import { datoDeActivo } from './excel'
import { type Valor, datosVencidos, textoVencido } from '../formatos/motor'
import type { vistaDeExcel } from './excelVista'
import { PanelFirma } from './Firma'
import { CON_PERIODO, periodosHasta } from './periodos'
import { excelDeFormato } from './hoja'
import { armarRegistro, entregarRegistro } from './registroPeriodo'
import { Ventana } from './Ventana'
import { VistaExcel } from './VistaExcel'

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
/** Cómo se llama el período según la frecuencia del formato (la que se elige en «Formatos de inspección»). */
const NOMBRE_PERIODO: Record<string, string> = { semanal: 'semana', mensual: 'mes', bimestral: 'bimestre', trimestral: 'trimestre', semestral: 'semestre', anual: 'año' }
const VEZ: Record<string, string> = { semanal: 'una vez por semana', mensual: 'una vez al mes', bimestral: 'una vez cada 2 meses', trimestral: 'una vez cada 3 meses', semestral: 'una vez cada 6 meses', anual: 'una vez al año' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Suma meses a un AAAA-MM (sin pasar por la zona horaria). */
function sumarMeses(mes: string, n: number) {
  const t = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Mantenimiento: «vencido» si su mes ya pasó; «por vencer» desde el primer día del mes anterior al de vencimiento (si vence en agosto, avisa desde el 1 de julio). */
function estadoMantenimiento(proximo: unknown, hoy: string): 'vencido' | 'por_vencer' | 'vigente' {
  const mes = String(proximo ?? '')
  if (!/^\d{4}-\d{2}$/.test(mes)) return 'vencido'
  const actual = hoy.slice(0, 7)
  if (mes < actual) return 'vencido'
  return mes <= sumarMeses(actual, 1) ? 'por_vencer' : 'vigente'
}

type Vista = 'ninguna' | 'catastro' | 'inspeccion' | 'noop' | 'vencer' | 'registro' | 'hallazgos'

/**
 * Pantalla de la inspección de extintores (pedido del dueño, 29/10/2026, paquete SO.R.G.085): cumplimiento de la semana, no operativos,
 * por vencer, catastro (doble entrada), tabla para inspeccionar, buscador por código con su ficha y el botón para generar el registro.
 */
export function Extintores({ empresaId, cuenta, gestiona, online, copia, formato, variante = 'extintor' }: { empresaId: string; cuenta: string; gestiona: boolean; online: boolean; copia: CopiaLocal; formato: FormatoLocal; variante?: 'extintor' | 'daci' }) {
  // La misma pantalla sirve para extintores y para los dispositivos del sistema DACI (pedido del dueño, 29/10/2026); solo cambian los textos,
  // el catastro, la ficha y que el DACI no tiene vencimientos.
  const esExt = variante === 'extintor'
  const N = esExt ? { s: 'extintor', p: 'extintores' } : { s: 'dispositivo', p: 'dispositivos' }
  const subtipos = copia.tipos.find((t) => t.id === formato.plantilla.tipo_activo_id)?.subtipos ?? []
  const { contexto, error: errCtx } = useContextoActivos(empresaId, true, false)
  const [activos, setActivos] = useState<Activo[] | null>(null)
  const [ultimas, setUltimas] = useState<Map<string, UltimaInspeccion> | null>(null)
  const [filas, setFilas] = useState<FilaAvance[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('ninguna')
  const [sede, setSede] = useState(copia.sedes[0]?.id ?? '')
  const hoy = hoyLocal()
  // La frecuencia es la del formato (semanal por defecto): con frecuencia mensual, todo se mide por mes, una inspección al mes por extintor.
  const frecuencia = CON_PERIODO.includes(formato.plantilla.frecuencia) ? formato.plantilla.frecuencia : 'semanal'
  const esSemanal = frecuencia === 'semanal'
  const unPeriodo = NOMBRE_PERIODO[frecuencia]
  const semanas = useMemo(() => periodosHasta(hoy, frecuencia, 13), [hoy, frecuencia])
  const [semana, setSemana] = useState(semanas[0]?.clave ?? '')
  const periodo = semanas.find((s) => s.clave === semana) ?? semanas[0]
  const tipoId = formato.plantilla.tipo_activo_id
  const criticos = useMemo(() => todosLosPuntos(formato.version.receta).filter((x) => x.punto.critico).map((x) => x.punto), [formato])
  const nombrePersona = useMemo(() => new Map(copia.personas.map((p) => [p.persona_id, p.apellidos_nombres])), [copia])
  const nombreArea = (id: string | null) => copia.unidades.find((u) => u.id === id)?.nombre ?? ''
  const nombreUbic = (id: string | null) => copia.ubicaciones.find((u) => u.id === id)?.nombre ?? ''

  const cargarActivos = useCallback(() => {
    if (!tipoId) return
    listarActivos(empresaId, tipoId).then((a) => setActivos(a.filter((x) => x.estado === 'activo')), (e) => setError((e as Error).message))
    ultimasInspecciones(formato.plantilla.id).then(setUltimas, () => setUltimas(new Map()))
  }, [empresaId, tipoId, formato.plantilla.id])
  useEffect(() => {
    if (online) cargarActivos()
  }, [online, cargarActivos])

  const cargarSemana = useCallback(() => {
    if (!online || !sede || !periodo) return
    setFilas(null)
    avancePeriodo(formato.plantilla.id, sede, periodo.desde, periodo.hasta).then(setFilas, (e) => setError((e as Error).message))
  }, [online, sede, periodo, formato.plantilla.id])
  useEffect(cargarSemana, [cargarSemana])

  if (!online) return <p className="nota">La pantalla de {N.p} necesita señal. Sin señal, empieza una inspección desde «Nueva inspección» en Inspecciones.</p>
  if (!activos || !filas || !ultimas) return <>{error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>}</>

  const total = filas.length
  const hechos = filas.filter((f) => f.inspeccion_id).length
  const pct = total ? Math.round((100 * hechos) / total) : 0
  // Solo cuenta la última inspección de cada equipo: si un punto crítico salió en X y luego se corrigió, ya no es no operativo.
  // También son no operativos los que tienen algo vencido: mantenimiento, prueba hidrostática (más de 5 años) o fabricación (más de 20).
  const reglaVencido = formato.version.receta.reglas.find((g) => g.tipo === 'vencido')
  const motivoNoOp = (a: Activo) => {
    const u = ultimas.get(a.id)
    const malos = u ? criticos.filter((p) => u.respuestas[p.clave]?.valor === 'no').map((p) => `${p.texto} en X`) : []
    const vencidos = reglaVencido && reglaVencido.tipo === 'vencido'
      ? datosVencidos(reglaVencido.controles, a.datos as Record<string, Valor>, hoy).map((c) => textoVencido(c, formato.version.receta))
      : []
    const todos = [...malos, ...vencidos]
    return todos.length ? todos.join(', ') : null
  }
  const noOperativos = activos.filter((a) => motivoNoOp(a))
  const porVencer = activos.filter((a) => estadoMantenimiento(a.datos.proximo_mantenimiento, hoy) === 'por_vencer')
  const vencidos = activos.filter((a) => estadoMantenimiento(a.datos.proximo_mantenimiento, hoy) === 'vencido')
  const alternar = (v: Vista) => setVista((x) => (x === v ? 'ninguna' : v))

  return (
    <>
      <Aviso>{error ?? errCtx}</Aviso>
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
          <span>{unPeriodo[0].toUpperCase() + unPeriodo.slice(1)}</span>
          <select value={semana} onChange={(e) => setSemana(e.target.value)}>
            {semanas.map((s) => <option key={s.clave} value={s.clave}>{s.etiqueta}</option>)}
          </select>
        </label>
      </div>

      <p className="nota">Cada {N.s} se inspecciona {VEZ[frecuencia]} (frecuencia del formato). El estado de cada equipo se mide en {unPeriodo === 'semana' ? 'la' : 'el'} {unPeriodo} elegid{unPeriodo === 'semana' ? 'a' : 'o'}.</p>
      <div className="tarjetas-ext">
        <div className="tarjeta-ext">
          <small>Cumplimiento {esSemanal ? 'de la semana' : `del ${unPeriodo}`}</small>
          <b>{pct} %</b>
          <span>{hechos} de {total} {N.p} inspeccionados</span>
        </div>
        <button type="button" className={`tarjeta-ext ${noOperativos.length ? 'mal' : ''}`} aria-pressed={vista === 'noop'} onClick={() => alternar('noop')}>
          <small>No operativos</small>
          <b>{noOperativos.length}</b>
          <span>{esExt ? 'punto crítico en X en su última inspección, o algo vencido' : 'punto crítico en X en su última inspección'}</span>
        </button>
        {esExt && (
          <button type="button" className={`tarjeta-ext ${porVencer.length ? 'aviso' : ''}`} aria-pressed={vista === 'vencer'} onClick={() => alternar('vencer')}>
            <small>Por vencer</small>
            <b>{porVencer.length}</b>
            <span>vencen este mes o el próximo{vencidos.length ? ` · ${vencidos.length} ya vencido(s)` : ''}</span>
          </button>
        )}
      </div>

      {contexto && (
        <BuscadorExtintor variante={variante} subtipos={subtipos} activos={activos} filas={filas} ultimas={ultimas} formato={formato} contexto={contexto} copia={copia}
          nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} semanaActual={semanas[0]?.clave === semana} onCambio={() => (cargarActivos(), cargarSemana(), contexto.recargar())} />
      )}

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

      {vista === 'noop' && (
        <Seccion titulo={`No operativos (${noOperativos.length})`}>
          {!noOperativos.length ? <p className="aviso-ok">Ningún {N.s} está no operativo.</p> : (
            <ul className="lista">
              {noOperativos.map((a) => (
                <li key={a.id}><div><b>{a.codigo}</b><small>{nombreUbic(a.ubicacion_id) || 'Sin ubicación'} · {nombreArea(a.unidad_id) || 'Sin área'} · {motivoNoOp(a)}</small></div></li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
      {esExt && vista === 'vencer' && (
        <Seccion titulo={`Por vencer (${porVencer.length})`}>
          <p className="nota">El mantenimiento vence 1 año después del último. El aviso sale desde el primer día del mes anterior al del vencimiento.</p>
          {!porVencer.length ? <p className="aviso-ok">Ningún extintor está por vencer.</p> : (
            <ul className="lista">
              {porVencer.map((a) => (
                <li key={a.id}><div><b>{a.codigo}</b><small>{nombreUbic(a.ubicacion_id) || 'Sin ubicación'} · vence {datoDeActivo(a.datos, 'activo.proximo_mantenimiento.mes_texto')}</small></div></li>
              ))}
            </ul>
          )}
        </Seccion>
      )}
      {vista === 'catastro' && <Catastro variante={variante} subtipos={subtipos} activos={activos} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} hoy={hoy} />}
      {vista === 'inspeccion' && (
        <TablaInspeccion activos={activos} filas={filas} formato={formato} nombrePersona={nombrePersona} nombreArea={nombreArea} nombreUbic={nombreUbic} />
      )}


      {vista === 'hallazgos' && <Hallazgos empresaId={empresaId} cuenta={cuenta} gestiona={gestiona} online={online} fuenteFija={formato.plantilla.nombre} />}
      {vista === 'registro' && <GenerarRegistro esExt={esExt} formato={formato} copia={copia} sede={sede} semanas={semanas} hoy={hoy} cuenta={cuenta} esSemanal={esSemanal} unPeriodo={unPeriodo} />}
    </>
  )
}

/**
 * Catastro: cuadro de doble entrada con totales; al elegir una fila o una cantidad se abre la lista de esos equipos.
 * Extintores: agente × capacidad. Dispositivos del sistema DACI: subtipo × área.
 */
function Catastro({ variante, subtipos, activos, nombrePersona, nombreArea, nombreUbic, hoy }: {
  variante: 'extintor' | 'daci'; subtipos: { codigo: string; nombre: string }[]; activos: Activo[]; nombrePersona: Map<string, string>
  nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string; hoy: string
}) {
  const esExt = variante === 'extintor'
  const [ver, setVer] = useState<{ fila: string | null; col: string | null } | null>(null)
  const capacidad = (a: Activo) => (a.datos.capacidad != null && a.datos.capacidad !== '' ? `${a.datos.capacidad} ${a.datos.capacidad_unidad ?? ''}`.trim() : 'Sin capacidad')
  const subtipoDe = (a: Activo) => subtipos.find((x) => x.codigo === a.subtipo)?.nombre ?? 'Sin subtipo'
  const filaDe = (a: Activo) => (esExt ? String(a.datos.agente ?? 'Sin agente') : subtipoDe(a))
  const colDe = (a: Activo) => (esExt ? capacidad(a) : nombreArea(a.unidad_id) || 'Sin área')
  const filasT = [...new Set(activos.map(filaDe))].sort((x, y) => x.localeCompare(y, 'es'))
  const colsT = [...new Set(activos.map(colDe))].sort((x, y) => (esExt ? parseFloat(x) - parseFloat(y) : 0) || x.localeCompare(y, 'es'))
  const de = (f: string | null, c: string | null) => activos.filter((a) => (f == null || filaDe(a) === f) && (c == null || colDe(a) === c))
  const celda = (f: string | null, c: string | null) => {
    const n = de(f, c).length
    return n ? <button type="button" className="celda-btn" title="Ver estos equipos" onClick={() => setVer({ fila: f, col: c })}>{n}</button> : ''
  }
  const lista = ver ? de(ver.fila, ver.col) : []
  return (
    <Seccion titulo={`Catastro de ${esExt ? 'extintores' : 'dispositivos'} (${activos.length})`}>
      <p className="nota">Toca {esExt ? 'un agente' : 'un subtipo'} o una cantidad para ver los equipos.</p>
      <div className="tabla-scroll">
        <table className="tabla-catastro">
          <thead>
            <tr>
              <th>{esExt ? 'Agente / Capacidad' : 'Subtipo / Área'}</th>
              {colsT.map((c) => <th key={c}>{c}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filasT.map((f) => (
              <tr key={f}>
                <th scope="row"><button type="button" className="celda-btn" onClick={() => setVer({ fila: f, col: null })}>{f}</button></th>
                {colsT.map((c) => <td key={c}>{celda(f, c)}</td>)}
                <td><b>{celda(f, null)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {colsT.map((c) => <td key={c}><b>{celda(null, c)}</b></td>)}
              <td><b>{celda(null, null)}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {ver && (
        <Ventana titulo={`${ver.fila ?? (esExt ? 'Todos los agentes' : 'Todos los dispositivos')}${ver.col ? ` · ${ver.col}` : ''} (${lista.length})`} onCerrar={() => setVer(null)}>
          <div className="tabla-scroll">
            <table className="tabla-catastro tabla-clic">
              <thead>
                <tr>
                  {esExt
                    ? <><th>Código</th><th>Ubicación</th><th>Área</th><th>Agente</th><th>Capacidad</th><th>N.º de serie</th><th>Fabricación</th><th>PH</th><th>Próx. mant.</th><th>Responsable</th></>
                    : <><th>Código</th><th>Ubicación</th><th>Área</th><th>Subtipo</th><th>Modelo</th><th>Zona o lazo</th><th>Responsable</th></>}
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => {
                  const m = estadoMantenimiento(a.datos.proximo_mantenimiento, hoy)
                  return esExt ? (
                    <tr key={a.id}>
                      <td><b>{a.codigo}</b></td>
                      <td>{nombreUbic(a.ubicacion_id)}</td>
                      <td>{nombreArea(a.unidad_id)}</td>
                      <td>{filaDe(a)}</td>
                      <td>{capacidad(a)}</td>
                      <td>{String(a.datos.numero_serie ?? '')}</td>
                      <td>{String(a.datos.anio_fabricacion ?? '')}</td>
                      <td>{String(a.datos.anio_prueba_hidrostatica ?? '')}</td>
                      <td>{datoDeActivo(a.datos, 'activo.proximo_mantenimiento.mes_texto')} <span className={`chip ${m === 'vencido' ? 'chip-mal' : m === 'por_vencer' ? 'chip-aviso' : 'chip-ok'}`}>{m === 'vencido' ? 'Vencido' : m === 'por_vencer' ? 'Por vencer' : 'Vigente'}</span></td>
                      <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                    </tr>
                  ) : (
                    <tr key={a.id}>
                      <td><b>{a.codigo}</b></td>
                      <td>{nombreUbic(a.ubicacion_id)}</td>
                      <td>{nombreArea(a.unidad_id)}</td>
                      <td>{subtipoDe(a)}</td>
                      <td>{String(a.datos.modelo ?? '')}</td>
                      <td>{String(a.datos.zona ?? '')}</td>
                      <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Ventana>
      )}
    </Seccion>
  )
}

/** Tabla para realizar la inspección: todos los extintores con su estado en la semana elegida arriba, y filtros. */
function TablaInspeccion({ activos, filas, formato, nombrePersona, nombreArea, nombreUbic }: {
  activos: Activo[]; filas: FilaAvance[]; formato: FormatoLocal; nombrePersona: Map<string, string>; nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string
}) {
  const [estado, setEstado] = useState<'todos' | 'pendiente' | 'realizado'>('todos')
  const [buscar, setBuscar] = useState('')
  const [resp, setResp] = useState('')
  const porActivo = new Map(filas.map((f) => [f.activo_id, f]))
  const responsables = [...new Set(activos.map((a) => a.responsable_id).filter((x): x is string => Boolean(x)))].sort((x, y) => (nombrePersona.get(x) ?? '').localeCompare(nombrePersona.get(y) ?? '', 'es'))
  const lista = activos.filter((a) => {
    const hecho = Boolean(porActivo.get(a.id)?.inspeccion_id)
    return (estado === 'todos' || (estado === 'realizado') === hecho)
      && (!buscar || a.codigo.toLowerCase().includes(buscar.trim().toLowerCase())) && (!resp || a.responsable_id === resp)
  })
  return (
    <Seccion titulo={`Realizar inspección (${lista.length} de ${activos.length})`}>
      <div className="fila3 no-imprimir">
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
          <input type="search" list="codigos-ext-tabla" autoComplete="off" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej.: P1-001" />
          <datalist id="codigos-ext-tabla">
            {activos.filter((a) => !buscar || a.codigo.toLowerCase().includes(buscar.toLowerCase())).slice(0, 30).map((a) => <option key={a.id} value={a.codigo} />)}
          </datalist>
        </label>
        <label className="field">
          <span>Responsable</span>
          <select value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => <option key={r} value={r}>{nombrePersona.get(r) ?? 'Persona de la empresa'}</option>)}
          </select>
        </label>
      </div>
      {!lista.length ? <p className="nota">No hay equipos con este filtro.</p> : (
        <div className="tabla-scroll">
          <table className="tabla-catastro tabla-clic">
            <thead>
              <tr><th>Código</th><th>Ubicación</th><th>Área</th><th>Responsable</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const f = porActivo.get(a.id)
                const hecho = Boolean(f?.inspeccion_id)
                return (
                  <tr key={a.id} tabIndex={0} onClick={() => ir(hecho ? `/inspecciones/${f!.inspeccion_id}` : `/inspecciones/nueva/${formato.plantilla.id}/-/${a.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLElement).click()}>
                    <td><b>{a.codigo}</b></td>
                    <td>{nombreUbic(a.ubicacion_id)}</td>
                    <td>{nombreArea(a.unidad_id)}</td>
                    <td>{a.responsable_id ? (nombrePersona.get(a.responsable_id) ?? '') : ''}</td>
                    <td><span className={`chip ${hecho ? 'chip-ok' : 'chip-aviso'}`}>{hecho ? 'Inspeccionado' : 'Pendiente'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="nota">Toca una fila: si está pendiente empieza su inspección; si ya está inspeccionado, la abre.</p>
    </Seccion>
  )
}

/** Buscador por código (se completa al escribir) con la ficha del extintor, «ir a inspeccionar», modificar y eliminar; o agregar uno nuevo. */
export function BuscadorExtintor({ variante, subtipos, activos, filas, ultimas, formato, contexto, copia, nombreArea, nombreUbic, hoy, semanaActual, onCambio }: {
  variante: 'extintor' | 'daci' | 'bomba'; subtipos: { codigo: string; nombre: string }[]
  activos: Activo[]; filas: FilaAvance[]; ultimas: Map<string, UltimaInspeccion>; formato: FormatoLocal; contexto: NonNullable<ReturnType<typeof useContextoActivos>['contexto']>; copia: CopiaLocal
  nombreArea: (id: string | null) => string; nombreUbic: (id: string | null) => string; hoy: string; semanaActual: boolean; onCambio: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [modo, setModo] = useState<'ver' | 'editar' | 'baja' | 'nuevo'>('ver')
  const tipo = contexto.tipos.find((t) => t.id === formato.plantilla.tipo_activo_id)
  const a = activos.find((x) => x.codigo.toLowerCase() === codigo.trim().toLowerCase())
  const sugeridos = activos.filter((x) => !codigo || x.codigo.toLowerCase().includes(codigo.trim().toLowerCase())).slice(0, 30)
  const hecho = a ? filas.some((f) => f.activo_id === a.id && f.inspeccion_id) : false
  const u = a ? ultimas.get(a.id) : undefined
  const mant = a ? estadoMantenimiento(a.datos.proximo_mantenimiento, hoy) : null // solo extintores
  const nombreResp = a?.responsable_id ? (copia.personas.find((p) => p.persona_id === a.responsable_id)?.apellidos_nombres ?? '') : ''
  const terminado = () => (setModo('ver'), onCambio())

  return (
    <Seccion titulo={`Buscar ${variante === 'extintor' ? 'extintor' : variante === 'bomba' ? (/electro/i.test(formato.plantilla.nombre) ? 'electrobomba' : 'motobomba') : 'dispositivo'} por código`}>
      <label className="field">
        <span>Código</span>
        <input type="search" list="codigos-ext" autoComplete="off" value={codigo} placeholder="Ej.: P1-001"
          onChange={(e) => (setCodigo(e.target.value), setModo('ver'))} />
        <datalist id="codigos-ext">
          {sugeridos.map((x) => <option key={x.id} value={x.codigo}>{nombreUbic(x.ubicacion_id)}</option>)}
        </datalist>
      </label>
      {a && tipo && modo === 'ver' && (
        <div className="ficha-ext">
          <div className="fila-entre">
            <h3>{a.codigo}</h3>
            <span className="acciones">
              <button className="btn-link" type="button" aria-label="Modificar equipo" title="Modificar" onClick={() => setModo('editar')}><Pencil size={18} aria-hidden="true" /> Modificar</button>
              <button className="btn-link peligro" type="button" aria-label="Eliminar equipo" title="Eliminar" onClick={() => setModo('baja')}><Trash2 size={18} aria-hidden="true" /> Eliminar</button>
            </span>
          </div>
          <dl className="datos-ficha">
            <div><dt>Ubicación</dt><dd>{nombreUbic(a.ubicacion_id) || '—'}</dd></div>
            <div><dt>Área</dt><dd>{nombreArea(a.unidad_id) || '—'}</dd></div>
            {variante === 'extintor' ? (
              <>
                <div><dt>N.º de serie</dt><dd>{String(a.datos.numero_serie ?? '—')}</dd></div>
                <div><dt>Agente</dt><dd>{String(a.datos.agente ?? '—')}</dd></div>
                <div><dt>Capacidad</dt><dd>{a.datos.capacidad != null ? `${a.datos.capacidad} ${a.datos.capacidad_unidad ?? ''}` : '—'}</dd></div>
                <div><dt>Fecha de fabricación</dt><dd>{String(a.datos.anio_fabricacion ?? '—')}</dd></div>
                <div><dt>PH vigente</dt><dd>{String(a.datos.anio_prueba_hidrostatica ?? '—')}</dd></div>
                <div><dt>Próximo mantenimiento</dt><dd>{datoDeActivo(a.datos, 'activo.proximo_mantenimiento.mes_texto') || '—'}{' '}
              <span className={`chip ${mant === 'vencido' ? 'chip-mal' : mant === 'por_vencer' ? 'chip-aviso' : 'chip-ok'}`}>{mant === 'vencido' ? 'Vencido' : mant === 'por_vencer' ? 'Por vencer' : 'Vigente'}</span></dd></div>
              </>
            ) : variante === 'bomba' ? (
              a.datos.principal_marca != null || a.datos.jockey_marca != null ? (
                <>
                  <div><dt>Electrobomba principal</dt><dd>{[a.datos.principal_marca, a.datos.principal_potencia, a.datos.principal_caudal].filter(Boolean).join(' · ') || '—'}</dd></div>
                  <div><dt>Electrobomba Jockey</dt><dd>{[a.datos.jockey_marca, a.datos.jockey_potencia, a.datos.jockey_caudal].filter(Boolean).join(' · ') || '—'}</dd></div>
                </>
              ) : null
            ) : (
              <>
                <div><dt>Subtipo</dt><dd>{subtipos.find((x) => x.codigo === a.subtipo)?.nombre ?? '—'}</dd></div>
                <div><dt>Modelo</dt><dd>{String(a.datos.modelo ?? '—')}</dd></div>
                <div><dt>Zona o lazo</dt><dd>{String(a.datos.zona ?? '—')}</dd></div>
              </>
            )}
            <div><dt>Responsable</dt><dd>{nombreResp || '—'}</dd></div>
            <div><dt>Última inspección</dt><dd>{u ? fechaCorta(u.fecha) : 'Todavía sin inspecciones'}</dd></div>
          </dl>
          {semanaActual && !hecho && (
            <button className="btn" type="button" onClick={() => ir(`/inspecciones/nueva/${formato.plantilla.id}/-/${a.id}`)}>
              <ClipboardCheck size={18} aria-hidden="true" /> Ir a inspeccionar
            </button>
          )}
          {hecho && <p className="aviso-ok">Ya fue inspeccionado en el período elegido.</p>}
        </div>
      )}
      {a && tipo && modo === 'editar' && <FormActivo exigirTodo={variante === 'extintor'} ctx={contexto} tipo={tipo} activo={a} materiales={[]} onListo={terminado} onCancelar={() => setModo('ver')} />}
      {a && modo === 'baja' && <FormBaja activo={a} onListo={() => (setCodigo(''), terminado())} onCancelar={() => setModo('ver')} />}
      {!a && codigo.trim() && tipo && modo !== 'nuevo' && (
        <div className="acciones">
          <span className="nota">No hay {variante === 'extintor' ? 'un extintor' : variante === 'bomba' ? `una ${/electro/i.test(formato.plantilla.nombre) ? 'electrobomba' : 'motobomba'}` : 'un dispositivo'} con el código «{codigo.trim()}».</span>
          <button className="btn-sec" type="button" onClick={() => setModo('nuevo')}>
            <Plus size={18} aria-hidden="true" /> Agregar nuevo equipo
          </button>
        </div>
      )}
      {!a && tipo && modo === 'nuevo' && (
        <FormActivo exigirTodo={variante === 'extintor'} ctx={contexto} tipo={tipo} activo={null} codigoInicial={codigo.trim()} materiales={[]} onListo={terminado} onCancelar={() => setModo('ver')} />
      )}
    </Seccion>
  )
}

/** Meses recientes (el actual y los 11 anteriores) con su primer y último día. */
export function mesesRecientes(hoy: string) {
  return Array.from({ length: 12 }, (_, k) => {
    const mes = sumarMeses(hoy.slice(0, 7), -k)
    const y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7))
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { clave: mes, etiqueta: `${MESES[m - 1]} ${y}`, desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` }
  })
}

/** Generar el registro en Excel o PDF de una semana o de un mes; la fecha de inspección es el domingo de la semana (se puede cambiar) o la que se escriba. */
function GenerarRegistro({ esExt, formato, copia, sede, semanas, hoy, cuenta, esSemanal, unPeriodo }: { formato: FormatoLocal; copia: CopiaLocal; sede: string; semanas: ReturnType<typeof periodosHasta>; hoy: string; cuenta: string; esSemanal: boolean; unPeriodo: string; esExt: boolean }) {
  void cuenta
  // Con frecuencia semanal se puede elegir una semana o un mes del calendario; con otra frecuencia (mensual…), un período del formato.
  const meses = useMemo(
    () => (esSemanal ? mesesRecientes(hoy) : semanas.map((s) => ({ clave: s.clave, etiqueta: s.etiqueta.split(' · ')[0], desde: s.desde, hasta: s.hasta }))),
    [esSemanal, hoy, semanas],
  )
  // Las opciones Excel y PDF salen según el Excel de la organización que tenga el formato (null: aún se está viendo).
  const [tieneExcel, setTieneExcel] = useState<boolean | null>(null)
  const [por, setPor] = useState<'semana' | 'mes'>(esSemanal ? 'semana' : 'mes')
  const [semana, setSemana] = useState(semanas[0]?.clave ?? '')
  const [mes, setMes] = useState(meses[0].clave)
  const [fecha, setFecha] = useState(esSemanal ? (semanas[0]?.hasta ?? '') : '')
  const [registro, setRegistro] = useState({ nombre: '', cargo: '' })
  const [firma, setFirma] = useState<Uint8Array | null>(null)
  const [firmando, setFirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [armando, setArmando] = useState(false)
  const [vistaPdf, setVistaPdf] = useState<ReturnType<typeof vistaDeExcel> | null>(null)

  useEffect(() => {
    let vivo = true
    void excelDeFormato(formato.plantilla.id).then((x) => vivo && setTieneExcel(!!x), () => vivo && setTieneExcel(false))
    return () => {
      vivo = false
    }
  }, [formato.plantilla.id])

  useEffect(() => {
    if (!vistaPdf) return
    const listo = () => setVistaPdf(null)
    window.addEventListener('afterprint', listo)
    const t = setTimeout(() => window.print(), 300)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', listo)
    }
  }, [vistaPdf])

  // Alerta (pedido del dueño, 29/10/2026): el registro lleva código, versión y fecha de aprobación del formato.
  const faltaVersion = [
    ...(formato.version.codigo_formato ? [] : ['el código']),
    ...(formato.version.version_formato ? [] : ['la versión']),
    ...(formato.version.fecha_aprobacion ? [] : ['la fecha de aprobación']),
  ]
  const elegido = por === 'semana' ? semanas.find((s) => s.clave === semana) : meses.find((m) => m.clave === mes)
  const cambiarPor = (p: 'semana' | 'mes') => {
    setPor(p)
    setFecha(p === 'semana' ? (semanas.find((s) => s.clave === semana)?.hasta ?? '') : '') // por mes se pide la fecha
  }

  async function generar(como: 'excel' | 'pdf') {
    setError(null)
    setAviso(null)
    if (!elegido) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError('Escribe la fecha de la inspección.')
    if (registro.nombre.trim().length < 3 || !registro.cargo.trim() || !firma) return setError('Escribe tu nombre y apellido, tu cargo y firma: el pie del formato los pide.')
    setArmando(true)
    try {
      const filas = await avancePeriodo(formato.plantilla.id, sede, elegido.desde, elegido.hasta)
      const r = await armarRegistro({ formato, copia, sede, periodo: { etiqueta: elegido.etiqueta, desde: elegido.desde, hasta: elegido.hasta }, filas, registro: { ...registro, fecha }, firma })
      if (!r) return setAviso('Este formato no tiene un Excel de la organización. Súbelo en el formato.')
      const vista = await entregarRegistro(r.bytes, como, `Inspección ${esExt ? 'Extintores' : 'DACI'}- ${elegido.clave}`)
      if (vista) setVistaPdf(vista)
      setAviso(`Registro listo: ${r.filas} equipo(s)${r.agregadas ? `; se agregaron ${r.agregadas} filas al formato` : ''}.`)
    } catch (e) {
      setError(`No se pudo armar el registro: ${(e as Error).message}`)
    } finally {
      setArmando(false)
    }
  }

  return (
    <Seccion titulo="Generar registro">
      <div className="fila3">
        {esSemanal && <label className="field">
          <span>Registro de</span>
          <select value={por} onChange={(e) => cambiarPor(e.target.value as 'semana' | 'mes')}>
            <option value="semana">Una semana</option>
            <option value="mes">Un mes</option>
          </select>
        </label>}
        {por === 'semana' ? (
          <label className="field">
            <span>Semana</span>
            <select value={semana} onChange={(e) => (setSemana(e.target.value), setFecha(semanas.find((s) => s.clave === e.target.value)?.hasta ?? ''))}>
              {semanas.map((s) => <option key={s.clave} value={s.clave}>{s.etiqueta}</option>)}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>{esSemanal ? 'Mes' : unPeriodo[0].toUpperCase() + unPeriodo.slice(1)}</span>
            <select value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="field campo-fecha">
        <span>Fecha de inspección {por === 'semana' ? '(por defecto, el domingo de la semana; puedes cambiarla)' : '(escríbela: el registro es de todo el período)'}</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <div className="fila2">
        <label className="field">
          <span>Responsable de la inspección y custodia del registro: nombre y apellido *</span>
          <input type="text" maxLength={200} value={registro.nombre} onChange={(e) => setRegistro((r) => ({ ...r, nombre: e.target.value }))} />
        </label>
        <label className="field">
          <span>Cargo *</span>
          <input type="text" maxLength={120} value={registro.cargo} onChange={(e) => setRegistro((r) => ({ ...r, cargo: e.target.value }))} />
        </label>
      </div>
      {firmando ? (
        <PanelFirma onListo={(png) => void png.arrayBuffer().then((b) => (setFirma(new Uint8Array(b)), setFirmando(false)))} onCancelar={() => setFirmando(false)} />
      ) : (
        <div className="acciones">
          <button className="btn-sec" type="button" onClick={() => setFirmando(true)}>
            <PenLine size={16} aria-hidden="true" /> {firma ? 'Firmar de nuevo' : 'Firmar *'}
          </button>
          {firma && <span className="chip chip-ok">Firma lista (no se guarda: hay que firmar cada vez)</span>}
        </div>
      )}
      <Aviso>{error}</Aviso>
      {aviso && <p className="aviso-suave">{aviso}</p>}
      {faltaVersion.length > 0 && (
        <p className="aviso-suave">Al formato le falta {faltaVersion.join(', ')}: el registro saldrá con ese dato en blanco. Complétalo en Formatos.</p>
      )}
      {tieneExcel === false ? (
        <p className="aviso-suave">Este formato no tiene un Excel de la organización, por eso no se puede generar el registro en Excel ni en PDF. Súbelo en el formato.</p>
      ) : (
        <div className="acciones">
          <button className="btn" type="button" disabled={armando || tieneExcel === null} onClick={() => void generar('excel')}>
            <FileSpreadsheet size={18} aria-hidden="true" /> {armando ? 'Armando…' : 'Generar en Excel'}
          </button>
          <button className="btn" type="button" disabled={armando || tieneExcel === null} onClick={() => void generar('pdf')}>
            <FileText size={18} aria-hidden="true" /> {armando ? 'Armando…' : 'Generar en PDF'}
          </button>
        </div>
      )}
      {vistaPdf && createPortal(<VistaExcel vista={vistaPdf.vista} medias={vistaPdf.medias} />, document.body)}
    </Seccion>
  )
}

