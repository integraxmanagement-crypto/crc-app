import type { CSSProperties } from 'react'

/**
 * Estado de carga con esqueleto (05/11/2026): en vez del texto «Cargando…» se dibuja la forma de lo que va a llegar, con un brillo suave que
 * pasa. Cada forma imita una pantalla real para que al llegar el contenido nada se mueva. Para lectores de pantalla dice «Cargando».
 */
export type FormaEsqueleto = 'lista' | 'tarjetas' | 'detalle' | 'formulario' | 'organigrama' | 'linea' | 'bloque'

const barra = (ancho: string, extra = '') => <span className={`esq-barra ${extra}`} style={{ '--ancho': ancho } as CSSProperties} />

function Fila() {
  return (
    <div className="esq-fila">
      <span className="esq-barra esq-redondo" />
      <div className="esq-texto">
        {barra('62%')}
        {barra('38%', 'esq-fina')}
      </div>
    </div>
  )
}

export function Esqueleto({ forma = 'lista', filas = 3, ancho = '8rem' }: { forma?: FormaEsqueleto; filas?: number; ancho?: string }) {
  // La línea y el bloque van dentro de un texto o de una caja: no llevan su propio aviso de «cargando».
  if (forma === 'linea') return <span className="esq-barra esq-inline" style={{ '--ancho': ancho } as CSSProperties} aria-hidden="true" />
  if (forma === 'bloque') return <span className="esq-barra esq-bloque" aria-hidden="true" />

  return (
    <div className={`esq esq-${forma}`} role="status" aria-busy="true" aria-live="polite">
      <span className="solo-lectores">Cargando…</span>
      <div aria-hidden="true" className="esq-cuerpo">
        {forma === 'lista' && Array.from({ length: filas }, (_, i) => <Fila key={i} />)}
        {forma === 'tarjetas' &&
          Array.from({ length: filas }, (_, i) => (
            <div className="esq-tarjeta" key={i}>
              {barra('55%')}
              {barra('90%', 'esq-fina')}
              {barra('70%', 'esq-fina')}
            </div>
          ))}
        {forma === 'detalle' && (
          <>
            <div className="esq-cab">
              {barra('16rem', 'esq-titulo')}
              {barra('11rem', 'esq-fina')}
            </div>
            <div className="esq-tarjeta">
              {barra('30%')}
              {barra('100%', 'esq-fina')}
              {barra('86%', 'esq-fina')}
            </div>
            <div className="esq-tarjeta">
              {barra('38%')}
              <Fila />
              <Fila />
            </div>
          </>
        )}
        {forma === 'formulario' && (
          <>
            {barra('9rem', 'esq-titulo')}
            {barra('100%', 'esq-campo')}
            {barra('100%', 'esq-campo')}
            {barra('100%', 'esq-campo')}
            {barra('100%', 'esq-boton')}
          </>
        )}
        {forma === 'organigrama' && (
          <div className="esq-org">
            {barra('11rem', 'esq-caja')}
            <div className="esq-org-ramas">
              {barra('10rem', 'esq-caja')}
              {barra('10rem', 'esq-caja')}
              {barra('10rem', 'esq-caja')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
