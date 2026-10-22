// Completa los datos FICTICIOS de las empresas de prueba A y B (tarea 3.2), con las mismas acciones que usa la app.
// Solo para crc-dev. Contactos, direcciones y teléfonos son inventados; los correos usan la terminación .invalid.
// Uso: node pruebas/preparar-empresas.mjs   (se puede repetir)
import { PNG_FICTICIO, comprobar, ingresarComo, resumen } from './comun.mjs'

const FICHAS = {
  '20000000010': {
    ficha: { razon_social: 'EMPRESA A · Minera Andina Ficticia S.A.C.', domicilio_direccion: 'Jr. Ficticio 456', domicilio_distrito: 'San Isidro',
      domicilio_provincia: 'Lima', domicilio_departamento: 'Lima', ciiu_codigo: '0729', actividad_texto: 'Extracción de minerales (ficticia)' },
    sede: { nombre: 'Sede principal', direccion: 'Jr. Ficticio 456', distrito: 'San Isidro', provincia: 'Lima', departamento: 'Lima' },
  },
  '20000000028': {
    ficha: { razon_social: 'EMPRESA B · Constructora Costa Ficticia S.A.C.', domicilio_direccion: 'Calle Inventada 789', domicilio_distrito: 'Miraflores',
      domicilio_provincia: 'Lima', domicilio_departamento: 'Lima', ciiu_codigo: '4100', actividad_texto: 'Construcción de edificios (ficticia)' },
    sede: { nombre: 'Obra Central (ficticia)', direccion: 'Calle Inventada 789', distrito: 'Miraflores', provincia: 'Lima', departamento: 'Lima' },
    contactos: {
      representante_legal: { nombre: 'PRUEBA REPRESENTANTE B, Mario (ficticio)', telefono: '900000011', correo: 'representante.b@ficticio.invalid' },
      administrador: { nombre: 'PRUEBA CONTACTO B, Nora (ficticia)', telefono: '900000012', correo: 'contacto.b@ficticio.invalid' },
      respaldo: { nombre: 'PRUEBA RESPALDO B, Iván (ficticio)', telefono: '900000013', correo: 'respaldo.b@ficticio.invalid' },
    },
    logo: true,
  },
}

const { c: dueno, error } = await ingresarComo('DUENO')
if (error) throw new Error('El dueño ficticio no pudo ingresar: ' + error.message)
const { data: empresas } = await dueno.from('empresas').select('id, ruc, ciiu_codigo, logo_positivo, plan')

for (const [ruc, d] of Object.entries(FICHAS)) {
  const e = empresas.find((x) => x.ruc === ruc)
  if (!e.ciiu_codigo || ruc === '20000000028') {
    const r = await dueno.rpc('actualizar_empresa', { p_empresa: e.id, p_ficha: { ruc, plan: e.plan, es_prueba: true, ...d.ficha } })
    comprobar(`Ficha de ${ruc} completa`, !r.error, r.error?.message)
  }
  const { data: sedes } = await dueno.from('sedes').select('id').eq('empresa_id', e.id)
  if (!sedes.length) {
    const r = await dueno.rpc('guardar_sede', { p_empresa: e.id, p_sede: null, p_datos: d.sede })
    comprobar(`Primera sede de ${ruc}`, !r.error, r.error?.message)
  }
  if (d.contactos) {
    const r = await dueno.rpc('guardar_contactos', { p_empresa: e.id, p_datos: d.contactos })
    comprobar(`Contactos ficticios de ${ruc}`, !r.error, r.error?.message)
  }
  if (d.logo && !e.logo_positivo) {
    const ruta = `${e.id}/positivo.png`
    const up = await dueno.storage.from('logos').upload(ruta, PNG_FICTICIO, { contentType: 'image/png', upsert: true })
    const reg = up.error ? up : await dueno.rpc('registrar_logo', { p_empresa: e.id, p_tipo: 'positivo', p_ruta: ruta })
    comprobar(`Logo ficticio de ${ruc}`, !reg.error, reg.error?.message)
  }
}
process.exit(resumen() ? 1 : 0)
