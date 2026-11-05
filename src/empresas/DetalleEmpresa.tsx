import { ArrowLeft, Boxes, ClipboardCheck, ListChecks, Pencil, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fijarCaducidadAdmin, fijarEquipoSst, leerCaducidadAdmin, leerEquipoSstEmpresa } from '../equipo/datos'
import { ir } from '../ruta'
import { Administradores } from './Administradores'
import { Aviso, Dato, Seccion } from './campos'
import { Contactos } from './Contactos'
import { type Contactos as TContactos, type Empresa, type Sede, actualizarEmpresa, cambiarEstadoEmpresa, leerEmpresa } from './datos'
import { FormatosIncompletos } from './FormatosIncompletos'
import { FormFicha } from './FormFicha'
import { Logos } from './Logos'
import { Sedes } from './Sedes'
import { Trabajadores } from './Trabajadores'

/** Solo el dueño de la plataforma: enciende o apaga la caducidad de la contraseña de los administradores de la empresa (90 días). */
function InterruptorCaducidad({ empresaId }: { empresaId: string }) {
  const [activa, setActiva] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    leerCaducidadAdmin(empresaId).then(setActiva, (e) => setError((e as Error).message))
  }, [empresaId])
  async function cambiar(valor: boolean) {
    setError(null)
    try {
      await fijarCaducidadAdmin(empresaId, valor)
      setActiva(valor)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Seccion titulo="Caducidad de contraseña de administradores">
      <p className="nota">
        Si está encendida, el administrador general y los administradores de sede de esta empresa deben cambiar su contraseña cada 90 días: al ingresar después del plazo, la app se la pide. No afecta a gestores, usuarios ni al dueño de la plataforma. Las cuentas actuales cuentan desde el día en que se activó la función.
      </p>
      <Aviso>{error}</Aviso>
      <label className="sismos-casilla">
        <input type="checkbox" checked={activa ?? true} disabled={activa === null} onChange={(e) => void cambiar(e.target.checked)} /> Caducidad a los 90 días encendida para esta empresa
      </label>
    </Seccion>
  )
}

/** Solo el dueño de la plataforma: habilita o no «Conoce al equipo de SST» para la empresa (04/11/2026). */
function InterruptorEquipoSst({ empresaId }: { empresaId: string }) {
  const [habilitado, setHabilitado] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    leerEquipoSstEmpresa(empresaId).then(setHabilitado, (e) => setError((e as Error).message))
  }, [empresaId])
  async function cambiar(valor: boolean) {
    setError(null)
    try {
      await fijarEquipoSst(empresaId, valor)
      setHabilitado(valor)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Seccion titulo="Conoce al equipo de SST">
      <p className="nota">Muestra a las personas de la empresa el organigrama de su equipo de SST (puestos y nombres, que cambian los administradores y los gestores). Tú decides si esta empresa lo tiene.</p>
      <Aviso>{error}</Aviso>
      <label className="sismos-casilla">
        <input type="checkbox" checked={habilitado ?? true} disabled={habilitado === null} onChange={(e) => void cambiar(e.target.checked)} /> Habilitado para esta empresa
      </label>
    </Seccion>
  )
}

/**
 * Ficha completa de una empresa.
 * modo 'dueno': Integrax edita todo. modo 'admin': el administrador general ve su ficha y edita solo contactos y logos (decisión 1A).
 * modo 'admin_sede': el administrador de una sede ve la ficha y trabaja con las personas de su sede; no toca contactos, logos, listas ni administradores.
 * Lo que se muestra es solo comodidad: quien decide qué se puede leer y cambiar es la base de datos.
 */
export function DetalleEmpresa({ empresaId, modo }: { empresaId: string; modo: 'dueno' | 'admin' | 'admin_sede' }) {
  const [datos, setDatos] = useState<{ empresa: Empresa | null; sedes: Sede[]; contactos: TContactos } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editandoFicha, setEditandoFicha] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const esDueno = modo === 'dueno'
  const general = modo !== 'admin_sede'
  const base = esDueno ? `/empresas/${empresaId}` : '/mi-empresa'

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

      <Trabajadores empresaId={empresa.id} modo={empresa.trabajadores_modo ?? 'automatico'} manual={empresa.trabajadores_manual ?? null} editable={general} onCambio={cargar} />

      <Seccion titulo="Personas">
        <p className="nota">Cuentas de la empresa (crear, cesar, reactivar y dar contraseñas nuevas) y la estructura (gerencias, áreas y subáreas) y los puestos.</p>
        <div className="acciones">
          <button className="btn" type="button" onClick={() => ir(`${base}/usuarios`)}>
            <Users size={20} aria-hidden="true" /> Usuarios
          </button>
          {general && (
            <button className="btn-sec" type="button" onClick={() => ir(`${base}/listas`)}>
              <ListChecks size={18} aria-hidden="true" /> Estructura y puestos
            </button>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Inspecciones">
        <p className="nota">Formatos de inspección de la empresa (copiados de las plantillas base de CRC y adaptados) y sus activos, ubicaciones y listas.</p>
        <FormatosIncompletos empresaId={empresaId} rutaFormatos={esDueno ? `${base}/formatos` : '/formatos'} />
        <div className="acciones">
          <button className="btn" type="button" onClick={() => ir(esDueno ? `${base}/formatos` : '/formatos')}>
            <ClipboardCheck size={20} aria-hidden="true" /> Formatos de inspección
          </button>
          <button className="btn-sec" type="button" onClick={() => ir(esDueno ? `${base}/activos` : '/activos')}>
            <Boxes size={18} aria-hidden="true" /> Activos y listas
          </button>
        </div>
      </Seccion>

      {general && <Logos empresa={empresa} editable onCambio={cargar} />}
      {general && <Contactos empresaId={empresa.id} contactos={contactos} editable onCambio={cargar} />}
      <Sedes empresaId={empresa.id} sedes={sedes} editable={esDueno} onCambio={cargar} />
      {general && <Administradores empresaId={empresa.id} puedeCrear={esDueno} sedes={sedes} />}

      {esDueno && <InterruptorEquipoSst empresaId={empresa.id} />}
      {esDueno && <InterruptorCaducidad empresaId={empresa.id} />}

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
