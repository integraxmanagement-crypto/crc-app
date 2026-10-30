import { ArrowLeft, Ban, FileSpreadsheet, FileText, Pencil, Printer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Aviso, Seccion } from '../empresas/campos'
import { db } from '../empresas/datos'
import { type Fila, type Respuesta, puntoVisible, seccionesVisibles, sinOcultas } from '../formatos/motor'
import type { Punto } from '../formatos/receta'
import { ir } from '../ruta'
import { type CopiaLocal, bajarCopia, leerCopia } from './campo'
import {
  type ArchivoServidor, type FirmaServidor, NOMBRE_AVISO, anularInspeccion, corregirInspeccion, detalleInspeccion, enlaceEvidencia, marcarEnPapel,
} from './datos'
import { gruposDe, llenarExcel, marcasDeExcel, partes, valoresDe } from './excel'
import { llenarExcelPeriodo, valoresFilas, valoresGenerales } from './excelPeriodo'
import { vistaDeExcel } from './excelVista'
import { VistaExcel } from './VistaExcel'
import { datosHoja, excelDeFormato, fotoPng, guardarExcel, logoPng } from './hoja'
import { hoyLocal } from './ayudas'
import { PuntoCampo } from './Llenar'

type Detalle = Awaited<ReturnType<typeof detalleInspeccion>>
const fechaPeru = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
const TEXTO: Record<string, string> = { si: '√', no: 'X', na: 'N/A' }
const ESTADO_FIRMA: Record<FirmaServidor['estado'], [string, string]> = {
  pendiente: ['Pendiente', 'chip-aviso'],
  firmada: ['Firmada en CRC', 'chip-ok'],
  en_papel: ['Firma en papel', 'chip-gris'],
}

/**
 * Una inspección recibida (tarea 3.4-C): respuestas, fotos, firmas, hallazgos, avisos e historial. La hoja Excel de
 * la organización se descarga llena, con las firmas hechas en CRC como imágenes (las de papel se firman a mano). Corregir (con motivo, deja historial) y
 * anular las puede el administrador.
 */
export function DetalleInspeccion({ id, cuenta, empresaId, online, esAdmin, auto }: { id: string; cuenta: string; empresaId: string; online: boolean; esAdmin: boolean; auto?: 'excel' | 'pdf' }) {
  const [d, setD] = useState<Detalle | null>(null)
  const [copia, setCopia] = useState<CopiaLocal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [modo, setModo] = useState<'ver' | 'corregir' | 'anular'>('ver')
  const [vistaPdf, setVistaPdf] = useState<ReturnType<typeof vistaDeExcel> | null>(null)

  const cargar = useCallback(() => {
    detalleInspeccion(id).then(setD, (e) => setError((e as Error).message))
  }, [id])
  useEffect(() => {
    if (online) cargar()
  }, [online, cargar])
  // PDF igual al Excel: cuando la hoja ya está dibujada, se abre «Imprimir» (ahí se elige «Guardar como PDF»).
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
  useEffect(() => {
    void leerCopia(cuenta, empresaId).then((c) => (c ? setCopia(c) : online ? bajarCopia(cuenta, empresaId).then(setCopia, () => {}) : null))
  }, [cuenta, empresaId, online])

  const nombre = useMemo(() => {
    const m = new Map((copia?.personas ?? []).map((p) => [p.persona_id, p]))
    return (pid: string | null | undefined) => (pid ? (m.get(pid)?.apellidos_nombres ?? 'Persona de la empresa') : '')
  }, [copia])

  if (!online && !d) return <p className="nota">El detalle se ve con señal.</p>
  if (!d) return error ? <Aviso>{error}</Aviso> : <p className="nota">Cargando…</p>

  const i = d.inspeccion
  const v = i.plantillas_versiones
  const receta = v?.receta
  const secciones = receta ? seccionesVisibles(receta, i.activo_foto?.subtipo ?? null) : []
  const fotosDe = (punto: string, fila: number | null) => d.archivos.filter((a) => a.punto_clave === punto && a.fila === fila)
  const tieneExcel = Boolean(copia?.formatos.find((x) => x.plantilla.id === i.plantilla_id)?.excel)
  const puedePapel = (i.inspector_id === cuenta || esAdmin) && i.estado === 'cerrada'

  /** El Excel de la organización lleno con esta inspección y sus firmas (null si el formato no tiene Excel). */
  async function armarExcel(): Promise<Uint8Array | null> {
    const archivo = await excelDeFormato(i.plantilla_id)
    if (!archivo) {
      setAviso('Este formato no tiene un Excel de la organización. Usa «Imprimir» o sube el Excel en el formato.')
      return null
    }
    const ordenadas = [...d!.firmas].sort((a, b) => a.orden - b.orden)
    const firmantes = ordenadas.map((f) => ({
      rol_clave: f.rol_clave,
      nombre: f.persona_id ? nombre(f.persona_id) : (f.externo_nombre ?? ''),
      cargo: f.cargo, // se escribe a mano al llenar la inspección; no se toma el puesto de la persona
      // Con la firma dentro del Excel (revisión LOTO, 29/10/2026), la fecha es la de la firma; en papel se fecha a mano.
      fecha: f.estado === 'firmada' && f.firmado_en ? hoyLocal(new Date(f.firmado_en)) : null,
    }))
    // Las imágenes de las firmas hechas en CRC, para las marcas {{firma.<rol>.imagen}} (las de papel quedan vacías).
    const imagenes = new Map<string, Uint8Array>()
    const vistos = new Map<string, number>()
    for (const f of ordenadas) {
      const n = (vistos.get(f.rol_clave) ?? 0) + 1
      vistos.set(f.rol_clave, n)
      if (f.estado !== 'firmada' || !f.imagen_ruta) continue
      const r = await db().storage.from('evidencias').download(f.imagen_ruta)
      if (!r.error) imagenes.set(`firma.${f.rol_clave}${n > 1 ? `#${n}` : ''}.imagen`, new Uint8Array(await r.data.arrayBuffer()))
    }
    // La primera foto de cada fila de un bloque repetible, donde diga {{foto.<punto>#<fila>}} (IPF: evidencia de la condición).
    for (const s of secciones) {
      if (!s.repetible) continue
      for (const p of s.puntos.filter((x) => x.tipo === 'foto')) {
        const filas = i.filas[s.clave] ?? []
        for (let k = 0; k < filas.length; k++) {
          const a = fotosDe(p.clave, k)[0]
          if (!a) continue
          const r = await db().storage.from('evidencias').download(a.ruta)
          const png = r.error ? null : await fotoPng(r.data).catch(() => null)
          if (png) imagenes.set(`foto.${p.clave}#${k + 1}`, png)
        }
      }
    }
    // El logo de la empresa, donde diga {{logo}} o arriba a la izquierda (revisión de diseño, 29/10/2026).
    const logo = await logoPng(copia, (v as { logo?: string } | null)?.logo).catch(() => null)
    if (logo) imagenes.set('logo', logo)
    const datos = datosHoja(i, {
      nombreFormato: i.plantillas?.nombre ?? '',
      version: v!,
      copia,
      nombre,
      lugares: { sede: i.sedes?.nombre, area: i.unidades?.nombre, ubicacion: i.ubicaciones?.nombre },
      firmantes,
    })
    // Un formato con registro por período (extintores): una inspección sola sale como un registro de una fila, con el pie de quien la firmó.
    if ((await marcasDeExcel(archivo)).some((m) => m.startsWith('fila.'))) {
      const a = copia?.activos.find((x) => x.codigo === i.activo_foto?.codigo)
      const quien = firmantes[0]
      const firmaImagen = ordenadas[0] ? imagenes.get(`firma.${ordenadas[0].rol_clave}.imagen`) : undefined
      const periodo = { etiqueta: i.fecha, desde: i.fecha, hasta: i.fecha }
      const r = await llenarExcelPeriodo(
        archivo,
        valoresGenerales(valoresDe(datos), periodo, { hechos: 1, total: 1 }, { nombre: quien?.nombre ?? nombre(i.inspector_id), cargo: quien?.cargo ?? '' }),
        valoresFilas([{ codigo: i.activo_foto?.codigo ?? '', datos: i.activo_foto?.datos ?? {}, inspeccion: datos, lugar: { area: i.unidades?.nombre ?? '', ubicacion: i.ubicaciones?.nombre ?? '', responsable: nombre(a?.responsable_id ?? null) } }]),
        new Map<string, Uint8Array>([...(firmaImagen ? [['firma.registro.imagen', firmaImagen] as [string, Uint8Array]] : []), ...(imagenes.get('logo') ? [['logo', imagenes.get('logo')!] as [string, Uint8Array]] : [])]),
      )
      return r.bytes
    }
    // Las filas modelo del Excel se repiten según las condiciones encontradas y los firmantes (pedido del dueño, 29/10/2026).
    return llenarExcel(archivo, valoresDe(datos), imagenes, gruposDe(datos))
  }

  async function descargar(como: 'excel' | 'pdf') {
    setError(null)
    setAviso(null)
    try {
      const lleno = await armarExcel()
      if (!lleno) return
      if (como === 'excel') guardarExcel(lleno, `Inspeccion-${i.numero}-${i.plantillas?.nombre ?? 'formato'}`)
      else setVistaPdf(vistaDeExcel(await partes(lleno)))
    } catch (e) {
      setError(`No se pudo armar el ${como === 'excel' ? 'Excel' : 'PDF'}: ${(e as Error).message}`)
    }
  }

  return (
    <div className="detalle detalle-inspeccion">
      <button className="btn-link volver no-imprimir" type="button" onClick={() => ir('/inspecciones')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inspecciones
      </button>
      <header className="detalle-cab fila-entre">
        <div>
          <h1>
            Inspección N.º {i.numero} · {i.plantillas?.nombre}
          </h1>
          <p>
            {v?.codigo_formato ? `${v.codigo_formato} · ` : ''}
            {v?.version_formato ? `Versión ${v.version_formato} · ` : ''}v{v?.numero} del formato en CRC
          </p>
        </div>
        <div className="acciones no-imprimir">
          <button className="btn-sec" type="button" onClick={() => void descargar('excel')}>
            <FileSpreadsheet size={18} aria-hidden="true" /> Excel
          </button>
          {/* PDF idéntico al Excel de la organización (revisión LOTO, 29/10/2026). */}
          <button className="btn-sec" type="button" onClick={() => void descargar('pdf')}>
            <FileText size={18} aria-hidden="true" /> PDF
          </button>
          {/* Con Excel de la organización, «Imprimir» saca esa misma hoja (como el PDF); sin él, la hoja simple de CRC. */}
          <button className="btn-link" type="button" onClick={() => (tieneExcel ? void descargar('pdf') : window.print())}>
            <Printer size={18} aria-hidden="true" /> Imprimir
          </button>
        </div>
      </header>
      <Aviso>{error}</Aviso>
      {aviso && <p className="aviso-suave">{aviso}</p>}
      {i.estado === 'anulada' && (
        <p className="aviso-suave">
          <Ban size={16} aria-hidden="true" /> Anulada el {fechaHora(i.anulada_en!)}: {i.motivo_anulacion}
        </p>
      )}

      <dl className="ficha">
        <div><dt>Fecha</dt><dd>{fechaPeru(i.fecha)}</dd></div>
        <div><dt>Resultado</dt><dd>{i.resultado ?? 'Realizado'}{i.puntaje != null ? ` · ${i.puntaje} %` : ''}</dd></div>
        <div><dt>Inspector</dt><dd>{nombre(i.inspector_id)}</dd></div>
        <div><dt>Lugar</dt><dd>{[i.sedes?.nombre, i.unidades?.nombre, i.ubicaciones?.nombre].filter(Boolean).join(' · ')}</dd></div>
        {i.activo_foto && <div><dt>Activo</dt><dd>{i.activo_foto.tipo} {i.activo_foto.codigo}</dd></div>}
        <div><dt>Cerrada en el equipo</dt><dd>{fechaHora(i.cerrada_en_equipo)} · recibida {fechaHora(i.recibida_en)}</dd></div>
      </dl>
      {i.avisos.length > 0 && (
        <ul className="avisos-inspeccion">
          {i.avisos.map((a) => (
            <li key={a}>{NOMBRE_AVISO[a] ?? a}</li>
          ))}
        </ul>
      )}

      {i.hallazgos.length > 0 && (
        <Seccion titulo={`Hallazgos (${i.hallazgos.length})`}>
          <ul className="hallazgos">
            {i.hallazgos.map((h, k) => (
              <li key={k}>
                <b>{h.clave}</b> {h.texto}
                {h.accion?.texto && <small> · Acción: {h.accion.texto}{h.accion.responsable ? ` · ${nombre(h.accion.responsable) || h.accion.responsable}` : ''}{h.accion.plazo ? ` · plazo ${fechaPeru(h.accion.plazo)}` : ''}</small>}
              </li>
            ))}
          </ul>
          <button className="btn-link no-imprimir" type="button" onClick={() => ir(`/hallazgos/${i.id}`)}>
            Ver el seguimiento de estos hallazgos
          </button>
        </Seccion>
      )}

      {modo === 'corregir' && receta ? (
        <Corregir key={i.edicion} d={d} copia={copia} onListo={() => (setModo('ver'), cargar())} onCancelar={() => setModo('ver')} />
      ) : (
        <Seccion titulo="Respuestas">
          {secciones.map((s) => (
            <div key={s.clave} className="prueba-seccion">
              <h3>{s.titulo}</h3>
              {s.repetible
                ? (i.filas[s.clave] ?? []).map((fila, k) => (
                    <div key={k} className="prueba-fila">
                      <b>{s.titulo} {k + 1}</b>
                      {s.puntos.map((p) => <RespuestaVista key={p.clave} p={p} r={fila[p.clave]} fotos={fotosDe(p.clave, k)} nombre={nombre} />)}
                    </div>
                  ))
                : s.puntos.filter((p) => puntoVisible(p, i.respuestas)).map((p) => <RespuestaVista key={p.clave} p={p} r={i.respuestas[p.clave]} fotos={fotosDe(p.clave, null)} nombre={nombre} />)}
              {s.repetible && !(i.filas[s.clave] ?? []).length && <p className="nota">Sin filas.</p>}
            </div>
          ))}
          {i.observacion && <p><b>Observación general:</b> {i.observacion}</p>}
        </Seccion>
      )}

      {/* Un formato sin firmas (extintores) no muestra esta parte. */}
      {d.firmas.length > 0 && (
        <Seccion titulo="Firmas">
          <ul className="lista">
            {d.firmas.map((f) => (
              <FirmaVista key={f.id} f={f} nombre={nombre} puedePapel={puedePapel && online} onCambio={cargar} edicionActual={i.edicion} />
            ))}
          </ul>
        </Seccion>
      )}

      {d.ediciones.length > 0 && (
        <Seccion titulo="Historial de correcciones">
          <ul className="lista">
            {d.ediciones.map((e) => (
              <li key={e.id}>
                <Pencil aria-hidden="true" />
                <div>
                  <b>Corrección de la edición {e.edicion}</b>
                  <small>{fechaHora(e.hecho_en)} · {nombre(e.hecho_por)} · {e.motivo}</small>
                </div>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {esAdmin && i.estado === 'cerrada' && modo === 'ver' && (
        <div className="acciones no-imprimir">
          <button className="btn-sec" type="button" disabled={!online} onClick={() => setModo('corregir')}>
            <Pencil size={18} aria-hidden="true" /> Corregir
          </button>
          <button className="btn-link peligro" type="button" disabled={!online} onClick={() => setModo('anular')}>
            <Ban size={18} aria-hidden="true" /> Anular
          </button>
          {!online && <span className="nota">Corregir y anular necesitan señal.</span>}
        </div>
      )}
      {modo === 'anular' && <Anular id={i.id} onListo={() => (setModo('ver'), cargar())} onCancelar={() => setModo('ver')} />}
      {/* Desde «Registros» se puede pedir el Excel o el PDF directo: se descarga una vez que está lista la copia del equipo. */}
      {auto && copia && <AutoDescarga onListo={() => void descargar(auto)} />}
      {createPortal(vistaPdf ? <VistaExcel vista={vistaPdf.vista} medias={vistaPdf.medias} /> : <HojaImpresa d={d} copia={copia} nombre={nombre} />, document.body)}
    </div>
  )
}

/** Lo que sale al imprimir: una hoja simple con las respuestas y espacio para firmar a mano (sin Excel de la organización). */
function HojaImpresa({ d, copia, nombre }: { d: Detalle; copia: CopiaLocal | null; nombre: (id: string) => string }) {
  const i = d.inspeccion
  const v = i.plantillas_versiones
  const secciones = v ? seccionesVisibles(v.receta, i.activo_foto?.subtipo ?? null) : []
  const valor = (p: Punto, r: Respuesta | undefined) => {
    const x = r?.valor
    if (p.tipo === 'foto') return `${d.archivos.filter((a) => a.punto_clave === p.clave).length} foto(s)`
    if (x == null || x === '') return ''
    if (p.tipo === 'cumple') return TEXTO[String(x)]
    if (p.tipo === 'si_no') return x === 'si' ? 'Sí' : 'No'
    if (p.tipo === 'persona') return nombre(String(x))
    if (p.tipo === 'fecha') return fechaPeru(String(x))
    return String(x)
  }
  const fila = (p: Punto, r: Respuesta | undefined, pre = '') => (
    <tr key={pre + p.clave}>
      <td>{p.clave}</td>
      <td>{p.texto}</td>
      <td>{valor(p, r)}</td>
      <td>{[r?.obs, r?.accion?.texto].filter(Boolean).join(' · ')}</td>
    </tr>
  )
  return (
    <div className="hoja-entrega hoja-inspeccion">
      <h1>{i.plantillas?.nombre}</h1>
      <p>
        {copia?.empresa.razon_social} · RUC {copia?.empresa.ruc}
        {v?.codigo_formato ? ` · Código ${v.codigo_formato}` : ''}
        {v?.version_formato ? ` · Versión ${v.version_formato}` : ''}
        {v?.fecha_aprobacion ? ` · Aprobado ${fechaPeru(v.fecha_aprobacion)}` : ''}
      </p>
      <p>
        Inspección N.º {i.numero} · {fechaPeru(i.fecha)} · {[i.sedes?.nombre, i.unidades?.nombre, i.ubicaciones?.nombre].filter(Boolean).join(' · ')}
        {i.activo_foto ? ` · ${i.activo_foto.tipo} ${i.activo_foto.codigo}` : ''} · Inspector: {nombre(i.inspector_id)}
      </p>
      <p>
        Resultado: <b>{i.resultado ?? 'Realizado'}</b>
        {i.puntaje != null ? ` · Puntaje ${i.puntaje} %` : ''}
        {i.estado === 'anulada' ? ` · ANULADA: ${i.motivo_anulacion}` : ''}
      </p>
      <table>
        <thead>
          <tr><th>Clave</th><th>Punto</th><th>Respuesta</th><th>Observación / acción</th></tr>
        </thead>
        <tbody>
          {secciones.flatMap((s) =>
            s.repetible
              ? (i.filas[s.clave] ?? []).flatMap((f, k) => s.puntos.filter((p) => p.tipo !== 'calculo').map((p) => fila(p, f[p.clave], `${s.clave}${k}`)))
              : s.puntos.filter((p) => p.tipo !== 'calculo').map((p) => fila(p, i.respuestas[p.clave])),
          )}
        </tbody>
      </table>
      {i.observacion && <p>Observación general: {i.observacion}</p>}
      {d.firmas.length > 0 && (
        <table className="firmas-papel">
          <thead>
            <tr><th>Firma</th><th>Nombre</th><th>Firma a mano</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {d.firmas.map((f) => (
              <tr key={f.id}>
                <td>{f.rol_titulo}</td>
                <td>{f.persona_id ? nombre(f.persona_id) : f.externo_nombre}{f.externo_documento ? ` · ${f.externo_documento}` : ''}</td>
                <td>{f.estado === 'firmada' ? 'Firmada en CRC' : ''}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Huella de la inspección: {i.huella.slice(0, 16)}</p>
    </div>
  )
}

function RespuestaVista({ p, r, fotos, nombre }: { p: Punto; r: Respuesta | undefined; fotos: ArchivoServidor[]; nombre: (id: string) => string }) {
  const v = r?.valor
  const texto = v == null || v === '' ? '—' : p.tipo === 'cumple' ? TEXTO[String(v)] : p.tipo === 'si_no' ? (v === 'si' ? 'Sí' : 'No') : p.tipo === 'persona' ? nombre(String(v)) : p.tipo === 'fecha' ? fechaPeru(String(v)) : `${v}${p.unidad ? ` ${p.unidad}` : ''}`
  if (p.tipo === 'calculo') return null
  return (
    <div className={`prueba-punto ${v === 'no' ? 'no-cumple' : ''}`}>
      <p>
        <code>{p.clave}</code> {p.texto}: <b>{p.tipo === 'foto' ? `${fotos.length} foto(s)` : texto}</b>
      </p>
      {r?.obs && <small>Observación: {r.obs}</small>}
      {r?.accion?.texto && <small>Acción: {r.accion.texto}{r.accion.responsable ? ` · ${nombre(r.accion.responsable)}` : ''}{r.accion.plazo ? ` · plazo ${fechaPeru(r.accion.plazo)}` : ''}</small>}
      {fotos.length > 0 && (
        <div className="fotos-punto">
          {fotos.map((f) => (
            <FotoServidor key={f.id} ruta={f.ruta} />
          ))}
        </div>
      )}
    </div>
  )
}

function FotoServidor({ ruta, alt = 'Foto de la inspección' }: { ruta: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    enlaceEvidencia(ruta).then(setUrl, () => {})
  }, [ruta])
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="mini-foto">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  ) : (
    <span className="mini-foto"><span className="mini-vacia" /></span>
  )
}

function FirmaVista({ f, nombre, puedePapel, onCambio, edicionActual }: { f: FirmaServidor; nombre: (id: string) => string; puedePapel: boolean; onCambio: () => void; edicionActual: number }) {
  const [error, setError] = useState<string | null>(null)
  const [texto, clase] = ESTADO_FIRMA[f.estado]
  return (
    <li>
      <span className="firma-mini">{f.imagen_ruta ? <FotoServidor ruta={f.imagen_ruta} alt="Firma" /> : null}</span>
      <div>
        <b>{f.rol_titulo}: {f.persona_id ? nombre(f.persona_id) : `${f.externo_nombre} (externo)`}</b>
        <span className={`chip ${clase}`}>{texto}</span>
        {f.estado === 'firmada' && f.edicion != null && f.edicion < edicionActual && <span className="chip chip-aviso">Firmó una versión anterior</span>}
        <small>{f.firmado_en ? fechaHora(f.firmado_en) : f.externo_documento ? `Documento ${f.externo_documento}` : ''}</small>
        {error && <small className="error-linea">{error}</small>}
      </div>
      {puedePapel && f.estado === 'pendiente' && (
        <span className="lista-acciones">
          <button className="btn-link" type="button" onClick={() => marcarEnPapel(f.id).then(onCambio, (e) => setError((e as Error).message))}>
            Firmó en papel
          </button>
        </span>
      )}
    </li>
  )
}

function Anular({ id, onListo, onCancelar }: { id: string; onListo: () => void; onCancelar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="subform">
      <label className="field">
        <span>Motivo de la anulación</span>
        <input type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <p className="nota">La inspección no se borra: queda marcada como anulada, con el motivo.</p>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn peligro" type="button" disabled={motivo.trim().length < 3}
          onClick={() => anularInspeccion(id, motivo).then(onListo, (e) => setError((e as Error).message))}>
          Anular
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

/** Corregir con señal: se cambian respuestas y observación (no las fotos), con motivo. El servidor recalcula. */
function Corregir({ d, copia, onListo, onCancelar }: { d: Detalle; copia: CopiaLocal | null; onListo: () => void; onCancelar: () => void }) {
  const i = d.inspeccion
  const receta = i.plantillas_versiones!.receta
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>(i.respuestas)
  const [filas, setFilas] = useState<Record<string, Fila[]>>(i.filas)
  const [observacion, setObservacion] = useState(i.observacion ?? '')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const props = (p: Punto) => ({
    punto: p, listas: copia?.listas ?? [], personas: copia?.personas ?? [], cantidad: null, calculo: '—', fotos: [], sinEspacio: true, sinFotos: true,
    onFoto: () => {}, onQuitarFoto: () => {},
  })
  async function guardar() {
    setOcupado(true)
    setError(null)
    try {
      await corregirInspeccion({ id: i.id, edicion: i.edicion, motivo, respuestas, filas, observacion: observacion || null })
      onListo()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }
  return (
    <Seccion titulo="Corregir respuestas">
      <p className="nota">Las fotos y las firmas no cambian. Las firmas hechas quedarán marcadas como de una versión anterior.</p>
      {seccionesVisibles(receta, i.activo_foto?.subtipo ?? null).map((s) => (
        <div key={s.clave} className="prueba-seccion">
          <h3>{s.titulo}</h3>
          {s.repetible
            ? (filas[s.clave] ?? []).map((fila, k) => (
                <div key={k} className="prueba-fila">
                  <b>{s.titulo} {k + 1}</b>
                  {s.puntos.map((p) => (
                    <PuntoCampo key={p.clave} {...props(p)} respuesta={fila[p.clave]}
                      onCambio={(r) => setFilas((x) => ({ ...x, [s.clave]: x[s.clave].map((f, j) => (j === k ? { ...f, [p.clave]: r } : f)) }))} />
                  ))}
                </div>
              ))
            : s.puntos.filter((p) => puntoVisible(p, respuestas)).map((p) => <PuntoCampo key={p.clave} {...props(p)} respuesta={respuestas[p.clave]} onCambio={(r) => setRespuestas((x) => sinOcultas(receta, { ...x, [p.clave]: r }))} />)}
        </div>
      ))}
      {receta.observacion_general && (
        <label className="field">
          <span>Observación general</span>
          <textarea rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Motivo de la corrección</span>
        <input type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="button" disabled={ocupado || motivo.trim().length < 3} onClick={() => void guardar()}>
          {ocupado ? 'Guardando…' : 'Guardar corrección'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </Seccion>
  )
}

/** Corre una sola vez al aparecer (para la descarga directa de un registro). */
function AutoDescarga({ onListo }: { onListo: () => void }) {
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    onListo()
  }, [onListo])
  return null
}
