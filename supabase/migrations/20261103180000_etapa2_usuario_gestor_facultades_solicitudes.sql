-- Etapa 2 del punto 2 (03/11/2026): usuario gestor, facultades por persona y solicitudes de cambio del gestor con aprobación del administrador.
-- Diseño aprobado por el dueño: pruebas/diseno-etapa2-usuario-gestor.md (sección 9).
-- AVISO (CLAUDE.md): cambia roles, permisos, roles_permisos y roles_asignables, y agrega tablas que cuelgan de vinculos.

-- ───────── 1. Rol nuevo y permisos
insert into public.roles (codigo, nombre, descripcion, orden)
values ('usuario_gestor', 'Usuario gestor', 'Trabajador con facultades extra marcadas por el administrador (lista fija).', 4);
update public.roles set orden = 5 where codigo = 'usuario';
insert into public.roles_permisos (rol, permiso) select 'usuario_gestor', permiso from public.roles_permisos where rol = 'usuario';

insert into public.permisos (codigo, descripcion) values
  ('facultades.dar', 'Marcar o quitar las facultades de usuarios gestores y gestores de sus sedes.'),
  ('solicitudes.resolver', 'Aprobar o denegar las solicitudes de cambio de los gestores de sus sedes y recibir las comunicaciones.'),
  ('solicitudes.pedir', 'Solicitar al administrador anular o corregir inspecciones y cambiar el programa anual aprobado.');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'facultades.dar'), ('admin_sede', 'facultades.dar'),
  ('admin_empresa', 'solicitudes.resolver'), ('admin_sede', 'solicitudes.resolver'),
  ('gestor', 'solicitudes.pedir'),
  -- El gestor maneja el personal de sus sedes (solo usuarios y usuarios gestores; sin contraseñas).
  ('gestor', 'cuentas.crear'), ('gestor', 'cuentas.cesar'), ('gestor', 'personas.editar'), ('gestor', 'personas.ver_empresa');
insert into public.roles_asignables (rol, rol_asignable) values
  ('admin_empresa', 'usuario_gestor'), ('admin_sede', 'usuario_gestor'), ('gestor', 'usuario'), ('gestor', 'usuario_gestor');

-- ───────── 2. Facultades por persona
-- Qué se puede marcar a cada rol (lista fija).
create function app.facultad_valida(p_rol text, p_permiso text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_rol
    when 'usuario_gestor' then p_permiso in ('inspecciones.ver', 'inspecciones.registrar', 'hallazgos.gestionar', 'passt.ver', 'personas.ver_nombres')
    when 'gestor' then p_permiso in ('inspecciones.anular', 'inspecciones.editar_cerrada', 'passt.reprogramar')
    else false end;
$$;

create table public.facultades_persona (
  vinculo_id uuid not null references public.vinculos (id) on delete cascade,
  permiso text not null references public.permisos (codigo),
  empresa_id uuid not null references public.empresas (id),
  otorgado_por uuid references public.personas (id),
  otorgado_en timestamptz not null default now(),
  primary key (vinculo_id, permiso)
);
create table public.facultades_historial (
  id bigint generated always as identity primary key,
  vinculo_id uuid not null,
  empresa_id uuid not null,
  permiso text not null,
  accion text not null check (accion in ('dar', 'quitar')),
  hecho_por uuid,
  hecho_en timestamptz not null default now()
);
comment on table public.facultades_persona is 'Facultades extra por cuenta (usuario gestor: 5; gestor: anular, corregir y reprogramar sin aprobación). Solo se escribe con dar_facultad / quitar_facultad.';

-- Solo se marca a quien corresponde por su rol (también protege contra escrituras desde otra función).
create function app.validar_facultad() returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = new.vinculo_id;
  if v.id is null or v.estado <> 'activo' or not app.facultad_valida(v.rol, new.permiso) then
    raise exception 'Esa facultad no se puede marcar a esta cuenta' using errcode = '22023';
  end if;
  new.empresa_id := v.empresa_id;
  return new;
end $$;
create trigger facultades_validar before insert or update on public.facultades_persona for each row execute function app.validar_facultad();

-- Al cesar la cuenta o cambiarle el rol, se borran las facultades que ya no le corresponden.
create function app.limpiar_facultades() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  with borradas as (
    delete from public.facultades_persona f
    where f.vinculo_id = new.id and (new.estado <> 'activo' or not app.facultad_valida(new.rol, f.permiso))
    returning f.vinculo_id, f.empresa_id, f.permiso)
  insert into public.facultades_historial (vinculo_id, empresa_id, permiso, accion, hecho_por)
  select vinculo_id, empresa_id, permiso, 'quitar', (select auth.uid()) from borradas;
  return null;
end $$;
create trigger vinculos_limpiar_facultades after update of rol, estado on public.vinculos for each row execute function app.limpiar_facultades();

-- El permiso final = los de su rol + sus facultades. Todas las reglas que preguntan «¿tiene este permiso?» siguen igual.
create or replace function app.tengo_permiso(p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.roles_permisos rp where rp.rol = (app.mi_vinculo_activo()).rol and rp.permiso = p_permiso)
      or exists (select 1 from public.facultades_persona f where f.vinculo_id = (app.mi_vinculo_activo()).id and f.permiso = p_permiso);
$$;

create function public.mis_permisos() returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p order by p), '{}')
  from (select permiso as p from public.roles_permisos where rol = (app.mi_vinculo_activo()).rol
        union select permiso from public.facultades_persona where vinculo_id = (app.mi_vinculo_activo()).id) x;
$$;

create function public.dar_facultad(p_vinculo uuid, p_permiso text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos; n int;
begin
  select * into v from public.vinculos where id = p_vinculo;
  if v.id is null or v.estado <> 'activo' or not app.puedo_gestionar_vinculo(p_vinculo, 'facultades.dar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not app.facultad_valida(v.rol, p_permiso) then
    raise exception 'Esa facultad no se puede marcar a esta cuenta' using errcode = '22023';
  end if;
  insert into public.facultades_persona (vinculo_id, permiso, empresa_id, otorgado_por) values (p_vinculo, p_permiso, v.empresa_id, (select auth.uid()))
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.facultades_historial (vinculo_id, empresa_id, permiso, accion, hecho_por) values (p_vinculo, v.empresa_id, p_permiso, 'dar', (select auth.uid()));
  end if;
end $$;

create function public.quitar_facultad(p_vinculo uuid, p_permiso text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos; n int;
begin
  select * into v from public.vinculos where id = p_vinculo;
  if v.id is null or not app.puedo_gestionar_vinculo(p_vinculo, 'facultades.dar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  delete from public.facultades_persona where vinculo_id = p_vinculo and permiso = p_permiso;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.facultades_historial (vinculo_id, empresa_id, permiso, accion, hecho_por) values (p_vinculo, v.empresa_id, p_permiso, 'quitar', (select auth.uid()));
  end if;
end $$;

-- Lectura: la propia cuenta y quien puede gestionarla (administrador de su sede, general o dueño).
create function app.puedo_ver_facultades(p_vinculo uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vinculos v where v.id = p_vinculo and v.persona_id = (select auth.uid()))
      or app.puedo_gestionar_vinculo(p_vinculo, 'facultades.dar');
$$;
alter table public.facultades_persona enable row level security;
alter table public.facultades_historial enable row level security;
create policy "Facultades: ver" on public.facultades_persona for select to authenticated using (app.puedo_ver_facultades(vinculo_id));
create policy "Facultades historial: ver" on public.facultades_historial for select to authenticated using (app.puedo_ver_facultades(vinculo_id));

-- ───────── 3. Solicitudes de cambio (y comunicaciones)
create table public.solicitudes_cambio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  sede_id uuid references public.sedes (id),
  tipo text not null check (tipo in ('anular_inspeccion', 'corregir_inspeccion', 'cambio_programa')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'denegada', 'comunicada')),
  objetivo_id uuid not null,
  titulo text not null,
  motivo text not null check (length(trim(motivo)) >= 3),
  datos jsonb not null default '{}'::jsonb,
  solicitado_por uuid not null references public.personas (id),
  solicitado_en timestamptz not null default now(),
  resuelto_por uuid references public.personas (id),
  resuelto_en timestamptz,
  comentario_resolucion text,
  visto_solicitante boolean not null default false,
  vistos uuid[] not null default '{}'
);
create index on public.solicitudes_cambio (empresa_id, estado);
create index on public.solicitudes_cambio (solicitado_por);
comment on table public.solicitudes_cambio is 'Pedidos del gestor (anular o corregir inspecciones, cambiar el programa aprobado) que decide un administrador, y comunicaciones de lo que el gestor hizo directo con su facultad.';

create function app.puedo_ver_solicitud(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.solicitudes_cambio s where s.id = p_id and (
    s.solicitado_por = (select auth.uid()) or app.es_dueno_plataforma()
    or (s.empresa_id = app.mi_empresa() and app.tengo_permiso('solicitudes.resolver')
        and (app.soy_general() or (s.sede_id is not null and app.puedo_sede(s.sede_id))))));
$$;
create function app.puedo_resolver_solicitud(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.solicitudes_cambio s where s.id = p_id and s.estado = 'pendiente' and s.solicitado_por <> (select auth.uid()) and (
    app.es_dueno_plataforma()
    or (s.empresa_id = app.mi_empresa() and app.tengo_permiso('solicitudes.resolver')
        and (app.soy_general() or (s.sede_id is not null and app.puedo_sede(s.sede_id))))));
$$;
alter table public.solicitudes_cambio enable row level security;
create policy "Solicitudes: ver" on public.solicitudes_cambio for select to authenticated using (app.puedo_ver_solicitud(id));

create function public.puedo_resolver_solicitud(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.puedo_resolver_solicitud(p_id);
$$;

-- Los nodos y semanas que toca un cambio del programa deben ser de ese programa.
create function app.nodo_del_programa(p_nodo uuid, p_programa uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.passt_nodos where id = p_nodo and programa_id = p_programa);
$$;
create function app.revisar_cambio_programa(p_programa uuid, d jsonb) returns void language plpgsql stable security definer set search_path = '' as $$
declare op text := d ->> 'operacion';
begin
  if op = 'programar_semana' then
    if not app.nodo_del_programa((d ->> 'p_actividad')::uuid, p_programa) or (d ->> 'p_semana')::int is null or (d ->> 'p_programada')::boolean is null then raise exception 'El cambio no es de este programa' using errcode = '22023'; end if;
  elsif op = 'guardar_nodo' then
    if jsonb_typeof(d -> 'p_datos') is distinct from 'object' or (d ->> 'p_id' is not null and not app.nodo_del_programa((d ->> 'p_id')::uuid, p_programa)) then raise exception 'El cambio no es de este programa' using errcode = '22023'; end if;
  elsif op = 'baja_nodo' then
    if not app.nodo_del_programa((d ->> 'p_id')::uuid, p_programa) then raise exception 'El cambio no es de este programa' using errcode = '22023'; end if;
  elsif op = 'mover_nodo' then
    if not app.nodo_del_programa((d ->> 'p_id')::uuid, p_programa) or jsonb_typeof(d -> 'p_datos') is distinct from 'object' then raise exception 'El cambio no es de este programa' using errcode = '22023'; end if;
  elsif op = 'guardar_metas' then
    if not app.nodo_del_programa((d ->> 'p_nodo')::uuid, p_programa) or jsonb_typeof(d -> 'p_metas') is distinct from 'array' then raise exception 'El cambio no es de este programa' using errcode = '22023'; end if;
  else
    raise exception 'Ese cambio del programa no se puede solicitar' using errcode = '22023';
  end if;
exception when invalid_text_representation or null_value_not_allowed then
  raise exception 'Datos del cambio no válidos' using errcode = '22023';
end $$;

create function public.solicitar_cambio(p_tipo text, p_objetivo uuid, p_datos jsonb, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.vinculos := app.mi_vinculo_activo();
  i public.inspecciones; pr public.passt_programas;
  v_id uuid; v_titulo text; v_sede uuid; v_datos jsonb := coalesce(p_datos, '{}'::jsonb);
begin
  if me.id is null or me.rol <> 'gestor' or not app.tengo_permiso('solicitudes.pedir') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Escribe el motivo' using errcode = '22023';
  end if;
  if p_tipo in ('anular_inspeccion', 'corregir_inspeccion') then
    select * into i from public.inspecciones where id = p_objetivo;
    if i.id is null or i.empresa_id <> me.empresa_id or not app.puedo_sede(i.sede_id) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if i.estado <> 'cerrada' then raise exception 'Solo se piden cambios sobre inspecciones cerradas' using errcode = '22023'; end if;
    v_sede := i.sede_id;
    if p_tipo = 'anular_inspeccion' then
      if app.tengo_permiso('inspecciones.anular') then raise exception 'Ya tienes permiso para anular: hazlo directo' using errcode = '22023'; end if;
      v_titulo := format('Anular la inspección N.º %s', i.numero);
      v_datos := '{}'::jsonb;
    else
      if app.tengo_permiso('inspecciones.editar_cerrada') then raise exception 'Ya tienes permiso para corregir: hazlo directo' using errcode = '22023'; end if;
      if jsonb_typeof(v_datos -> 'respuestas') is distinct from 'object' or jsonb_typeof(v_datos -> 'edicion') is distinct from 'number' then
        raise exception 'Faltan las respuestas corregidas' using errcode = '22023';
      end if;
      v_titulo := format('Corregir la inspección N.º %s', i.numero);
      v_datos := jsonb_strip_nulls(jsonb_build_object('edicion', v_datos -> 'edicion', 'respuestas', v_datos -> 'respuestas', 'filas', v_datos -> 'filas', 'observacion', v_datos -> 'observacion'));
    end if;
  elsif p_tipo = 'cambio_programa' then
    select * into pr from public.passt_programas where id = p_objetivo;
    if pr.id is null or pr.empresa_id <> me.empresa_id or not app.puedo_ver_programa(pr.empresa_id, pr.sede_id) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if pr.sede_id is not null and not app.puedo_sede(pr.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
    if pr.estado <> 'aprobado' then raise exception 'Mientras el programa está en borrador se edita directo' using errcode = '22023'; end if;
    if app.puedo_programa(pr.empresa_id, pr.sede_id, 'passt.reprogramar') then raise exception 'Ya tienes permiso para cambiar el programa: hazlo directo' using errcode = '22023'; end if;
    perform app.revisar_cambio_programa(pr.id, v_datos);
    v_sede := pr.sede_id;
    v_titulo := format('Cambiar el programa «%s»', pr.nombre);
  else
    raise exception 'Tipo de solicitud no válido' using errcode = '22023';
  end if;
  insert into public.solicitudes_cambio (empresa_id, sede_id, tipo, estado, objetivo_id, titulo, motivo, datos, solicitado_por)
  values (me.empresa_id, v_sede, p_tipo, 'pendiente', p_objetivo, v_titulo, trim(p_motivo), v_datos, me.persona_id)
  returning id into v_id;
  return v_id;
end $$;

-- Aplica el cambio pedido sobre el programa, como el administrador que aprobó (el motivo es el del gestor).
create function app.aplicar_cambio_programa(s public.solicitudes_cambio) returns void language plpgsql security definer set search_path = '' as $$
declare d jsonb := s.datos; op text := s.datos ->> 'operacion';
begin
  perform app.revisar_cambio_programa(s.objetivo_id, d);
  if op = 'programar_semana' then
    perform public.programar_semana((d ->> 'p_actividad')::uuid, (d ->> 'p_semana')::int, (d ->> 'p_programada')::boolean, s.motivo);
  elsif op = 'guardar_nodo' then
    perform public.guardar_nodo(s.objetivo_id, nullif(d ->> 'p_id', '')::uuid, (d -> 'p_datos') || jsonb_build_object('motivo', s.motivo));
  elsif op = 'baja_nodo' then
    perform public.baja_nodo((d ->> 'p_id')::uuid, s.motivo);
  elsif op = 'mover_nodo' then
    perform public.mover_nodo((d ->> 'p_id')::uuid, (d -> 'p_datos') || jsonb_build_object('motivo', s.motivo));
  elsif op = 'guardar_metas' then
    perform public.guardar_metas((d ->> 'p_nodo')::uuid, d -> 'p_metas', s.motivo);
  end if;
end $$;

create function public.resolver_solicitud(p_id uuid, p_aprobar boolean, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_cambio;
begin
  select * into s from public.solicitudes_cambio where id = p_id for update;
  if s.id is null or not app.puedo_resolver_solicitud(p_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if s.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta' using errcode = '22023'; end if;
  if not p_aprobar then
    if p_comentario is null or length(trim(p_comentario)) < 3 then raise exception 'Escribe por qué se deniega' using errcode = '22023'; end if;
  elsif s.tipo = 'anular_inspeccion' then
    perform public.anular_inspeccion(s.objetivo_id, s.motivo);
  elsif s.tipo = 'cambio_programa' then
    perform app.aplicar_cambio_programa(s);
  else
    raise exception 'Una corrección se aprueba desde el servidor que la valida' using errcode = '22023';
  end if;
  update public.solicitudes_cambio set estado = case when p_aprobar then 'aprobada' else 'denegada' end, resuelto_por = (select auth.uid()), resuelto_en = now(),
    comentario_resolucion = nullif(trim(coalesce(p_comentario, '')), ''), visto_solicitante = false
  where id = p_id;
end $$;

-- Solo lo llama el servidor (registrar-inspeccion) después de aplicar la corrección aprobada.
create function public.cerrar_solicitud_servidor(p_id uuid, p_por uuid, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.solicitudes_cambio set estado = 'aprobada', resuelto_por = p_por, resuelto_en = now(), comentario_resolucion = nullif(trim(coalesce(p_comentario, '')), ''), visto_solicitante = false
  where id = p_id and estado = 'pendiente';
  if not found then raise exception 'La solicitud ya fue resuelta' using errcode = '22023'; end if;
end $$;

create function public.marcar_solicitud_vista(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_cambio;
begin
  select * into s from public.solicitudes_cambio where id = p_id;
  if s.id is null or not app.puedo_ver_solicitud(p_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if s.solicitado_por = (select auth.uid()) then
    update public.solicitudes_cambio set visto_solicitante = true where id = p_id;
  else
    update public.solicitudes_cambio set vistos = array_append(vistos, (select auth.uid())) where id = p_id and not ((select auth.uid()) = any (vistos));
  end if;
end $$;

-- ───────── 4. Comunicaciones: lo que un gestor hace directo con su facultad avisa al administrador
create function app.rol_de(p_persona uuid, p_empresa uuid) returns text language sql stable security definer set search_path = '' as $$
  select rol from public.vinculos where persona_id = p_persona and empresa_id = p_empresa and estado = 'activo' limit 1;
$$;
create function app.comunicar_anulacion() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'cerrada' and new.estado = 'anulada' and app.rol_de((select auth.uid()), new.empresa_id) = 'gestor' then
    insert into public.solicitudes_cambio (empresa_id, sede_id, tipo, estado, objetivo_id, titulo, motivo, datos, solicitado_por, visto_solicitante)
    values (new.empresa_id, new.sede_id, 'anular_inspeccion', 'comunicada', new.id, format('Anuló la inspección N.º %s', new.numero), coalesce(new.motivo_anulacion, 'Sin motivo'), '{}'::jsonb, (select auth.uid()), true);
  end if;
  return null;
end $$;
create trigger inspecciones_comunicar_anulacion after update of estado on public.inspecciones for each row execute function app.comunicar_anulacion();

create function app.comunicar_correccion() returns trigger language plpgsql security definer set search_path = '' as $$
declare i public.inspecciones;
begin
  if app.rol_de(new.hecho_por, new.empresa_id) = 'gestor' then
    select * into i from public.inspecciones where id = new.inspeccion_id;
    insert into public.solicitudes_cambio (empresa_id, sede_id, tipo, estado, objetivo_id, titulo, motivo, datos, solicitado_por, visto_solicitante)
    values (new.empresa_id, i.sede_id, 'corregir_inspeccion', 'comunicada', new.inspeccion_id, format('Corrigió la inspección N.º %s', i.numero), coalesce(new.motivo, 'Sin motivo'), '{}'::jsonb, new.hecho_por, true);
  end if;
  return null;
end $$;
create trigger ediciones_comunicar_correccion after insert on public.inspecciones_ediciones for each row execute function app.comunicar_correccion();

create function app.comunicar_cambio_programa() returns trigger language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  if new.cambio in ('marcado', 'desmarcado') or app.rol_de(new.hecho_por, new.empresa_id) is distinct from 'gestor' then return null; end if;
  select * into pr from public.passt_programas where id = new.programa_id;
  if pr.estado = 'aprobado' then
    insert into public.solicitudes_cambio (empresa_id, sede_id, tipo, estado, objetivo_id, titulo, motivo, datos, solicitado_por, visto_solicitante)
    values (new.empresa_id, pr.sede_id, 'cambio_programa', 'comunicada', pr.id, format('Cambió el programa «%s» (%s)', pr.nombre, new.cambio), coalesce(new.motivo, 'Sin motivo'), '{}'::jsonb, new.hecho_por, true);
  end if;
  return null;
end $$;
create trigger passt_historial_comunicar after insert on public.passt_historial for each row execute function app.comunicar_cambio_programa();

-- ───────── 5. Permisos de ejecución y de tablas (nadie escribe directo; anon no ejecuta nada)
revoke all on table public.facultades_persona, public.facultades_historial, public.solicitudes_cambio from anon, public, authenticated;
grant select on table public.facultades_persona, public.facultades_historial, public.solicitudes_cambio to authenticated;
revoke all on function app.facultad_valida(text, text), app.validar_facultad(), app.limpiar_facultades(), app.puedo_ver_facultades(uuid), app.puedo_ver_solicitud(uuid),
  app.puedo_resolver_solicitud(uuid), app.nodo_del_programa(uuid, uuid), app.revisar_cambio_programa(uuid, jsonb), app.aplicar_cambio_programa(public.solicitudes_cambio),
  app.rol_de(uuid, uuid), app.comunicar_anulacion(), app.comunicar_correccion(), app.comunicar_cambio_programa() from public, anon;
grant execute on function app.facultad_valida(text, text), app.puedo_ver_facultades(uuid), app.puedo_ver_solicitud(uuid), app.puedo_resolver_solicitud(uuid) to authenticated;
revoke all on function public.mis_permisos(), public.dar_facultad(uuid, text), public.quitar_facultad(uuid, text), public.puedo_resolver_solicitud(uuid),
  public.solicitar_cambio(text, uuid, jsonb, text), public.resolver_solicitud(uuid, boolean, text), public.marcar_solicitud_vista(uuid),
  public.cerrar_solicitud_servidor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mis_permisos(), public.dar_facultad(uuid, text), public.quitar_facultad(uuid, text), public.puedo_resolver_solicitud(uuid),
  public.solicitar_cambio(text, uuid, jsonb, text), public.resolver_solicitud(uuid, boolean, text), public.marcar_solicitud_vista(uuid) to authenticated;
grant execute on function public.cerrar_solicitud_servidor(uuid, uuid, text) to service_role;
