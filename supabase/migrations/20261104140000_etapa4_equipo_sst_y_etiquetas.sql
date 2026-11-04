-- Etapa 4 del punto 2 (04/11/2026): «Conoce al equipo de SST» (puesto y WhatsApp de cada gestor) y roles adicionales como ETIQUETAS sin permisos.
-- Tablas NUEVAS (no se cambia ninguna tabla compartida: personas, vinculos, roles, permisos, etc.). Solo lectura directa; se escribe por funciones.
--  · contacto_sst: el WhatsApp de un gestor. Solo lo escribe el propio gestor (dato personal, opcional). Se lee solo el propio; los demás lo ven por equipo_sst().
--  · etiquetas_persona: miembro del comité, brigadista, monitor de seguridad u otro (con detalle). No dan ningún permiso.

create table public.contacto_sst (
  vinculo_id uuid primary key references public.vinculos (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id),
  whatsapp text not null check (whatsapp ~ '^\+[0-9]{8,15}$'),
  actualizado_en timestamptz not null default now()
);

create table public.etiquetas_persona (
  vinculo_id uuid not null references public.vinculos (id) on delete cascade,
  etiqueta text not null check (etiqueta in ('miembro_comite', 'brigadista', 'monitor_seguridad', 'otro')),
  empresa_id uuid not null references public.empresas (id),
  detalle text check (detalle is null or char_length(detalle) between 3 and 60),
  asignado_por uuid not null,
  asignado_en timestamptz not null default now(),
  primary key (vinculo_id, etiqueta),
  check ((etiqueta = 'otro') = (detalle is not null))
);

-- Lectura: la propia cuenta y quien puede gestionarla.
create function app.puedo_ver_etiquetas(p_vinculo uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vinculos v where v.id = p_vinculo and v.persona_id = (select auth.uid()))
      or app.puedo_gestionar_vinculo(p_vinculo, 'personas.editar');
$$;

alter table public.contacto_sst enable row level security;
alter table public.etiquetas_persona enable row level security;
create policy "Contacto SST: solo el propio" on public.contacto_sst for select to authenticated
  using (exists (select 1 from public.vinculos v where v.id = vinculo_id and v.persona_id = (select auth.uid())));
create policy "Etiquetas: ver" on public.etiquetas_persona for select to authenticated using (app.puedo_ver_etiquetas(vinculo_id));

-- El gestor guarda (o borra, con texto vacío) su propio WhatsApp.
create function public.guardar_mi_whatsapp(p_numero text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos := app.mi_vinculo_activo(); limpio text; n text;
begin
  if v.id is null or v.rol <> 'gestor' then raise exception 'Solo el gestor guarda su WhatsApp' using errcode = '42501'; end if;
  limpio := regexp_replace(coalesce(p_numero, ''), '[\s().-]', '', 'g');
  if limpio = '' then
    delete from public.contacto_sst where vinculo_id = v.id;
    return;
  end if;
  if limpio !~ '^\+?[0-9]{8,15}$' then raise exception 'El número no es válido: usa solo cifras, por ejemplo 987654321' using errcode = '22023'; end if;
  n := case when left(limpio, 1) = '+' then limpio
            when limpio ~ '^9[0-9]{8}$' then '+51' || limpio
            else '+' || limpio end;
  insert into public.contacto_sst (vinculo_id, empresa_id, whatsapp) values (v.id, v.empresa_id, n)
  on conflict (vinculo_id) do update set whatsapp = excluded.whatsapp, actualizado_en = now();
end $$;

-- El equipo de SST que ve cada persona: los gestores activos de sus sedes (el administrador general, los de toda la empresa).
create function public.equipo_sst() returns table (vinculo_id uuid, nombre text, puesto text, whatsapp text, sedes text[])
language sql stable security definer set search_path = '' as $$
  select v.id, p.apellidos_nombres, coalesce(pu.nombre, v.puesto), c.whatsapp,
         coalesce((select array_agg(s.nombre order by s.nombre) from public.vinculos_sedes vs join public.sedes s on s.id = vs.sede_id where vs.vinculo_id = v.id), '{}')
  from public.vinculos v
  join public.personas p on p.id = v.persona_id
  left join public.puestos pu on pu.id = v.puesto_id
  left join public.contacto_sst c on c.vinculo_id = v.id
  where app.mi_empresa() is not null and v.empresa_id = app.mi_empresa() and v.rol = 'gestor' and v.estado = 'activo'
    and (app.soy_general()
         or exists (select 1 from public.vinculos_sedes mia join public.vinculos_sedes suya on suya.sede_id = mia.sede_id
                    where mia.vinculo_id = (app.mi_vinculo_activo()).id and suya.vinculo_id = v.id))
  order by p.apellidos_nombres;
$$;

create function public.dar_etiqueta(p_vinculo uuid, p_etiqueta text, p_detalle text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo;
  if v.id is null or v.estado <> 'activo' or not app.puedo_gestionar_vinculo(p_vinculo, 'personas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_etiqueta not in ('miembro_comite', 'brigadista', 'monitor_seguridad', 'otro') then raise exception 'Esa etiqueta no existe' using errcode = '22023'; end if;
  if p_etiqueta = 'otro' and char_length(btrim(coalesce(p_detalle, ''))) < 3 then raise exception 'Escribe cuál es (al menos 3 letras)' using errcode = '22023'; end if;
  insert into public.etiquetas_persona (vinculo_id, etiqueta, empresa_id, detalle, asignado_por)
  values (p_vinculo, p_etiqueta, v.empresa_id, case when p_etiqueta = 'otro' then btrim(p_detalle) end, (select auth.uid()))
  on conflict (vinculo_id, etiqueta) do update set detalle = excluded.detalle, asignado_por = excluded.asignado_por, asignado_en = now();
end $$;

create function public.quitar_etiqueta(p_vinculo uuid, p_etiqueta text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.puedo_gestionar_vinculo(p_vinculo, 'personas.editar') then raise exception 'No autorizado' using errcode = '42501'; end if;
  delete from public.etiquetas_persona where vinculo_id = p_vinculo and etiqueta = p_etiqueta;
end $$;

revoke all on table public.contacto_sst, public.etiquetas_persona from anon, public, authenticated;
grant select on table public.contacto_sst, public.etiquetas_persona to authenticated;
revoke all on function app.puedo_ver_etiquetas(uuid) from anon, public;
grant execute on function app.puedo_ver_etiquetas(uuid) to authenticated;
revoke all on function public.guardar_mi_whatsapp(text), public.equipo_sst(), public.dar_etiqueta(uuid, text, text), public.quitar_etiqueta(uuid, text) from anon, public;
grant execute on function public.guardar_mi_whatsapp(text), public.equipo_sst(), public.dar_etiqueta(uuid, text, text), public.quitar_etiqueta(uuid, text) to authenticated;
