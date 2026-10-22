import { ArrowLeft, Pencil } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ir } from '../ruta'
import { Administradores } from './Administradores'
import { Aviso, Dato, Seccion } from './campos'
import { Contactos } from './Contactos'
import { type Contactos as TContactos, type Empresa, type Sede, actualizarEmpresa, cambiarEstadoEmpresa, leerEmpresa } from './datos'
import { FormFicha } from './FormFicha'
import { Logos } from './Logos'
import { Sedes } from './Sedes'

/**
 * Ficha completa de una empresa.
 * modo 'dueno': Integrax edita todo. modo 'admin': el administrador ve su ficha y edita solo contactos y logos (decisión 1A).
 * Lo que se muestra es solo comodidad: quien decide qué se puede leer y cambiar es la base de datos.
 */
export function DetalleEmpresa({ empresaId, modo }: { empresaId: string; modo: 'dueno' | 'admin' }) {
  const [datos, setDatos] = useState<{ empresa: Empresa | null; sedes: Sede[]; contactos: TContactos } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editandoFicha, setEditandoFicha] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const esDueno = modo === 'dueno'

  const cargar = useCallback(() => {
    leerEmpresa(empresaId)
      .then((d) => {
        setDatos(d)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
  }, [empresaId])
  useEffect(cargar, [cargar])

  if (error && !datos)
    return (
      <div className="detalle">
        <Aviso>{error}</Aviso>
        <button className="btn-sec" type="button" onClick={cargar}>
          Reintentar
        </button>
      </div>
    )
  if (!datos) return <p className="nota">Cargando…</p>
  const { empresa, sedes, contactos } = datos
  if (!empresa) return <Aviso>No se encontró la empresa, o no tienes permiso para verla.</Aviso>

  async function cambiarEstado() {
    if (!empresa) return
    try {
      await cambiarEstadoEmpresa(empresa.id, empresa.estado === 'activa' ? 'suspendida' : 'activa')
      setConfirmar(false)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (editandoFicha)
    return (
      <FormFicha
        inicial={empresa}
        onCancelar={() => setEditandoFicha(false)}
        onGuardar={async (ficha) => {
          await actualizarEmpresa(empresa.id, ficha)
          setEditandoFicha(false)
          cargar()
        }}
      />
    )

  return (
    <div className="detalle">
      {esDueno && (
        <button className="btn-link volver" type="button" onClick={() => ir('/empresas')}>
          <ArrowLeft size={18} aria-hidden="true" /> Empresas
        </button>
      )}
      <header className="detalle-cab">
        <h1>{empresa.razon_social}</h1>
        <p>
          RUC {empresa.ruc}
          {empresa.nombre_comercial ? ` · ${empresa.nombre_comercial}` : ''}
        </p>
        <p className="chips">
          <span className={`chip ${empresa.estado === 'activa' ? 'chip-ok' : 'chip-mal'}`}>{empresa.estado === 'activa' ? 'Activa' : 'Suspendida'}</span>
          <span className="chip chip-gris">Plan {empresa.plan === 'pago' ? 'de pago' : 'gratuito'}</span>
          {empresa.es_prueba && <span className="chip chip-prueba">Ficticia · prueba</span>}
        </p>
      </header>
      <Aviso>{datos && error}</Aviso>

      <Seccion
        titulo="Ficha"
        accion={
          esDueno ? (
            <button className="btn-sec" type="button" onClick={() => setEditandoFicha(true)}>
              <Pencil size={18} aria-hidden="true" /> Editar ficha
            </button>
          ) : null
        }
      >
        <dl className="ficha">
          <Dato etiqueta="Razón social" valor={empresa.razon_social} />
          <Dato etiqueta="Nombre comercial" valor={empresa.nombre_comercial} />
          <Dato
            etiqueta="Domicilio legal"
            valor={empresa.domicilio_direccion && `${empresa.domicilio_direccion} · ${empresa.domicilio_distrito}, ${empresa.domicilio_provincia}, ${empresa.domicilio_departamento}`}
          />
          <Dato etiqueta="CIIU" valor={empresa.ciiu_codigo && `${empresa.ciiu_codigo} · ${empresa.catalogo_ciiu?.descripcion ?? ''}`} />
          <Dato etiqueta="Actividad (para formatos)" valor={empresa.actividad_texto} />
        </dl>
        {!esDueno && <p className="nota">Para cambiar estos datos o las sedes, escribe a Integrax.</p>}
      </Seccion>

      <Logos empresa={empresa} editable onCambio={cargar} />
      <Contactos empresaId={empresa.id} contactos={contactos} editable onCambio={cargar} />
      <Sedes empresaId={empresa.id} sedes={sedes} editable={esDueno} onCambio={cargar} />
      <Administradores empresaId={empresa.id} puedeCrear={esDueno} />

      {esDueno && (
        <Seccion titulo="Estado de la empresa">
          <p className="nota">
            {empresa.estado === 'activa'
              ? 'Si la suspendes, nadie de esta empresa podrá ingresar y se cerrarán sus sesiones abiertas. No se borra nada.'
              : 'Está suspendida: nadie de esta empresa puede ingresar. Al reactivarla, vuelven a ingresar normalmente.'}
          </p>
          {!confirmar ? (
            <button className={empresa.estado === 'activa' ? 'btn-peligro' : 'btn'} type="button" onClick={() => setConfirmar(true)}>
              {empresa.estado === 'activa' ? 'Suspender empresa' : 'Reactivar empresa'}
            </button>
          ) : (
            <div className="acciones">
              <button className={empresa.estado === 'activa' ? 'btn-peligro' : 'btn'} type="button" onClick={() => void cambiarEstado()}>
                Sí, {empresa.estado === 'activa' ? 'suspender' : 'reactivar'}
              </button>
              <button className="btn-link" type="button" onClick={() => setConfirmar(false)}>
                Cancelar
              </button>
            </div>
          )}
        </Seccion>
      )}
    </div>
  )
}
