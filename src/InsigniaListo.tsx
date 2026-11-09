/**
 * Insignia de «listo» para los botones de generar (06/11/2026): un aro que se dibuja, un círculo que aparece con brillo,
 * un visto que se traza y un pequeño rebote; dura 4 s. Mientras se arma, un arco gira. Los colores salen del botón (currentColor).
 */
export function InsigniaListo({ armando, listo }: { armando: boolean; listo: boolean }) {
  return (
    <span className={`insignia ${armando ? 'insignia-gira' : ''} ${listo ? 'insignia-ok' : ''}`} aria-hidden="true">
      <svg viewBox="-100 -100 200 200">
        <circle className="ins-pista" r="77" />
        <g className="ins-grupo">
          <circle className="ins-arco" r="77" transform="rotate(-90)" />
          <circle className="ins-relleno" r="82" />
          <path className="ins-visto" d="M -35 2 L -10 27 L 37 -23" />
        </g>
      </svg>
    </span>
  )
}
