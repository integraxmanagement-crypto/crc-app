import { Save } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { BuscadorCiiu } from './BuscadorCiiu'
import { Aviso, Campo } from './campos'
import { type DatosSede, type Empresa, type Ficha, rucValido } from './datos'

const vacia: Ficha = {
  ruc: '',
  razon_social: '',
  nombre_comercial: '',
  domicilio_direccion: '',
  domicilio_distrito: '',
  domicilio_provincia: '',
  domicilio_departamento: '',
  ciiu_codigo: null,
  actividad_texto: '',
  plan: 'gratuito',
  es_prueba: true, // crc-dev es solo de prueba; el entorno de la empresa piloto será otro
}

/**
 * Ficha de la empresa. Al crear, pide además la primera sede (toda empresa tiene al menos una).
 * Solo la ve el dueño de la plataforma; la base de datos rechaza a cualquier otra persona.
 */
export function FormFicha({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Empresa
  onGuardar: (ficha: Ficha, sede: DatosSede | null) => Promise<void>
  onCancelar: () => void
}) {
  const creando = !inicial
  const [f, setF] = useState<Ficha>(() => (inicial ? { ...vacia, ...pick(inicial) } : vacia))
  const [ciiuDesc, setCiiuDesc] = useState(inicial?.catalogo_ciiu?.descripcion ?? null)
  const [copiarDomicilio, setCopiarDomicilio] = useState(true)
  const [sede, setSede] = useState<DatosSede>({ nombre: 'Sede principal', direccion: '', distrito: '', provincia: '', departamento: '' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo: keyof Ficha) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [campo]: e.target.value }))
  const rucCompleto = f.ruc.length === 11
  const rucOk = rucValido(f.ruc)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!rucOk) return setError('El RUC no es válido: deben ser 11 dígitos, empezar con 10, 15, 16, 17 o 20 y el último dígito debe cuadrar.')
    if (!f.ciiu_codigo) return setError('Elige la actividad económica del catálogo CIIU.')
    if (f.es_prueba && !/ficticia/i.test(f.razon_social)) return setError('Una empresa de prueba debe llevar la palabra «Ficticia» en la razón social.')
    const primeraSede = creando
      ? copiarDomicilio
        ? { nombre: sede.nombre, direccion: f.domicilio_direccion ?? '', distrito: f.domicilio_distrito ?? '', provincia: f.domicilio_provincia ?? '', departamento: f.domicilio_departamento ?? '' }
        : sede
      : null
    setGuardando(true)
    try {
      await onGuardar(f, primeraSede)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form" onSubmit={enviar} noValidate>
      <h2 className="form-title">{creando ? 'Nueva empresa' : 'Editar ficha'}</h2>

      <fieldset>
        <legend>Datos legales</legend>
        <Campo
          etiqueta="RUC"
          value={f.ruc}
          onChange={(e) => setF((x) => ({ ...x, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
          inputMode="numeric"
          maxLength={11}
          placeholder="11 dígitos"
          aria-invalid={rucCompleto && !rucOk}
          ayuda={rucCompleto ? (rucOk ? '✓ Formato y dígito verificador correctos' : '✗ El dígito verificador no cuadra o el inicio no es válido') : 'Se revisa el formato y el dígito verificador (no se consulta a SUNAT).'}
        />
        <Campo etiqueta="Razón social" value={f.razon_social} onChange={cambiar('razon_social')} maxLength={200} />
        <Campo etiqueta="Nombre comercial" opcional value={f.nombre_comercial ?? ''} onChange={cambiar('nombre_comercial')} maxLength={200} />
      </fieldset>

      <fieldset>
        <legend>Domicilio legal</legend>
        <Campo etiqueta="Dirección" value={f.domicilio_direccion ?? ''} onChange={cambiar('domicilio_direccion')} maxLength={250} />
        <div className="fila3">
          <Campo etiqueta="Distrito" value={f.domicilio_distrito ?? ''} onChange={cambiar('domicilio_distrito')} maxLength={100} />
          <Campo etiqueta="Provincia" value={f.domicilio_provincia ?? ''} onChange={cambiar('domicilio_provincia')} maxLength={100} />
          <Campo etiqueta="Departamento" value={f.domicilio_departamento ?? ''} onChange={cambiar('domicilio_departamento')} maxLength={100} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Actividad económica</legend>
        <BuscadorCiiu
          valor={f.ciiu_codigo}
          descripcion={ciiuDesc}
          onElegir={(c) => {
            setCiiuDesc(c.descripcion)
            setF((x) => ({ ...x, ciiu_codigo: c.codigo, actividad_texto: x.actividad_texto || c.descripcion }))
          }}
        />
        <Campo
          etiqueta="Texto de la actividad para los formatos"
          value={f.actividad_texto ?? ''}
          onChange={cambiar('actividad_texto')}
          maxLength={300}
          ayuda="Es lo que se imprime en los encabezados de registros y formatos. Puedes cambiarlo sin cambiar el CIIU."
        />
      </fieldset>

      <fieldset>
        <legend>Plan y tipo</legend>
        <label className="field">
          <span>Plan</span>
          <select value={f.plan} onChange={(e) => setF((x) => ({ ...x, plan: e.target.value as Ficha['plan'] }))}>
            <option value="gratuito">Gratuito</option>
            <option value="pago">De pago</option>
          </select>
          <small className="ayuda">Solo se guarda; el control de planes llega en la v1.1.</small>
        </label>
        <label className="check-linea">
          <input type="checkbox" checked={f.es_prueba} onChange={(e) => setF((x) => ({ ...x, es_prueba: e.target.checked }))} />
          Empresa ficticia de prueba (solo para este entorno de desarrollo)
        </label>
      </fieldset>

      {creando && (
        <fieldset>
          <legend>Primera sede</legend>
          <Campo etiqueta="Nombre de la sede" value={sede.nombre} onChange={(e) => setSede((s) => ({ ...s, nombre: e.target.value }))} maxLength={120} />
          <label className="check-linea">
            <input type="checkbox" checked={copiarDomicilio} onChange={(e) => setCopiarDomicilio(e.target.checked)} />
            Está en el domicilio legal
          </label>
          {!copiarDomicilio && (
            <>
              <Campo etiqueta="Dirección" value={sede.direccion} onChange={(e) => setSede((s) => ({ ...s, direccion: e.target.value }))} maxLength={250} />
              <div className="fila3">
                <Campo etiqueta="Distrito" value={sede.distrito} onChange={(e) => setSede((s) => ({ ...s, distrito: e.target.value }))} maxLength={100} />
                <Campo etiqueta="Provincia" value={sede.provincia} onChange={(e) => setSede((s) => ({ ...s, provincia: e.target.value }))} maxLength={100} />
                <Campo etiqueta="Departamento" value={sede.departamento} onChange={(e) => setSede((s) => ({ ...s, departamento: e.target.value }))} maxLength={100} />
              </div>
            </>
          )}
        </fieldset>
      )}

      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={guardando}>
          <Save size={20} aria-hidden="true" /> {guardando ? 'Guardando…' : creando ? 'Crear empresa' : 'Guardar cambios'}
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function pick(e: Empresa): Ficha {
  return {
    ruc: e.ruc,
    razon_social: e.razon_social,
    nombre_comercial: e.nombre_comercial ?? '',
    domicilio_direccion: e.domicilio_direccion ?? '',
    domicilio_distrito: e.domicilio_distrito ?? '',
    domicilio_provincia: e.domicilio_provincia ?? '',
    domicilio_departamento: e.domicilio_departamento ?? '',
    ciiu_codigo: e.ciiu_codigo,
    actividad_texto: e.actividad_texto ?? '',
    plan: e.plan,
    es_prueba: e.es_prueba,
  }
}
