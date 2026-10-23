// Revisión de las filas del Excel de personal (tarea 3.6, paso 4). No graba nada: dice qué pasaría con cada fila.
// Se usa para la vista previa y, otra vez, justo antes de grabar (paso 5), para que nadie se salte las reglas.
// Las personas se reconocen por TIPO + NÚMERO de documento (no por el nombre).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

export const FILAS_MAXIMAS = 300

export type Fila = {
  fila: number
  tipo: string
  numero: string
  numeroEraNumero?: boolean
  nombres: string
  fecha: string | null
  fechaTexto?: string
  puesto: string
  gerencia: string
  area: string
  subarea: string
  rol: string
}

export type Estado =
  | 'nueva' // cuenta nueva: recibirá contraseña inicial
  | 'alta_cuenta_existente' // ya tenía cuenta en CRC (cesada en otra empresa): se da de alta aquí con su contraseña de siempre
  | 'sin_cambios' // ya está en la empresa y todo es igual
  | 'actualizar' // ya está en la empresa: se actualizan los datos que cambiaron
  | 'reactivar' // estaba cesada en esta empresa: se reactiva solo si el administrador lo marca
  | 'administrador' // es administrador: el Excel no lo modifica
  | 'falta_lista' // su puesto o su área no existen todavía en las listas de la empresa
  | 'error'

export type Revisada = {
  fila: number
  tipo: string
  numero: string
  nombres: string
  estado: Estado
  motivos: string[] // por qué no se puede cargar (estado «error»)
  cambios: string[] // qué cambiaría (estado «actualizar» o «reactivar»)
  faltan: string[] // qué falta crear en las listas (estado «falta_lista»)
  // Datos ya resueltos para grabar:
  persona_id?: string
  vinculo_id?: string
  puesto_id?: string | null
  unidad_id?: string | null
  fecha?: string
  rol?: string
}

// «necesario»: lo usa al menos una fila sin otros errores (la vista previa lo propone marcado para crear).
export type Faltante = ({ tipo: 'puesto'; nombre: string } | { tipo: 'unidad'; nivel: 'gerencia' | 'area' | 'subarea'; camino: string[] }) & {
  filas: number[]
  necesario: boolean
}

export type Resultado = {
  filas: Revisada[]
  faltantes: Faltante[]
  noAparecen: { vinculo_id: string; apellidos_nombres: string; tipo_documento: string; numero_documento: string; rol: string }[]
}

const TIPOS: Record<string, string> = { DNI: 'dni', CE: 'ce', PAS: 'pas', 'CARNET DE EXTRANJERIA': 'ce', PASAPORTE: 'pas' }
const NOMBRE_TIPO: Record<string, string> = { dni: 'DNI', ce: 'CE', pas: 'PAS' }

/** Para comparar nombres de listas sin que importen mayúsculas, tildes ni espacios de más. */
export const comparable = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const limpio = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim()
export const normalizarNumero = (s: string) => String(s ?? '').toUpperCase().replace(/[\s.-]/g, '')

function hoyLima(): string {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)
}
function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86400_000).toISOString().slice(0, 10)
}
const fechaPeru = (iso: string) => iso.split('-').reverse().join('/')

type Unidad = { id: string; nivel: string; padre_id: string | null; nombre: string; vigente: boolean }

/** Revisa todas las filas para una empresa. `admin` es el cliente con permisos del servidor. */
export async function revisar(admin: SupabaseClient, empresaId: string, entrada: Fila[]): Promise<Resultado> {
  const [{ data: tiposDoc }, { data: puestos }, { data: unidades }] = await Promise.all([
    admin.from('tipos_documento').select('codigo, patron'),
    admin.from('puestos').select('id, nombre, vigente').eq('empresa_id', empresaId),
    admin.from('unidades').select('id, nivel, padre_id, nombre, vigente').eq('empresa_id', empresaId),
  ])
  const patron = new Map((tiposDoc ?? []).map((t) => [t.codigo as string, new RegExp(t.patron as string)]))
  const listaUnidades = (unidades ?? []) as Unidad[]
  const vigenteRama = (u: Unidad | undefined): boolean =>
    !u ? true : u.vigente && vigenteRama(listaUnidades.find((x) => x.id === u.padre_id))
  const buscarUnidad = (nivel: string, padre: string | null, nombre: string) =>
    listaUnidades.find((u) => u.nivel === nivel && u.padre_id === padre && comparable(u.nombre) === comparable(nombre))
  const buscarPuesto = (nombre: string) => (puestos ?? []).find((p) => comparable(p.nombre as string) === comparable(nombre))

  // Personas que ya existen con esos números (de cualquier tipo, para avisar de posibles errores de tipeo).
  const numeros = [...new Set(entrada.map((f) => normalizarNumero(f.numero)).filter(Boolean))]
  const { data: personas } = numeros.length
    ? await admin.from('personas').select('id, tipo_documento, numero_documento, apellidos_nombres').in('numero_documento', numeros)
    : { data: [] }
  const ids = (personas ?? []).map((p) => p.id as string)
  const { data: vinculos } = ids.length
    ? await admin.from('vinculos').select('id, persona_id, empresa_id, rol, estado, fecha_ingreso, puesto_id, unidad_id, actualizado_en').in('persona_id', ids)
    : { data: [] }

  const hoy = hoyLima()
  const maxFecha = sumarDias(hoy, 90)
  const vistos = new Map<string, number>() // tipo:numero → primera fila donde apareció
  const faltantes = new Map<string, Faltante>()
  const anotar = (clave: string, f: Faltante) => {
    if (!faltantes.has(clave)) faltantes.set(clave, f)
    faltantes.get(clave)!.filas.push(filaActual)
  }
  let filaActual = 0
  const filas: Revisada[] = []

  for (const f of entrada.slice(0, FILAS_MAXIMAS)) {
    filaActual = f.fila
    const motivos: string[] = []
    const faltan: string[] = []
    const tipo = TIPOS[limpio(f.tipo).toUpperCase()] ?? null
    const numero = normalizarNumero(f.numero)
    const nombres = limpio(f.nombres)
    const r: Revisada = { fila: f.fila, tipo: tipo ? NOMBRE_TIPO[tipo] : limpio(f.tipo), numero, nombres, estado: 'nueva', motivos, cambios: [], faltan }

    // Documento
    if (!tipo) motivos.push('Tipo de documento no válido: usa DNI, CE o PAS.')
    if (!numero) motivos.push('Falta el número de documento.')
    else if (tipo && !patron.get(tipo)?.test(numero)) {
      let m = tipo === 'dni' ? 'DNI no válido: debe tener 8 dígitos, solo números.' : 'Número no válido: de 6 a 12 letras o números.'
      if (f.numeroEraNumero && tipo === 'dni' && /^\d{1,7}$/.test(numero)) m += ' Excel pudo quitarle un 0 inicial: escribe el número como texto.'
      motivos.push(m)
    }
    const clave = `${tipo}:${numero}`
    if (tipo && numero) {
      const antes = vistos.get(clave)
      if (antes != null) motivos.push(`Repetido: el mismo documento ya está en la fila ${antes}.`)
      else vistos.set(clave, f.fila)
    }

    // Nombre, fecha y rol
    if (nombres.length < 3) motivos.push('Faltan los apellidos y nombres.')
    else if (nombres.length > 200) motivos.push('Apellidos y nombres demasiado largos (máximo 200 caracteres).')
    if (!f.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) motivos.push(`Fecha de ingreso no válida${f.fechaTexto ? ` («${f.fechaTexto}»)` : ''}: usa día/mes/año.`)
    else if (f.fecha < '1950-01-01' || f.fecha > maxFecha) motivos.push(`Fecha de ingreso fuera de rango (${fechaPeru(f.fecha)}).`)
    const rol = limpio(f.rol).toLowerCase()
    if (rol === 'administrador' || rol === 'admin' || rol === 'admin_empresa') motivos.push('Rol no permitido: los administradores los crea Integrax, no el Excel.')
    else if (rol !== 'gestor' && rol !== 'usuario') motivos.push('Rol no válido: usa «gestor» o «usuario».')

    // Puesto y estructura (gerencia → área → subárea opcional; si la subárea repite el área, es lo mismo que vacía)
    let puestoId: string | null = null
    if (limpio(f.puesto)) {
      const p = buscarPuesto(f.puesto)
      if (!p) {
        faltan.push(`Puesto «${limpio(f.puesto)}»`)
        anotar(`p:${comparable(f.puesto)}`, { tipo: 'puesto', nombre: limpio(f.puesto), filas: [], necesario: false })
      } else if (!p.vigente) motivos.push(`El puesto «${p.nombre}» está desactivado: actívalo o elige otro.`)
      else puestoId = p.id as string
    } else motivos.push('Falta el puesto.')

    let unidadId: string | null = null
    const ger = limpio(f.gerencia)
    const are = limpio(f.area)
    const sub = comparable(f.subarea) === comparable(f.area) ? '' : limpio(f.subarea)
    if (!ger) motivos.push('Falta la gerencia.')
    if (!are) motivos.push('Falta el área.')
    if (ger && are) {
      const g = buscarUnidad('gerencia', null, ger)
      const a = g ? buscarUnidad('area', g.id, are) : undefined
      const s = sub && a ? buscarUnidad('subarea', a.id, sub) : undefined
      const camino = [ger, are, sub].filter(Boolean)
      if (!g) {
        faltan.push(`Gerencia «${ger}»`)
        anotar(`g:${comparable(ger)}`, { tipo: 'unidad', nivel: 'gerencia', camino: [ger], filas: [], necesario: false })
      }
      if (!a) {
        faltan.push(`Área «${ger} › ${are}»`)
        anotar(`a:${comparable(ger)}|${comparable(are)}`, { tipo: 'unidad', nivel: 'area', camino: [ger, are], filas: [], necesario: false })
      }
      if (sub && !s) {
        faltan.push(`Subárea «${camino.join(' › ')}»`)
        anotar(`s:${camino.map(comparable).join('|')}`, { tipo: 'unidad', nivel: 'subarea', camino, filas: [], necesario: false })
      }
      const elegida = sub ? s : a
      if (elegida) {
        if (!vigenteRama(elegida)) motivos.push(`«${camino.join(' › ')}» está desactivada: actívala o elige otra.`)
        else unidadId = elegida.id
      }
    }

    // ¿La persona ya existe? Solo por tipo + número.
    if (tipo && numero && !motivos.some((m) => m.startsWith('Repetido'))) {
      const persona = (personas ?? []).find((p) => p.tipo_documento === tipo && p.numero_documento === numero)
      const otroTipo = (personas ?? []).find((p) => p.tipo_documento !== tipo && p.numero_documento === numero)
      if (!persona && otroTipo) {
        motivos.push(`Ya existe una persona con este número como ${NOMBRE_TIPO[otroTipo.tipo_documento as string]}: revisa el tipo de documento.`)
      }
      if (persona) {
        r.persona_id = persona.id as string
        const suyos = (vinculos ?? []).filter((v) => v.persona_id === persona.id)
        const activo = suyos.find((v) => v.estado === 'activo')
        if (activo && activo.empresa_id !== empresaId) {
          motivos.push('Esta persona tiene una cuenta activa en otra empresa: debe cesarse allí primero.')
        } else if (activo) {
          r.vinculo_id = activo.id as string
          if (activo.rol === 'admin_empresa') r.estado = 'administrador'
          else {
            const cambios = r.cambios
            if (comparable(persona.apellidos_nombres as string) !== comparable(nombres) && nombres.length >= 3) cambios.push(`Nombre: «${persona.apellidos_nombres}» → «${nombres}»`)
            if (f.fecha && activo.fecha_ingreso !== f.fecha) cambios.push(`Fecha de ingreso: ${fechaPeru(activo.fecha_ingreso as string)} → ${fechaPeru(f.fecha)}`)
            if (puestoId && activo.puesto_id !== puestoId) cambios.push('Puesto')
            if (unidadId && activo.unidad_id !== unidadId) cambios.push('Área o subárea')
            if ((rol === 'gestor' || rol === 'usuario') && activo.rol !== rol) cambios.push(`Rol: ${activo.rol} → ${rol}`)
            r.estado = cambios.length ? 'actualizar' : 'sin_cambios'
          }
        } else {
          const cesadoAqui = suyos
            .filter((v) => v.empresa_id === empresaId)
            .sort((x, y) => String(y.actualizado_en).localeCompare(String(x.actualizado_en)))[0]
          if (cesadoAqui) {
            r.vinculo_id = cesadoAqui.id as string
            if (cesadoAqui.rol === 'admin_empresa') motivos.push('Era administrador de esta empresa: solo Integrax puede reactivarlo.')
            r.estado = 'reactivar'
            r.cambios.push('Estaba cesada en esta empresa: se reactivará si lo marcas')
          } else r.estado = 'alta_cuenta_existente'
        }
      }
    }

    if (motivos.length) r.estado = 'error'
    else if (faltan.length && r.estado !== 'administrador') r.estado = 'falta_lista'
    r.puesto_id = puestoId
    r.unidad_id = unidadId
    if (f.fecha) r.fecha = f.fecha
    if (rol === 'gestor' || rol === 'usuario') r.rol = rol
    filas.push(r)
  }

  // Gestores y usuarios activos de la empresa que no aparecen en el Excel (decisión 9: «por revisar» si es la lista completa).
  const enExcel = new Set(filas.filter((x) => x.persona_id).map((x) => x.persona_id))
  const { data: activos } = await admin.from('vinculos')
    .select('id, rol, persona_id, personas!inner(tipo_documento, numero_documento, apellidos_nombres)')
    .eq('empresa_id', empresaId).eq('estado', 'activo').in('rol', ['gestor', 'usuario'])
  const noAparecen = (activos ?? [])
    .filter((v) => !enExcel.has(v.persona_id as string))
    .map((v) => {
      const p = v.personas as unknown as { tipo_documento: string; numero_documento: string; apellidos_nombres: string }
      return { vinculo_id: v.id as string, rol: v.rol as string, apellidos_nombres: p.apellidos_nombres, tipo_documento: NOMBRE_TIPO[p.tipo_documento] ?? p.tipo_documento, numero_documento: p.numero_documento }
    })
    .sort((a, b) => a.apellidos_nombres.localeCompare(b.apellidos_nombres, 'es'))

  const conError = new Set(filas.filter((x) => x.estado === 'error').map((x) => x.fila))
  for (const fal of faltantes.values()) fal.necesario = fal.filas.some((n) => !conError.has(n))
  return { filas, faltantes: [...faltantes.values()], noAparecen }
}
