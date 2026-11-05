-- Nivel 2, punto 2 (04/11/2026): la prueba pruebas/facultades.mjs deja de acumular solicitudes, historial y facultades en la Empresa D.
-- Como nadie escribe directo en esas tablas, la prueba usa esta función, con candados: solo el dueño de la plataforma, solo la empresa ficticia D (RUC 20000000052),
-- solo lo creado desde una hora de inicio reciente (no puede borrar lo anterior ni con una fecha vieja) y solo estas tres tablas.
-- No toca empresas, sedes, unidades, puestos, personas, vínculos, roles ni permisos.

create function public.limpiar_pruebas_facultades(p_empresa uuid, p_desde timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s integer; h integer; f integer;
begin
  perform app.exigir_dueno();
  if not exists (select 1 from public.empresas where id = p_empresa and ruc = '20000000052' and es_prueba and razon_social ilike '%ficticia%') then
    raise exception 'Solo se limpia la empresa ficticia D de las pruebas' using errcode = '42501';
  end if;
  if p_desde is null or p_desde < now() - interval '3 hours' or p_desde > now() then
    raise exception 'La hora de inicio debe ser de las últimas 3 horas' using errcode = '22023';
  end if;
  delete from public.solicitudes_cambio where empresa_id = p_empresa and solicitado_en >= p_desde;
  get diagnostics s = row_count;
  delete from public.facultades_historial where empresa_id = p_empresa and hecho_en >= p_desde;
  get diagnostics h = row_count;
  delete from public.facultades_persona where empresa_id = p_empresa and otorgado_en >= p_desde;
  get diagnostics f = row_count;
  return jsonb_build_object('solicitudes', s, 'historial', h, 'facultades', f);
end $$;

revoke all on function public.limpiar_pruebas_facultades(uuid, timestamptz) from anon, public;
grant execute on function public.limpiar_pruebas_facultades(uuid, timestamptz) to authenticated;
