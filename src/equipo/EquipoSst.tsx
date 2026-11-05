import { ArrowLeft, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso, Campo, Seccion } from '../empresas/campos'
import { ir } from '../ruta'
import { type Contacto, type Nodo, agregarNodo, armarEquipoActual, editarNodo, equipoSstHabilitado, gestoresParaVincular, guardarMiWhatsapp, leerMiWhatsapp, listarContactos, listarNodos, quitarNodo, vincularNodo } from './datos'

type Arbol = Nodo & { hijos: Arbol[] }

/** «+51987654321» → «+51 987 654 321» (solo para mostrar). */
const conEspacios = (n: string) => (n.startsWith('+51') && n.length === 12 ? `+51 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : n)
type Editor = { modo: 'agregar'; padre: Nodo | null } | { modo: 'editar'; nodo: Nodo }
type SedeMia = { id: string; nombre: string }

/** Arma el árbol; un puesto cuyo padre esta persona no ve (otra sede) se muestra como inicio de rama. */
function armar(nodos: Nodo[]): Arbol[] {
  const por = new Map<string, Arbol>(nodos.map((n) => [n.id, { ...n, hijos: [] }]))
  const raices: Arbol[] = []
  for (const n of por.values()) {
    const padre = n.padre_id ? por.get(n.padre_id) : undefined
    if (padre) padre.hijos.push(n)
    else raices.push(n)
  }
  return raices
}

function Tarjeta({ n, whatsapp, puede, onEditar, onRama, onQuitar }: { n: Arbol; whatsapp?: string | null; puede: boolean; onEditar: () => void; onRama: () => void; onQuitar: () => void }) {
  return (
    <div className="org-persona">
      <span className="org-rol">{n.puesto}</span>
      <b>{n.nombre ?? <em className="opcional">Por cubrir</em>}</b>
      {n.sedes && <small>{n.sedes.nombre}</small>}
      {whatsapp && (
        <small>
          <a className="btn-link" href={`https://wa.me/${whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={15} aria-hidden="true" /> {conEspacios(whatsapp)}
          </a>
        </small>
      )}
      {puede && (
        <span className="org-acciones">
          <button className="btn-link" type="button" onClick={onEditar} title="Cambiar puesto y nombre"><Pencil size={15} aria-hidden="true" /> Editar</button>
          <button className="btn-link" type="button" onClick={onRama} title="Agregar un puesto debajo de este"><Plus size={15} aria-hidden="true" /> Rama</button>
          <button className="btn-link" type="button" onClick={onQuitar} title="Quitar este puesto y sus ramas"><Trash2 size={15} aria-hidden="true" /> Quitar</button>
        </span>
      )}
    </div>
  )
}

function Rama({ lista, numeros, puedeNodo, acciones }: { lista: Arbol[]; numeros: Map<string, string | null>; puedeNodo: (n: Nodo) => boolean; acciones: { editar: (n: Nodo) => void; rama: (n: Nodo) => void; quitar: (n: Nodo) => void } }) {
  return (
    <ul>
      {lista.map((n) => (
        <li key={n.id}>
          <Tarjeta n={n} whatsapp={numeros.get(n.id)} puede={puedeNodo(n)} onEditar={() => acciones.editar(n)} onRama={() => acciones.rama(n)} onQuitar={() => acciones.quitar(n)} />
          {!!n.hijos.length && <Rama lista={n.hijos} numeros={numeros} puedeNodo={puedeNodo} acciones={acciones} />}
        </li>
      ))}
    </ul>
  )
}

/**
 * «Conoce al equipo de SST» (04/11/2026): organigrama con puestos y nombres, sin decir qué rol tiene cada cuenta. Lo ven todas las personas de
 * la empresa (según su sede) y lo cambian solo los administradores y los gestores: nombres, puestos y ramas. El dueño de la plataforma decide
 * por empresa si la sección está habilitada. Con `inicio` es la tarjeta del inicio (solo lectura); sin él, la pantalla completa.
 */
export function EquipoSst({ online, inicio = false, puedeEditar = false, esGeneral = false, esGestor = false, sedes = [] }:
  { online: boolean; inicio?: boolean; puedeEditar?: boolean; esGeneral?: boolean; esGestor?: boolean; sedes?: SedeMia[] }) {
  const [nodos, setNodos] = useState<Nodo[] | null>(null)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [habilitado, setHabilitado] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)

  const cargar = useCallback(() => {
    listarNodos().then((n) => { setNodos(n); setError(null) }, (e) => setError((e as Error).message))
    listarContactos().then(setContactos, () => setContactos([]))
  }, [])
  useEffect(() => {
    if (!online) return
    equipoSstHabilitado().then((h) => {
      setHabilitado(h)
      if (h) cargar()
    }, (e) => setError((e as Error).message))
  }, [online, cargar])

  const arbol = useMemo(() => armar(nodos ?? []), [nodos])
  const numeros = useMemo(() => new Map(contactos.map((c) => [c.nodo_id, c.whatsapp])), [contactos])
  const misSedes = useMemo(() => new Set(sedes.map((s) => s.id)), [sedes])
  const puedeNodo = (n: Nodo) => puedeEditar && !inicio && (n.sede_id ? esGeneral || misSedes.has(n.sede_id) : esGeneral)

  async function quitar(n: Nodo) {
    if (!window.confirm(`¿Quitar «${n.puesto}» y todas sus ramas?`)) return
    try {
      await quitarNodo(n.id)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const acciones = { editar: (n: Nodo) => setEditor({ modo: 'editar', nodo: n }), rama: (n: Nodo) => setEditor({ modo: 'agregar', padre: n }), quitar: (n: Nodo) => void quitar(n) }

  const contenido = habilitado === false ? <p className="nota">Esta sección no está habilitada para tu empresa. Si la quieres, pídesela a Integrax.</p>
    : !nodos ? <p className="nota">{online ? 'Cargando…' : 'El equipo se ve con señal.'}</p>
    : !nodos.length ? <p className="nota">Todavía no se ha armado el organigrama del equipo de SST.</p>
    : <div className="org-arbol" role="tree" aria-label="Organigrama del equipo de SST"><Rama lista={arbol} numeros={numeros} puedeNodo={puedeNodo} acciones={acciones} /></div>

  if (inicio) {
    if (habilitado === false) return null
    return (
      <Seccion titulo="Conoce al equipo de SST">
        <Aviso>{error}</Aviso>
        {contenido}
      </Seccion>
    )
  }
  const vacio = habilitado !== false && nodos !== null && !nodos.length
  return (
    <div className="detalle">
      <button className="btn-link volver" type="button" onClick={() => ir('/')}>
        <ArrowLeft size={18} aria-hidden="true" /> Inicio
      </button>
      <header className="detalle-cab">
        <h1>Equipo de SST</h1>
        <p>Las personas de seguridad y salud en el trabajo de tus sedes. Escríbeles si tienes una duda o quieres avisar de algo.</p>
      </header>
      <Aviso>{error}</Aviso>
      {esGestor && habilitado !== false && <MiWhatsapp online={online} onCambio={cargar} />}
      {puedeEditar && habilitado !== false && nodos && (
        <div className="acciones">
          <button className="btn-sec" type="button" onClick={() => setEditor({ modo: 'agregar', padre: null })}>
            <Plus size={18} aria-hidden="true" /> Agregar puesto
          </button>
          {vacio && esGeneral && (
            <button className="btn" type="button" onClick={() => void armarEquipoActual().then(cargar, (e) => setError((e as Error).message))}>
              Armar con el equipo actual
            </button>
          )}
        </div>
      )}
      {editor && <FormNodo vinculoActual={editor.modo === 'editar' ? (contactos.find((c) => c.nodo_id === editor.nodo.id)?.vinculo_id ?? '') : ''} key={editor.modo === 'editar' ? editor.nodo.id : (editor.padre?.id ?? 'raiz')} editor={editor} esGeneral={esGeneral} sedes={sedes} onCancelar={() => setEditor(null)} onListo={() => { setEditor(null); cargar() }} />}
      {contenido}
    </div>
  )
}

function FormNodo({ editor, vinculoActual, esGeneral, sedes, onCancelar, onListo }: { editor: Editor; vinculoActual: string; esGeneral: boolean; sedes: SedeMia[]; onCancelar: () => void; onListo: () => void }) {
  const editando = editor.modo === 'editar'
  const [puesto, setPuesto] = useState(editando ? editor.nodo.puesto : '')
  const [nombre, setNombre] = useState(editando ? (editor.nodo.nombre ?? '') : '')
  const sedeInicial = editor.modo === 'agregar' ? (editor.padre?.sede_id ?? (esGeneral ? '' : (sedes[0]?.id ?? ''))) : ''
  const [sede, setSede] = useState(sedeInicial)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [cuenta, setCuenta] = useState(vinculoActual)
  const [gestores, setGestores] = useState<{ vinculo_id: string; nombre: string }[]>([])
  const sedeDelPuesto = editor.modo === 'editar' ? editor.nodo.sede_id : (sede || null)
  useEffect(() => {
    gestoresParaVincular(sedeDelPuesto).then(setGestores, () => setGestores([]))
  }, [sedeDelPuesto])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      let id = editor.modo === 'editar' ? editor.nodo.id : ''
      if (editor.modo === 'editar') await editarNodo(id, puesto, nombre)
      else id = await agregarNodo(editor.padre?.id ?? null, sede || null, puesto, nombre)
      if (cuenta !== vinculoActual) await vincularNodo(id, cuenta || null)
      onListo()
    } catch (er) {
      setError((er as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <form className="form seccion" onSubmit={(e) => void guardar(e)}>
      <h2>{editando ? 'Cambiar puesto y nombre' : editor.padre ? `Agregar una rama debajo de «${editor.padre.puesto}»` : 'Agregar un puesto'}</h2>
      <Campo etiqueta="Puesto" value={puesto} onChange={(e) => setPuesto(e.target.value)} maxLength={60} required placeholder="Ej.: Supervisor de seguridad" />
      <Campo etiqueta="Nombre" opcional ayuda="Déjalo vacío si el puesto está por cubrir." value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
      {!editando && (esGeneral || sedes.length > 1) && (
        <label className="field">
          <span>Sede</span>
          <select value={sede} onChange={(e) => setSede(e.target.value)}>
            {esGeneral && <option value="">Toda la empresa</option>}
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>Persona con cuenta de gestor <em className="opcional">(opcional)</em></span>
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
          <option value="">— Sin vincular —</option>
          {gestores.map((g) => <option key={g.vinculo_id} value={g.vinculo_id}>{g.nombre}</option>)}
        </select>
        <small className="ayuda">Si vinculas a un gestor y él publicó su WhatsApp, el número aparece en este puesto.</small>
      </label>
      <Aviso>{error}</Aviso>
      <div className="acciones">
        <button className="btn" type="submit" disabled={ocupado || puesto.trim().length < 2}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button className="btn-link" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

/** El gestor publica su número: aparece en su puesto del organigrama (si está vinculado). Es opcional y lo puede borrar cuando quiera. */
function MiWhatsapp({ online, onCambio }: { online: boolean; onCambio: () => void }) {
  const [numero, setNumero] = useState('')
  const [cargado, setCargado] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'ok'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    if (online) leerMiWhatsapp().then((n) => { setNumero(n); setCargado(true) }, (e) => setAviso({ tipo: 'error', texto: (e as Error).message }))
  }, [online])
  async function guardar(valor: string) {
    setAviso(null)
    setOcupado(true)
    try {
      await guardarMiWhatsapp(valor)
      setNumero(valor ? await leerMiWhatsapp() : '')
      setAviso({ tipo: 'ok', texto: valor ? 'Tu número quedó publicado.' : 'Tu número se borró: ya no se ve.' })
      onCambio()
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Seccion titulo="Tu WhatsApp">
      <p className="nota">
        <b>WhatsApp corporativo, opcional.</b> Es el número que te da la empresa, no uno personal. Solo se muestra si lo publicas, en tu puesto del organigrama (si el administrador te vinculó a él), y lo ven las personas que comparten sede contigo. Si lo borras, no se muestra nada. Solo tú puedes cambiarlo o borrarlo.
      </p>
      <div className="form">
        <Campo etiqueta="WhatsApp corporativo, opcional" type="tel" inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} placeholder="987 654 321" disabled={!cargado || ocupado} />
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
        <div className="acciones">
          <button className="btn" type="button" disabled={!online || !cargado || ocupado || !numero.trim()} onClick={() => void guardar(numero)}>{ocupado ? 'Guardando…' : 'Publicar'}</button>
          <button className="btn-link" type="button" disabled={!online || !cargado || ocupado || !numero} onClick={() => void guardar('')}>Borrar mi número</button>
        </div>
      </div>
    </Seccion>
  )
}
