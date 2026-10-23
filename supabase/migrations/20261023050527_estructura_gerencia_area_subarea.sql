-- Tarea 3.6 · Paso 2: estructura de la empresa en tres niveles: Gerencia → Área → Subárea o línea (opcional).
-- Decisión 1A: una sola lista de «unidades», cada una con su nivel y a quién pertenece.
-- Decisión 2A: las áreas ficticias de la 3.3 se conservan (con el mismo identificador) y cuelgan de una gerencia
-- «General (ficticia)» por empresa. En una base nueva (entorno limpio) no hay áreas y no se crea nada.
-- La ficha de cada persona apunta a su unidad más baja (subárea o, si no tiene, área).

-- ───────────────────────── Lista de unidades ─────────────────────────

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nivel text not null check (nivel in ('gerencia', 'area', 'subarea')),
  padre_id uuid references public.unidades (id) on delete restrict,
  nombre text not null check (length(nombre) between 2 and 120),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  constraint unidades_padre_segun_nivel check ((nivel = 'gerencia') = (padre_id is null))
);
comment on table public.unidades is
  'Estructura de cada empresa: gerencias, áreas (dentro de una gerencia) y subáreas o líneas (dentro de un área, opcionales). Si ya se usaron, se desactivan en vez de borrarse.';
-- El mismo nombre puede repetirse en ramas distintas, pero no dentro de la misma.
create unique index unidades_nombre_unico
  on public.unidades (empresa_id, nivel, coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
create index unidades_padre_idx on public.unidades (padre_id);

create trigger unidades_limpiar before insert or update on public.unidades
for each row execute function app.limpiar_nombre_lista();

-- El área debe pertenecer a una gerencia y la subárea a un área, de la MISMA empresa. El nivel no se cambia.
create function app.validar_unidad() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if tg_op = 'UPDATE' and (new.nivel <> old.nivel or new.empresa_id <> old.empresa_id) then
    raise exception 'No se puede cambiar el nivel ni la empresa de una unidad' using errcode = '22023';
  end if;
  if new.padre_id is not null then
    select empresa_id, nivel into p from public.unidades where id = new.padre_id;
    if p.empresa_id is distinct from new.empresa_id
       or p.nivel is distinct from (case new.nivel when 'area' then 'gerencia' when 'subarea' then 'area' end) then
      raise exception 'La unidad superior no es válida' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create trigger unidades_validar before insert or update on public.unidades
for each row execute function app.validar_unidad();

-- Camino completo, por ejemplo «Operaciones › Producción › Línea 1».
create function app.ruta_unidad(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  with recursive c as (
    select id, padre_id, nombre, 1 as n from public.unidades where id = p_id
    union all
    select u.id, u.padre_id, u.nombre, c.n + 1 from public.unidades u join c on u.id = c.padre_id
  )
  select string_agg(nombre, ' › ' order by n desc) from c;
$$;

-- Vigente solo si ella y todas las de arriba están vigentes (desactivar una gerencia desactiva su rama).
create function app.unidad_vigente(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive c as (
    select padre_id, vigente from public.unidades where id = p_id
    union all
    select u.padre_id, u.vigente from public.unidades u join c on u.id = c.padre_id
  )
  select coalesce(bool_and(vigente), false) from c;
$$;

-- La unidad y todas las que están dentro de ella.
create function app.rama_unidad(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive c as (
    select id from public.unidades where id = p_id
    union all
    select u.id from public.unidades u join c on u.padre_id = c.id
  )
  select id from c;
$$;

-- ───────────────────────── Pasar los datos ficticios de la 3.3 ─────────────────────────

insert into public.unidades (empresa_id, nivel, nombre)
select distinct empresa_id, 'gerencia', 'General (ficticia)' from public.areas;

insert into public.unidades (id, empresa_id, nivel, padre_id, nombre, vigente, creado_en, creado_por)
select a.id, a.empresa_id, 'area', g.id, a.nombre, a.vigente, a.creado_en, a.creado_por
from public.areas a
join public.unidades g on g.empresa_id = a.empresa_id and g.nivel = 'gerencia';

-- La ficha apunta ahora a la lista de unidades (mismos identificadores: no se pierde ninguna asignación).
drop trigger vinculos_area_puesto on public.vinculos;
alter table public.vinculos disable trigger vinculos_historial_auto;
alter table public.vinculos disable trigger vinculos_actualizado;

alter table public.vinculos drop constraint vinculos_area_id_fkey;
alter table public.vinculos rename column area_id to unidad_id;
alter index public.vinculos_area_idx rename to vinculos_unidad_idx;
alter table public.vinculos add constraint vinculos_unidad_id_fkey
  foreign key (unidad_id) references public.unidades (id) on delete restrict;
-- La copia de texto del área pasa a ser el camino completo.
update public.vinculos set area = app.ruta_unidad(unidad_id) where unidad_id is not null;

alter table public.vinculos enable trigger vinculos_historial_auto;
alter table public.vinculos enable trigger vinculos_actualizado;

-- ───────────────────────── Funciones que usaban «areas» (3.3) ─────────────────────────

drop function app.vinculo_area_puesto();

-- Revisa que la unidad y el puesto sean de la lista de la MISMA empresa y estén vigentes, y copia sus nombres.
-- Si llega solo el texto del área (como lo envía crear-cuenta sin unidad), se busca por nombre o por camino;
-- si hay más de una con ese nombre, se pide elegirla.
create function app.vinculo_unidad_puesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; v_texto text; v_cuantas integer;
begin
  -- Unidad
  if new.unidad_id is null and new.area is not null
     and (tg_op = 'INSERT' or (new.area is distinct from old.area and old.unidad_id is null)) then
    v_texto := lower(regexp_replace(trim(new.area), '\s+', ' ', 'g'));
    select count(*), min(id::text)::uuid into v_cuantas, new.unidad_id from public.unidades
    where empresa_id = new.empresa_id and nivel in ('area', 'subarea')
      and (lower(nombre) = v_texto or lower(app.ruta_unidad(id)) = v_texto);
    if v_cuantas = 0 then
      raise exception 'El área no está en la lista de la empresa' using errcode = '22023';
    elsif v_cuantas > 1 then
      raise exception 'Hay varias áreas con ese nombre: elige la unidad en la lista' using errcode = '22023';
    end if;
  end if;
  if new.unidad_id is null then
    new.area := null;
  else
    select empresa_id, nivel into r from public.unidades where id = new.unidad_id;
    if r.empresa_id is distinct from new.empresa_id then
      raise exception 'El área no está en la lista de la empresa' using errcode = '22023';
    end if;
    if r.nivel = 'gerencia' then
      raise exception 'Elige un área o una subárea, no una gerencia' using errcode = '22023';
    end if;
    if (tg_op = 'INSERT' or new.unidad_id is distinct from old.unidad_id) and not app.unidad_vigente(new.unidad_id) then
      raise exception 'El área está desactivada' using errcode = '22023';
    end if;
    new.area := app.ruta_unidad(new.unidad_id);
  end if;

  -- Puesto (igual que en la 3.3)
  if new.puesto_id is null and new.puesto is not null
     and (tg_op = 'INSERT' or (new.puesto is distinct from old.puesto and old.puesto_id is null)) then
    select id into new.puesto_id from public.puestos
    where empresa_id = new.empresa_id and lower(nombre) = lower(regexp_replace(trim(new.puesto), '\s+', ' ', 'g'));
    if new.puesto_id is null then
      raise exception 'El puesto no está en la lista de la empresa' using errcode = '22023';
    end if;
  end if;
  if new.puesto_id is null then
    new.puesto := null;
  else
    select empresa_id, nombre, vigente into r from public.puestos where id = new.puesto_id;
    if r.empresa_id is distinct from new.empresa_id then
      raise exception 'El puesto no está en la lista de la empresa' using errcode = '22023';
    end if;
    if not r.vigente and (tg_op = 'INSERT' or new.puesto_id is distinct from old.puesto_id) then
      raise exception 'El puesto está desactivado' using errcode = '22023';
    end if;
    new.puesto := r.nombre;
  end if;
  return new;
end $$;

create trigger vinculos_unidad_puesto before insert or update on public.vinculos
for each row execute function app.vinculo_unidad_puesto();

create or replace function app.registrar_historial_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_accion text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'alta';
  elsif old.estado = 'activo' and new.estado = 'cesado' then
    v_accion := 'cese';
  elsif old.estado = 'cesado' and new.estado = 'activo' then
    v_accion := 'reactivacion';
  elsif (old.rol, old.puesto_id, old.unidad_id, old.fecha_ingreso, old.fecha_cese, old.motivo_cese)
        is not distinct from (new.rol, new.puesto_id, new.unidad_id, new.fecha_ingreso, new.fecha_cese, new.motivo_cese) then
    return new;
  else
    v_accion := 'cambio';
  end if;
  insert into public.vinculos_historial
    (vinculo_id, persona_id, empresa_id, accion, estado, rol, fecha_cese, motivo_cese, hecho_por, puesto, area, fecha_ingreso)
  values
    (new.id, new.persona_id, new.empresa_id, v_accion, new.estado, new.rol, new.fecha_cese, new.motivo_cese,
     coalesce((select auth.uid()), new.creado_por), new.puesto, new.area, new.fecha_ingreso);
  return new;
end $$;

-- Corrección de datos (3.3, decisión 2A): la clave "unidad_id" reemplaza a "area_id".
create or replace function public.actualizar_persona(p_vinculo uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.vinculos;
  v_rol text;
  v_nombre text := app.texto(p_datos, 'apellidos_nombres');
  v_fecha text := app.texto(p_datos, 'fecha_ingreso');
begin
  select * into v from public.vinculos where id = p_vinculo for update;
  if v.id is null or v.persona_id = (select auth.uid())
     or not app.puedo_gestionar(v.empresa_id, v.rol, 'personas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado <> 'activo' then
    raise exception 'Solo se pueden corregir cuentas activas' using errcode = '22023';
  end if;
  v_rol := coalesce(app.texto(p_datos, 'rol'), v.rol);
  if v_rol <> v.rol and not app.puedo_gestionar(v.empresa_id, v_rol, 'personas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.rol = 'admin_empresa' and v_rol <> 'admin_empresa' and not app.hay_otro_admin_activo(v.empresa_id, v.id) then
    raise exception 'No se puede quitar el rol al único administrador activo de la empresa' using errcode = '22023';
  end if;
  if p_datos ? 'fecha_ingreso' and (v_fecha is null or v_fecha !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'Fecha de ingreso no válida' using errcode = '22023';
  end if;
  if p_datos ? 'apellidos_nombres' then
    if v_nombre is null or length(v_nombre) not between 3 and 200 then
      raise exception 'Escribe apellidos y nombres (3 a 200 caracteres)' using errcode = '22023';
    end if;
    update public.personas set apellidos_nombres = v_nombre where id = v.persona_id;
  end if;
  update public.vinculos set
    rol = v_rol,
    fecha_ingreso = case when p_datos ? 'fecha_ingreso' then v_fecha::date else fecha_ingreso end,
    unidad_id = case when p_datos ? 'unidad_id' then nullif(p_datos ->> 'unidad_id', '')::uuid else unidad_id end,
    puesto_id = case when p_datos ? 'puesto_id' then nullif(p_datos ->> 'puesto_id', '')::uuid else puesto_id end
  where id = p_vinculo;
end $$;

-- Las acciones de listas de la 3.3 quedan solo para puestos.
create or replace function app.empresa_de_item(p_lista text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_lista <> 'puestos' then
    raise exception 'Lista no válida' using errcode = '22023';
  end if;
  return (select empresa_id from public.puestos where id = p_id);
end $$;

create or replace function public.guardar_item_lista(p_lista text, p_empresa uuid, p_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid;
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if p_lista <> 'puestos' then
    raise exception 'Lista no válida' using errcode = '22023';
  end if;
  v_empresa := case when p_id is null then p_empresa else app.empresa_de_item(p_lista, p_id) end;
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.puestos (empresa_id, nombre, creado_por) values (v_empresa, v_nombre, (select auth.uid()))
      returning id into v_id;
    else
      update public.puestos set nombre = v_nombre where id = p_id returning id into v_id;
      update public.vinculos set puesto = v_nombre where puesto_id = p_id;
    end if;
  exception when unique_violation then
    raise exception 'Ya existe un puesto con ese nombre' using errcode = '23505';
  end;
  return v_id;
end $$;

create or replace function public.cambiar_vigencia_item_lista(p_lista text, p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := app.empresa_de_item(p_lista, p_id);
begin
  if v_empresa is null or p_vigente is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.puestos set vigente = p_vigente where id = p_id;
end $$;

create or replace function public.borrar_item_lista(p_lista text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := app.empresa_de_item(p_lista, p_id);
begin
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.vinculos where puesto_id = p_id) then
    raise exception 'Está en uso: desactívalo en vez de borrarlo' using errcode = '23503';
  end if;
  delete from public.puestos where id = p_id;
end $$;

drop table public.areas;

-- ───────────────────────── Acciones sobre la estructura ─────────────────────────

-- Crea (p_id vacío) o renombra una unidad. Al crear: gerencia sin superior; área dentro de una gerencia;
-- subárea dentro de un área.
create function public.guardar_unidad(p_empresa uuid, p_id uuid, p_nivel text, p_padre uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := case when p_id is null then p_empresa else (select empresa_id from public.unidades where id = p_id) end;
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      if p_nivel not in ('gerencia', 'area', 'subarea') or ((p_nivel = 'gerencia') <> (p_padre is null)) then
        raise exception 'Indica dónde va la unidad' using errcode = '22023';
      end if;
      insert into public.unidades (empresa_id, nivel, padre_id, nombre, creado_por)
      values (v_empresa, p_nivel, p_padre, v_nombre, (select auth.uid()))
      returning id into v_id;
    else
      update public.unidades set nombre = v_nombre where id = p_id returning id into v_id;
      -- Actualiza la copia del camino en las fichas de esa rama.
      update public.vinculos set area = app.ruta_unidad(unidad_id)
      where unidad_id in (select app.rama_unidad(p_id));
    end if;
  exception when unique_violation then
    raise exception 'Ya existe una unidad con ese nombre en el mismo lugar' using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.cambiar_vigencia_unidad(p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := (select empresa_id from public.unidades where id = p_id);
begin
  if v_empresa is null or p_vigente is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.unidades set vigente = p_vigente where id = p_id;
end $$;

-- Borra una unidad que no tiene nada dentro y que nunca se usó. Si se usó, se desactiva.
create function public.borrar_unidad(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := (select empresa_id from public.unidades where id = p_id);
begin
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.unidades where padre_id = p_id) then
    raise exception 'Tiene unidades dentro: bórralas primero o desactívala' using errcode = '23503';
  end if;
  if exists (select 1 from public.vinculos where unidad_id = p_id) then
    raise exception 'Está en uso: desactívala en vez de borrarla' using errcode = '23503';
  end if;
  delete from public.unidades where id = p_id;
end $$;

-- ───────────────────────── Permisos de acceso y reglas RLS ─────────────────────────

alter table public.unidades enable row level security;
revoke all on public.unidades from anon, authenticated;
grant select on public.unidades to authenticated;

create policy "Ver la estructura de mi empresa" on public.unidades for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

revoke all on function app.validar_unidad(), app.vinculo_unidad_puesto() from public, anon, authenticated;
revoke all on function app.ruta_unidad(uuid), app.unidad_vigente(uuid), app.rama_unidad(uuid) from public, anon, authenticated;
revoke all on function public.guardar_unidad(uuid, uuid, text, uuid, text), public.cambiar_vigencia_unidad(uuid, boolean),
  public.borrar_unidad(uuid) from public, anon;
grant execute on function public.guardar_unidad(uuid, uuid, text, uuid, text), public.cambiar_vigencia_unidad(uuid, boolean),
  public.borrar_unidad(uuid) to authenticated;
