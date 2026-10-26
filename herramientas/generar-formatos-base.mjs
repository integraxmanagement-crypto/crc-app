// Genera la migración con el contenido BASE de CRC (tarea 3.4-B): listas, tipos de activo y las 6 plantillas,
// a partir de src/formatos/base.ts (textos del anexo de Cowork). No contiene personas, empresas ni lugares.
// Uso: node herramientas/generar-formatos-base.mjs > archivo.sql
import { LISTAS_BASE, PLANTILLAS_BASE, TIPOS_ACTIVO_BASE } from '../src/formatos/base.ts'
import { validarReceta } from '../src/formatos/receta.ts'

const texto = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const json = (o) => {
  const j = JSON.stringify(o)
  if (j.includes('$j$')) throw new Error('El contenido no puede llevar $j$')
  return `$j$${j}$j$::jsonb`
}

const l = []
l.push('-- Tarea 3.4-B · Contenido base de CRC: listas editables, 4 tipos de activo y las 6 plantillas de inspección.')
l.push('-- Generado con herramientas/generar-formatos-base.mjs desde src/formatos/base.ts (anexo de textos base de Cowork,')
l.push('-- v01 del 26/10/2026). Es contenido del producto, no datos de prueba: no hay personas, empresas ni lugares.')
l.push('-- Va con empresa vacía (= base): cada empresa lo copia y lo adapta. Las versiones base quedan publicadas (vigentes).')
l.push('')
for (const lista of LISTAS_BASE) {
  l.push(`with l as (insert into public.listas (codigo, nombre) values (${texto(lista.codigo)}, ${texto(lista.nombre)}) returning id)`)
  l.push(`insert into public.listas_valores (lista_id, nombre, orden) select l.id, v.nombre, v.orden from l,`)
  l.push(`  (values ${lista.valores.map((v, i) => `(${texto(v)}, ${i + 1})`).join(', ')}) as v (nombre, orden);`)
}
l.push('')
for (const t of TIPOS_ACTIVO_BASE) {
  l.push(`insert into public.tipos_activo (codigo, nombre, subtipos, campos, dotacion) values (${texto(t.codigo)}, ${texto(t.nombre)},`)
  l.push(`  ${json(t.subtipos)}, ${json(t.campos)}, ${t.dotacion});`)
}
l.push('')
for (const p of PLANTILLAS_BASE) {
  const problemas = validarReceta(p.receta, true)
  if (problemas.length) throw new Error(`${p.codigo}: ${problemas.join(' | ')}`)
  const tipo = p.tipo_activo ? `(select id from public.tipos_activo where empresa_id is null and codigo = ${texto(p.tipo_activo)})` : 'null'
  l.push(`with p as (insert into public.plantillas (codigo, nombre, descripcion, aplica_a, tipo_activo_id, frecuencia)`)
  l.push(`  values (${texto(p.codigo)}, ${texto(p.nombre)}, ${texto(p.descripcion)}, ${texto(p.aplica_a)}, ${tipo}, ${texto(p.frecuencia)}) returning id),`)
  l.push(`r as (select ${json(p.receta)} as receta)`)
  l.push(`insert into public.plantillas_versiones (plantilla_id, numero, estado, logo, receta, huella, publicado_en)`)
  l.push(`select p.id, 1, 'vigente', 'positivo', r.receta, encode(extensions.digest(convert_to(r.receta::text, 'UTF8'), 'sha256'), 'hex'), now() from p, r;`)
}
l.push('')
l.push('-- Revisión final: las 6 recetas pasan la misma revisión que se exige para publicar.')
l.push('do $$ declare v record; begin')
l.push('  for v in select receta from public.plantillas_versiones where empresa_id is null loop')
l.push('    perform app.validar_receta(v.receta, true);')
l.push('  end loop;')
l.push('end $$;')
process.stdout.write(l.join('\n') + '\n')
