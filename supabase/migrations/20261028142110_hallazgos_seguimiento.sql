-- Tarea 3.4-D (parte 2) · Seguimiento de hallazgos. Diseño aprobado (3.4-A, §2.3 y §3.2) y reglas aprobadas por el
-- dueño el 28/10/2026: cada hallazgo nace solo al recibir la inspección (con responsable y plazo si la inspección los
-- trae); si se anula la inspección, sus hallazgos abiertos se anulan; si se corrige, se agregan los nuevos y los que
-- desaparecen quedan «anulado por corrección»; el usuario ve y cierra solo los suyos (comentario y foto opcional);
-- en la v1 el cierre necesita señal. Nada se borra: cada cambio queda en el historial.
-- Aviso (regla del CLAUDE.md): agrega 2 filas a permisos y 5 a roles_permisos (aprobado por el dueño el 28/10/2026).

insert into public.permisos (codigo, descripcion) values
  ('hallazgos.gestionar', 'Ver todos los hallazgos de su empresa; asignar responsable, cambiar plazo y acción, cerrar y reabrir.'),
  ('hallazgos.cerrar_propios', 'Ver y cerrar (con comentario y evidencia) los hallazgos que tiene asignados.');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'hallazgos.gestionar'),
  ('admin_empresa', 'hallazgos.cerrar_propios'),
  ('gestor', 'hallazgos.gestionar'),
  ('gestor', 'hallazgos.cerrar_propios'),
  ('usuario', 'hallazgos.cerrar_propios');

create table public.hallazgos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  inspeccion_id uuid not null references public.inspecciones (id) on delete restrict,
  plantilla_id uuid not null references public.plantillas (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  activo_id uuid references public.activos (id) on delete restrict,
  origen text not null check (origen in ('no_cumple', 'fuera_rango', 'vencido', 'fila')),
  clave text, -- punto, dato del activo o sección (bloque repetible)
  fila integer,
  texto text not null check (length(texto) between 1 and 1000),
  accion text check (accion is null or length(accion) <= 1000),
  responsable_id uuid references public.personas (id) on delete restrict,
  plazo date,
  estado text not null default 'abierto' check (estado in ('abierto', 'en_proceso', 'cerrado', 'anulado')),
  severidad text check (severidad is null), -- reservado para la v1.1 (decisión 3 del encargo)
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  cerrado_por uuid references public.personas (id),
  cierre_comentario text check (cierre_comentario is null or length(cierre_comentario) between 3 and 1000),
  cierre_foto_ruta text,
  cierre_foto_bytes integer,
  anulado_motivo text,
  constraint hallazgos_cierre check ((estado = 'cerrado') = (cerrado_en is not null and cerrado_por is not null and cierre_comentario is not null)),
  constraint hallazgos_anulado check ((estado = 'anulado') = (anulado_motivo is not null))
);
comment on table public.hallazgos is 'Hallazgos de las inspecciones y su seguimiento. Nacen solos al recibir la inspección. No se borran.';
create unique index hallazgos_unico on public.hallazgos (inspeccion_id, origen, coalesce(clave, ''), coalesce(fila, -1));
create index hallazgos_empresa_estado_idx on public.hallazgos (empresa_id, estado);
create index hallazgos_responsable_idx on public.hallazgos (responsable_id) where estado in ('abierto', 'en_proceso');

create table public.hallazgos_historial (
  id bigint generated always as identity primary key,
  hallazgo_id uuid not null references public.hallazgos (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  cambio text not null check (cambio in ('creado', 'asignado', 'en_proceso', 'cerrado', 'reabierto', 'anulado')),
  antes jsonb,
  despues jsonb,
  comentario text,
  hecho_por uuid references public.personas (id),
  hecho_en timestamptz not null default now()
);
comment on table public.hallazgos_historial is 'Cada cambio de un hallazgo (creación, asignación, plazo, estado). Nadie lo edita.';
create index hallazgos_historial_idx on public.hallazgos_historial (hallazgo_id);

-- ───── Quién ve un hallazgo ─────
create function app.puedo_ver_hallazgo(p_hallazgo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.hallazgos h where h.id = p_hallazgo and (
      app.es_dueno_plataforma()
      or (h.empresa_id = app.mi_empresa() and (app.tengo_permiso('hallazgos.gestionar')
          or (app.tengo_permiso('hallazgos.cerrar_propios') and h.responsable_id = (select auth.uid()))))
    ));
$$;

alter table public.hallazgos enable row level security;
alter table public.hallazgos_historial enable row level security;
revoke all on public.hallazgos, public.hallazgos_historial from anon, authenticated;
grant select on public.hallazgos, public.hallazgos_historial to authenticated;
create policy "Ver hallazgos permitidos" on public.hallazgos for select to authenticated
using ((select app.es_dueno_plataforma())
       or (empresa_id = (select app.mi_empresa()) and ((select app.tengo_permiso('hallazgos.gestionar'))
           or ((select app.tengo_permiso('hallazgos.cerrar_propios')) and responsable_id = (select auth.uid())))));
create policy "Ver historial de hallazgos permitidos" on public.hallazgos_historial for select to authenticated
using (app.puedo_ver_hallazgo(hallazgo_id));

-- ───── Nacen solos: al recibir la inspección, al corregirla y al anularla ─────
-- Responsable y plazo solo si son válidos: una persona activa de la misma empresa y una fecha.
create function app.datos_hallazgo(p_empresa uuid, x jsonb)
returns table (responsable uuid, plazo date, accion text)
language plpgsql stable security definer set search_path = '' as $$
declare v_resp uuid; v_plazo date;
begin
  begin v_resp := nullif(x #>> '{accion,responsable}', '')::uuid; exception when others then v_resp := null; end;
  if v_resp is not null and not exists (select 1 from public.vinculos where persona_id = v_resp and empresa_id = p_empresa and estado = 'activo') then
    v_resp := null;
  end if;
  begin v_plazo := nullif(x #>> '{accion,plazo}', '')::date; exception when others then v_plazo := null; end;
  return query select v_resp, v_plazo, left(nullif(trim(coalesce(x #>> '{accion,texto}', '')), ''), 1000);
end $$;

create function app.sincronizar_hallazgos(i public.inspecciones, p_por uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare x jsonb; d record; nuevo public.hallazgos; claves text[] := '{}'; v_clave text;
begin
  if i.estado <> 'cerrada' then return; end if;
  for x in select * from jsonb_array_elements(coalesce(i.hallazgos, '[]'::jsonb)) loop
    v_clave := (x ->> 'origen') || '|' || coalesce(x ->> 'clave', '') || '|' || coalesce(x ->> 'fila', '-1');
    claves := claves || v_clave;
    if exists (select 1 from public.hallazgos h where h.inspeccion_id = i.id and h.origen = x ->> 'origen'
               and coalesce(h.clave, '') = coalesce(x ->> 'clave', '') and coalesce(h.fila, -1) = coalesce((x ->> 'fila')::integer, -1)) then
      continue;
    end if;
    select * into d from app.datos_hallazgo(i.empresa_id, x);
    insert into public.hallazgos (empresa_id, inspeccion_id, plantilla_id, sede_id, activo_id, origen, clave, fila, texto, accion, responsable_id, plazo)
    values (i.empresa_id, i.id, i.plantilla_id, i.sede_id, i.activo_id, x ->> 'origen', x ->> 'clave', (x ->> 'fila')::integer,
            left(coalesce(nullif(trim(x ->> 'texto'), ''), 'Hallazgo'), 1000), d.accion, d.responsable, d.plazo)
    returning * into nuevo;
    insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, despues, hecho_por)
    values (nuevo.id, nuevo.empresa_id, 'creado', jsonb_build_object('responsable_id', nuevo.responsable_id, 'plazo', nuevo.plazo, 'accion', nuevo.accion), p_por);
  end loop;
  -- Los que ya no están tras una corrección (y siguen abiertos) quedan anulados por corrección.
  with quitados as (
    update public.hallazgos h set estado = 'anulado', anulado_motivo = 'Anulado por corrección de la inspección'
    where h.inspeccion_id = i.id and h.estado in ('abierto', 'en_proceso')
      and not ((h.origen || '|' || coalesce(h.clave, '') || '|' || coalesce(h.fila, -1)::text) = any (claves))
    returning h.id, h.empresa_id
  )
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, hecho_por)
  select id, empresa_id, 'anulado', 'Anulado por corrección de la inspección', p_por from quitados;
end $$;

create function app.al_cambiar_inspeccion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform app.sincronizar_hallazgos(new, new.inspector_id);
  elsif new.estado = 'anulada' and old.estado <> 'anulada' then
    with anulados as (
      update public.hallazgos set estado = 'anulado', anulado_motivo = 'Inspección anulada'
      where inspeccion_id = new.id and estado in ('abierto', 'en_proceso') returning id, empresa_id
    )
    insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, hecho_por)
    select id, empresa_id, 'anulado', 'Inspección anulada: ' || new.motivo_anulacion, new.anulada_por from anulados;
  elsif new.hallazgos is distinct from old.hallazgos then
    perform app.sincronizar_hallazgos(new, (select auth.uid()));
  end if;
  return null;
end $$;

create trigger inspecciones_hallazgos after insert or update of estado, hallazgos on public.inspecciones
for each row execute function app.al_cambiar_inspeccion();

-- Inspecciones que ya existían (todas ficticias en crc-dev): sus hallazgos se crean una sola vez.
do $$
declare i public.inspecciones;
begin
  for i in select * from public.inspecciones where estado = 'cerrada' order by numero loop
    perform app.sincronizar_hallazgos(i, i.inspector_id);
  end loop;
end $$;

-- ───── Acciones (la app solo lee; escribe con estas acciones, que revisan permisos) ─────
create function app.hallazgo_para(p_id uuid, p_gestionar boolean) returns public.hallazgos
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos;
begin
  select * into h from public.hallazgos where id = p_id for update;
  if h.id is null or not (
       app.puedo_en_empresa(h.empresa_id, 'hallazgos.gestionar')
       or (not p_gestionar and h.empresa_id = app.mi_empresa() and app.tengo_permiso('hallazgos.cerrar_propios') and h.responsable_id = (select auth.uid()))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return h;
end $$;

-- Asignar responsable, plazo y acción (gestor o administrador).
create function public.gestionar_hallazgo(p_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos; v_resp uuid; v_plazo date; v_accion text;
begin
  h := app.hallazgo_para(p_id, true);
  if h.estado in ('cerrado', 'anulado') then
    raise exception 'El hallazgo está cerrado o anulado: reábrelo primero' using errcode = '22023';
  end if;
  v_resp := nullif(p_datos ->> 'responsable_id', '')::uuid;
  v_plazo := nullif(p_datos ->> 'plazo', '')::date;
  v_accion := nullif(trim(coalesce(p_datos ->> 'accion', '')), '');
  if v_resp is not null and not exists (select 1 from public.vinculos where persona_id = v_resp and empresa_id = h.empresa_id and estado = 'activo') then
    raise exception 'El responsable debe ser una persona activa de la empresa' using errcode = '22023';
  end if;
  if length(coalesce(v_accion, '')) > 1000 then
    raise exception 'La acción es muy larga (hasta 1000)' using errcode = '22023';
  end if;
  update public.hallazgos set responsable_id = v_resp, plazo = v_plazo, accion = v_accion where id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, antes, despues, hecho_por)
  values (h.id, h.empresa_id, 'asignado',
          jsonb_build_object('responsable_id', h.responsable_id, 'plazo', h.plazo, 'accion', h.accion),
          jsonb_build_object('responsable_id', v_resp, 'plazo', v_plazo, 'accion', v_accion), (select auth.uid()));
end $$;

-- «Lo estoy atendiendo» (el responsable o quien gestiona).
create function public.hallazgo_en_proceso(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos;
begin
  h := app.hallazgo_para(p_id, false);
  if h.estado <> 'abierto' then
    raise exception 'Solo un hallazgo abierto pasa a «en proceso»' using errcode = '22023';
  end if;
  update public.hallazgos set estado = 'en_proceso' where id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, hecho_por) values (h.id, h.empresa_id, 'en_proceso', (select auth.uid()));
end $$;

-- Cerrar con comentario y foto opcional (ya subida al almacén). Necesita señal en la v1.
create function public.cerrar_hallazgo(p_id uuid, p_comentario text, p_foto_ruta text, p_foto_bytes integer) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos;
begin
  h := app.hallazgo_para(p_id, false);
  if h.estado not in ('abierto', 'en_proceso') then
    raise exception 'El hallazgo ya está cerrado o anulado' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_comentario, ''))) < 3 then
    raise exception 'Escribe qué se hizo para cerrarlo' using errcode = '22023';
  end if;
  if p_foto_ruta is not null and (p_foto_ruta !~ ('^' || h.empresa_id::text || '/' || h.inspeccion_id::text || '/cierre-' || h.id::text || '-[0-9a-f]{8}\.(jpg|webp|png)$')
      or p_foto_bytes is null or p_foto_bytes not between 1 and 1048576) then
    raise exception 'La foto no está en la carpeta del hallazgo' using errcode = '22023';
  end if;
  update public.hallazgos set estado = 'cerrado', cerrado_en = now(), cerrado_por = (select auth.uid()), cierre_comentario = left(trim(p_comentario), 1000),
    cierre_foto_ruta = p_foto_ruta, cierre_foto_bytes = p_foto_bytes
  where id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, despues, hecho_por)
  values (h.id, h.empresa_id, 'cerrado', left(trim(p_comentario), 1000), jsonb_build_object('foto', p_foto_ruta), (select auth.uid()));
end $$;

-- Reabrir (gestor o administrador), con motivo. El cierre anterior queda en el historial.
create function public.reabrir_hallazgo(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos;
begin
  h := app.hallazgo_para(p_id, true);
  if h.estado <> 'cerrado' then
    raise exception 'Solo se reabre un hallazgo cerrado' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo' using errcode = '22023';
  end if;
  update public.hallazgos set estado = 'abierto', cerrado_en = null, cerrado_por = null, cierre_comentario = null, cierre_foto_ruta = null, cierre_foto_bytes = null
  where id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, antes, comentario, hecho_por)
  values (h.id, h.empresa_id, 'reabierto', jsonb_build_object('cerrado_en', h.cerrado_en, 'cerrado_por', h.cerrado_por, 'comentario', h.cierre_comentario, 'foto', h.cierre_foto_ruta),
          trim(p_motivo), (select auth.uid()));
end $$;

-- ───── Foto de cierre en el almacén «evidencias»: <empresa>/<inspección>/cierre-<hallazgo>-<8 letras>.jpg ─────
create or replace function app.puedo_subir_evidencia(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(([0-9a-f-]{36}\.(jpg|webp|png))|(firma-[0-9a-f-]{36}-[a-z0-9_-]{1,30}\.png))$'
    and split_part(p_nombre, '/', 1) = app.mi_empresa()::text
    and (
      (app.tengo_permiso('inspecciones.registrar')
        and not exists (select 1 from public.inspecciones where id::text = split_part(p_nombre, '/', 2)))
      or exists (
        select 1 from public.firmas f
        where f.inspeccion_id::text = split_part(p_nombre, '/', 2) and f.persona_id = (select auth.uid()) and f.estado = 'pendiente'
          and split_part(p_nombre, '/', 3) = 'firma-' || f.persona_id::text || '-' || f.rol_clave || '.png')
    ))
  or (p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/cierre-[0-9a-f-]{36}-[0-9a-f]{8}\.(jpg|webp|png)$'
    and split_part(p_nombre, '/', 1) = app.mi_empresa()::text
    and exists (
      select 1 from public.hallazgos h
      where h.inspeccion_id::text = split_part(p_nombre, '/', 2) and h.estado in ('abierto', 'en_proceso')
        and split_part(p_nombre, '/', 3) like 'cierre-' || h.id::text || '-%'
        and (app.tengo_permiso('hallazgos.gestionar') or (app.tengo_permiso('hallazgos.cerrar_propios') and h.responsable_id = (select auth.uid())))));
$$;

create or replace function app.puedo_ver_evidencia(p_nombre text, p_dueno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.puedo_ver_inspeccion(nullif(split_part(p_nombre, '/', 2), '')::uuid)
      or (p_dueno = (select auth.uid()) and split_part(p_nombre, '/', 1) = app.mi_empresa()::text)
      or exists (select 1 from public.hallazgos h where h.cierre_foto_ruta = p_nombre and app.puedo_ver_hallazgo(h.id));
$$;

revoke all on function app.puedo_ver_hallazgo(uuid), app.datos_hallazgo(uuid, jsonb), app.sincronizar_hallazgos(public.inspecciones, uuid),
  app.al_cambiar_inspeccion(), app.hallazgo_para(uuid, boolean) from public, anon, authenticated;
grant execute on function app.puedo_ver_hallazgo(uuid) to authenticated;
do $$
declare f text;
begin
  foreach f in array array['gestionar_hallazgo(uuid, jsonb)', 'hallazgo_en_proceso(uuid)', 'cerrar_hallazgo(uuid, text, text, integer)', 'reabrir_hallazgo(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
