import { BotonEliminar } from '../BotonEliminar'
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Aviso, Seccion } from '../empresas/campos'
import { type CambioColumnas, cambiarColumnas, proponerCambioColumnas, propuestasPendientes } from './datos'
import { TarjetasConfig } from './TarjetasConfig'
import { BASE_CAMBIA_TIPO, type Columna, type Matriz, NOMBRE_TIPO, type Tarjeta, TIPOS_NUEVA, esAutomatica } from './reglas'

type Borrador = { clave: string | null; nombre: string; tipo: string; opciones: string; obligatoria: boolean }
const NUEVA: Borrador = { clave: null, nombre: '', tipo: 'texto', opciones: '', obligatoria: false }
const TIPOS_BASE_EDITABLES: [string, string][] = [['texto', 'Letras (texto libre)'], ['lista', 'Lista desplegable: una opción'], ['multiple', 'Lista desplegable: varias opciones']]

/**
 * Configuración de las columnas de la matriz (por sede). El administrador general o de sede cambia directo; el gestor propone y un administrador
 * aprueba o deniega desde «Solicitudes». Las columnas base no se eliminan (se ocultan). Eliminar una columna agregada borra sus datos de esa sede.
 */
export function ConfigurarColumnas({ sedeId, matriz, columnas, tarjetas, esAdmin, online, onCambio }: { sedeId: string; matriz: Matriz; columnas: Columna[]; tarjetas: Tarjeta[]; esAdmin: boolean; online: boolean; onCambio: () => Promise<void> }) {
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  useEffect(() => {
    if (!esAdmin) propuestasPendientes(sedeId).then(setPendientes, () => {})
  }, [sedeId, esAdmin, aviso])

  async function enviar(cambio: CambioColumnas, confirmar?: string) {
    setError(null)
    setAviso(null)
    if (confirmar && !window.confirm(confirmar)) return
    if (!esAdmin && motivo.trim().length < 3) return setError('Escribe el motivo de tu propuesta.')
    setOcupado(true)
    try {
      if (esAdmin) {
        await cambiarColumnas(sedeId, cambio, matriz)
        setAviso('Cambio hecho.')
      } else {
        await proponerCambioColumnas(sedeId, cambio, motivo.trim(), matriz)
        setAviso('Propuesta enviada. Un administrador la aprobará o la denegará; hasta entonces la matriz sigue igual.')
        setMotivo('')
      }
      setBorrador(null)
      await onCambio()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function guardarBorrador() {
    if (!borrador) return
    const opciones = borrador.opciones.split('\n').map((o) => o.trim()).filter(Boolean)
    const conLista = borrador.tipo === 'lista' || borrador.tipo === 'multiple'
    if (borrador.nombre.trim().length < 2) return setError('Escribe el nombre de la columna.')
    if (conLista && !opciones.length) return setError('Escribe al menos una opción, una por línea.')
    const cambio: CambioColumnas = borrador.clave
      ? { operacion: 'modificar', clave: borrador.clave, nombre: borrador.nombre.trim(), tipo: borrador.tipo, ...(conLista ? { opciones } : {}), obligatoria: borrador.obligatoria }
      : { operacion: 'agregar', nombre: borrador.nombre.trim(), tipo: borrador.tipo, ...(conLista ? { opciones } : {}), obligatoria: borrador.obligatoria }
    void enviar(cambio)
  }

  const editar = (c: Columna) => setBorrador({ clave: c.clave, nombre: c.nombre, tipo: c.tipo, opciones: c.opciones.join('\n'), obligatoria: c.obligatoria })
  const tiposPara = (c: Columna | undefined): [string, string][] =>
    !c ? TIPOS_NUEVA : c.es_base ? (BASE_CAMBIA_TIPO.includes(c.clave) ? TIPOS_BASE_EDITABLES : []) : TIPOS_NUEVA
  const original = borrador?.clave ? columnas.find((c) => c.clave === borrador.clave) : undefined
  const tipos = tiposPara(original)

  return (
    <Seccion titulo={esAdmin ? 'Configurar las columnas de esta sede' : 'Proponer cambios a las columnas'}>
      {esAdmin ? (
        <p className="nota">Agrega, oculta o elimina columnas, y cambia su tipo, sus opciones y si son obligatorias. Los cambios valen para esta sede.</p>
      ) : (
        <>
          <p className="nota">Tu propuesta se envía a los administradores. Si la aprueban, se hace el cambio; si la deniegan, la matriz queda como está.</p>
          {pendientes > 0 && <p className="aviso-suave">Hay {pendientes} {pendientes === 1 ? 'propuesta esperando' : 'propuestas esperando'} respuesta en esta sede.</p>}
          <label className="field">
            <span>Motivo de la propuesta</span>
            <input type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
        </>
      )}
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{aviso}</Aviso>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th scope="col">Columna</th><th scope="col">Tipo</th><th scope="col">Obligatoria</th><th scope="col">En la matriz</th><th scope="col"><span className="solo-lectores">Acciones</span></th></tr>
          </thead>
          <tbody>
            {columnas.map((c) => (
              <tr key={c.clave}>
                <td>{c.nombre}{c.es_base && <small> · base</small>}</td>
                <td>{NOMBRE_TIPO[c.tipo]}{c.opciones.length > 0 && <small> ({c.opciones.length} opciones)</small>}</td>
                <td>{esAutomatica(c) ? 'No aplica' : c.obligatoria ? <span className="chip chip-aviso">* Obligatoria</span> : 'No'}</td>
                <td>{c.visible ? 'Visible' : <span className="chip chip-gris">Oculta</span>}</td>
                <td className="acciones">
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => editar(c)}><Pencil size={14} aria-hidden="true" /> Editar</button>
                  <button className="btn-link" type="button" disabled={ocupado} onClick={() => void enviar({ operacion: c.visible ? 'ocultar' : 'mostrar', clave: c.clave })}>
                    {c.visible ? <><EyeOff size={14} aria-hidden="true" /> Ocultar</> : <><Eye size={14} aria-hidden="true" /> Mostrar</>}
                  </button>
                  {!c.es_base && (
                    <BotonEliminar etiqueta={`Eliminar la columna ${c.nombre} (se borran sus datos en esta sede)`} verbo="eliminar" disabled={ocupado} onEliminar={() => void enviar({ operacion: 'eliminar', clave: c.clave })} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!borrador && (
        <div className="acciones">
          <button className="btn" type="button" onClick={() => setBorrador(NUEVA)}><Plus size={18} aria-hidden="true" /> Agregar columna</button>
        </div>
      )}
      {borrador && (
        <form className="subform" onSubmit={(e) => { e.preventDefault(); guardarBorrador() }}>
          <h3>{borrador.clave ? 'Editar columna' : 'Agregar columna'}</h3>
          <label className="field"><span>Nombre</span>
            <input type="text" maxLength={60} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} /></label>
          {tipos.length > 0 ? (
            <label className="field"><span>Tipo de dato</span>
              <select value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value })}>
                {tipos.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></label>
          ) : (
            <p className="nota">Tipo: {original ? NOMBRE_TIPO[original.tipo] : ''} (no se puede cambiar).</p>
          )}
          {(borrador.tipo === 'lista' || borrador.tipo === 'multiple') && (
            <label className="field"><span>Opciones (una por línea)</span>
              <textarea rows={5} value={borrador.opciones} onChange={(e) => setBorrador({ ...borrador, opciones: e.target.value })} /></label>
          )}
          {!(original && esAutomatica(original)) && (
            <label className="check-linea"><input type="checkbox" checked={borrador.obligatoria} onChange={(e) => setBorrador({ ...borrador, obligatoria: e.target.checked })} /> Obligatoria al cargar una condición</label>
          )}
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : esAdmin ? 'Guardar cambio' : 'Enviar propuesta'}</button>
            <button className="btn-sec" type="button" disabled={ocupado} onClick={() => setBorrador(null)}>Cancelar</button>
          </div>
        </form>
      )}
      {esAdmin && <TarjetasConfig sedeId={sedeId} matriz={matriz} columnas={columnas} tarjetas={tarjetas} online={online} onCambio={onCambio} />}
    </Seccion>
  )
}
