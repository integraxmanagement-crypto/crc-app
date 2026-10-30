import { ImageUp, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Aviso, Seccion } from './campos'
import { type Empresa, quitarLogoNegativo, revisarLogo, subirLogo, verLogo } from './datos'

type Tipo = 'positivo' | 'negativo'

/** Logos de la empresa: positivo (fondo claro, obligatorio para imprimir) y negativo (fondo oscuro, opcional). */
export function Logos({ empresa, editable, onCambio }: { empresa: Empresa; editable: boolean; onCambio: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  /** Revisa el archivo elegido; devuelve false si no sirve (el aviso queda arriba). */
  async function revisar(archivo: File) {
    setError(null)
    setOk(null)
    const problema = await revisarLogo(archivo)
    if (problema) setError(problema)
    return !problema
  }

  async function subir(tipo: Tipo, archivo: File) {
    setError(null)
    try {
      await subirLogo(empresa.id, tipo, archivo, tipo === 'positivo' ? empresa.logo_positivo : empresa.logo_negativo)
      setOk(`Logo ${tipo} guardado.`)
      window.dispatchEvent(new Event('crc:logo-cambiado')) // la cabecera vuelve a leer el logo
      onCambio()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function quitar() {
    if (!empresa.logo_negativo) return
    setError(null)
    try {
      await quitarLogoNegativo(empresa.id, empresa.logo_negativo)
      setOk('Logo negativo quitado: se usará el positivo.')
      window.dispatchEvent(new Event('crc:logo-cambiado'))
      onCambio()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Seccion titulo="Logos">
      <div className="logos">
        <CajaLogo
          key={`p-${empresa.actualizado_en}`}
          tipo="positivo"
          titulo="Positivo (fondo claro)"
          ruta={empresa.logo_positivo}
          editable={editable}
          onRevisar={revisar}
          onArchivo={(a) => subir('positivo', a)}
        />
        <CajaLogo
          key={`n-${empresa.actualizado_en}`}
          tipo="negativo"
          titulo="Negativo (fondo oscuro)"
          ruta={empresa.logo_negativo ?? empresa.logo_positivo}
          prestado={!empresa.logo_negativo}
          editable={editable}
          onRevisar={revisar}
          onArchivo={(a) => subir('negativo', a)}
          onQuitar={empresa.logo_negativo ? () => void quitar() : undefined}
        />
      </div>
      <Aviso>{error}</Aviso>
      <Aviso tipo="ok">{ok}</Aviso>
      <p className="nota">PNG, JPG o WebP de hasta 1 MB. Mejor PNG con fondo transparente. Si no hay logo negativo, se usa el positivo.</p>
    </Seccion>
  )
}

function CajaLogo({
  tipo,
  titulo,
  ruta,
  prestado,
  editable,
  onRevisar,
  onArchivo,
  onQuitar,
}: {
  tipo: Tipo
  titulo: string
  ruta: string | null
  prestado?: boolean
  editable: boolean
  onRevisar: (a: File) => Promise<boolean>
  onArchivo: (a: File) => Promise<void>
  onQuitar?: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  // El archivo elegido queda en vista previa hasta confirmar: «Guardar cambio» o «Descartar» (pedido del dueño, 29/10/2026).
  const [pendiente, setPendiente] = useState<{ archivo: File; vista: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vigente = true
    let actual: string | null = null
    // La caja se vuelve a crear (key) cada vez que cambia el logo, así que no hace falta limpiar la imagen anterior.
    if (ruta)
      void verLogo(ruta).then((u) => {
        actual = u
        if (vigente) setUrl(u)
        else if (u) URL.revokeObjectURL(u)
      })
    return () => {
      vigente = false
      if (actual) URL.revokeObjectURL(actual)
    }
  }, [ruta])

  return (
    <figure className="logo-caja">
      <div className={`logo-fondo logo-${tipo}`}>
        {pendiente ? <img src={pendiente.vista} alt={`Vista previa del logo ${tipo}`} /> : url ? <img src={url} alt={`Logo ${tipo}`} /> : <span className="vacio">{ruta ? 'Cargando…' : 'Sin logo'}</span>}
      </div>
      <figcaption>
        {titulo}
        {prestado && ruta && !pendiente && <small> · usando el positivo</small>}
        {pendiente && <small> · vista previa: sin guardar</small>}
      </figcaption>
      {editable && (
        <div className="acciones">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const a = e.target.files?.[0]
              e.target.value = ''
              if (a) void onRevisar(a).then((bien) => bien && setPendiente((p) => (p && URL.revokeObjectURL(p.vista), { archivo: a, vista: URL.createObjectURL(a) })))
            }}
          />
          {pendiente ? (
            <>
              <button className="btn" type="button" disabled={guardando} onClick={() => (setGuardando(true), void onArchivo(pendiente.archivo).finally(() => (setGuardando(false), setPendiente(null))))}>
                {guardando ? 'Guardando…' : 'Guardar cambio'}
              </button>
              <button className="btn-sec" type="button" disabled={guardando} onClick={() => (URL.revokeObjectURL(pendiente.vista), setPendiente(null))}>Descartar</button>
            </>
          ) : (
            <button className="btn-sec" type="button" onClick={() => input.current?.click()}>
              <ImageUp size={18} aria-hidden="true" /> {prestado || !ruta ? 'Subir' : 'Cambiar'}
            </button>
          )}
          {onQuitar && !pendiente && (
            <button className="btn-link" type="button" onClick={onQuitar}>
              <Trash2 size={16} aria-hidden="true" /> Quitar
            </button>
          )}
        </div>
      )}
    </figure>
  )
}
