import { ArrowLeft, Download, FileSpreadsheet, Plus, RefreshCw } from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { db } from '../empresas/datos'
import { caminoUnidad, guardarPuesto, guardarUnidad, leerListas } from '../usuarios/datos'
import { ESTADOS, type Estado, type Faltante, type Revision, revisarCarga, textoFaltante } from './datos'
import { FILAS_MAXIMAS, type Lectura, leerPersonal } from './lectura.ts'
import { crearPlantilla } from './plantilla.ts'
import { ErrorExcel, TAMANO_MAXIMO } from './xlsx.ts'

const ORDEN: Estado[] = ['error', 'falta_lista', 'nueva', 'alta_cuenta_existente', 'actualizar', 'reactivar', 'sin_cambios', 'administrador']
type Filtro = 'todas' | 'problemas' | 'nuevas' | 'existentes'

/**
 * Carga de personal desde Excel (tarea 3.6). La usan el administrador (su empresa) y el dueño (cualquier empresa).
 * El archivo se lee en este equipo y se olvida al salir de la pantalla; nunca se sube ni se guarda (Ley 29733).
 * Nada se graba hasta confirmar, y se graba todo o nada.
 */
export function Carga({ empresaId, onVolver }: { empresaId: string; onVolver: () => void }) {
  const [empresaNombre, setEmpresaNombre] = useState('')
  useEffect(() => {
    db().from('empresas').select('razon_social').eq('id', empresaId).maybeSingle()
      .then(({ data }) => setEmpresaNombre(data?.razon_social ?? ''))
  }, [empresaId])
  const [archivo, setArchivo] = useState<string | null>(null)
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [crear, setCrear] = useState<Set<number>>(new Set())
  const [reactivar, setReactivar] = useState<Set<number>>(new Set())
  const [listaCompleta, setListaCompleta] = useState(false)
  const [verNoAparecen, setVerNoAparecen] = useState(false)

  async function revisar(l: Lectura) {
    setOcupado('Revisando las filas…')
    try {
      const r = await revisarCarga(empresaId, l.registros)
      setRevision(r)
      setCrear(new Set(r.faltantes.flatMap((f, i) => (f.necesario ? [i] : []))))
      setReactivar(new Set())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo después de corregirlo
    if (!f) return
    setError(null)
    setRevision(null)
    setLectura(null)
    setArchivo(f.name)
    if (f.size > TAMANO_MAXIMO) return setError('El archivo pesa más de 1 MB. Divide la lista en varios archivos.')
    setOcupado('Leyendo el Excel…')
    try {
      const l = await leerPersonal(await f.arrayBuffer())
      setLectura(l)
      await revisar(l)
    } catch (err) {
      setError(err instanceof ErrorExcel ? err.message : 'No se pudo leer el archivo. Revisa que sea un Excel .xlsx.')
    } finally {
      setOcupado(null)
    }
  }

  async function descargarPlantilla() {
    setError(null)
    setOcupado('Preparando la plantilla…')
    try {
      const { puestos, unidades } = await leerListas(empresaId)
      const vigentes = unidades.filter((u) => caminoUnidad(unidades, u.id).vigente)
      const nombres = (nivel: string) => [...new Set(vigentes.filter((u) => u.nivel === nivel).map((u) => u.nombre))].sort((a, b) => a.localeCompare(b, 'es'))
      const xlsx = crearPlantilla({
        empresa: empresaNombre,
        puestos: puestos.filter((p) => p.vigente).map((p) => p.nombre),
        gerencias: nombres('gerencia'),
        areas: nombres('area'),
        subareas: nombres('subarea'),
      })
      const url = URL.createObjectURL(new Blob([xlsx as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `CRC_plantilla_personal_${empresaNombre.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.xlsx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  /** Crea lo marcado, de arriba hacia abajo (gerencias, luego áreas, luego subáreas), y vuelve a revisar. */
  async function crearFaltantes() {
    if (!revision || !lectura) return
    setError(null)
    setOcupado('Creando en las listas…')
    try {
      const elegidos = revision.faltantes.filter((_, i) => crear.has(i))
      for (const f of elegidos) if (f.tipo === 'puesto') await guardarPuesto(empresaId, null, f.nombre)
      for (const nivel of ['gerencia', 'area', 'subarea'] as const) {
        const { unidades } = await leerListas(empresaId)
        const buscar = (n: string, padre: string | null, nombre: string) =>
          unidades.find((u) => u.nivel === n && u.padre_id === padre && u.nombre.toLowerCase() === nombre.toLowerCase())
        for (const f of elegidos) {
          if (f.tipo !== 'unidad' || f.nivel !== nivel) continue
          const g = nivel === 'gerencia' ? null : buscar('gerencia', null, f.camino[0])
          const a = nivel === 'subarea' && g ? buscar('area', g.id, f.camino[1]) : null
          const padre = nivel === 'gerencia' ? null : nivel === 'area' ? g?.id : a?.id
          if (nivel !== 'gerencia' && !padre) throw new Error(`Para crear ${textoFaltante(f)} marca también la unidad de arriba.`)
          await guardarUnidad(empresaId, null, nivel, padre ?? null, f.camino[f.camino.length - 1])
        }
      }
      await revisar(lectura)
    } catch (e) {
      setError((e as Error).message)
      setOcupado(null)
    }
  }

  const cuenta = useMemo(() => {
    const c = Object.fromEntries(ORDEN.map((e) => [e, 0])) as Record<Estado, number>
    for (const f of revision?.filas ?? []) c[f.estado]++
    return c
  }, [revision])

  const visibles = (revision?.filas ?? []).filter((f) =>
    filtro === 'todas' ? true
      : filtro === 'problemas' ? f.estado === 'error' || f.estado === 'falta_lista'
        : filtro === 'nuevas' ? f.estado === 'nueva' || f.estado === 'alta_cuenta_existente'
          : !['error', 'falta_lista', 'nueva', 'alta_cuenta_existente'].includes(f.estado),
  )
  const bloqueado = cuenta.error > 0 || cuenta.falta_lista > 0
  const marcar = (set: Set<number>, fijar: (s: Set<number>) => void, i: number) => {
    const s = new Set(set)
    if (s.has(i)) s.delete(i)
    else s.add(i)
    fijar(s)
  }

  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={onVolver}>
        <ArrowLeft size={18} aria-hidden="true" /> Usuarios
      </button>
      <header className="detalle-cab">
        <h1>Cargar personal desde Excel</h1>
        <p>{empresaNombre}</p>
      </header>

      <Seccion titulo="1. Plantilla">
        <p className="nota">Trae las listas de puestos y de la estructura de la empresa. Hasta {FILAS_MAXIMAS} personas y 1 MB por archivo.</p>
        <div className="acciones">
          <button className="btn-sec" type="button" disabled={Boolean(ocupado)} onClick={() => void descargarPlantilla()}>
            <Download size={18} aria-hidden="true" /> Descargar plantilla
          </button>
        </div>
      </Seccion>

      <Seccion titulo="2. Elegir el Excel">
        <p className="nota">El archivo se lee en este equipo: no se sube ni se guarda. Nada se graba hasta que confirmes.</p>
        <label className="btn subir-excel">
          <FileSpreadsheet size={20} aria-hidden="true" /> {archivo ? 'Elegir otro archivo' : 'Elegir archivo .xlsx'}
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void elegir(e)} disabled={Boolean(ocupado)} />
        </label>
        {archivo && <p className="nota">Archivo: {archivo}{lectura ? ` · hoja «${lectura.hoja}» · ${lectura.registros.length} personas` : ''}</p>}
        {ocupado && <p className="nota" role="status">{ocupado}</p>}
        <Aviso>{error}</Aviso>
      </Seccion>

      {revision && (
        <>
          <Seccion
            titulo="3. Vista previa"
            accion={
              <button className="btn-link" type="button" disabled={Boolean(ocupado)} onClick={() => lectura && void revisar(lectura)}>
                <RefreshCw size={16} aria-hidden="true" /> Revisar de nuevo
              </button>
            }
          >
            <p className="chips resumen-carga">
              {ORDEN.filter((e) => cuenta[e]).map((e) => (
                <span key={e} className={`chip ${ESTADOS[e].clase}`}>
                  {ESTADOS[e].texto}: {cuenta[e]}
                </span>
              ))}
            </p>
            {bloqueado ? (
              <Aviso>
                Para grabar, todas las filas deben estar sin errores y con sus listas completas. Corrige el Excel y vuelve a elegirlo
                {cuenta.falta_lista ? ', o crea abajo lo que falta' : ''}.
              </Aviso>
            ) : (
              <Aviso tipo="ok">Todo listo para grabar: no hay filas con error.</Aviso>
            )}

            {revision.faltantes.length > 0 && (
              <div className="faltantes">
                <h3>Falta crear en las listas de la empresa</h3>
                <p className="nota">Marcadas: las que necesita alguna fila sin otros errores. Revisa que estén bien escritas antes de crearlas.</p>
                <ul>
                  {revision.faltantes.map((f: Faltante, i) => (
                    <li key={i}>
                      <label className="check-linea">
                        <input type="checkbox" checked={crear.has(i)} onChange={() => marcar(crear, setCrear, i)} />
                        <span>
                          {textoFaltante(f)} <small>(fila{f.filas.length > 1 ? 's' : ''} {f.filas.join(', ')}{f.necesario ? '' : ' · solo filas con error'})</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button className="btn-sec" type="button" disabled={!crear.size || Boolean(ocupado)} onClick={() => void crearFaltantes()}>
                  <Plus size={18} aria-hidden="true" /> Crear las marcadas y revisar de nuevo
                </button>
              </div>
            )}

            <div className="segmentos" role="group" aria-label="Filtrar filas">
              {([['todas', 'Todas'], ['problemas', 'Con problemas'], ['nuevas', 'Nuevas'], ['existentes', 'Ya existen']] as [Filtro, string][]).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="tabla-scroll">
              <table className="tabla tabla-carga">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Documento</th>
                    <th>Apellidos y nombres</th>
                    <th>Resultado</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={f.fila} className={`fila-${f.estado}`}>
                      <td>{f.fila}</td>
                      <td className="mono">
                        {f.tipo} {f.numero}
                      </td>
                      <td>{f.nombres || <span className="vacio">—</span>}</td>
                      <td>
                        <span className={`chip ${ESTADOS[f.estado].clase}`}>{ESTADOS[f.estado].texto}</span>
                      </td>
                      <td className="detalle-fila">
                        {f.motivos.map((m) => (
                          <div key={m} className="texto-mal">{m}</div>
                        ))}
                        {f.estado !== 'error' && f.faltan.map((m) => <div key={m}>Falta: {m}</div>)}
                        {f.estado === 'reactivar' ? (
                          <label className="check-linea">
                            <input type="checkbox" checked={reactivar.has(f.fila)} onChange={() => marcar(reactivar, setReactivar, f.fila)} /> Reactivar esta cuenta
                          </label>
                        ) : (
                          f.cambios.map((m) => <div key={m}>{m}</div>)
                        )}
                        {f.estado === 'nueva' && <div>Recibirá una contraseña inicial.</div>}
                        {f.estado === 'alta_cuenta_existente' && <div>Se da de alta aquí; sigue con su contraseña de siempre.</div>}
                        {f.estado === 'sin_cambios' && <div>No se toca nada (ni su contraseña).</div>}
                      </td>
                    </tr>
                  ))}
                  {!visibles.length && (
                    <tr>
                      <td colSpan={5} className="vacio">
                        Ninguna fila en este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Seccion>

          <Seccion titulo="4. Personas que no aparecen en el Excel">
            <label className="check-linea">
              <input type="checkbox" checked={listaCompleta} onChange={(e) => setListaCompleta(e.target.checked)} />
              <span>Este Excel es la lista completa del personal activo (carga mensual)</span>
            </label>
            <p className="nota">
              {revision.noAparecen.length === 0
                ? 'Todos los gestores y usuarios activos de la empresa aparecen en el Excel.'
                : listaCompleta
                  ? `${revision.noAparecen.length} gestores o usuarios activos no aparecen: quedarán «por revisar» hasta que confirmes su cese o que siguen. Nadie se cesa solo.`
                  : `${revision.noAparecen.length} gestores o usuarios activos no aparecen. Como no marcaste «lista completa», no les pasará nada.`}{' '}
              Los administradores no van en el Excel y nunca quedan «por revisar».
            </p>
            {revision.noAparecen.length > 0 && (
              <button className="btn-link" type="button" onClick={() => setVerNoAparecen(!verNoAparecen)}>
                {verNoAparecen ? 'Ocultar la lista' : 'Ver quiénes son'}
              </button>
            )}
            {verNoAparecen && (
              <ul className="lista">
                {revision.noAparecen.map((p) => (
                  <li key={p.vinculo_id}>
                    <div>
                      <b>{p.apellidos_nombres}</b>
                      <small>
                        {p.tipo_documento} {p.numero_documento} · {p.rol === 'gestor' ? 'Gestor' : 'Usuario'}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="5. Confirmar">
            <p className="nota">
              Se crearán {cuenta.nueva} cuentas nuevas{cuenta.alta_cuenta_existente ? `, se darán de alta ${cuenta.alta_cuenta_existente} personas que ya tenían cuenta` : ''}
              {cuenta.actualizar ? `, se actualizarán ${cuenta.actualizar}` : ''}
              {reactivar.size ? ` y se reactivarán ${reactivar.size}` : ''}. Se graba todo o nada.
            </p>
            <button className="btn" type="button" disabled>
              Confirmar y grabar
            </button>
            <p className="nota">El grabado se activa en el paso 5 de esta tarea.</p>
          </Seccion>
        </>
      )}
    </div>
  )
}
