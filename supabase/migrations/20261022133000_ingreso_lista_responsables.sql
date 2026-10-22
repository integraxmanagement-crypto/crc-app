-- Tarea 3.1 · El gestor ve la lista de personas de SU empresa para asignar responsables,
-- pero solo nombres, puesto y área (sin número de documento ni datos de cese).
-- RLS filtra filas, no columnas; por eso esta lista sale de una función que devuelve solo esas columnas.

insert into public.permisos (codigo, descripcion) values
  ('personas.ver_nombres', 'Ver nombres, puesto y área de las personas activas de su empresa (para asignar responsables).');

insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'personas.ver_nombres'),
  ('gestor', 'personas.ver_nombres');

create function public.personas_de_mi_empresa()
returns table (persona_id uuid, apellidos_nombres text, puesto text, area text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.apellidos_nombres, v.puesto, v.area
  from public.vinculos v
  join public.personas p on p.id = v.persona_id
  where v.empresa_id = app.mi_empresa()
    and v.estado = 'activo'
    and app.tengo_permiso('personas.ver_nombres')
  order by p.apellidos_nombres;
$$;

revoke all on function public.personas_de_mi_empresa() from public, anon;
grant execute on function public.personas_de_mi_empresa() to authenticated;
