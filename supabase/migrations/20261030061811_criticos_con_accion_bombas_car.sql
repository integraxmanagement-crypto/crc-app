-- Críticos con acción (30/10/2026, dueño): todo punto crítico genera hallazgo y pide acción correctiva, responsable y plazo. Versión nueva de la caseta (CAR) y de las bombas (genérica, motobomba y electrobomba); en la electrobomba, la hora de inicio (antes y final) es de tipo hora. Las versiones anteriores quedan retiradas. No toca personas, empresas, roles ni permisos.
create temp table _nuevas on commit drop as
select p.id as plantilla_id, p.codigo,
  jsonb_set(v.receta, '{secciones}', (
    select jsonb_agg(jsonb_set(s, '{puntos}', (
      select jsonb_agg(
        case
          when p.codigo = 'car' and (pt->>'critico')::boolean then pt || '{"hallazgo":"no_cumple","pide_accion":true}'::jsonb
          when p.codigo <> 'car' and pt->>'hallazgo' = 'no_cumple' then pt || '{"critico":true,"pide_accion":true}'::jsonb
          when p.codigo = 'electrobomba' and pt->>'clave' in ('EB-P02A', 'EB-P02F') then pt || '{"tipo":"hora"}'::jsonb
          else pt end order by o)
      from jsonb_array_elements(s->'puntos') with ordinality x(pt, o))) order by so)
    from jsonb_array_elements(v.receta->'secciones') with ordinality y(s, so))) as receta
from public.plantillas p join public.plantillas_versiones v on v.plantilla_id = p.id and v.estado = 'vigente'
where p.empresa_id is null and p.codigo in ('car', 'bombas', 'motobomba', 'electrobomba');
update public.plantillas_versiones v set estado = 'retirada' from _nuevas n where v.plantilla_id = n.plantilla_id and v.estado = 'vigente';
insert into public.plantillas_versiones (plantilla_id, numero, estado, logo, receta, huella, publicado_en)
select n.plantilla_id, (select coalesce(max(numero), 0) + 1 from public.plantillas_versiones where plantilla_id = n.plantilla_id), 'vigente', 'positivo', n.receta,
  encode(extensions.digest(convert_to(n.receta::text, 'UTF8'), 'sha256'), 'hex'), now() from _nuevas n;
update public.plantillas set actualizado_en = now() where id in (select plantilla_id from _nuevas);
