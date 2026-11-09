// Registro de entrega de EPP en Excel o PDF, igual al formato de la organización (09/11/2026).
// El Excel base es el que entregó el dueño, con marcas {{…}} en las celdas de datos (src/epp/formato-epp.xlsx); el diseño no cambia.
// Una fila por entrega; si hay más filas que las dibujadas en el formato, se agregan. Lo arma el equipo, sin librerías.
import { db } from '../empresas/datos'
import { llenarExcelPeriodo } from '../inspecciones/excelPeriodo'
import plantillaUrl from './formato-epp.xlsx?url'
import { type ConfigFormato, type Entrega, NOMBRE_DOC, type Trabajador } from './datos'

export type EmpresaEpp = { razon_social: string; ruc: string; domicilio: string; actividad: string; trabajadores: number | null; logo_positivo: string | null }

const fechaPeru = (f: string | null) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '')
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')

/** Datos de la empresa para el encabezado del registro. */
export async function leerEmpresaEpp(empresaId: string): Promise<EmpresaEpp> {
  const { data } = await db().from('empresas').select('razon_social, ruc, domicilio_direccion, domicilio_distrito, domicilio_provincia, domicilio_departamento, actividad_texto, logo_positivo').eq('id', empresaId).single()
  const e = (data ?? {}) as Record<string, string | null>
  const n = await db().rpc('numero_trabajadores', { p_empresa: empresaId }).then((r) => (r.error ? null : (r.data as number | null)), () => null)
  return {
    razon_social: e.razon_social ?? '',
    ruc: e.ruc ?? '',
    domicilio: [e.domicilio_direccion, [e.domicilio_distrito, e.domicilio_provincia, e.domicilio_departamento].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    actividad: e.actividad_texto ?? '',
    trabajadores: n,
    logo_positivo: e.logo_positivo ?? null,
  }
}

async function logoPng(ruta: string | null): Promise<Uint8Array | null> {
  if (!ruta) return null
  try {
    const r = await db().storage.from('logos').download(ruta)
    if (r.error) return null
    const imagen = await createImageBitmap(r.data)
    const lienzo = document.createElement('canvas')
    lienzo.width = imagen.width
    lienzo.height = imagen.height
    lienzo.getContext('2d')!.drawImage(imagen, 0, 0)
    const png = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/png'))
    return png ? new Uint8Array(await png.arrayBuffer()) : null
  } catch {
    return null
  }
}

export type EntradaEpp = {
  empresa: EmpresaEpp
  config: ConfigFormato
  trabajador: Trabajador
  entregas: Entrega[]
  /** El gestor (o administrador) que genera el registro: es el «Responsable del Registro». */
  responsable: { nombre: string; cargo: string; fecha: string }
  firma: Uint8Array | null
}

export async function armarRegistroEpp(o: EntradaEpp) {
  const archivo = new Uint8Array(await (await fetch(plantillaUrl)).arrayBuffer())
  const t = o.trabajador
  const general: Record<string, string> = {
    codigo_formato: o.config.codigo_formato ?? '',
    version_formato: o.config.version_formato ?? '',
    fecha_aprobacion: fechaPeru(o.config.fecha_aprobacion),
    numero_registro: '',
    razon_social: o.empresa.razon_social,
    ruc: o.empresa.ruc,
    trabajadores: o.empresa.trabajadores == null ? '' : String(o.empresa.trabajadores),
    domicilio: o.empresa.domicilio,
    actividad: o.empresa.actividad,
    trabajador: t.apellidos_nombres,
    cargo: t.cargo ?? '',
    area: t.area ?? '',
    tipo_documento: t.tipo_documento === 'dni' ? 'DNI' : NOMBRE_DOC[t.tipo_documento],
    documento: t.numero_documento,
    codigo_trabajador: t.codigo_trabajador ?? '',
    logo: '',
    'firma.registro.nombre': o.responsable.nombre,
    'firma.registro.cargo': o.responsable.cargo,
    'firma.registro.fecha': fechaPeru(o.responsable.fecha),
    'firma.registro.imagen': '',
  }
  const filas = o.entregas.map((e, i) => {
    const valores: Record<string, string> = {
      n: String(i + 1),
      epp: e.epp_nombre,
      fecha: fechaPeru(e.fecha_entrega),
      perdida: e.motivo === 'perdida' ? 'X' : '',
      renovacion: e.motivo === 'renovacion' ? 'X' : '',
      nuevo: e.motivo === 'nuevo' ? 'X' : '',
      conformidad: e.conformidad_en ? `Conforme ${fechaHora(e.conformidad_en)}` : 'Pendiente',
      fecha_renovacion: fechaPeru(e.fecha_renovacion),
    }
    return (marca: string) => valores[marca] ?? ''
  })
  const imagenes = new Map<string, Uint8Array>()
  if (o.firma) imagenes.set('firma.registro.imagen', o.firma)
  const logo = await logoPng(o.empresa.logo_positivo)
  if (logo) imagenes.set('logo', logo)
  return llenarExcelPeriodo(archivo, (m) => general[m] ?? '', filas, imagenes.size ? imagenes : undefined, { conservarVacias: true })
}
