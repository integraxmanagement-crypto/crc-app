import { Pencil } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Aviso, Campo, Dato, Seccion } from './campos'
import { type Contacto, type Contactos as TContactos, type TipoContacto, guardarContactos } from './datos'

const TIPOS: { tipo: TipoContacto; nombre: string; opcional?: boolean }[] = [
  { tipo: 'representante_legal', nombre: 'Representante legal' },
  { tipo: 'administrador', nombre: 'Administrador de contacto' },
  { tipo: 'respaldo', nombre: 'Contacto de respaldo', opcional: true },
]
const vacio: Contacto = { nombre: '', telefono: '', correo: '' }

/** Contactos de la empresa (datos personales): solo los ven el dueño y el administrador de esa empresa. */
export function Contactos({ empresaId, contactos, editable, onCambio }: { empresaId: string; contactos: TContactos; editable: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState<Record<TipoContacto, Contacto>>(() => leer(contactos))
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cambiar = (tipo: TipoContacto, campo: keyof Contacto) => (e: { target: { value: string } }) =>
    setDatos((d) => ({ ...d, [tipo]: { ...d[tipo], [campo]: e.target.value } }))

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const r = datos.respaldo
      const respaldoVacio = !r.nombre.trim() && !r.telefono.trim() && !r.correo.trim()
      await guardarContactos(empresaId, {
        representante_legal: datos.representante_legal,
        administrador: datos.administrador,
        ...(respaldoVacio ? {} : { respaldo: r }),
      })
      setEditando(false)
      setOk('Contactos guardados.')
      onCambio()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Seccion
      titulo="Contactos"
      accion={
        editable && !editando ? (
          <button className="btn-sec" type="button" onClick={() => { setDatos(leer(contactos)); setOk(null); setEditando(true) }}>
            <Pencil size={18} aria-hidden="true" /> Editar
          </button>
        ) : null
      }
    >
      {!editando ? (
        <>
          <div className="contactos">
            {TIPOS.map(({ tipo, nombre }) => {
              const c = contactos[tipo]
              return (
                <dl className="ficha" key={tipo}>
                  <Dato etiqueta={nombre} valor={c?.nombre} />
                  <Dato etiqueta="Teléfono" valor={c?.telefono} />
                  <Dato etiqueta="Correo" valor={c?.correo} />
                </dl>
              )
            })}
          </div>
          <Aviso tipo="ok">{ok}</Aviso>
          <p className="nota">Son datos personales: solo los ven Integrax y el administrador de la empresa.</p>
        </>
      ) : (
        <form className="form subform" onSubmit={guardar} noValidate>
          {TIPOS.map(({ tipo, nombre, opcional }) => (
            <fieldset key={tipo}>
              <legend>
                {nombre}
                {opcional && <em className="opcional"> (opcional)</em>}
              </legend>
              <Campo etiqueta="Apellidos y nombres" value={datos[tipo].nombre} onChange={cambiar(tipo, 'nombre')} maxLength={200} autoComplete="off" />
              <div className="fila2">
                <Campo etiqueta="Teléfono" value={datos[tipo].telefono} onChange={cambiar(tipo, 'telefono')} inputMode="tel" maxLength={20} autoComplete="off" placeholder="987654321" />
                <Campo etiqueta="Correo" value={datos[tipo].correo} onChange={cambiar(tipo, 'correo')} inputMode="email" type="email" maxLength={200} autoComplete="off" />
              </div>
            </fieldset>
          ))}
          <Aviso>{error}</Aviso>
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar contactos'}
            </button>
            <button className="btn-link" type="button" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Seccion>
  )
}

function leer(c: TContactos): Record<TipoContacto, Contacto> {
  return {
    representante_legal: { ...vacio, ...c.representante_legal },
    administrador: { ...vacio, ...c.administrador },
    respaldo: { ...vacio, ...c.respaldo },
  }
}
