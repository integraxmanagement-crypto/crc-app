import { useEffect, useState } from 'react'
import { leerCopia } from '../inspecciones/campo'
import { db } from '../empresas/datos'
import { useRuta } from '../ruta'
import type { Perfil } from '../sesion'
import { Logo } from './Logo'

// Logo de la barra superior: el de la empresa cliente (pedido del dueño, 29/10/2026). La barra es oscura, así que va el logo
// negativo, o el positivo si no hay. Sin empresa (cuenta del dueño), sin logo o sin señal la primera vez, sale el de CRC.
const guardado = (ruta: string) => `crc.logobarra.${ruta}`

async function cargarLogo(ruta: string): Promise<string | null> {
  try {
    const g = localStorage.getItem(guardado(ruta))
    if (g) return g
  } catch { /* sin almacenamiento: se baja cada vez */ }
  const r = await db().storage.from('logos').download(ruta)
  if (r.error || !r.data) return null
  const url = await new Promise<string | null>((ok) => {
    const lector = new FileReader()
    lector.onload = () => ok(typeof lector.result === 'string' ? lector.result : null)
    lector.onerror = () => ok(null)
    lector.readAsDataURL(r.data)
  })
  try {
    if (url) localStorage.setItem(guardado(ruta), url)
  } catch { /* no cabe: se baja la próxima vez */ }
  return url
}

export function LogoBarra({ perfil }: { perfil: Perfil }) {
  const [logo, setLogo] = useState<{ empresa: string; url: string } | null>(null)
  const [diminuto, setDiminuto] = useState(false) // un archivo de prueba de 1 píxel no sirve de logo: se deja el de CRC
  // La cuenta del dueño no tiene empresa: mientras mira la ficha de una empresa, la cabecera lleva el logo de esa empresa.
  const ruta = useRuta()
  const empresa = perfil.empresaId ?? (perfil.esDueno && ruta[0] === 'empresas' && /^[0-9a-f-]{36}$/i.test(ruta[1] ?? '') ? ruta[1] : null)
  const [version, setVersion] = useState(0)

  // Al guardar o quitar un logo en «Logos» de la empresa, la cabecera lo lee de nuevo (pedido del dueño, 29/10/2026).
  useEffect(() => {
    const cambio = () => {
      try {
        Object.keys(localStorage).filter((k) => k.startsWith('crc.logobarra.')).forEach((k) => localStorage.removeItem(k))
      } catch { /* sin almacenamiento */ }
      setDiminuto(false)
      setVersion((v) => v + 1)
    }
    window.addEventListener('crc:logo-cambiado', cambio)
    return () => window.removeEventListener('crc:logo-cambiado', cambio)
  }, [])

  useEffect(() => {
    if (!empresa) return
    let vivo = true
    void (async () => {
      let rutaLogo: string | null = null
      // Con señal se lee la empresa (así un logo recién cambiado se ve al instante); sin señal, la copia guardada en el equipo.
      const r = await db().from('empresas').select('logo_positivo, logo_negativo').eq('id', empresa).maybeSingle().then((x) => x, () => null)
      const f = r?.data as { logo_positivo: string | null; logo_negativo: string | null } | null | undefined
      if (f) rutaLogo = f.logo_negativo ?? f.logo_positivo
      else {
        const copia = await leerCopia(perfil.id, empresa).catch(() => undefined)
        if (copia) rutaLogo = copia.empresa.logo_negativo ?? copia.empresa.logo_positivo
      }
      if (!rutaLogo) return void (vivo && setLogo(null))
      const url = await cargarLogo(rutaLogo).catch(() => null)
      if (vivo && url) setLogo({ empresa, url })
    })()
    return () => {
      vivo = false
    }
  }, [empresa, perfil.id, version])

  if (empresa && logo?.empresa === empresa && !diminuto) {
    return <img className="logo-empresa" src={logo.url} alt="Logo de la empresa" onLoad={(e) => setDiminuto(e.currentTarget.naturalWidth < 16 || e.currentTarget.naturalHeight < 8)} />
  }
  return <Logo fondo="oscuro" />
}
