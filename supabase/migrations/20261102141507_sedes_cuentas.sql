-- Etapa 1 del punto 2 (02/11/2026, diseño aprobado por el dueño): sedes y administrador de sede. PARTE 1: sedes de cada cuenta, rol «admin_sede», ayudas y cuentas.
-- Cambia vinculos, roles, permisos y sedes (tablas que también usan los módulos de contratistas y medio ambiente): el dueño lo avisa a Cowork.
--  · Tabla nueva vinculos_sedes: una fila por sede de cada cuenta. El administrador general (admin_empresa) no necesita filas: ve todas.
--  · Rol nuevo admin_sede: administra cuentas, activos, inspecciones, planes de acción y PASST de SUS sedes; solo asigna gestor y usuario.
--  · Solo el dueño crea y cesa administradores (general o de sede); nadie edita su propia cuenta.
--  · Una cuenta que no es administrador general no puede quedar sin sedes (regla de la base de datos al grabar).

-- ───── 1. Sedes de cada cuenta ─────
create table public.vinculos_sedes (
  vinculo_id uuid not null references public.vinculos (id) on delete cascade,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  creado_en timestamptz not null default now(),
  primary key (vinculo_id, sede_id)
);
create index vinculos_sedes_sede on public.vinculos_sedes (sede_id);
create index vinculos_sedes_empresa on public.vinculos_sedes (empresa_id);
alter table public.vinculos_sedes enable row level security;
comment on table public.vinculos_sedes is 'Sedes de cada cuenta (etapa 1 del punto 2). Sin filas = administrador general: ve todas las sedes.';

create function app.validar_vinculo_sede() returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = new.vinculo_id;
  if v.id is null or not exists (select 1 from public.sedes where id = new.sede_id and empresa_id = v.empresa_id) then
    raise exception 'La sede no es de la empresa de la cuenta' using errcode = '22023';
  end if;
  new.empresa_id := v.empresa_id;
  return new;
end $$;
create trigger vinculos_sedes_validar before insert on public.vinculos_sedes for each row execute function app.validar_vinculo_sede();

-- ───── 2. Rol admin_sede y sus permisos ─────
update public.roles set orden = orden + 1 where orden >= 2;
insert into public.roles (codigo, nombre, descripcion, orden) values
  ('admin_sede', 'Administrador de sede', 'Administra las cuentas, los activos, las inspecciones, los planes de acción y el programa anual de SST de sus sedes. No cambia lo que es de toda la empresa.', 2);
insert into public.roles_permisos (rol, permiso)
select 'admin_sede', permiso from public.roles_permisos
where rol = 'admin_empresa'
  and permiso not in ('empresa.editar_contactos', 'empresa.editar_logos', 'empresa.ver_contactos', 'listas.editar', 'plantillas.publicar', 'plantillas.editar');
insert into public.roles_asignables (rol, rol_asignable) values ('admin_sede', 'gestor'), ('admin_sede', 'usuario');

-- ───── 3. Ayudas ─────
-- ¿Soy administrador general (o el dueño)? Ve todas las sedes de su empresa.
create function app.soy_general() returns boolean language sql stable security definer set search_path = '' as $$
  select app.es_dueno_plataforma() or coalesce((app.mi_vinculo_activo()).rol = 'admin_empresa', false);
$$;

-- ¿La sede es una de mis sedes? (el dueño y el administrador general: toda sede de su empresa)
create function app.puedo_sede(p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_sede is not null and (
    app.es_dueno_plataforma()
    or exists (
      select 1 from public.sedes s
      where s.id = p_sede and s.empresa_id = app.mi_empresa()
        and ((app.mi_vinculo_activo()).rol = 'admin_empresa'
             or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = (app.mi_vinculo_activo()).id and vs.sede_id = p_sede))));
$$;

-- Con una sola sede activa, «sin sede» (programa general) es esa sede.
create function app.sede_efectiva(p_empresa uuid, p_sede uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(p_sede, case when (select count(*) from public.sedes where empresa_id = p_empresa and activa) = 1
                               then (select id from public.sedes where empresa_id = p_empresa and activa) end);
$$;
create function app.empresa_con_una_sede(p_empresa uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.sedes where empresa_id = p_empresa and activa) = 1;
$$;

-- ¿Puedo editar, aprobar o reprogramar este programa del PASST? (programa general = sin sede, en una empresa de varias sedes: solo el administrador general)
create function app.puedo_programa(p_empresa uuid, p_sede uuid, p_permiso text) returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when app.es_dueno_plataforma() then exists (select 1 from public.empresas where id = p_empresa)
    else p_empresa = app.mi_empresa() and app.tengo_permiso(p_permiso)
      and (app.soy_general()
           or (app.sede_efectiva(p_empresa, p_sede) is not null and app.puedo_sede(app.sede_efectiva(p_empresa, p_sede))
               -- con una sola sede, aprobar y reprogramar es del administrador general
               and not (p_permiso in ('passt.aprobar', 'passt.reprogramar') and app.empresa_con_una_sede(p_empresa))))
  end;
$$;

-- ¿Puedo ver este programa? Uno sin sede (general) lo ven todos los de la empresa con permiso; uno de una sede, quien tiene esa sede.
create function app.puedo_ver_programa(p_empresa uuid, p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.es_dueno_plataforma()
    or (p_empresa = app.mi_empresa() and app.tengo_permiso('passt.ver') and (p_sede is null or app.soy_general() or app.puedo_sede(p_sede)));
$$;

-- ¿Puedo ver esta cuenta? Yo mismo, el dueño, el administrador general (todas) o quien comparte una sede (nunca a un administrador general).
create function app.puedo_ver_vinculo(p_vinculo uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vinculos v where v.id = p_vinculo and (
      v.persona_id = (select auth.uid())
      or app.es_dueno_plataforma()
      or (v.empresa_id = app.mi_empresa() and app.tengo_permiso('personas.ver_empresa')
          and (app.soy_general()
               or (v.rol <> 'admin_empresa'
                   and exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and app.puedo_sede(vs.sede_id)))))));
$$;

-- ¿Puedo gestionar a esta cuenta (cesar, dar contraseña, corregir)? El dueño: cualquiera. Los demás: solo roles que puedo asignar, nunca yo mismo y
-- solo cuentas cuyas sedes están TODAS dentro de las mías (el administrador general: toda la empresa).
create function app.puedo_gestionar_vinculo(p_vinculo uuid, p_permiso text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vinculos v where v.id = p_vinculo and (
      (app.es_dueno_plataforma() and exists (select 1 from public.empresas where id = v.empresa_id and estado = 'activa'))
      or (v.persona_id <> (select auth.uid())
          and app.tengo_permiso(p_permiso) and v.empresa_id = app.mi_empresa()
          and exists (select 1 from public.roles_asignables ra where ra.rol = (app.mi_vinculo_activo()).rol and ra.rol_asignable = v.rol)
          and (app.soy_general()
               or (exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id)
                   and not exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and not app.puedo_sede(vs.sede_id)))))));
$$;

-- Lo que vale para una cuenta nueva: puedo crear ese rol y TODAS las sedes elegidas son mías.
create function public.puedo_crear_cuenta(p_empresa uuid, p_rol text, p_sedes uuid[]) returns boolean language sql stable security definer set search_path = '' as $$
  select app.puedo_gestionar(p_empresa, p_rol, 'cuentas.crear')
    and (app.es_dueno_plataforma() or app.soy_general() or (p_sedes is not null and cardinality(p_sedes) > 0
         and not exists (select 1 from unnest(p_sedes) s where not app.puedo_sede(s))));
$$;

create or replace function public.puedo_dar_contrasena(p_persona uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select v.id from public.vinculos v
  where v.persona_id = p_persona and v.estado = 'activo' and p_persona <> (select auth.uid())
    and app.puedo_gestionar_vinculo(v.id, 'cuentas.contrasena');
$$;

-- ───── 4. Una cuenta que no es administrador general no puede quedar sin sedes ─────
create function app.exigir_sedes(p_vinculo uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo;
  if v.id is not null and v.estado = 'activo' and v.rol <> 'admin_empresa'
     and not exists (select 1 from public.vinculos_sedes where vinculo_id = v.id) then
    raise exception 'La cuenta debe tener al menos una sede' using errcode = '22023';
  end if;
end $$;
create function app.revisar_sedes_vinculo() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_sedes(case when tg_table_name = 'vinculos' then new.id else old.vinculo_id end);
  return null;
end $$;
create constraint trigger vinculos_exigir_sedes after insert or update of rol, estado on public.vinculos
  deferrable initially deferred for each row execute function app.revisar_sedes_vinculo();
create constraint trigger vinculos_sedes_exigir after delete on public.vinculos_sedes
  deferrable initially deferred for each row execute function app.revisar_sedes_vinculo();

-- Relleno: los gestores y usuarios actuales reciben TODAS las sedes de su empresa (nadie pierde acceso). Los administradores actuales quedan como generales.
insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id)
select v.id, s.id, v.empresa_id from public.vinculos v join public.sedes s on s.empresa_id = v.empresa_id where v.rol in ('gestor', 'usuario');

-- ───── 5. Alta de una cuenta con sus sedes (solo la función del servidor) ─────
create function public.alta_vinculo(p_datos jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := (p_datos ->> 'empresa_id')::uuid;
  v_rol text := p_datos ->> 'rol';
  v_sedes uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'sedes', '[]'))::uuid), '{}');
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v_rol <> 'admin_empresa' then
    if cardinality(v_sedes) = 0 then
      -- sin sedes elegidas: solo vale si la empresa tiene una sola sede
      if app.empresa_con_una_sede(v_empresa) then v_sedes := array[(select id from public.sedes where empresa_id = v_empresa and activa)];
      else raise exception 'Elige las sedes de la cuenta' using errcode = '22023'; end if;
    end if;
    if exists (select 1 from unnest(v_sedes) s where not exists (select 1 from public.sedes where id = s and empresa_id = v_empresa and activa)) then
      raise exception 'Una de las sedes no es de la empresa o no está activa' using errcode = '22023';
    end if;
  end if;
  insert into public.vinculos (persona_id, empresa_id, rol, fecha_ingreso, puesto, area, unidad_id, creado_por)
  values ((p_datos ->> 'persona_id')::uuid, v_empresa, v_rol, (p_datos ->> 'fecha_ingreso')::date,
          nullif(p_datos ->> 'puesto', ''), nullif(p_datos ->> 'area', ''), nullif(p_datos ->> 'unidad_id', '')::uuid, (p_datos ->> 'creado_por')::uuid)
  returning id into v_id;
  insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id) select v_id, s, v_empresa from unnest(v_sedes) s where v_rol <> 'admin_empresa';
  return v_id;
end $$;
revoke all on function public.alta_vinculo(jsonb) from public, anon, authenticated;
grant execute on function public.alta_vinculo(jsonb) to service_role;

-- ───── 6. Cambiar las sedes de una cuenta ─────
create function public.asignar_sedes(p_vinculo uuid, p_sedes uuid[]) returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.vinculos;
  v_nuevo uuid[] := coalesce((select array_agg(distinct s) from unnest(p_sedes) s), '{}');
  v_actual uuid[];
  s uuid;
begin
  select * into v from public.vinculos where id = p_vinculo for update;
  if v.id is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not app.es_dueno_plataforma() then
    if v.persona_id = (select auth.uid()) or v.empresa_id is distinct from app.mi_empresa()
       or not app.tengo_permiso('personas.editar')
       or v.rol in ('admin_empresa', 'admin_sede')   -- los administradores y sus sedes: solo el dueño
       or not exists (select 1 from public.roles_asignables ra where ra.rol = (app.mi_vinculo_activo()).rol and ra.rol_asignable = v.rol) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
  end if;
  if v.estado <> 'activo' then raise exception 'Solo se corrigen cuentas activas' using errcode = '22023'; end if;
  if v.rol = 'admin_empresa' then raise exception 'El administrador general ve todas las sedes' using errcode = '22023'; end if;
  if cardinality(v_nuevo) = 0 then raise exception 'La cuenta debe tener al menos una sede' using errcode = '22023'; end if;
  foreach s in array v_nuevo loop
    if not exists (select 1 from public.sedes where id = s and empresa_id = v.empresa_id and activa) then
      raise exception 'Una de las sedes no es de la empresa o no está activa' using errcode = '22023';
    end if;
  end loop;
  v_actual := coalesce(array(select sede_id from public.vinculos_sedes where vinculo_id = v.id), '{}');
  if not app.soy_general() then
    -- el administrador de sede solo agrega o quita sedes que son suyas
    foreach s in array (select coalesce(array_agg(x), '{}') from (select unnest(v_nuevo) x except select unnest(v_actual)) d) loop
      if not app.puedo_sede(s) then raise exception 'No autorizado' using errcode = '42501'; end if;
    end loop;
    foreach s in array (select coalesce(array_agg(x), '{}') from (select unnest(v_actual) x except select unnest(v_nuevo)) d) loop
      if not app.puedo_sede(s) then raise exception 'No autorizado' using errcode = '42501'; end if;
    end loop;
  end if;
  delete from public.vinculos_sedes where vinculo_id = v.id and not (sede_id = any (v_nuevo));
  insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id)
  select v.id, x, v.empresa_id from unnest(v_nuevo) x where not (x = any (v_actual));
  insert into public.vinculos_historial (vinculo_id, persona_id, empresa_id, accion, estado, rol, hecho_por, puesto, area, fecha_ingreso)
  select v.id, v.persona_id, v.empresa_id, 'cambio', v.estado, v.rol, (select auth.uid()), v.puesto, v.area, v.fecha_ingreso;
end $$;
revoke all on function public.asignar_sedes(uuid, uuid[]) from public, anon;
grant execute on function public.asignar_sedes(uuid, uuid[]) to authenticated;

-- ───── 7. Quién ve qué (lectura) ─────
create policy "Ver sedes de cuentas permitidas" on public.vinculos_sedes for select to authenticated using (
  app.es_dueno_plataforma()
  or vinculo_id = (select (app.mi_vinculo_activo()).id)
  or (empresa_id = (select app.mi_empresa()) and app.tengo_permiso('personas.ver_empresa') and (app.soy_general() or app.puedo_sede(sede_id))));

drop policy "Ver vínculos permitidos" on public.vinculos;
create policy "Ver vínculos permitidos" on public.vinculos for select using (app.puedo_ver_vinculo(id));
drop policy "Ver personas permitidas" on public.personas;
create policy "Ver personas permitidas" on public.personas for select using (
  id = (select auth.uid()) or app.es_dueno_plataforma()
  or exists (select 1 from public.vinculos v where v.persona_id = personas.id and app.puedo_ver_vinculo(v.id)));
drop policy "Ver historial permitido" on public.vinculos_historial;
create policy "Ver historial permitido" on public.vinculos_historial for select using (app.puedo_ver_vinculo(vinculo_id));
drop policy "Ver contraseñas dadas en mi empresa" on public.contrasenas_dadas;
create policy "Ver contraseñas dadas en mi empresa" on public.contrasenas_dadas for select using (
  app.es_dueno_plataforma()
  or (app.tengo_permiso('cuentas.contrasena') and empresa_id = (select app.mi_empresa()) and (app.soy_general() or app.puedo_ver_vinculo(vinculo_id))));
drop policy "Ver las cargas de mi empresa" on public.cargas_personal;
create policy "Ver las cargas de mi empresa" on public.cargas_personal for select using (
  app.es_dueno_plataforma()
  or (app.tengo_permiso('cuentas.crear') and empresa_id = (select app.mi_empresa()) and (app.soy_general() or hecha_por = (select auth.uid()))));
