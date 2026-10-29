import { type CSSProperties, useEffect, useMemo } from 'react'
import type { Borde, Estilo, VistaHoja } from './excelVista'

// Ancho útil de una hoja A4 con márgenes de 8 mm, en píxeles de pantalla (96 por pulgada).
const UTIL = { vertical: (194 / 25.4) * 96, horizontal: (281 / 25.4) * 96 }

const GROSOR: Record<string, string> = {
  thin: '1px solid', hair: '1px solid', dotted: '1px dotted', dashed: '1px dashed', dashDot: '1px dashed', dashDotDot: '1px dashed',
  medium: '2px solid', mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed', slantDashDot: '2px dashed',
  thick: '3px solid', double: '3px double',
}
const borde = (b: Borde) => (b ? `${GROSOR[b.estilo] ?? '1px solid'} ${b.color}` : undefined)

function estiloCelda(e: Estilo, numero: boolean): CSSProperties {
  return {
    fontFamily: `'${e.fuente}', Arial, sans-serif`,
    fontSize: `${e.tamano}pt`,
    fontWeight: e.negrita ? 700 : 400,
    fontStyle: e.cursiva ? 'italic' : undefined,
    textDecoration: e.subrayado ? 'underline' : undefined,
    color: e.color ?? '#000',
    background: e.fondo ?? undefined,
    textAlign: (e.horizontal === 'centerContinuous' ? 'center' : e.horizontal === 'general' || !e.horizontal ? (numero ? 'right' : 'left') : e.horizontal) as CSSProperties['textAlign'],
    verticalAlign: e.vertical === 'center' ? 'middle' : e.vertical === 'top' ? 'top' : 'bottom',
    whiteSpace: e.ajustar ? 'pre-wrap' : 'pre',
    borderLeft: borde(e.izquierda), borderRight: borde(e.derecha), borderTop: borde(e.arriba), borderBottom: borde(e.abajo),
  }
}

/**
 * Dibujo de la hoja del Excel de la organización, igual que en Excel, para guardarlo como PDF (revisión LOTO,
 * 29/10/2026). Se ajusta al ancho de la hoja A4 (vertical o apaisada, como diga el Excel).
 */
export function VistaExcel({ vista, medias }: { vista: VistaHoja; medias: Map<string, Uint8Array> }) {
  const urls = useMemo(() => new Map([...medias].map(([n, b]) => [n, URL.createObjectURL(new Blob([b as BlobPart]))])), [medias])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  const ancho = vista.anchos.reduce((a, b) => a + b, 0)
  const alto = vista.altos.reduce((a, b) => a + b, 0)
  const escala = Math.min(1, (vista.horizontal ? UTIL.horizontal : UTIL.vertical) / ancho)
  const filas = vista.altos.map((_, r) => vista.celdas.filter((c) => c.fila === r).sort((a, b) => a.col - b.col))
  return (
    <div className={`hoja-entrega hoja-excel ${vista.horizontal ? 'hoja-excel-h' : 'hoja-excel-v'}`}>
      <div className="hoja-excel-lienzo" style={{ width: ancho, height: alto, zoom: escala }}>
        <table>
          <colgroup>
            {vista.anchos.map((w, k) => <col key={k} style={{ width: w }} />)}
          </colgroup>
          <tbody>
            {filas.map((celdas, r) => {
              // Celdas vacías donde no hay nada (para que la cuadrícula no se corra).
              const ocupadas = new Set<number>()
              for (const c of vista.celdas) if (c.fila <= r && c.fila + c.filas > r) for (let k = c.col; k < c.col + c.cols; k++) ocupadas.add(k)
              const salida = []
              for (let col = 0; col < vista.anchos.length; col++) {
                const c = celdas.find((x) => x.col === col)
                if (c) {
                  salida.push(
                    <td key={col} colSpan={c.cols} rowSpan={c.filas} style={estiloCelda(c.estilo, c.numero)}>
                      {c.texto}
                    </td>,
                  )
                  col += c.cols - 1
                } else if (!ocupadas.has(col)) salida.push(<td key={col} />)
              }
              return (
                <tr key={r} style={{ height: vista.altos[r] }}>
                  {salida}
                </tr>
              )
            })}
          </tbody>
        </table>
        {vista.imagenes.map((im, k) => {
          const u = urls.get(im.nombre)
          return u ? <img key={k} src={u} alt="" style={{ left: im.x, top: im.y, width: im.ancho, height: im.alto }} /> : null
        })}
      </div>
    </div>
  )
}
