-- Tarea 3.4-E · Programa Anual de SST (PASST), lo mínimo para el piloto. Reglas del dueño: D-41 (23 y 26/10/2026) y
-- decisiones del 28/10/2026 (3.4-E_decisiones_dueno_2026-10-28.md):
--  · árbol objetivo general → objetivos específicos (recursos, hasta 5 metas con indicador) → secciones → actividades;
--    la numeración no se guarda: la calcula la app con el orden (nunca se salta ni se repite);
--  · semanas ISO del año del programa (52 o 53); cada actividad con semanas programadas (P) y ejecutadas (E);
--  · E automática: al menos una inspección cerrada (no anulada) del formato vinculado en esa semana, de cualquier
--    inspector y con cualquier resultado. Se calcula al consultar (sin tarea diaria);
--  · E manual: el administrador en cualquier actividad; el responsable en las suyas sin formato vinculado;
--  · aprobar: el administrador; después, reprogramar y cambiar la estructura solo el administrador, con motivo;
--  · responsables: administradores o gestores de la empresa (los usuarios no).
-- Aviso (regla del CLAUDE.md): agrega 5 filas a permisos y 7 a roles_permisos (aprobado por el dueño el 28/10/2026).

insert into public.permisos (codigo, descripcion) values
  ('passt.ver', 'Ver los programas anuales de SST de su empresa.'),
  ('passt.editar', 'Crear, duplicar y editar programas anuales en borrador; programar semanas.'),
  ('passt.aprobar', 'Aprobar un programa anual de SST.'),
  ('passt.reprogramar', 'Cambiar semanas o estructura de un programa aprobado, con motivo.'),
  ('passt.marcar_manual', 'Marcar a mano como ejecutada cualquier actividad del programa, con observación.');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'passt.ver'),
  ('admin_empresa', 'passt.editar'),
  ('admin_empresa', 'passt.aprobar'),
  ('admin_empresa', 'passt.reprogramar'),
  ('admin_empresa', 'passt.marcar_manual'),
  ('gestor', 'passt.ver'),
  ('gestor', 'passt.editar');

create table public.passt_programas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  sede_id uuid references public.sedes (id) on delete restrict, -- vacía = programa general (todas las sedes)
  anio integer not null check (anio between 2020 and 2100), -- año ISO
  nombre text not null check (length(nombre) between 3 and 160),
  codigo_formato text check (codigo_formato is null or length(codigo_formato) <= 40),
  version_formato text check (version_formato is null or length(version_formato) <= 20),
  fecha_aprobacion date,
  meta_cumplimiento numeric(5, 2) not null default 95 check (meta_cumplimiento between 0 and 100),
  estado text not null default 'borrador' check (estado in ('borrador', 'aprobado')),
  aprobado_por uuid references public.personas (id),
  aprobado_en timestamptz,
  duplicado_de uuid references public.passt_programas (id),
  vigente boolean not null default true,
  creado_por uuid references public.personas (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint passt_aprobado check ((estado = 'aprobado') = (aprobado_en is not null))
);
comment on table public.passt_programas is 'Programa anual de SST de una empresa (general o de una sede). No se borra: se desactiva.';
create index passt_programas_empresa_idx on public.passt_programas (empresa_id, anio);

create table public.passt_nodos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.passt_programas (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  padre_id uuid references public.passt_nodos (id) on delete restrict,
  tipo text not null check (tipo in ('objetivo_general', 'objetivo_especifico', 'seccion', 'actividad')),
  orden integer not null,
  texto text not null check (length(texto) between 1 and 600),
  recursos text check (recursos is null or length(recursos) <= 1000), -- objetivos específicos
  responsable_id uuid references public.personas (id) on delete restrict, -- actividades
  meta_pct numeric(5, 2) check (meta_pct is null or meta_pct between 0 and 100),
  observaciones text check (observaciones is null or length(observaciones) <= 1000),
  plantilla_id uuid references public.plantillas (id) on delete restrict, -- formato vinculado (actividades)
  vigente boolean not null default true, -- false = dado de baja
  creado_en timestamptz not null default now(),
  constraint passt_nodos_raiz check ((tipo = 'objetivo_general') = (padre_id is null)),
  constraint passt_nodos_actividad check (tipo = 'actividad' or (responsable_id is null and plantilla_id is null and meta_pct is null))
);
comment on table public.passt_nodos is 'Árbol del programa. El número (1, 1.1, 1.1.1) no se guarda: sale del orden.';
create index passt_nodos_programa_idx on public.passt_nodos (programa_id);

create table public.passt_metas (
  id uuid primary key default gen_random_uuid(),
  nodo_id uuid not null references public.passt_nodos (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  orden integer not null check (orden between 1 and 5),
  texto text not null check (length(texto) between 1 and 400),
  indicador text check (indicador is null or length(indicador) <= 400),
  unique (nodo_id, orden)
);

create table public.passt_semanas (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.passt_nodos (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  semana integer not null check (semana between 1 and 53),
  programada boolean not null default false,
  manual boolean not null default false, -- marcada a mano como ejecutada
  manual_comentario text check (manual_comentario is null or length(manual_comentario) between 3 and 1000),
  manual_foto_ruta text,
  manual_foto_bytes integer,
  manual_por uuid references public.personas (id),
  manual_en timestamptz,
  unique (actividad_id, semana),
  constraint passt_semanas_manual check (manual = (manual_comentario is not null and manual_por is not null and manual_en is not null))
);
comment on table public.passt_semanas is 'Semanas programadas de cada actividad y marcas manuales de ejecución. Lo ejecutado por inspecciones se calcula al consultar.';

create table public.passt_historial (
  id bigint generated always as identity primary key,
  programa_id uuid not null references public.passt_programas (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nodo_id uuid references public.passt_nodos (id) on delete restrict,
  cambio text not null check (cambio in ('creado', 'duplicado', 'aprobado', 'estructura', 'reprogramado', 'marcado', 'desmarcado', 'baja')),
  detalle jsonb,
  motivo text,
  hecho_por uuid references public.personas (id),
  hecho_en timestamptz not null default now()
);
comment on table public.passt_historial is 'Rastro del programa: aprobación, reprogramaciones, cambios de estructura y marcas manuales. Nadie lo edita.';
create index passt_historial_programa_idx on public.passt_historial (programa_id);

-- ───── Quién ve ─────
do $$
declare t text;
begin
  foreach t in array array['passt_programas', 'passt_nodos', 'passt_metas', 'passt_semanas', 'passt_historial'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "Ver PASST de mi empresa" on public.%I for select to authenticated using ((select app.es_dueno_plataforma()) or (empresa_id = (select app.mi_empresa()) and (select app.tengo_permiso(''passt.ver''))))', t);
  end loop;
end $$;

-- ───── Ayudas internas ─────
-- Programa para cambiar: quien edita; si ya está aprobado, solo quien reprograma, con motivo (queda en el historial).
create function app.passt_para_cambiar(p_programa uuid, p_motivo text) returns public.passt_programas
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  select * into pr from public.passt_programas where id = p_programa for update;
  if pr.id is null or not app.puedo_en_empresa(pr.empresa_id, 'passt.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if pr.estado = 'aprobado' then
    if not app.puedo_en_empresa(pr.empresa_id, 'passt.reprogramar') then
      raise exception 'El programa está aprobado: solo el administrador lo cambia' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_motivo, ''))) < 3 then
      raise exception 'El programa está aprobado: escribe el motivo del cambio' using errcode = '22023';
    end if;
  end if;
  return pr;
end $$;

create function app.passt_anotar(pr public.passt_programas, p_nodo uuid, p_cambio text, p_detalle jsonb, p_motivo text) returns void
language sql security definer set search_path = '' as $$
  insert into public.passt_historial (programa_id, empresa_id, nodo_id, cambio, detalle, motivo, hecho_por)
  values (pr.id, pr.empresa_id, p_nodo, p_cambio, p_detalle, nullif(trim(coalesce(p_motivo, '')), ''), (select auth.uid()));
$$;

-- Semanas del año ISO (52 o 53).
create function app.semanas_del_anio(p_anio integer) returns integer
language sql immutable set search_path = '' as $$
  select extract(week from make_date(p_anio, 12, 28))::integer;
$$;

-- Qué va encima de cada elemento: objetivo específico → objetivo general → … (actividad → sección).
create function app.passt_tipo_padre(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo when 'objetivo_especifico' then 'objetivo_general' when 'seccion' then 'objetivo_especifico' when 'actividad' then 'seccion' end;
$$;

-- ───── Programas ─────
create function public.crear_programa(p_empresa uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_sede uuid := nullif(p_datos ->> 'sede_id', '')::uuid; v_anio integer := (p_datos ->> 'anio')::integer;
  v_nombre text := app.texto(p_datos, 'nombre'); pr public.passt_programas;
begin
  if not app.puedo_en_empresa(p_empresa, 'passt.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_sede is not null and not exists (select 1 from public.sedes where id = v_sede and empresa_id = p_empresa) then
    raise exception 'La sede no es de la empresa' using errcode = '22023';
  end if;
  if v_anio is null or v_anio not between 2020 and 2100 then
    raise exception 'Año no válido' using errcode = '22023';
  end if;
  insert into public.passt_programas (empresa_id, sede_id, anio, nombre, creado_por)
  values (p_empresa, v_sede, v_anio, coalesce(v_nombre, 'Programa anual de SST ' || v_anio), (select auth.uid()))
  returning * into pr;
  insert into public.passt_nodos (programa_id, empresa_id, tipo, orden, texto)
  values (pr.id, p_empresa, 'objetivo_general', 1, coalesce(app.texto(p_datos, 'objetivo_general'), 'Objetivo general ' || v_anio));
  perform app.passt_anotar(pr, null, 'creado', null, null);
  return pr.id;
end $$;

-- Encabezado: nombre, código, versión, fecha de aprobación y meta de cumplimiento.
create function public.guardar_programa(p_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas; v_meta numeric := coalesce((p_datos ->> 'meta_cumplimiento')::numeric, 95);
begin
  pr := app.passt_para_cambiar(p_id, p_datos ->> 'motivo');
  if app.texto(p_datos, 'nombre') is null or length(app.texto(p_datos, 'nombre')) not between 3 and 160 then
    raise exception 'Escribe el nombre del programa (3 a 160)' using errcode = '22023';
  end if;
  if v_meta not between 0 and 100 then
    raise exception 'La meta debe estar entre 0 y 100 %%' using errcode = '22023';
  end if;
  update public.passt_programas set nombre = app.texto(p_datos, 'nombre'), codigo_formato = left(app.texto(p_datos, 'codigo_formato'), 40),
    version_formato = left(app.texto(p_datos, 'version_formato'), 20), fecha_aprobacion = nullif(p_datos ->> 'fecha_aprobacion', '')::date,
    meta_cumplimiento = v_meta, actualizado_en = now()
  where id = pr.id;
  if pr.estado = 'aprobado' then perform app.passt_anotar(pr, null, 'estructura', jsonb_build_object('encabezado', p_datos), p_datos ->> 'motivo'); end if;
end $$;

create function public.aprobar_programa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  select * into pr from public.passt_programas where id = p_id for update;
  if pr.id is null or not app.puedo_en_empresa(pr.empresa_id, 'passt.aprobar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if pr.estado = 'aprobado' then
    raise exception 'Ya está aprobado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.passt_nodos n join public.passt_semanas s on s.actividad_id = n.id
                 where n.programa_id = pr.id and n.vigente and n.tipo = 'actividad' and s.programada) then
    raise exception 'Programa al menos una semana de una actividad antes de aprobar' using errcode = '22023';
  end if;
  update public.passt_programas set estado = 'aprobado', aprobado_por = (select auth.uid()), aprobado_en = now(), actualizado_en = now() where id = pr.id;
  perform app.passt_anotar(pr, null, 'aprobado', null, null);
end $$;

-- Duplicar: copia el árbol, las metas y las semanas programadas (no lo ejecutado). Queda en borrador.
create function public.duplicar_programa(p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare o public.passt_programas; pr public.passt_programas; n record; mapa jsonb := '{}'::jsonb; v_nuevo uuid;
  v_anio integer := coalesce((p_datos ->> 'anio')::integer, 0); v_sede uuid := nullif(p_datos ->> 'sede_id', '')::uuid; v_max integer;
begin
  select * into o from public.passt_programas where id = p_id;
  if o.id is null or not app.puedo_en_empresa(o.empresa_id, 'passt.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_anio = 0 then v_anio := o.anio; end if;
  if v_anio not between 2020 and 2100 then raise exception 'Año no válido' using errcode = '22023'; end if;
  if v_sede is not null and not exists (select 1 from public.sedes where id = v_sede and empresa_id = o.empresa_id) then
    raise exception 'La sede no es de la empresa' using errcode = '22023';
  end if;
  v_max := app.semanas_del_anio(v_anio);
  insert into public.passt_programas (empresa_id, sede_id, anio, nombre, codigo_formato, version_formato, meta_cumplimiento, duplicado_de, creado_por)
  values (o.empresa_id, v_sede, v_anio, coalesce(app.texto(p_datos, 'nombre'), o.nombre || ' (copia)'), o.codigo_formato, o.version_formato,
          o.meta_cumplimiento, o.id, (select auth.uid()))
  returning * into pr;
  -- Del padre al hijo: primero el objetivo general, luego los objetivos, las secciones y las actividades.
  for n in
    select * from public.passt_nodos where programa_id = o.id and vigente
    order by case tipo when 'objetivo_general' then 1 when 'objetivo_especifico' then 2 when 'seccion' then 3 else 4 end, orden
  loop
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id)
    values (pr.id, pr.empresa_id, (mapa ->> n.padre_id::text)::uuid, n.tipo, n.orden, n.texto, n.recursos, n.responsable_id, n.meta_pct, n.observaciones, n.plantilla_id)
    returning id into v_nuevo;
    mapa := mapa || jsonb_build_object(n.id::text, v_nuevo);
  end loop;
  insert into public.passt_metas (nodo_id, empresa_id, orden, texto, indicador)
  select (mapa ->> m.nodo_id::text)::uuid, m.empresa_id, m.orden, m.texto, m.indicador
  from public.passt_metas m where mapa ? m.nodo_id::text;
  insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
  select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id, s.semana, true
  from public.passt_semanas s where mapa ? s.actividad_id::text and s.programada and s.semana <= v_max;
  perform app.passt_anotar(pr, null, 'duplicado', jsonb_build_object('de', o.id), null);
  return pr.id;
end $$;

create function public.cambiar_vigencia_programa(p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  select * into pr from public.passt_programas where id = p_id;
  if pr.id is null or p_vigente is null or not app.puedo_en_empresa(pr.empresa_id, 'passt.aprobar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.passt_programas set vigente = p_vigente, actualizado_en = now() where id = pr.id;
end $$;

-- ───── Árbol ─────
-- p_datos: tipo, padre_id (nuevo), texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id, motivo.
create function public.guardar_nodo(p_programa uuid, p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas; n public.passt_nodos; padre public.passt_nodos; v_tipo text; v_padre_tipo text; v_resp uuid; v_plant uuid; v_meta numeric; v_id uuid;
  v_texto text := app.texto(p_datos, 'texto');
begin
  pr := app.passt_para_cambiar(p_programa, p_datos ->> 'motivo');
  if p_id is not null then
    select * into n from public.passt_nodos where id = p_id and programa_id = pr.id;
    if n.id is null or not n.vigente then raise exception 'El elemento no existe' using errcode = '22023'; end if;
    v_tipo := n.tipo;
  else
    v_tipo := p_datos ->> 'tipo';
    select * into padre from public.passt_nodos where id = nullif(p_datos ->> 'padre_id', '')::uuid and programa_id = pr.id and vigente;
    v_padre_tipo := app.passt_tipo_padre(v_tipo);
    if v_tipo is null or v_tipo not in ('objetivo_especifico', 'seccion', 'actividad') or padre.id is null or padre.tipo is distinct from v_padre_tipo then
      raise exception 'Un objetivo específico va en el objetivo general, una sección en un objetivo y una actividad en una sección' using errcode = '22023';
    end if;
  end if;
  if v_texto is null or length(v_texto) > 600 then raise exception 'Escribe el texto (hasta 600)' using errcode = '22023'; end if;
  if v_tipo = 'actividad' then
    v_resp := nullif(p_datos ->> 'responsable_id', '')::uuid;
    v_plant := nullif(p_datos ->> 'plantilla_id', '')::uuid;
    v_meta := coalesce(nullif(p_datos ->> 'meta_pct', '')::numeric, 100);
    -- Los responsables son administradores o gestores de la empresa (decisión del dueño, 28/10/2026).
    if v_resp is not null and not exists (select 1 from public.vinculos where persona_id = v_resp and empresa_id = pr.empresa_id
                                          and estado = 'activo' and rol in ('admin_empresa', 'gestor')) then
      raise exception 'El responsable debe ser un administrador o gestor activo de la empresa' using errcode = '22023';
    end if;
    if v_plant is not null and not exists (select 1 from public.plantillas where id = v_plant and empresa_id = pr.empresa_id) then
      raise exception 'El formato vinculado debe ser de la empresa' using errcode = '22023';
    end if;
    if v_meta not between 0 and 100 then raise exception 'La meta debe estar entre 0 y 100 %%' using errcode = '22023'; end if;
  end if;
  if p_id is null then
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id)
    values (pr.id, pr.empresa_id, padre.id, v_tipo,
            coalesce((select max(orden) from public.passt_nodos where padre_id = padre.id), 0) + 1, v_texto,
            case when v_tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
            v_resp, case when v_tipo = 'actividad' then v_meta end, left(app.texto(p_datos, 'observaciones'), 1000), v_plant)
    returning id into v_id;
  else
    update public.passt_nodos set texto = v_texto,
      recursos = case when tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
      responsable_id = v_resp, meta_pct = case when tipo = 'actividad' then v_meta end,
      observaciones = left(app.texto(p_datos, 'observaciones'), 1000), plantilla_id = v_plant
    where id = p_id returning id into v_id;
  end if;
  update public.passt_programas set actualizado_en = now() where id = pr.id;
  if pr.estado = 'aprobado' then perform app.passt_anotar(pr, v_id, 'estructura', p_datos - 'motivo', p_datos ->> 'motivo'); end if;
  return v_id;
end $$;

-- Mover: «subir» o «bajar» entre sus hermanos, o a otro padre del mismo tipo (va al final).
create function public.mover_nodo(p_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; otro public.passt_nodos; padre public.passt_nodos; pr public.passt_programas; v_dir text := p_datos ->> 'direccion';
begin
  select * into n from public.passt_nodos where id = p_id;
  if n.id is null or not n.vigente or n.tipo = 'objetivo_general' then raise exception 'No se puede mover' using errcode = '22023'; end if;
  pr := app.passt_para_cambiar(n.programa_id, p_datos ->> 'motivo');
  if v_dir in ('subir', 'bajar') then
    if v_dir = 'subir' then
      select * into otro from public.passt_nodos where padre_id = n.padre_id and vigente and orden < n.orden order by orden desc limit 1;
    else
      select * into otro from public.passt_nodos where padre_id = n.padre_id and vigente and orden > n.orden order by orden limit 1;
    end if;
    if otro.id is null then return; end if;
    update public.passt_nodos set orden = otro.orden where id = n.id;
    update public.passt_nodos set orden = n.orden where id = otro.id;
  else
    select * into padre from public.passt_nodos where id = nullif(p_datos ->> 'padre_id', '')::uuid and programa_id = n.programa_id and vigente;
    if padre.id is null or padre.tipo is distinct from app.passt_tipo_padre(n.tipo) then
      raise exception 'Ese lugar no corresponde a este elemento' using errcode = '22023';
    end if;
    update public.passt_nodos set padre_id = padre.id, orden = coalesce((select max(orden) from public.passt_nodos where padre_id = padre.id), 0) + 1 where id = n.id;
  end if;
  if pr.estado = 'aprobado' then perform app.passt_anotar(pr, n.id, 'estructura', p_datos - 'motivo', p_datos ->> 'motivo'); end if;
end $$;

-- Baja (no se borra): el elemento y todo lo que tiene debajo dejan de verse y de contar.
create function public.baja_nodo(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas;
begin
  select * into n from public.passt_nodos where id = p_id;
  if n.id is null or not n.vigente or n.tipo = 'objetivo_general' then raise exception 'No se puede dar de baja' using errcode = '22023'; end if;
  pr := app.passt_para_cambiar(n.programa_id, p_motivo);
  with recursive rama as (
    select id from public.passt_nodos where id = n.id
    union all select h.id from public.passt_nodos h join rama on h.padre_id = rama.id
  )
  update public.passt_nodos set vigente = false where id in (select id from rama);
  perform app.passt_anotar(pr, n.id, 'baja', null, p_motivo);
end $$;

-- Metas de un objetivo específico: hasta 5, cada una con su indicador (reemplaza las anteriores).
create function public.guardar_metas(p_nodo uuid, p_metas jsonb, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas; m jsonb; k integer := 0;
begin
  select * into n from public.passt_nodos where id = p_nodo;
  if n.id is null or n.tipo <> 'objetivo_especifico' then raise exception 'Las metas van en un objetivo específico' using errcode = '22023'; end if;
  pr := app.passt_para_cambiar(n.programa_id, p_motivo);
  if jsonb_typeof(p_metas) <> 'array' or jsonb_array_length(p_metas) > 5 then
    raise exception 'Hasta 5 metas por objetivo' using errcode = '22023';
  end if;
  delete from public.passt_metas where nodo_id = n.id;
  for m in select * from jsonb_array_elements(p_metas) loop
    if nullif(trim(coalesce(m ->> 'texto', '')), '') is null then continue; end if;
    k := k + 1;
    insert into public.passt_metas (nodo_id, empresa_id, orden, texto, indicador)
    values (n.id, n.empresa_id, k, left(trim(m ->> 'texto'), 400), left(nullif(trim(coalesce(m ->> 'indicador', '')), ''), 400));
  end loop;
  if pr.estado = 'aprobado' then perform app.passt_anotar(pr, n.id, 'estructura', jsonb_build_object('metas', p_metas), p_motivo); end if;
end $$;

-- ───── Semanas ─────
-- Programar o quitar una semana (P). Aprobado: solo el administrador y con motivo.
create function public.programar_semana(p_actividad uuid, p_semana integer, p_programada boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas;
begin
  select * into n from public.passt_nodos where id = p_actividad;
  if n.id is null or n.tipo <> 'actividad' or not n.vigente then raise exception 'La actividad no existe' using errcode = '22023'; end if;
  pr := app.passt_para_cambiar(n.programa_id, p_motivo);
  if p_semana is null or p_semana not between 1 and app.semanas_del_anio(pr.anio) then
    raise exception 'Semana no válida para %', pr.anio using errcode = '22023';
  end if;
  insert into public.passt_semanas (actividad_id, empresa_id, semana, programada) values (n.id, n.empresa_id, p_semana, coalesce(p_programada, false))
  on conflict (actividad_id, semana) do update set programada = excluded.programada;
  if pr.estado = 'aprobado' then
    perform app.passt_anotar(pr, n.id, 'reprogramado', jsonb_build_object('semana', p_semana, 'programada', p_programada), p_motivo);
  end if;
end $$;

-- Marcar a mano como ejecutada (o quitar la marca): el administrador en cualquier actividad; el responsable en las
-- suyas que no tienen formato vinculado (esas se ejecutan solas con la inspección). Con comentario y foto opcional.
create function public.marcar_semana(p_actividad uuid, p_semana integer, p_ejecutada boolean, p_comentario text, p_foto_ruta text, p_foto_bytes integer) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas;
begin
  select * into n from public.passt_nodos where id = p_actividad;
  if n.id is null or n.tipo <> 'actividad' or not n.vigente then raise exception 'La actividad no existe' using errcode = '22023'; end if;
  select * into pr from public.passt_programas where id = n.programa_id;
  if not (app.puedo_en_empresa(pr.empresa_id, 'passt.marcar_manual')
          or (n.plantilla_id is null and n.responsable_id = (select auth.uid()) and pr.empresa_id = app.mi_empresa() and app.tengo_permiso('passt.ver'))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_semana is null or p_semana not between 1 and app.semanas_del_anio(pr.anio) then
    raise exception 'Semana no válida para %', pr.anio using errcode = '22023';
  end if;
  if p_ejecutada and length(trim(coalesce(p_comentario, ''))) < 3 then
    raise exception 'Escribe qué se hizo' using errcode = '22023';
  end if;
  if p_ejecutada and p_foto_ruta is not null and (p_foto_ruta !~ ('^' || pr.empresa_id::text || '/' || n.id::text || '/passt-' || p_semana || '-[0-9a-f]{8}\.(jpg|webp|png)$')
      or p_foto_bytes is null or p_foto_bytes not between 1 and 1048576) then
    raise exception 'La foto no está en la carpeta de la actividad' using errcode = '22023';
  end if;
  insert into public.passt_semanas (actividad_id, empresa_id, semana) values (n.id, n.empresa_id, p_semana) on conflict (actividad_id, semana) do nothing;
  update public.passt_semanas set manual = coalesce(p_ejecutada, false),
    manual_comentario = case when p_ejecutada then left(trim(p_comentario), 1000) end,
    manual_foto_ruta = case when p_ejecutada then p_foto_ruta end, manual_foto_bytes = case when p_ejecutada then p_foto_bytes end,
    manual_por = case when p_ejecutada then (select auth.uid()) end, manual_en = case when p_ejecutada then now() end
  where actividad_id = n.id and semana = p_semana;
  perform app.passt_anotar(pr, n.id, case when p_ejecutada then 'marcado' else 'desmarcado' end,
                           jsonb_build_object('semana', p_semana, 'foto', p_foto_ruta), p_comentario);
end $$;

-- ───── Lo ejecutado por inspecciones (se calcula al consultar, sin tarea diaria) ─────
-- Por actividad con formato vinculado: en qué semanas del año hay inspecciones cerradas (no anuladas) de ese formato,
-- en la sede del programa (o en todas, si es general), de cualquier inspector y con cualquier resultado.
create function public.passt_ejecucion(p_programa uuid)
returns table (actividad_id uuid, semana integer, inspecciones integer, ultima uuid)
language plpgsql stable security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  select * into pr from public.passt_programas where id = p_programa;
  if pr.id is null or not app.puedo_en_empresa(pr.empresa_id, 'passt.ver') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select n.id, extract(week from i.fecha)::integer, count(*)::integer, (array_agg(i.id order by i.fecha desc, i.numero desc))[1]
    from public.passt_nodos n
    join public.inspecciones i on i.plantilla_id = n.plantilla_id and i.empresa_id = pr.empresa_id and i.estado = 'cerrada'
      and extract(isoyear from i.fecha)::integer = pr.anio and (pr.sede_id is null or i.sede_id = pr.sede_id)
    where n.programa_id = pr.id and n.tipo = 'actividad' and n.vigente and n.plantilla_id is not null
    group by n.id, extract(week from i.fecha);
end $$;

-- Hallazgos abiertos y vencidos que dejaron las inspecciones de cada actividad vinculada (en el año del programa).
create function public.passt_hallazgos(p_programa uuid)
returns table (actividad_id uuid, abiertos integer, vencidos integer)
language plpgsql stable security definer set search_path = '' as $$
declare pr public.passt_programas;
begin
  select * into pr from public.passt_programas where id = p_programa;
  if pr.id is null or not app.puedo_en_empresa(pr.empresa_id, 'passt.ver') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select n.id, count(*)::integer, count(*) filter (where h.plazo < current_date)::integer
    from public.passt_nodos n
    join public.hallazgos h on h.plantilla_id = n.plantilla_id and h.empresa_id = pr.empresa_id and h.estado in ('abierto', 'en_proceso')
      and (pr.sede_id is null or h.sede_id = pr.sede_id)
    join public.inspecciones i on i.id = h.inspeccion_id and extract(isoyear from i.fecha)::integer = pr.anio
    where n.programa_id = pr.id and n.tipo = 'actividad' and n.vigente and n.plantilla_id is not null
    group by n.id;
end $$;

-- N.° de trabajadores para el encabezado (personas con vínculo activo en la empresa).
create function public.passt_trabajadores(p_empresa uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when app.puedo_en_empresa(p_empresa, 'passt.ver')
    then (select count(*)::integer from public.vinculos where empresa_id = p_empresa and estado = 'activo') end;
$$;

-- ───── Foto de la marca manual: <empresa>/<actividad>/passt-<semana>-<8 letras>.jpg en «evidencias» ─────
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
        and (app.tengo_permiso('hallazgos.gestionar') or (app.tengo_permiso('hallazgos.cerrar_propios') and h.responsable_id = (select auth.uid())))))
  or (p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/passt-[0-9]{1,2}-[0-9a-f]{8}\.(jpg|webp|png)$'
    and split_part(p_nombre, '/', 1) = app.mi_empresa()::text
    and exists (
      select 1 from public.passt_nodos n
      where n.id::text = split_part(p_nombre, '/', 2) and n.tipo = 'actividad' and n.vigente and n.empresa_id = app.mi_empresa()
        and (app.tengo_permiso('passt.marcar_manual')
             or (n.plantilla_id is null and n.responsable_id = (select auth.uid()) and app.tengo_permiso('passt.ver')))));
$$;

create or replace function app.puedo_ver_evidencia(p_nombre text, p_dueno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.puedo_ver_inspeccion(nullif(split_part(p_nombre, '/', 2), '')::uuid)
      or (p_dueno = (select auth.uid()) and split_part(p_nombre, '/', 1) = app.mi_empresa()::text)
      or exists (select 1 from public.hallazgos h where h.cierre_foto_ruta = p_nombre and app.puedo_ver_hallazgo(h.id))
      or exists (select 1 from public.passt_semanas s where s.manual_foto_ruta = p_nombre
                 and (app.es_dueno_plataforma() or (s.empresa_id = app.mi_empresa() and app.tengo_permiso('passt.ver'))));
$$;

revoke all on function app.passt_para_cambiar(uuid, text), app.passt_anotar(public.passt_programas, uuid, text, jsonb, text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['crear_programa(uuid, jsonb)', 'guardar_programa(uuid, jsonb)', 'aprobar_programa(uuid)', 'duplicar_programa(uuid, jsonb)',
    'cambiar_vigencia_programa(uuid, boolean)', 'guardar_nodo(uuid, uuid, jsonb)', 'mover_nodo(uuid, jsonb)', 'baja_nodo(uuid, text)',
    'guardar_metas(uuid, jsonb, text)', 'programar_semana(uuid, integer, boolean, text)', 'marcar_semana(uuid, integer, boolean, text, text, integer)',
    'passt_ejecucion(uuid)', 'passt_hallazgos(uuid)', 'passt_trabajadores(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
