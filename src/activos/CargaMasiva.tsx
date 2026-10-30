import { Download, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ErrorExcel } from '../carga/xlsx'
import { Aviso } from '../empresas/campos'
import { guardarActivo, listarActivos } from '../formatos/datos'
import { Ventana } from '../inspecciones/Ventana'
import { unidadesAsignables } from '../usuarios/datos'
import { useContextoActivos } from './Activos'
import { type ContextoCarga, type Revision, crearPlantillaEquipos, revisarEquipos } from './revisionEquipos'

/**
 * Carga masiva de equipos (extintores o dispositivos del sistema DACI), pedida por el dueño el 29/10/2026: se baja la plantilla, se llena
 * y se sube. Primero se revisa todo; si hay errores se avisa fila por fila y no se carga nada.
 */
export function CargaMasivaEquipos({ empresaId, empresaNombre, tipoId, exigirTodo, onCerrar, onListo }: {
  empresaId: string; empresaNombre: string; tipoId: string; exigirTodo: boolean; onCerrar: () => void; onListo: () => void
}) {
  const { contexto, error: errCtx } = useContextoActivos(empresaId, true, false)
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ cargados: number; fallas: { fila: number; mensaje: string }[] } | null>(null)

  useEffect(() => {
    listarActivos(empresaId, tipoId).then((a) => setCodigos(a.map((x) => x.codigo)), (e) => setError((e as Error).message))
  }, [empresaId, tipoId])

  const ctx = useMemo<ContextoCarga | null>(() => {
    const tipo = contexto?.tipos.find((t) => t.id === tipoId)
    if (!contexto || !tipo || !codigos) return null
    const nombreUnidad = new Map(contexto.unidades.map((u) => [u.id, u.nombre]))
    return {
      tipo: { id: tipo.id, nombre: tipo.nombre, subtipos: tipo.subtipos, campos: tipo.campos },
      sedes: contexto.sedes.filter((s) => s.activa).map((s) => ({ id: s.id, nombre: s.nombre })),
      unidades: unidadesAsignables(contexto.unidades).filter((u) => u.vigente).map((u) => ({ id: u.id, nombre: nombreUnidad.get(u.id) ?? u.nombre, ruta: u.nombre })),
      ubicaciones: contexto.ubicaciones.filter((u) => u.vigente).map((u) => ({ id: u.id, sede_id: u.sede_id, unidad_id: u.unidad_id, nombre: u.nombre })),
      personas: contexto.personas.map((p) => ({ persona_id: p.persona_id, apellidos_nombres: p.apellidos_nombres })),
      listas: Object.fromEntries(contexto.listas.map((l) => [l.codigo, l.valores.filter((v) => v.vigente).map((v) => v.nombre)])),
      codigosExistentes: codigos,
      exigirTodo,
    }
  }, [contexto, codigos, tipoId, exigirTodo])

  function bajarPlantilla() {
    if (!ctx) return
    const xlsx = crearPlantillaEquipos(ctx, empresaNombre)
    const url = URL.createObjectURL(new Blob([xlsx as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `CRC_plantilla_${ctx.tipo.nombre.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function subir(archivo: File | undefined) {
    if (!archivo || !ctx) return
    setError(null)
    setResultado(null)
    setRevision(null)
    setOcupado('Revisando el Excel…')
    try {
      setRevision(await revisarEquipos(await archivo.arrayBuffer(), ctx))
    } catch (e) {
      setError(e instanceof ErrorExcel ? e.message : `No se pudo leer el Excel: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  async function cargar() {
    if (!revision || revision.errores.length) return
    setOcupado(`Cargando ${revision.listos.length} equipos…`)
    const fallas: { fila: number; mensaje: string }[] = []
    let cargados = 0
    for (const x of revision.listos) {
      try {
        await guardarActivo(empresaId, null, x.datos)
        cargados++
      } catch (e) {
        fallas.push({ fila: x.fila, mensaje: (e as Error).message })
      }
    }
    setResultado({ cargados, fallas })
    setRevision(null)
    setOcupado(null)
    if (cargados) onListo()
  }

  return (
    <Ventana titulo={`Cargar equipos · ${ctx?.tipo.nombre ?? ''}`} onCerrar={onCerrar}>
      <Aviso>{error ?? errCtx}</Aviso>
      {!ctx ? (
        !(error ?? errCtx) && <p className="nota">Cargando…</p>
      ) : (
        <>
          <p className="nota">
            1) Descarga la plantilla, 2) llénala (las columnas con * son obligatorias) y 3) súbela. CRC revisa todo antes de cargar: si hay errores te dice en qué fila y qué corregir, y no se carga ningún equipo.
          </p>
          <div className="acciones">
            <button className="btn-sec" type="button" onClick={bajarPlantilla}>
              <Download size={18} aria-hidden="true" /> Descargar plantilla
            </button>
            <label className="btn">
              <Upload size={18} aria-hidden="true" /> Subir el Excel lleno
              <input type="file" accept=".xlsx" hidden disabled={Boolean(ocupado)} onChange={(e) => (void subir(e.target.files?.[0]), (e.target.value = ''))} />
            </label>
          </div>
          {ocupado && <p className="aviso-suave">{ocupado}</p>}
          {revision && revision.errores.length > 0 && (
            <div className="alerta-formatos" role="alert">
              <p>
                <b>Hay {revision.errores.length} fila(s) con errores de {revision.filas}.</b> Corrígelas en el Excel y vuelve a subirlo. No se cargó ningún equipo.
              </p>
              <ul>
                {revision.errores.slice(0, 60).map((e) => (
                  <li key={e.fila}>
                    <span>
                      <b>Fila {e.fila}:</b> {e.mensaje}.
                    </span>
                  </li>
                ))}
              </ul>
              {revision.errores.length > 60 && <p className="nota">…y {revision.errores.length - 60} fila(s) más.</p>}
            </div>
          )}
          {revision && !revision.errores.length && (
            <>
              <p className="aviso-ok">El Excel está bien: {revision.listos.length} equipo(s) listos para cargar.</p>
              <div className="acciones">
                <button className="btn" type="button" disabled={Boolean(ocupado)} onClick={() => void cargar()}>
                  Cargar {revision.listos.length} equipo(s)
                </button>
              </div>
            </>
          )}
          {resultado && (
            <>
              {resultado.cargados > 0 && <p className="aviso-ok">Se cargaron {resultado.cargados} equipo(s).</p>}
              {resultado.fallas.length > 0 && (
                <div className="alerta-formatos" role="alert">
                  <p>
                    <b>No se pudieron cargar {resultado.fallas.length} fila(s).</b> Corrígelas y vuelve a subir solo esas filas.
                  </p>
                  <ul>
                    {resultado.fallas.map((f) => (
                      <li key={f.fila}>
                        <span>
                          <b>Fila {f.fila}:</b> {f.mensaje}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Ventana>
  )
}
