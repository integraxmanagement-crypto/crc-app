import { FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { db, mensaje, rpc } from '../empresas/datos'
import type { Receta } from '../formatos/receta'
import { EXCEL_MAX_BYTES, marcasDeExcel, marcasDesconocidas } from './excel'

type Excel = { ruta: string; nombre_archivo: string; bytes: number; marcas: string[]; subido_en: string }

/**
 * Excel de la organización para este formato (tarea 3.4-C, decisión del dueño 26/10/2026). La organización sube su
 * formato en Excel con marcas {{…}}; CRC llena una copia por inspección, sin firmas, para firmarla a mano.
 */
export function ExcelFormato({ plantillaId, empresaId, receta, puedeEditar }: { plantillaId: string; empresaId: string; receta: Receta; puedeEditar: boolean }) {
  const [excel, setExcel] = useState<Excel | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(() => {
    db().from('plantillas_excel').select('ruta, nombre_archivo, bytes, marcas, subido_en').eq('plantilla_id', plantillaId).maybeSingle()
      .then(({ data, error: e }) => (e ? setError(mensaje(e)) : setExcel(data as Excel | null)))
  }, [plantillaId])
  useEffect(cargar, [cargar])

  async function subir(archivo: File) {
    setError(null)
    setOk(null)
    if (!archivo.name.toLowerCase().endsWith('.xlsx')) return setError('Sube el formato como Excel .xlsx.')
    if (archivo.size > EXCEL_MAX_BYTES) return setError('El Excel pesa más de 1 MB. Quita imágenes grandes o hojas que no se usan.')
    setOcupado(true)
    try {
      const marcas = await marcasDeExcel(new Uint8Array(await archivo.arrayBuffer()))
      if (!marcas.length) throw new Error('El Excel no tiene marcas {{…}}: escribe, por ejemplo, {{razon_social}} o {{EXT-01}} en las celdas donde van los datos.')
      const ruta = `${empresaId}/${plantillaId}-${Date.now()}.xlsx`
      const { error: e } = await db().storage.from('formatos-excel').upload(ruta, archivo, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      if (e) throw new Error(mensaje(e))
      await rpc<void>('registrar_excel', { p_plantilla: plantillaId, p_ruta: ruta, p_nombre: archivo.name, p_bytes: archivo.size, p_marcas: marcas })
      const raras = marcasDesconocidas(marcas, receta)
      setOk(`Excel guardado con ${marcas.length} marca(s).${raras.length ? ` Estas no corresponden a este formato y quedarán en blanco: ${raras.join(', ')}.` : ''}`)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function quitar() {
    setOcupado(true)
    setError(null)
    try {
      await rpc<void>('quitar_excel', { p_plantilla: plantillaId })
      setOk('Se quitó el Excel. Las inspecciones se imprimirán con la hoja simple de CRC.')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const raras = excel ? marcasDesconocidas(excel.marcas, receta) : []
  return (
    <Seccion titulo="Excel de la organización (hoja para firmar a mano)">
      <p className="nota">
        Sube tu formato en Excel (.xlsx, hasta 1 MB) y escribe marcas entre llaves dobles donde van los datos: {'{{razon_social}}'}, {'{{fecha}}'},{' '}
        {'{{inspector}}'}, la clave de cada punto ({'{{'}
        {receta.secciones[0]?.puntos[0]?.clave ?? 'CLAVE'}
        {'}}'}) o {'{{CLAVE.si}}'} / {'{{CLAVE.no}}'} / {'{{CLAVE.na}}'} para marcar una «X» en la columna que toca. Cada inspección se descarga
        llena y sin firmas.
      </p>
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      {excel === undefined ? (
        <p className="nota">Cargando…</p>
      ) : excel ? (
        <ul className="lista">
          <li>
            <FileSpreadsheet aria-hidden="true" />
            <div>
              <b>{excel.nombre_archivo}</b>
              <small>
                {excel.marcas.length} marca(s) · subido el {new Date(excel.subido_en).toLocaleDateString('es-PE')}
                {raras.length ? ` · sin dato en este formato: ${raras.join(', ')}` : ''}
              </small>
            </div>
            {puedeEditar && (
              <span className="lista-acciones">
                <button className="btn-link" type="button" disabled={ocupado} onClick={() => void quitar()}>
                  <Trash2 size={16} aria-hidden="true" /> Quitar
                </button>
              </span>
            )}
          </li>
        </ul>
      ) : (
        <p className="nota">Sin Excel: al imprimir sale la hoja simple de CRC.</p>
      )}
      {puedeEditar && (
        <label className="btn-sec boton-foto">
          <Upload size={18} aria-hidden="true" /> {ocupado ? 'Subiendo…' : excel ? 'Reemplazar Excel' : 'Subir Excel'}
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden disabled={ocupado}
            onChange={(e) => {
              const a = e.target.files?.[0]
              if (a) void subir(a)
              e.target.value = ''
            }} />
        </label>
      )}
    </Seccion>
  )
}
