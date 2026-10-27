// Fotos de las inspecciones (tarea 3.4-C, D-37): se achican en el equipo antes de guardarlas, para que cada una
// pese como máximo 1 MB (límite aprobado por el dueño) y se envíen rápido aun con poca señal.

const LADO_MAXIMO = 1600
export const FOTO_MAX_BYTES = 1048576

/** Huella sha-256 (en hexadecimal) de un archivo: el servidor la guarda para saber que la foto no cambió. */
export async function huella(blob: Blob): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function abrirImagen(archivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    } catch {
      // Algunos navegadores no aceptan la opción: se abre como imagen normal.
    }
  }
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Achica la foto a 1600 px por lado como máximo y la guarda en JPEG de hasta 1 MB. */
export async function prepararFoto(archivo: Blob): Promise<{ blob: Blob; tipo: 'image/jpeg'; sha256: string }> {
  const img = await abrirImagen(archivo).catch(() => {
    throw new Error('No se pudo abrir la foto. Prueba con otra.')
  })
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  let ancho = Math.round(img.width * escala)
  let alto = Math.round(img.height * escala)
  const lienzo = document.createElement('canvas')
  let blob: Blob | null = null
  for (let intento = 0; intento < 6; intento++) {
    lienzo.width = ancho
    lienzo.height = alto
    lienzo.getContext('2d')!.drawImage(img, 0, 0, ancho, alto)
    blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', intento < 3 ? 0.82 - intento * 0.12 : 0.6))
    if (blob && blob.size <= FOTO_MAX_BYTES) break
    if (intento >= 2) {
      ancho = Math.round(ancho * 0.8)
      alto = Math.round(alto * 0.8)
    }
  }
  if ('close' in img) img.close()
  if (!blob || blob.size > FOTO_MAX_BYTES) throw new Error('La foto es demasiado pesada aun achicándola.')
  return { blob, tipo: 'image/jpeg', sha256: await huella(blob) }
}
