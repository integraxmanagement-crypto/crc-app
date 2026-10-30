import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ir } from '../ruta'
import { db } from './datos'

type Version = { estado: string; numero: number; codigo_formato: string | null; version_formato: string | null; fecha_aprobacion: string | null }
type Falta = { id: string; nombre: string; numero: number | null; estado: string; faltan: string[]; ruta: string }

/**
 * Alerta de formatos y programas anuales sin código, versión o fecha de aprobación (revisión de diseño, 29/10/2026): esos
 * datos van en el encabezado del Excel y del PDF. En los formatos se mira la versión vigente o, si no hay, el borrador.
 */
export function FormatosIncompletos({ empresaId, rutaFormatos }: { empresaId: string; rutaFormatos: string }) {
  const [lista, setLista] = useState<Falta[] | null>(null)

  useEffect(() => {
    const programas = db().from('passt_programas').select('id, nombre, estado, codigo_formato, version_formato, fecha_aprobacion').eq('empresa_id', empresaId).eq('vigente', true)
    Promise.all([programas, db().from('plantillas').select('id, nombre, versiones:plantillas_versiones(estado, numero, codigo_formato, version_formato, fecha_aprobacion)')
      .eq('empresa_id', empresaId).eq('vigente', true).order('nombre')]).then(([pr, { data }]) => {
        const salida: Falta[] = []
        for (const x of pr.data ?? []) {
          const faltan = [!x.codigo_formato?.trim() && 'código', !x.version_formato?.trim() && 'versión', !x.fecha_aprobacion && 'fecha de aprobación'].filter((y): y is string => Boolean(y))
          if (faltan.length) salida.push({ id: x.id, nombre: `Programa anual de SST: ${x.nombre}`, numero: null, estado: x.estado, faltan, ruta: `/passt/${x.id}` })
        }
        for (const p of (data ?? []) as { id: string; nombre: string; versiones: Version[] }[]) {
          const v = p.versiones.find((x) => x.estado === 'vigente') ?? p.versiones.find((x) => x.estado === 'borrador')
          if (!v) continue
          const faltan = [!v.codigo_formato?.trim() && 'código', !v.version_formato?.trim() && 'versión', !v.fecha_aprobacion && 'fecha de aprobación'].filter((x): x is string => Boolean(x))
          if (faltan.length) salida.push({ id: p.id, nombre: p.nombre, numero: v.numero, estado: v.estado, faltan, ruta: `${rutaFormatos}/${p.id}` })
        }
        setLista(salida)
      }, () => setLista([]))
  }, [empresaId, rutaFormatos])

  if (!lista?.length) return null
  return (
    <div className="alerta-formatos" role="alert">
      <p>
        <TriangleAlert size={18} aria-hidden="true" /> <b>{lista.length} formato(s) o programa(s) sin código, versión o fecha de aprobación.</b> Esos datos van en el
        encabezado del Excel y del PDF.
      </p>
      <ul>
        {lista.map((f) => (
          <li key={f.id}>
            <span>
              {f.nombre}{f.numero ? ` (v${f.numero}${f.estado === 'borrador' ? ', en borrador' : ''})` : ''} · falta: {f.faltan.join(', ')}
            </span>
            <button className="btn-link" type="button" onClick={() => ir(f.ruta)}>
              Completar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
