-- Tarea 3.4-D · El responsable (usuario) no ve la inspección, pero necesita saber de qué equipo e inspección es su
-- hallazgo: se guardan el número de la inspección y el código del equipo en el propio hallazgo.
alter table public.hallazgos add column inspeccion_numero integer, add column activo_codigo text;
update public.hallazgos h set inspeccion_numero = i.numero, activo_codigo = i.activo_foto ->> 'codigo'
from public.inspecciones i where i.id = h.inspeccion_id;

create or replace function app.sincronizar_hallazgos(i public.inspecciones, p_por uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare x jsonb; d record; nuevo public.hallazgos; claves text[] := '{}'; v_clave text;
begin
  if i.estado <> 'cerrada' then return; end if;
  for x in select * from jsonb_array_elements(coalesce(i.hallazgos, '[]'::jsonb)) loop
    v_clave := (x ->> 'origen') || '|' || coalesce(x ->> 'clave', '') || '|' || coalesce(x ->> 'fila', '-1');
    claves := claves || v_clave;
    if exists (select 1 from public.hallazgos h where h.inspeccion_id = i.id and h.origen = x ->> 'origen'
               and coalesce(h.clave, '') = coalesce(x ->> 'clave', '') and coalesce(h.fila, -1) = coalesce((x ->> 'fila')::integer, -1)) then
      continue;
    end if;
    select * into d from app.datos_hallazgo(i.empresa_id, x);
    insert into public.hallazgos (empresa_id, inspeccion_id, plantilla_id, sede_id, activo_id, origen, clave, fila, texto, accion, responsable_id, plazo,
                                  inspeccion_numero, activo_codigo)
    values (i.empresa_id, i.id, i.plantilla_id, i.sede_id, i.activo_id, x ->> 'origen', x ->> 'clave', (x ->> 'fila')::integer,
            left(coalesce(nullif(trim(x ->> 'texto'), ''), 'Hallazgo'), 1000), d.accion, d.responsable, d.plazo,
            i.numero, i.activo_foto ->> 'codigo')
    returning * into nuevo;
    insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, despues, hecho_por)
    values (nuevo.id, nuevo.empresa_id, 'creado', jsonb_build_object('responsable_id', nuevo.responsable_id, 'plazo', nuevo.plazo, 'accion', nuevo.accion), p_por);
  end loop;
  with quitados as (
    update public.hallazgos h set estado = 'anulado', anulado_motivo = 'Anulado por corrección de la inspección'
    where h.inspeccion_id = i.id and h.estado in ('abierto', 'en_proceso')
      and not ((h.origen || '|' || coalesce(h.clave, '') || '|' || coalesce(h.fila, -1)::text) = any (claves))
    returning h.id, h.empresa_id
  )
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, hecho_por)
  select id, empresa_id, 'anulado', 'Anulado por corrección de la inspección', p_por from quitados;
end $$;
revoke all on function app.sincronizar_hallazgos(public.inspecciones, uuid) from public, anon, authenticated;
