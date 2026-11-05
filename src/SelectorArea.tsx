import { useMemo, useState } from 'react'
import { opcionesArea } from './areas'
import { Combo } from './Combo'
import { Aviso } from './empresas/campos'
import { type Unidad, caminoUnidad, guardarUnidad } from './usuarios/datos'

/**
 * Campo «Área» con autocompletado (pedido del dueño, 05/11/2026): se escribe y la lista se filtra; si no existe aparece «Crear nueva área».
 * Sin señal no se puede crear: el texto escrito se conserva y se vincula cuando haya señal.
 */
export function SelectorArea({ empresaId, unidades, texto, elegido, onCambio, onUnidadesCambio, etiqueta = 'Área', marca, requerido, online }: {
  empresaId: string
  unidades: Unidad[]
  texto: string
  elegido: string | null
  onCambio: (texto: string, id: string | null) => void
  onUnidadesCambio?: () => void
  etiqueta?: string
  marca?: React.ReactNode
  requerido?: boolean
  online: boolean
}) {
  const opciones = useMemo(() => opcionesArea(unidades), [unidades])
  const [nueva, setNueva] = useState<string | null>(null)
  const [dentro, setDentro] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const padres = useMemo(() => {
    const v = unidades.filter((u) => u.vigente && caminoUnidad(unidades, u.id).vigente)
    return [...v.filter((u) => u.nivel === 'gerencia').map((u) => ({ id: u.id, texto: `Área nueva dentro de la gerencia «${u.nombre}»`, nivel: 'area' as const })),
      ...v.filter((u) => u.nivel === 'area').map((u) => ({ id: u.id, texto: `Línea nueva dentro del área «${u.nombre}»`, nivel: 'subarea' as const }))]
  }, [unidades])

  async function crear() {
    const padre = padres.find((p) => p.id === dentro)
    if (!nueva || !padre) return setError('Elige dónde va la nueva área.')
    setError(null)
    setOcupado(true)
    try {
      const id = await guardarUnidad(empresaId, null, padre.nivel, padre.id, nueva)
      onUnidadesCambio?.()
      onCambio(nueva, id)
      setNueva(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Combo etiqueta={etiqueta} marca={marca} opciones={opciones} texto={texto} elegido={elegido} requerido={requerido}
        placeholder="Escribe para buscar el área"
        onTexto={(t) => onCambio(t, null)} onElegir={(o) => o && onCambio(o.texto, o.id)}
        crear={{ rotulo: (e) => `Crear nueva área «${e}»`, onCrear: (e) => { setNueva(e); setDentro(padres[0]?.id ?? ''); setError(null) } }} />
      {nueva && (
        <div className="subform combo-crear-form" role="group" aria-label="Crear nueva área">
          <p><b>Crear «{nueva}»</b></p>
          {!online ? (
            <p className="aviso-suave">Sin señal no se puede crear el área. Se guardará el texto «{nueva}» y se vinculará cuando haya señal.</p>
          ) : !padres.length ? (
            <p className="aviso-suave">Primero hay que crear una gerencia en «Información de la empresa › Estructura y puestos».</p>
          ) : (
            <label className="field">
              <span>¿Dónde va?</span>
              <select value={dentro} onChange={(e) => setDentro(e.target.value)}>
                {padres.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
              </select>
            </label>
          )}
          <Aviso>{error}</Aviso>
          <div className="acciones">
            {online && padres.length > 0 && <button className="btn" type="button" disabled={ocupado} onClick={() => void crear()}>{ocupado ? 'Creando…' : 'Crear área'}</button>}
            <button className="btn-sec" type="button" disabled={ocupado} onClick={() => setNueva(null)}>{online && padres.length ? 'Cancelar' : 'Entendido'}</button>
          </div>
        </div>
      )}
    </>
  )
}
