-- Etapa 2 (03/11/2026): la corrección que pide un gestor la aplica el administrador con la misma ruta de siempre (registrar-inspeccion, modo «corregir»,
-- que valida con el motor de reglas y queda hecha por él) y después aprueba la solicitud. La base solo acepta la aprobación si esa corrección existe.
drop function public.cerrar_solicitud_servidor(uuid, uuid, text);

create or replace function public.resolver_solicitud(p_id uuid, p_aprobar boolean, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_cambio;
begin
  select * into s from public.solicitudes_cambio where id = p_id for update;
  if s.id is null or not app.puedo_resolver_solicitud(p_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if s.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta' using errcode = '22023'; end if;
  if not p_aprobar then
    if p_comentario is null or length(trim(p_comentario)) < 3 then raise exception 'Escribe por qué se deniega' using errcode = '22023'; end if;
  elsif s.tipo = 'anular_inspeccion' then
    perform public.anular_inspeccion(s.objetivo_id, s.motivo);
  elsif s.tipo = 'cambio_programa' then
    perform app.aplicar_cambio_programa(s);
  elsif s.tipo = 'corregir_inspeccion' then
    if not exists (select 1 from public.inspecciones_ediciones e
                   where e.inspeccion_id = s.objetivo_id and e.hecho_por = (select auth.uid()) and e.hecho_en >= s.solicitado_en
                     and e.edicion = (s.datos ->> 'edicion')::int) then
      raise exception 'Primero aplica la corrección y luego aprueba la solicitud' using errcode = '22023';
    end if;
  end if;
  update public.solicitudes_cambio set estado = case when p_aprobar then 'aprobada' else 'denegada' end, resuelto_por = (select auth.uid()), resuelto_en = now(),
    comentario_resolucion = nullif(trim(coalesce(p_comentario, '')), ''), visto_solicitante = false
  where id = p_id;
end $$;
revoke all on function public.resolver_solicitud(uuid, boolean, text) from public, anon;
grant execute on function public.resolver_solicitud(uuid, boolean, text) to authenticated;
