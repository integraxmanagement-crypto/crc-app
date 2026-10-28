-- Tarea 3.4-E · Lista de posibles responsables de actividades del programa: administradores y gestores activos de la
-- empresa (decisión del dueño del 28/10/2026: los usuarios no son responsables). Solo nombres, para elegir.
create function public.passt_responsables(p_empresa uuid)
returns table (persona_id uuid, apellidos_nombres text, rol text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.apellidos_nombres, v.rol
  from public.vinculos v join public.personas p on p.id = v.persona_id
  where v.empresa_id = p_empresa and v.estado = 'activo' and v.rol in ('admin_empresa', 'gestor')
    and app.puedo_en_empresa(p_empresa, 'passt.ver')
  order by p.apellidos_nombres;
$$;
revoke all on function public.passt_responsables(uuid) from public, anon;
grant execute on function public.passt_responsables(uuid) to authenticated;
