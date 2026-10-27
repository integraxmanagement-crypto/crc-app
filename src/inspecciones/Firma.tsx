import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Recuadro para firmar con el dedo o el mouse (firma de nivel 1: la hace cada firmante desde su propia cuenta,
 * decisión del dueño 26/10/2026). Devuelve la firma como imagen PNG.
 */
export function PanelFirma({ onListo, onCancelar, texto = 'Guardar firma' }: { onListo: (png: Blob) => void; onCancelar: () => void; texto?: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [trazos, setTrazos] = useState(0)
  const dibujando = useRef(false)

  useEffect(() => {
    const c = lienzo.current!
    const ajustar = () => {
      const r = c.getBoundingClientRect()
      c.width = Math.round(r.width * 2)
      c.height = Math.round(r.height * 2)
      const g = c.getContext('2d')!
      g.scale(2, 2)
      g.lineWidth = 2.4
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.strokeStyle = '#0b1f3a'
      setTrazos(0)
    }
    ajustar()
  }, [])

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  function limpiar() {
    const c = lienzo.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setTrazos(0)
  }

  return (
    <div className="firma-panel">
      <canvas
        ref={lienzo}
        className="firma-lienzo"
        aria-label="Recuadro para firmar"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dibujando.current = true
          const g = e.currentTarget.getContext('2d')!
          const [x, y] = punto(e)
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + 0.1, y + 0.1)
          g.stroke()
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return
          const g = e.currentTarget.getContext('2d')!
          const [x, y] = punto(e)
          g.lineTo(x, y)
          g.stroke()
        }}
        onPointerUp={() => {
          if (dibujando.current) setTrazos((t) => t + 1)
          dibujando.current = false
        }}
      />
      <p className="nota">Firma dentro del recuadro.</p>
      <div className="acciones">
        <button className="btn" type="button" disabled={trazos === 0}
          onClick={() => lienzo.current!.toBlob((b) => b && onListo(b), 'image/png')}>
          {texto}
        </button>
        <button className="btn-link" type="button" onClick={limpiar} disabled={trazos === 0}>
          <Eraser size={16} aria-hidden="true" /> Borrar
        </button>
        <button className="btn-link" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
