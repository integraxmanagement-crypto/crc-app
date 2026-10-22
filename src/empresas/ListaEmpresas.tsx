import { Building2, ChevronRight, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ir } from '../ruta'
import { Aviso } from './campos'
import { type Empresa, listarEmpresas, normalizar } from './datos'

/** Lista de empresas clientes (solo para el dueño de la plataforma). */
export function ListaEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    listarEmpresas()
      .then(setEmpresas)
      .catch((e) => setError((e as Error).message))
  }, [])

  const f = normalizar(filtro)
  const visibles = (empresas ?? []).filter((e) => !f || normalizar(`${e.razon_social} ${e.nombre_comercial ?? ''} ${e.ruc}`).includes(f))

  return (
    <div className="detalle">
      <header className="detalle-cab fila-entre">
        <div>
          <h1>Empresas</h1>
          <p>{empresas ? `${empresas.length} registradas` : 'Cargando…'}</p>
        </div>
        <button className="btn" type="button" onClick={() => ir('/empresas/nueva')}>
          <Plus size={20} aria-hidden="true" /> Nueva empresa
        </button>
      </header>
      <span className="buscador">
        <Search aria-hidden="true" />
        <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por razón social, nombre o RUC" aria-label="Buscar empresa" />
      </span>
      <Aviso>{error}</Aviso>
      <ul className="lista lista-empresas">
        {visibles.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => ir(`/empresas/${e.id}`)}>
              <Building2 aria-hidden="true" />
              <div>
                <b>{e.razon_social}</b>
                <small>
                  RUC {e.ruc}
                  {e.domicilio_departamento ? ` · ${e.domicilio_departamento}` : ''}
                </small>
                <span className="chips">
                  <span className={`chip ${e.estado === 'activa' ? 'chip-ok' : 'chip-mal'}`}>{e.estado === 'activa' ? 'Activa' : 'Suspendida'}</span>
                  {e.es_prueba && <span className="chip chip-prueba">Ficticia</span>}
                  {!e.ciiu_codigo && <span className="chip chip-aviso">Ficha incompleta</span>}
                </span>
              </div>
              <ChevronRight aria-hidden="true" />
            </button>
          </li>
        ))}
        {empresas && !visibles.length && <li className="vacio">Ninguna empresa coincide.</li>}
      </ul>
    </div>
  )
}
