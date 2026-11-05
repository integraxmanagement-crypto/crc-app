-- Etapa 4c (04/11/2026): el organigrama del equipo de SST pasa a ser PROPIO: puestos y nombres que escriben y cambian los administradores y los gestores
-- (el dueño pidió que la pantalla muestre solo el equipo de SST, con puestos y nombres, sin decir quién es gestor o administrador).
-- Tabla NUEVA (no cambia tablas compartidas). Se lee con RLS (solo lectura directa); se escribe por funciones. El interruptor del dueño sigue mandando.

create table public.equipo_sst_nodos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  sede_id uuid references public.sedes (id) on delete cascade,        -- null = puesto «de toda la empresa» (lo maneja el administrador general)
  padre_id uuid references public.equipo_sst_nodos (id) on delete cascade,
  puesto text not null check (char_length(puesto) between 2 and 60),
  nombre text check (nombre is null or char_length(nombre) between 2 and 80),   -- null = puesto por cubrir
  creado_por uuid not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index equipo_sst_nodos_empresa on public.equipo_sst_nodos (empresa_id, padre_id);

-- Quien puede cambiar un puesto de esa sede: administradores y gestores (no los usuarios gestores). El «de toda la empresa», solo el administrador general.
create function app.puedo_editar_equipo(p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (app.mi_vinculo_activo()).rol in ('admin_empresa', 'admin_sede', 'gestor')
    and case when p_sede is null then (app.mi_vinculo_activo()).rol = 'admin_empresa' else app.puedo_sede(p_sede) end, false);
$$;
-- Quien ve un puesto: las personas de la empresa con acceso a su sede (o a todos si es «de toda la empresa»), si el dueño habilitó la sección.
create function app.veo_nodo_equipo(p_empresa uuid, p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.mi_empresa() is not null and p_empresa = app.mi_empresa() and public.equipo_sst_habilitado()
    and (p_sede is null or app.puedo_sede(p_sede));
$$;

alter table public.equipo_sst_nodos enable row level security;
create policy "Organigrama SST: ver" on public.equipo_sst_nodos for select to authenticated using (app.veo_nodo_equipo(empresa_id, sede_id));

create function public.agregar_nodo_equipo(p_padre uuid, p_sede uuid, p_puesto text, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e uuid := app.mi_empresa(); padre public.equipo_sst_nodos; nuevo uuid; nom text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  if e is null or not app.puedo_editar_equipo(p_sede) or not public.equipo_sst_habilitado() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_sede is not null and not exists (select 1 from public.sedes where id = p_sede and empresa_id = e) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_padre is not null then
    select * into padre from public.equipo_sst_nodos where id = p_padre;
    if padre.id is null or padre.empresa_id <> e or not app.veo_nodo_equipo(padre.empresa_id, padre.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  end if;
  if char_length(btrim(coalesce(p_puesto, ''))) not between 2 and 60 then raise exception 'El puesto debe tener entre 2 y 60 letras' using errcode = '22023'; end if;
  if nom is not null and char_length(nom) not between 2 and 80 then raise exception 'El nombre debe tener entre 2 y 80 letras' using errcode = '22023'; end if;
  insert into public.equipo_sst_nodos (empresa_id, sede_id, padre_id, puesto, nombre, creado_por)
  values (e, p_sede, p_padre, btrim(p_puesto), nom, (select auth.uid())) returning id into nuevo;
  return nuevo;
end $$;

create function public.editar_nodo_equipo(p_nodo uuid, p_puesto text, p_nombre text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.equipo_sst_nodos; nom text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  select * into n from public.equipo_sst_nodos where id = p_nodo;
  if n.id is null or n.empresa_id is distinct from app.mi_empresa() or not app.puedo_editar_equipo(n.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_puesto, ''))) not between 2 and 60 then raise exception 'El puesto debe tener entre 2 y 60 letras' using errcode = '22023'; end if;
  if nom is not null and char_length(nom) not between 2 and 80 then raise exception 'El nombre debe tener entre 2 y 80 letras' using errcode = '22023'; end if;
  update public.equipo_sst_nodos set puesto = btrim(p_puesto), nombre = nom, actualizado_en = now() where id = p_nodo;
end $$;

-- Quitar un puesto quita también sus ramas; solo si quien lo hace maneja todas las sedes de esas ramas.
create function public.quitar_nodo_equipo(p_nodo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.equipo_sst_nodos;
begin
  select * into n from public.equipo_sst_nodos where id = p_nodo;
  if n.id is null or n.empresa_id is distinct from app.mi_empresa() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if exists (
    with recursive abajo as (
      select id, sede_id from public.equipo_sst_nodos where id = p_nodo
      union all
      select h.id, h.sede_id from public.equipo_sst_nodos h join abajo a on h.padre_id = a.id)
    select 1 from abajo where not app.puedo_editar_equipo(sede_id)
  ) then raise exception 'No autorizado: hay ramas de otra sede que no manejas' using errcode = '42501'; end if;
  delete from public.equipo_sst_nodos where id = p_nodo;
end $$;

-- Punto de partida: arma el organigrama con las personas del equipo de SST que ya tiene la empresa (solo el administrador general, solo si está vacío).
create function public.armar_equipo_sst_actual() returns integer
language plpgsql security definer set search_path = '' as $$
declare e uuid := app.mi_empresa(); r record; padre uuid; nuevo uuid; cuantos integer := 0;
begin
  if e is null or not app.puedo_editar_equipo(null) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if exists (select 1 from public.equipo_sst_nodos where empresa_id = e) then raise exception 'El organigrama ya tiene puestos: no se arma de nuevo' using errcode = '22023'; end if;
  create temp table sem (nodo uuid, rol text, sede uuid) on commit drop;
  for r in
    select v.rol, p.apellidos_nombres as nombre, coalesce(pu.nombre, v.puesto) as puesto,
           (select vs.sede_id from public.vinculos_sedes vs where vs.vinculo_id = v.id order by vs.sede_id limit 1) as sede
    from public.vinculos v join public.personas p on p.id = v.persona_id left join public.puestos pu on pu.id = v.puesto_id
    where v.empresa_id = e and v.estado = 'activo' and v.rol in ('admin_empresa', 'admin_sede', 'gestor', 'usuario_gestor')
    order by case v.rol when 'admin_empresa' then 1 when 'admin_sede' then 2 when 'gestor' then 3 else 4 end, p.apellidos_nombres
  loop
    padre := case r.rol
      when 'admin_empresa' then null
      when 'admin_sede' then (select nodo from sem where rol = 'admin_empresa' limit 1)
      when 'gestor' then coalesce((select nodo from sem where rol = 'admin_sede' and sede = r.sede limit 1), (select nodo from sem where rol = 'admin_empresa' limit 1))
      else coalesce((select nodo from sem where rol = 'gestor' and sede = r.sede limit 1), (select nodo from sem where rol = 'admin_sede' and sede = r.sede limit 1),
                    (select nodo from sem where rol = 'admin_empresa' limit 1)) end;
    insert into public.equipo_sst_nodos (empresa_id, sede_id, padre_id, puesto, nombre, creado_por)
    values (e, case when r.rol = 'admin_empresa' then null else r.sede end, padre,
            left(coalesce(nullif(btrim(r.puesto), ''), 'Equipo de SST'), 60), left(r.nombre, 80), (select auth.uid()))
    returning id into nuevo;
    insert into sem values (nuevo, r.rol, r.sede);
    cuantos := cuantos + 1;
  end loop;
  return cuantos;
end $$;

revoke all on table public.equipo_sst_nodos from anon, public, authenticated;
grant select on table public.equipo_sst_nodos to authenticated;
revoke all on function app.puedo_editar_equipo(uuid), app.veo_nodo_equipo(uuid, uuid) from anon, public;
grant execute on function app.puedo_editar_equipo(uuid), app.veo_nodo_equipo(uuid, uuid) to authenticated;
revoke all on function public.agregar_nodo_equipo(uuid, uuid, text, text), public.editar_nodo_equipo(uuid, text, text),
  public.quitar_nodo_equipo(uuid), public.armar_equipo_sst_actual() from anon, public;
grant execute on function public.agregar_nodo_equipo(uuid, uuid, text, text), public.editar_nodo_equipo(uuid, text, text),
  public.quitar_nodo_equipo(uuid), public.armar_equipo_sst_actual() to authenticated;
