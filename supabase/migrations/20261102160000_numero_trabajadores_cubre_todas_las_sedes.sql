-- Quien tiene todas las sedes de la empresa cuenta también a los administradores generales (que no tienen filas de sedes).
create or replace function public.numero_trabajadores(p_empresa uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when app.es_dueno_plataforma() or p_empresa = app.mi_empresa() then
    (select case when e.trabajadores_modo = 'manual' then e.trabajadores_manual
                 else (select count(*)::integer from public.vinculos v where v.empresa_id = e.id and v.estado = 'activo'
                       and (app.soy_general()
                            or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and app.puedo_sede(vs.sede_id))
                            or (v.rol = 'admin_empresa' and not exists (select 1 from public.sedes s where s.empresa_id = e.id and s.activa and not app.puedo_sede(s.id))))) end
     from public.empresas e where e.id = p_empresa) end;
$$;
