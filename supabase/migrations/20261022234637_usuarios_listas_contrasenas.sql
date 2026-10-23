-- Tarea 3.3 · Usuarios y roles por empresa: listas de áreas y puestos, contraseñas nuevas,
-- regla del último administrador y corrección de datos de las personas.
-- Como siempre: todo con RLS, la app solo LEE y los cambios pasan por acciones que revisan permisos.

-- ───────────────────────── Permisos nuevos (en tablas, D-28) ─────────────────────────

insert into public.permisos (codigo, descripcion) values
  ('cuentas.contrasena', 'Dar una contraseña nueva a cuentas de su empresa (solo de los roles que puede asignar).'),
  ('personas.editar', 'Corregir nombre, puesto, área, fecha de ingreso y rol de personas de su empresa (solo roles que puede asignar).'),
  ('listas.editar', 'Crear, renombrar, desactivar y borrar las áreas y puestos de su empresa.');

insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'cuentas.contrasena'),
  ('admin_empresa', 'personas.editar'),
  ('admin_empresa', 'listas.editar');

-- ───────────────────────── Listas de áreas y puestos por empresa ─────────────────────────

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nombre text not null check (length(nombre) between 2 and 120),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.areas is 'Áreas de cada empresa. Si ya se usaron, se desactivan en vez de borrarse.';
create unique index areas_nombre_unico on public.areas (empresa_id, lower(nombre));

create table public.puestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nombre text not null check (length(nombre) between 2 and 120),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.puestos is 'Puestos de cada empresa (dato de la ficha: no cambia lo que la persona puede hacer).';
create unique index puestos_nombre_unico on public.puestos (empresa_id, lower(nombre));

-- Quita espacios sobrantes del nombre, para que «Obras» y «Obras » sean el mismo.
create function app.limpiar_nombre_lista() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nombre := regexp_replace(trim(coalesce(new.nombre, '')), '\s+', ' ', 'g');
  return new;
end $$;

create trigger areas_limpiar before insert or update on public.areas
for each row execute function app.limpiar_nombre_lista();
create trigger puestos_limpiar before insert or update on public.puestos
for each row execute function app.limpiar_nombre_lista();

-- El vínculo apunta a la lista. Las columnas de texto puesto y área se conservan como copia del nombre,
-- para que lo que ya existe (crear-cuenta, la lista para el gestor) siga funcionando igual.
alter table public.vinculos
  add column area_id uuid references public.areas (id) on delete restrict,
  add column puesto_id uuid references public.puestos (id) on delete restrict;
create index vinculos_area_idx on public.vinculos (area_id);
create index vinculos_puesto_idx on public.vinculos (puesto_id);

-- Decisión 1A: los textos que ya existen (solo datos ficticios de crc-dev) pasan a las listas.
alter table public.vinculos disable trigger vinculos_historial_auto;
alter table public.vinculos disable trigger vinculos_actualizado;

insert into public.areas (empresa_id, nombre)
select distinct on (empresa_id, lower(n)) empresa_id, n
from (select empresa_id, regexp_replace(trim(area), '\s+', ' ', 'g') as n, creado_en
      from public.vinculos where area is not null) x
order by empresa_id, lower(n), creado_en;

insert into public.puestos (empresa_id, nombre)
select distinct on (empresa_id, lower(n)) empresa_id, n
from (select empresa_id, regexp_replace(trim(puesto), '\s+', ' ', 'g') as n, creado_en
      from public.vinculos where puesto is not null) x
order by empresa_id, lower(n), creado_en;

update public.vinculos v set area_id = a.id, area = a.nombre
from public.areas a
where a.empresa_id = v.empresa_id and lower(a.nombre) = lower(regexp_replace(trim(v.area), '\s+', ' ', 'g'));

update public.vinculos v set puesto_id = p.id, puesto = p.nombre
from public.puestos p
where p.empresa_id = v.empresa_id and lower(p.nombre) = lower(regexp_replace(trim(v.puesto), '\s+', ' ', 'g'));

alter table public.vinculos enable trigger vinculos_historial_auto;
alter table public.vinculos enable trigger vinculos_actualizado;

-- Revisa que el área y el puesto sean de la lista de la MISMA empresa y estén vigentes, y copia su nombre.
-- Si llega solo el texto (como lo envía crear-cuenta), lo busca en la lista; si no está, rechaza.
create function app.vinculo_area_puesto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  -- Área
  if new.area_id is null and new.area is not null
     and (tg_op = 'INSERT' or (new.area is distinct from old.area and old.area_id is null)) then
    select id into new.area_id from public.areas
    where empresa_id = new.empresa_id and lower(nombre) = lower(regexp_replace(trim(new.area), '\s+', ' ', 'g'));
    if new.area_id is null then
      raise exception 'El área no está en la lista de la empresa' using errcode = '22023';
    end if;
  end if;
  if new.area_id is null then
    new.area := null;
  else
    select empresa_id, nombre, vigente into r from public.areas where id = new.area_id;
    if r.empresa_id is distinct from new.empresa_id then
      raise exception 'El área no está en la lista de la empresa' using errcode = '22023';
    end if;
    if not r.vigente and (tg_op = 'INSERT' or new.area_id is distinct from old.area_id) then
      raise exception 'El área está desactivada' using errcode = '22023';
    end if;
    new.area := r.nombre;
  end if;

  -- Puesto
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

create trigger vinculos_area_puesto before insert or update on public.vinculos
for each row execute function app.vinculo_area_puesto();

-- El historial ahora también guarda puesto y área, y anota las correcciones (decisión 2A).
-- Renombrar un área o puesto solo cambia la copia del nombre: eso no se anota.
alter table public.vinculos_historial
  add column puesto text,
  add column area text,
  add column fecha_ingreso date;

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
  elsif (old.rol, old.puesto_id, old.area_id, old.fecha_ingreso, old.fecha_cese, old.motivo_cese)
        is not distinct from (new.rol, new.puesto_id, new.area_id, new.fecha_ingreso, new.fecha_cese, new.motivo_cese) then
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

-- ───────────────────────── Registro de contraseñas dadas ─────────────────────────

create table public.contrasenas_dadas (
  id bigint generated always as identity primary key,
  persona_id uuid not null references public.personas (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete restrict,
  vinculo_id uuid references public.vinculos (id) on delete restrict,
  modo text not null check (modo in ('individual', 'en_bloque', 'rescate')),
  dado_por uuid references public.personas (id) on delete restrict,
  dado_en timestamptz not null default now()
);
comment on table public.contrasenas_dadas is
  'Quién dio una contraseña nueva, a quién y cuándo. Nunca guarda la contraseña. dado_por vacío = herramienta de rescate.';
create index contrasenas_dadas_empresa_idx on public.contrasenas_dadas (empresa_id, dado_en desc);
create index contrasenas_dadas_persona_idx on public.contrasenas_dadas (persona_id);

-- ───────────────────────── Permisos de acceso y reglas RLS ─────────────────────────

do $$
declare t text;
begin
  foreach t in array array['areas', 'puestos', 'contrasenas_dadas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy "Ver áreas de mi empresa" on public.areas for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

create policy "Ver puestos de mi empresa" on public.puestos for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

create policy "Ver contraseñas dadas en mi empresa" on public.contrasenas_dadas for select to authenticated
using (
  (select app.es_dueno_plataforma())
  or ((select app.tengo_permiso('cuentas.contrasena')) and empresa_id = (select app.mi_empresa()))
);

-- ───────────────────────── Acciones: listas ─────────────────────────

create function app.puedo_editar_listas(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (app.es_dueno_plataforma() and exists (select 1 from public.empresas where id = p_empresa))
      or (app.tengo_permiso('listas.editar') and p_empresa = app.mi_empresa());
$$;

-- Empresa dueña de un elemento de la lista ('areas' o 'puestos'); null si no existe.
create function app.empresa_de_item(p_lista text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if p_lista not in ('areas', 'puestos') then
    raise exception 'Lista no válida' using errcode = '22023';
  end if;
  execute format('select empresa_id from public.%I where id = $1', p_lista) into v using p_id;
  return v;
end $$;

-- Crea (p_id vacío) o renombra un área o puesto.
create function public.guardar_item_lista(p_lista text, p_empresa uuid, p_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := case when p_id is null then p_empresa else app.empresa_de_item(p_lista, p_id) end;
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if p_lista not in ('areas', 'puestos') then
    raise exception 'Lista no válida' using errcode = '22023';
  end if;
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      execute format('insert into public.%I (empresa_id, nombre, creado_por) values ($1, $2, $3) returning id', p_lista)
        into v_id using v_empresa, v_nombre, (select auth.uid());
    else
      execute format('update public.%I set nombre = $2 where id = $1 returning id', p_lista)
        into v_id using p_id, v_nombre;
      -- Actualiza la copia del nombre en las fichas que lo usan.
      if p_lista = 'areas' then
        update public.vinculos set area = v_nombre where area_id = p_id;
      else
        update public.vinculos set puesto = v_nombre where puesto_id = p_id;
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Ya existe % con ese nombre', case p_lista when 'areas' then 'un área' else 'un puesto' end
      using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.cambiar_vigencia_item_lista(p_lista text, p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := app.empresa_de_item(p_lista, p_id);
begin
  if v_empresa is null or p_vigente is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  execute format('update public.%I set vigente = $2 where id = $1', p_lista) using p_id, p_vigente;
end $$;

-- Borra un área o puesto que nunca se usó. Si ya se usó (aunque sea en una cuenta cesada), se desactiva.
create function public.borrar_item_lista(p_lista text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := app.empresa_de_item(p_lista, p_id);
begin
  if v_empresa is null or not app.puedo_editar_listas(v_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if exists (select 1 from public.vinculos where (case p_lista when 'areas' then area_id else puesto_id end) = p_id) then
    raise exception 'Está en uso: desactívalo en vez de borrarlo' using errcode = '23503';
  end if;
  execute format('delete from public.%I where id = $1', p_lista) using p_id;
end $$;

-- ───────────────────────── Acciones: personas ─────────────────────────

-- ¿Queda algún otro administrador activo en la empresa? Bloquea las filas para evitar dos ceses a la vez.
create function app.hay_otro_admin_activo(p_empresa uuid, p_vinculo uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.vinculos
  where empresa_id = p_empresa and rol = 'admin_empresa' and estado = 'activo' for update;
  return exists (
    select 1 from public.vinculos
    where empresa_id = p_empresa and rol = 'admin_empresa' and estado = 'activo' and id <> p_vinculo
  );
end $$;

-- Igual que en la 3.1, más la regla del último administrador (decisión 3A, también para el dueño).
create or replace function public.cesar_vinculo(p_vinculo uuid, p_fecha_cese date, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo for update;
  if v.id is null or v.persona_id = (select auth.uid())
     or not app.puedo_gestionar(v.empresa_id, v.rol, 'cuentas.cesar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado = 'cesado' then
    raise exception 'La cuenta ya está cesada' using errcode = '22023';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Indica el motivo del cese' using errcode = '22023';
  end if;
  if v.rol = 'admin_empresa' and not app.hay_otro_admin_activo(v.empresa_id, v.id) then
    raise exception 'No se puede cesar al único administrador activo de la empresa. Crea primero otro administrador.'
      using errcode = '22023';
  end if;
  update public.vinculos
     set estado = 'cesado', fecha_cese = coalesce(p_fecha_cese, current_date), motivo_cese = trim(p_motivo)
   where id = p_vinculo;
  -- Cierra todas sus sesiones: en cuanto su equipo intente renovar el permiso, quedará fuera.
  delete from auth.sessions where user_id = v.persona_id;
end $$;

-- Corrige nombre, puesto, área, fecha de ingreso y rol (decisión 2A). El documento no se edita.
-- Solo envía las claves que cambian; "area_id": null deja la persona sin área.
create function public.actualizar_persona(p_vinculo uuid, p_datos jsonb) returns void
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
    area_id = case when p_datos ? 'area_id' then nullif(p_datos ->> 'area_id', '')::uuid else area_id end,
    puesto_id = case when p_datos ? 'puesto_id' then nullif(p_datos ->> 'puesto_id', '')::uuid else puesto_id end
  where id = p_vinculo;
end $$;

-- ───────────────────────── Acciones: contraseña nueva ─────────────────────────

-- La usa la función del servidor "dar-contrasena", con la sesión de quien la pide.
-- Devuelve el vínculo activo de la persona si quien llama puede darle una contraseña nueva; si no, nada.
create function public.puedo_dar_contrasena(p_persona uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select v.id from public.vinculos v
  where v.persona_id = p_persona and v.estado = 'activo' and p_persona <> (select auth.uid())
    and app.puedo_gestionar(v.empresa_id, v.rol, 'cuentas.contrasena');
$$;

-- Solo el servidor (después de cambiar la contraseña): obliga a cambiarla, cierra sesiones y lo anota.
create function public.registrar_contrasena_dada(p_persona uuid, p_vinculo uuid, p_dado_por uuid, p_modo text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.personas set debe_cambiar_contrasena = true, clave_con_candado = true where id = p_persona;
  delete from auth.sessions where user_id = p_persona;
  insert into public.contrasenas_dadas (persona_id, empresa_id, vinculo_id, modo, dado_por)
  values (p_persona, (select empresa_id from public.vinculos where id = p_vinculo), p_vinculo, p_modo, p_dado_por);
end $$;

-- ───────────────────────── Quién puede llamar a qué ─────────────────────────

revoke all on function app.limpiar_nombre_lista(), app.vinculo_area_puesto(), app.registrar_historial_vinculo()
  from public, anon, authenticated;
revoke all on function app.puedo_editar_listas(uuid), app.empresa_de_item(text, uuid), app.hay_otro_admin_activo(uuid, uuid)
  from public, anon, authenticated;

revoke all on function public.guardar_item_lista(text, uuid, uuid, text), public.cambiar_vigencia_item_lista(text, uuid, boolean),
  public.borrar_item_lista(text, uuid), public.actualizar_persona(uuid, jsonb), public.puedo_dar_contrasena(uuid),
  public.registrar_contrasena_dada(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.guardar_item_lista(text, uuid, uuid, text), public.cambiar_vigencia_item_lista(text, uuid, boolean),
  public.borrar_item_lista(text, uuid), public.actualizar_persona(uuid, jsonb), public.puedo_dar_contrasena(uuid)
  to authenticated;
revoke execute on function public.registrar_contrasena_dada(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.registrar_contrasena_dada(uuid, uuid, uuid, text) to service_role;
