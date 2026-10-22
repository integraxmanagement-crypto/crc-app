-- Tarea 3.1 · Funciones de apoyo, reglas RLS, cese/reactivación y "portero" del ingreso.

-- ───────────────────────── Funciones de apoyo (quién soy) ─────────────────────────
-- "security definer": leen las tablas sin pasar por RLS, para que las reglas no se llamen a sí mismas.
-- Solo responden sobre la persona que tiene la sesión abierta (auth.uid()).

create function app.es_dueno_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.duenos_plataforma where persona_id = (select auth.uid()));
$$;

create function app.mi_vinculo_activo() returns public.vinculos
language sql stable security definer set search_path = '' as $$
  select v.* from public.vinculos v
  join public.empresas e on e.id = v.empresa_id
  where v.persona_id = (select auth.uid()) and v.estado = 'activo' and e.estado = 'activa'
  limit 1;
$$;

create function app.mi_empresa() returns uuid
language sql stable security definer set search_path = '' as $$
  select (app.mi_vinculo_activo()).empresa_id;
$$;

create function app.tengo_permiso(p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roles_permisos rp
    where rp.rol = (app.mi_vinculo_activo()).rol and rp.permiso = p_permiso
  );
$$;

-- ¿Puedo dar (o cesar) el rol p_rol en la empresa p_empresa?
create function app.puedo_gestionar(p_empresa uuid, p_rol text, p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (app.es_dueno_plataforma() and exists (select 1 from public.empresas where id = p_empresa and estado = 'activa'))
    or (
      app.tengo_permiso(p_permiso)
      and p_empresa = app.mi_empresa()
      and exists (
        select 1 from public.roles_asignables ra
        where ra.rol = (app.mi_vinculo_activo()).rol and ra.rol_asignable = p_rol
      )
    );
$$;

revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

-- ───────────────────────── Validaciones y registro automático ─────────────────────────

-- Limpia y valida el número de documento según su tipo (DNI = 8 dígitos, etc.).
create function app.validar_persona() returns trigger
language plpgsql set search_path = '' as $$
declare v_patron text;
begin
  new.numero_documento := upper(regexp_replace(coalesce(new.numero_documento, ''), '[\s.-]', '', 'g'));
  new.apellidos_nombres := regexp_replace(trim(new.apellidos_nombres), '\s+', ' ', 'g');
  select patron into v_patron from public.tipos_documento where codigo = new.tipo_documento;
  if v_patron is null or new.numero_documento !~ v_patron then
    raise exception 'Número de documento no válido para el tipo %', new.tipo_documento using errcode = '22023';
  end if;
  return new;
end $$;

create trigger personas_validar before insert or update on public.personas
for each row execute function app.validar_persona();

-- Guarda en el historial cada alta, cese y reactivación.
create function app.registrar_historial_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_accion text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'alta';
  elsif old.estado = 'activo' and new.estado = 'cesado' then
    v_accion := 'cese';
  elsif old.estado = 'cesado' and new.estado = 'activo' then
    v_accion := 'reactivacion';
  else
    v_accion := 'cambio';
  end if;
  insert into public.vinculos_historial
    (vinculo_id, persona_id, empresa_id, accion, estado, rol, fecha_cese, motivo_cese, hecho_por)
  values
    (new.id, new.persona_id, new.empresa_id, v_accion, new.estado, new.rol, new.fecha_cese, new.motivo_cese,
     coalesce((select auth.uid()), new.creado_por));
  return new;
end $$;

create trigger vinculos_historial_auto after insert or update on public.vinculos
for each row execute function app.registrar_historial_vinculo();

create function app.marcar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger vinculos_actualizado before update on public.vinculos
for each row execute function app.marcar_actualizado();

-- Las funciones de trigger no se llaman directamente.
revoke all on function app.validar_persona(), app.registrar_historial_vinculo(), app.marcar_actualizado()
  from public, anon, authenticated;

-- ───────────────────────── Reglas de seguridad por fila (RLS) ─────────────────────────

-- Catálogos: cualquier persona con sesión puede leerlos (no tienen datos de nadie).
create policy "Catálogo visible con sesión" on public.tipos_documento for select to authenticated using (true);
create policy "Catálogo visible con sesión" on public.roles for select to authenticated using (true);
create policy "Catálogo visible con sesión" on public.permisos for select to authenticated using (true);
create policy "Catálogo visible con sesión" on public.roles_permisos for select to authenticated using (true);
create policy "Catálogo visible con sesión" on public.roles_asignables for select to authenticated using (true);

-- Empresas: el dueño ve todas; los demás, solo la suya.
create policy "Ver mi empresa" on public.empresas for select to authenticated
using ((select app.es_dueno_plataforma()) or id = (select app.mi_empresa()));

-- Personas: me veo a mí; el dueño ve a todos; quien tiene permiso ve a las personas de SU empresa.
create policy "Ver personas permitidas" on public.personas for select to authenticated
using (
  id = (select auth.uid())
  or (select app.es_dueno_plataforma())
  or (
    (select app.tengo_permiso('personas.ver_empresa'))
    and exists (
      select 1 from public.vinculos v
      where v.persona_id = personas.id and v.empresa_id = (select app.mi_empresa())
    )
  )
);

-- Vínculos: los míos; el dueño todos; quien tiene permiso, los de SU empresa.
create policy "Ver vínculos permitidos" on public.vinculos for select to authenticated
using (
  persona_id = (select auth.uid())
  or (select app.es_dueno_plataforma())
  or ((select app.tengo_permiso('personas.ver_empresa')) and empresa_id = (select app.mi_empresa()))
);

create policy "Ver historial permitido" on public.vinculos_historial for select to authenticated
using (
  (select app.es_dueno_plataforma())
  or ((select app.tengo_permiso('personas.ver_empresa')) and empresa_id = (select app.mi_empresa()))
);

create policy "Ver dueños" on public.duenos_plataforma for select to authenticated
using (persona_id = (select auth.uid()) or (select app.es_dueno_plataforma()));

-- ───────────────────────── Acciones que la app puede pedir ─────────────────────────
-- El mismo mensaje "No autorizado" si el vínculo no existe o es de otra empresa: así no se revela nada.

create function public.puedo_crear_cuenta(p_empresa uuid, p_rol text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.puedo_gestionar(p_empresa, p_rol, 'cuentas.crear');
$$;

create function public.cesar_vinculo(p_vinculo uuid, p_fecha_cese date, p_motivo text) returns void
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
  update public.vinculos
     set estado = 'cesado', fecha_cese = coalesce(p_fecha_cese, current_date), motivo_cese = trim(p_motivo)
   where id = p_vinculo;
  -- Cierra todas sus sesiones: en cuanto su equipo intente renovar el permiso, quedará fuera.
  delete from auth.sessions where user_id = v.persona_id;
end $$;

create function public.reactivar_vinculo(p_vinculo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo for update;
  if v.id is null or v.persona_id = (select auth.uid())
     or not app.puedo_gestionar(v.empresa_id, v.rol, 'cuentas.cesar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado = 'activo' then
    raise exception 'La cuenta ya está activa' using errcode = '22023';
  end if;
  if exists (select 1 from public.vinculos where persona_id = v.persona_id and estado = 'activo') then
    raise exception 'Esta persona ya tiene un vínculo activo en otra empresa' using errcode = '23505';
  end if;
  update public.vinculos set estado = 'activo', fecha_cese = null, motivo_cese = null where id = p_vinculo;
end $$;

-- Marca que la persona ya cambió su contraseña inicial. Solo lo usa la función del servidor.
create function public.marcar_contrasena_cambiada(p_persona uuid) returns void
language sql security definer set search_path = '' as $$
  update public.personas set debe_cambiar_contrasena = false where id = p_persona;
$$;

revoke all on function public.puedo_crear_cuenta(uuid, text), public.cesar_vinculo(uuid, date, text),
  public.reactivar_vinculo(uuid), public.marcar_contrasena_cambiada(uuid) from public, anon;
grant execute on function public.puedo_crear_cuenta(uuid, text), public.cesar_vinculo(uuid, date, text),
  public.reactivar_vinculo(uuid) to authenticated;
revoke execute on function public.marcar_contrasena_cambiada(uuid) from authenticated;
grant execute on function public.marcar_contrasena_cambiada(uuid) to service_role;

-- ───────────────────────── Portero del ingreso (Custom Access Token Hook) ─────────────────────────
-- Supabase lo llama cada vez que entrega o renueva el permiso de ingreso.
-- Si la persona no es dueña de la plataforma ni tiene un vínculo activo con una empresa activa, se le niega.
-- Corre DESPUÉS de verificar la contraseña: quien no la sabe nunca ve este mensaje.
-- Queda creado pero INACTIVO hasta que se active en el panel (Authentication → Hooks).

create function public.portero_ingreso(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare v_usuario uuid := (event ->> 'user_id')::uuid;
begin
  if exists (select 1 from public.duenos_plataforma where persona_id = v_usuario)
     or exists (
       select 1 from public.vinculos v join public.empresas e on e.id = v.empresa_id
       where v.persona_id = v_usuario and v.estado = 'activo' and e.estado = 'activa'
     ) then
    return event;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Tu cuenta está inhabilitada. Consulta con el administrador de tu empresa.'));
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.portero_ingreso(jsonb) to supabase_auth_admin;
revoke execute on function public.portero_ingreso(jsonb) from authenticated, anon, public;

grant select on public.duenos_plataforma, public.vinculos, public.empresas to supabase_auth_admin;
create policy "Portero lee dueños" on public.duenos_plataforma for select to supabase_auth_admin using (true);
create policy "Portero lee vínculos" on public.vinculos for select to supabase_auth_admin using (true);
create policy "Portero lee empresas" on public.empresas for select to supabase_auth_admin using (true);
