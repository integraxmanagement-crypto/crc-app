import { CalendarDays, ClipboardCheck, ClipboardList, Home, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type CopiaLocal, leerCopia } from './inspecciones/campo'
import { listarInspecciones } from './inspecciones/datos'
import { ir } from './ruta'
import type { Perfil } from './sesion'
import { Logo } from './marca/Logo'

/**
 * Menú lateral (pedido del dueño, 29/10/2026): se abre desde las tres líneas de la barra y se desliza desde la izquierda. Trae Inicio,
 * Programa anual de SST, Inspecciones (con las cuatro inspecciones más usadas y «Ver todas») y Formatos. Reemplaza esos botones de la barra.
 */
export function MenuLateral({ perfil, equipoSso, online, abierto, onCerrar }: { perfil: Perfil; equipoSso: boolean; online: boolean; abierto: boolean; onCerrar: () => void }) {
  const [masUsadas, setMasUsadas] = useState<{ id: string; nombre: string }[]>([])

  // Las cuatro inspecciones más usadas: las que más registros tienen; sin señal (o sin registros), por orden alfabético.
  useEffect(() => {
    if (!abierto || !equipoSso || !perfil.empresaId) return
    let vivo = true
    ;(async () => {
      const copia: CopiaLocal | undefined = await leerCopia(perfil.id, perfil.empresaId!)
      const formatos = copia?.formatos.map((f) => ({ id: f.plantilla.id, nombre: f.plantilla.nombre })) ?? []
      let cuenta = new Map<string, number>()
      if (online) {
        const lista = await listarInspecciones(perfil.empresaId!).catch(() => [])
        // Una misma inspección puede tener varias copias del formato: se cuenta por nombre.
        const idDeNombre = new Map(formatos.map((f) => [f.nombre, f.id]))
        for (const i of lista) {
          const id = idDeNombre.get(i.plantillas?.nombre ?? '')
          if (id) cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
        }
      } else cuenta = new Map()
      const orden = [...formatos].sort((a, b) => (cuenta.get(b.id) ?? 0) - (cuenta.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
      if (vivo) setMasUsadas(orden.slice(0, 4))
    })().catch(() => {})
    return () => {
      vivo = false
    }
  }, [abierto, equipoSso, online, perfil.id, perfil.empresaId])

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, onCerrar])

  const ir_ = (ruta: string) => () => {
    onCerrar()
    ir(ruta)
  }

  return (
    <>
      <div className={`menu-fondo ${abierto ? 'abierto' : ''}`} onClick={onCerrar} aria-hidden="true" />
      <aside className={`menu-lateral ${abierto ? 'abierto' : ''}`} aria-label="Menú principal" aria-hidden={!abierto} inert={!abierto}>
        <div className="menu-cab">
          <Logo fondo="oscuro" />
          <button type="button" aria-label="Cerrar el menú" onClick={onCerrar}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav>
          <button type="button" onClick={ir_('/')}>
            <Home size={18} aria-hidden="true" /> Inicio
          </button>
          {equipoSso && (
            <button type="button" onClick={ir_('/passt')}>
              <CalendarDays size={18} aria-hidden="true" /> Programa anual de SST
            </button>
          )}
          {equipoSso && (
            <>
              <button type="button" onClick={ir_('/inspecciones')}>
                <ClipboardList size={18} aria-hidden="true" /> Inspecciones
              </button>
              <ul className="menu-sub">
                {masUsadas.map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={ir_(`/inspecciones/tipo/${f.id}`)}>{f.nombre}</button>
                  </li>
                ))}
                <li>
                  <button type="button" className="menu-ver-todas" onClick={ir_('/inspecciones')}>Ver todas</button>
                </li>
              </ul>
            </>
          )}
          {equipoSso && (
            <button type="button" onClick={ir_('/formatos')}>
              <ClipboardCheck size={18} aria-hidden="true" /> Formatos
            </button>
          )}
        </nav>
      </aside>
    </>
  )
}
