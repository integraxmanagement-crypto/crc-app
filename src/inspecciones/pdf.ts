// PDF que se descarga solo (pedido del dueño, 09/11/2026): ya no se abre «Imprimir» para guardar a mano.
// La hoja del Excel de la organización ya está dibujada en pantalla (VistaExcel); se fotografía y se arma el PDF en A4, vertical o apaisado
// como diga el Excel, con márgenes de 8 mm. Las librerías se cargan solo al pedir el primer PDF, para no pesar en el resto de la aplicación.
import { useEffect } from 'react'

const MARGEN_MM = 8
const A4 = { vertical: [210, 297], horizontal: [297, 210] } as const

/** Convierte una hoja `.hoja-excel` dibujada en pantalla en un PDF y lo descarga. */
export async function descargarPdf(hoja: HTMLElement, nombre: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const horizontal = hoja.classList.contains('hoja-excel-h')
  const lienzo = hoja.querySelector<HTMLElement>('.hoja-excel-lienzo')
  if (!lienzo) throw new Error('No se encontró la hoja para el PDF.')
  const ancho = parseFloat(lienzo.style.width) || lienzo.offsetWidth
  const alto = parseFloat(lienzo.style.height) || lienzo.offsetHeight

  // La hoja se fotografía a su tamaño natural, aparte de la pantalla, sin el «zoom» que usa para ajustarse al papel.
  const aparte = document.createElement('div')
  aparte.style.cssText = `position:fixed;left:-100000px;top:0;width:${ancho}px;background:#fff;`
  const copia = hoja.cloneNode(true) as HTMLElement
  copia.style.display = 'block'
  const lienzoCopia = copia.querySelector<HTMLElement>('.hoja-excel-lienzo')!
  lienzoCopia.style.zoom = 'normal'
  aparte.appendChild(copia)
  document.body.appendChild(aparte)
  try {
    const escala = Math.min(3, Math.max(2, 2400 / ancho))
    const foto = await html2canvas(lienzoCopia, { scale: escala, backgroundColor: '#fff', useCORS: true, logging: false, width: ancho, height: alto })
    const [pw, ph] = A4[horizontal ? 'horizontal' : 'vertical']
    const util = { w: pw - 2 * MARGEN_MM, h: ph - 2 * MARGEN_MM }
    const pdf = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true })
    // Se ajusta al ancho útil; si la hoja es más alta que una página, sigue en la siguiente.
    // Si la hoja pasa poco del alto de una página, se reduce para que quepa entera en una sola (como «ajustar a una página» en Excel).
    const altoAjustado = (util.w * foto.height) / foto.width
    if (altoAjustado > util.h && altoAjustado <= util.h * 1.35) {
      const k = util.h / altoAjustado
      const w = util.w * k
      pdf.addImage(foto.toDataURL('image/jpeg', 0.95), 'JPEG', MARGEN_MM + (util.w - w) / 2, MARGEN_MM, w, util.h, undefined, 'FAST')
      pdf.save(nombre.replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '') + '.pdf')
      return
    }
    const pxPorMm = foto.width / util.w
    const altoPaginaPx = Math.floor(util.h * pxPorMm)
    for (let y = 0, pagina = 0; y < foto.height; y += altoPaginaPx, pagina++) {
      const h = Math.min(altoPaginaPx, foto.height - y)
      const trozo = document.createElement('canvas')
      trozo.width = foto.width
      trozo.height = h
      const g = trozo.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, trozo.width, trozo.height)
      g.drawImage(foto, 0, y, foto.width, h, 0, 0, foto.width, h)
      if (pagina > 0) pdf.addPage()
      pdf.addImage(trozo.toDataURL('image/jpeg', 0.95), 'JPEG', MARGEN_MM, MARGEN_MM, util.w, h / pxPorMm, undefined, 'FAST')
    }
    pdf.save(nombre.replace(/[\\/:*?"<>|]+/g, '-').replace(/\.pdf$/i, '') + '.pdf')
  } finally {
    aparte.remove()
  }
}

/**
 * Cuando la hoja ya está dibujada (vistaPdf con su nombre), se descarga el PDF solo y se llama a `limpiar` para quitarla de la pantalla.
 * Si algo falla, `alFallar` recibe el motivo.
 */
export function usePdfAutomatico(vistaPdf: { nombre: string } | null, limpiar: () => void, alFallar?: (motivo: string) => void) {
  useEffect(() => {
    if (!vistaPdf) return
    let vivo = true
    // Un momento para que la hoja y sus imágenes terminen de dibujarse.
    const t = setTimeout(() => {
      const hojas = document.querySelectorAll<HTMLElement>('body > .hoja-excel')
      const hoja = hojas[hojas.length - 1]
      const hecho = hoja ? descargarPdf(hoja, vistaPdf.nombre) : Promise.reject(new Error('No se encontró la hoja para el PDF.'))
      hecho.catch((e) => vivo && alFallar?.(`No se pudo armar el PDF: ${(e as Error).message}`)).finally(() => vivo && limpiar())
    }, 400)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // limpiar y alFallar cambian en cada pintado; solo importa cuando aparece una hoja nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaPdf])
}
