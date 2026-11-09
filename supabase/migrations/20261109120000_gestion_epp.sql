-- Gestión de EPPs (pedido del dueño, 09/11/2026): control de entrega de equipos de protección personal.
--  · Catálogo de EPP por empresa (nombre y cada cuántos meses se renueva). Lo arman los administradores.
--  · Entrega de un EPP a un trabajador: lo registra un gestor o un administrador; el trabajador da su conformidad con
--    su documento y su contraseña (función del servidor «confirmar-entrega-epp», que reusa el bloqueo del ingreso).
--  · Datos del formato (código, versión, fecha de aprobación) por empresa, para el Excel y el PDF del registro.
--  · «Código de trabajador» en el vínculo (ficha de la persona en la empresa).
-- Quién puede lo decide el rol del vínculo (app.rol_epp), igual que en Gestión de condiciones: no toca roles ni permisos.

alter table public.vinculos add column codigo_trabajador text check (codigo_trabajador is null or char_length(codigo_trabajador) between 1 and 30);
create index vinculos_codigo_trabajador on public.vinculos (empresa_id, upper(codigo_trabajador)) where codigo_trabajador is not null;

-- ───────────────────────── Quién puede ─────────────────────────
create function app.rol_epp() returns text language sql stable security definer set search_path = '' as $$
  select case (app.mi_vinculo_activo()).rol when 'admin_empresa' then 'admin' when 'admin_sede' then 'admin' when 'gestor' then 'gestor' else null end;
$$;

-- ¿Puedo ver y atender a este trabajador? Mi misma empresa; el administrador general ve a todos y los demás, a quienes comparten sede conmigo.
create function app.puedo_epp_vinculo(p_vinculo uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.rol_epp() is not null and exists (
    select 1 from public.vinculos t
    where t.id = p_vinculo and t.empresa_id = (select app.mi_empresa())
      and ((app.mi_vinculo_activo()).rol = 'admin_empresa'
        or exists (select 1 from public.vinculos_sedes a join public.vinculos_sedes b on b.sede_id = a.sede_id
                   where a.vinculo_id = t.id and b.vinculo_id = (app.mi_vinculo_activo()).id))
  );
$$;

-- ───────────────────────── Tablas ─────────────────────────
create table public.epp_catalogo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 120),
  vida_meses integer check (vida_meses is null or vida_meses between 1 and 120),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references public.personas (id)
);
create unique index epp_catalogo_nombre on public.epp_catalogo (empresa_id, lower(nombre));

create table public.epp_config (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  codigo_formato text check (codigo_formato is null or char_length(codigo_formato) <= 40),
  version_formato text check (version_formato is null or char_length(version_formato) <= 20),
  fecha_aprobacion date,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.personas (id)
);

create table public.epp_entregas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  vinculo_id uuid not null references public.vinculos (id) on delete restrict,
  persona_id uuid not null references public.personas (id) on delete restrict,
  epp_id uuid references public.epp_catalogo (id) on delete set null,
  epp_nombre text not null,
  fecha_entrega date not null,
  motivo text not null check (motivo in ('nuevo', 'renovacion', 'perdida')),
  fecha_renovacion date,
  entregado_por uuid not null references public.personas (id),
  conformidad_en timestamptz,
  conformidad_por uuid references public.personas (id),
  creado_en timestamptz not null default now()
);
create index epp_entregas_vinculo on public.epp_entregas (vinculo_id, fecha_entrega);
create index epp_entregas_empresa on public.epp_entregas (empresa_id);

alter table public.epp_catalogo enable row level security;
alter table public.epp_config enable row level security;
alter table public.epp_entregas enable row level security;
create policy "EPP catálogo: ver" on public.epp_catalogo for select to authenticated using (empresa_id = (select app.mi_empresa()) and app.rol_epp() is not null);
create policy "EPP formato: ver" on public.epp_config for select to authenticated using (empresa_id = (select app.mi_empresa()) and app.rol_epp() is not null);
create policy "EPP entregas: ver" on public.epp_entregas for select to authenticated using (app.puedo_epp_vinculo(vinculo_id));
revoke all on public.epp_catalogo, public.epp_config, public.epp_entregas from anon;
revoke insert, update, delete, truncate on public.epp_catalogo, public.epp_config, public.epp_entregas from authenticated;

-- ───────────────────────── Buscar un trabajador ─────────────────────────
-- Por nombre o apellido, por DNI / carné de extranjería (número) o por código de trabajador. Mínimo 2 letras.
create function public.buscar_trabajadores_epp(p_texto text) returns table (
  vinculo_id uuid, persona_id uuid, apellidos_nombres text, tipo_documento text, numero_documento text, codigo_trabajador text, cargo text, area text
) language plpgsql stable security definer set search_path = '' as $$
declare t text := lower(btrim(coalesce(p_texto, '')));
begin
  if app.rol_epp() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if char_length(t) < 2 then return; end if;
  return query
    select v.id, p.id, p.apellidos_nombres, p.tipo_documento, p.numero_documento, v.codigo_trabajador, v.puesto, v.area
    from public.vinculos v join public.personas p on p.id = v.persona_id
    where v.estado = 'activo' and app.puedo_epp_vinculo(v.id)
      and (translate(lower(p.apellidos_nombres), 'áéíóúüñ', 'aeiouun') like '%' || translate(t, 'áéíóúüñ', 'aeiouun') || '%'
           or upper(p.numero_documento) like upper(regexp_replace(t, '[\s.-]', '', 'g')) || '%'
           or upper(coalesce(v.codigo_trabajador, '')) like upper(t) || '%')
    order by p.apellidos_nombres
    limit 15;
end $$;

-- Código de trabajador de la persona en la empresa.
create function public.fijar_codigo_trabajador(p_vinculo uuid, p_codigo text) returns void language plpgsql security definer set search_path = '' as $$
declare c text := nullif(btrim(coalesce(p_codigo, '')), '');
begin
  if not app.puedo_epp_vinculo(p_vinculo) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if c is not null and char_length(c) > 30 then raise exception 'El código es muy largo (máximo 30 letras o números).' using errcode = '22023'; end if;
  update public.vinculos set codigo_trabajador = c, actualizado_en = now() where id = p_vinculo;
end $$;

-- ───────────────────────── Catálogo y datos del formato (administradores) ─────────────────────────
create function public.guardar_epp_catalogo(p_id uuid, p_nombre text, p_vida_meses integer, p_vigente boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare emp uuid := (select app.mi_empresa()); n text := btrim(coalesce(p_nombre, '')); nuevo uuid;
begin
  if app.rol_epp() is distinct from 'admin' or emp is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if char_length(n) < 2 or char_length(n) > 120 then raise exception 'Escribe el nombre del EPP (2 a 120 letras).' using errcode = '22023'; end if;
  if p_vida_meses is not null and (p_vida_meses < 1 or p_vida_meses > 120) then raise exception 'Los meses de renovación van de 1 a 120.' using errcode = '22023'; end if;
  if p_id is null then
    begin
      insert into public.epp_catalogo (empresa_id, nombre, vida_meses, vigente, creado_por) values (emp, n, p_vida_meses, coalesce(p_vigente, true), (select auth.uid())) returning id into nuevo;
    exception when unique_violation then raise exception 'Ya hay un EPP con ese nombre.' using errcode = '22023';
    end;
    return nuevo;
  end if;
  begin
    update public.epp_catalogo set nombre = n, vida_meses = p_vida_meses, vigente = coalesce(p_vigente, vigente) where id = p_id and empresa_id = emp returning id into nuevo;
  exception when unique_violation then raise exception 'Ya hay un EPP con ese nombre.' using errcode = '22023';
  end;
  if nuevo is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  return nuevo;
end $$;

create function public.guardar_epp_config(p_codigo text, p_version text, p_fecha date) returns void language plpgsql security definer set search_path = '' as $$
declare emp uuid := (select app.mi_empresa());
begin
  if app.rol_epp() is distinct from 'admin' or emp is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.epp_config (empresa_id, codigo_formato, version_formato, fecha_aprobacion, actualizado_por)
  values (emp, left(nullif(btrim(coalesce(p_codigo, '')), ''), 40), left(nullif(btrim(coalesce(p_version, '')), ''), 20), p_fecha, (select auth.uid()))
  on conflict (empresa_id) do update set codigo_formato = excluded.codigo_formato, version_formato = excluded.version_formato,
    fecha_aprobacion = excluded.fecha_aprobacion, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
end $$;

-- ───────────────────────── Entregas ─────────────────────────
-- La fecha estimada de renovación sale de la fecha de entrega y los meses del catálogo (vacía si el EPP no tiene meses).
create function public.registrar_entrega_epp(p_vinculo uuid, p_epp uuid, p_fecha date, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  emp uuid := (select app.mi_empresa()); c public.epp_catalogo; t public.vinculos; nuevo uuid;
  hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not app.puedo_epp_vinculo(p_vinculo) then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into t from public.vinculos where id = p_vinculo;
  select * into c from public.epp_catalogo where id = p_epp and empresa_id = emp and vigente;
  if c.id is null then raise exception 'Elige un EPP de la lista.' using errcode = '22023'; end if;
  if p_motivo not in ('nuevo', 'renovacion', 'perdida') then raise exception 'Elige el motivo: nuevo, renovación o pérdida.' using errcode = '22023'; end if;
  if p_fecha is null or p_fecha > hoy + 1 or p_fecha < hoy - 3650 then raise exception 'La fecha de entrega no es válida.' using errcode = '22023'; end if;
  insert into public.epp_entregas (empresa_id, vinculo_id, persona_id, epp_id, epp_nombre, fecha_entrega, motivo, fecha_renovacion, entregado_por)
  values (emp, t.id, t.persona_id, c.id, c.nombre, p_fecha, p_motivo,
          case when c.vida_meses is null then null else (p_fecha + make_interval(months => c.vida_meses))::date end, (select auth.uid()))
  returning id into nuevo;
  return nuevo;
end $$;

-- Una entrega sin conformidad todavía se puede anular (error de registro). Con conformidad ya no: es un registro firmado.
create function public.anular_entrega_epp(p_entrega uuid) returns void language plpgsql security definer set search_path = '' as $$
declare e public.epp_entregas;
begin
  select * into e from public.epp_entregas where id = p_entrega;
  if e.id is null or not app.puedo_epp_vinculo(e.vinculo_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if e.conformidad_en is not null then raise exception 'Esta entrega ya tiene la conformidad del trabajador: no se puede anular.' using errcode = '22023'; end if;
  delete from public.epp_entregas where id = p_entrega;
end $$;

-- La conformidad la da la función del servidor «confirmar-entrega-epp» después de verificar la contraseña del trabajador.
-- Solo la usa el servidor (rol de servicio).
create function public.marcar_conformidad_epp(p_entrega uuid, p_persona uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.epp_entregas set conformidad_en = now(), conformidad_por = p_persona
  where id = p_entrega and persona_id = p_persona and conformidad_en is null;
  return found;
end $$;

-- ───────────────────────── Permisos de las funciones ─────────────────────────
revoke all on function app.rol_epp(), app.puedo_epp_vinculo(uuid) from public, anon;
grant execute on function app.rol_epp(), app.puedo_epp_vinculo(uuid) to authenticated;
revoke all on function public.buscar_trabajadores_epp(text), public.fijar_codigo_trabajador(uuid, text), public.guardar_epp_catalogo(uuid, text, integer, boolean),
  public.guardar_epp_config(text, text, date), public.registrar_entrega_epp(uuid, uuid, date, text), public.anular_entrega_epp(uuid) from public, anon;
grant execute on function public.buscar_trabajadores_epp(text), public.fijar_codigo_trabajador(uuid, text), public.guardar_epp_catalogo(uuid, text, integer, boolean),
  public.guardar_epp_config(text, text, date), public.registrar_entrega_epp(uuid, uuid, date, text), public.anular_entrega_epp(uuid) to authenticated;
revoke all on function public.marcar_conformidad_epp(uuid, uuid) from public, anon, authenticated;
grant execute on function public.marcar_conformidad_epp(uuid, uuid) to service_role;
