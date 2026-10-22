-- Tarea 3.1 · El cambio de la contraseña inicial también lo exige la base de datos, no solo la pantalla:
-- mientras no la cambie, la persona solo puede ver su propia ficha (para saber que debe cambiarla).

create or replace function app.es_dueno_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.duenos_plataforma d
    join public.personas p on p.id = d.persona_id
    where d.persona_id = (select auth.uid()) and not p.debe_cambiar_contrasena
  );
$$;

create or replace function app.mi_vinculo_activo() returns public.vinculos
language sql stable security definer set search_path = '' as $$
  select v.* from public.vinculos v
  join public.empresas e on e.id = v.empresa_id
  join public.personas p on p.id = v.persona_id
  where v.persona_id = (select auth.uid()) and v.estado = 'activo' and e.estado = 'activa'
    and not p.debe_cambiar_contrasena
  limit 1;
$$;
