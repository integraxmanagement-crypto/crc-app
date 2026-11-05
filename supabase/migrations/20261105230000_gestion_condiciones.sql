-- Gestión de condiciones (pedido del dueño, 05/11/2026): una matriz por sede donde el administrador general, el administrador de sede y el gestor
-- cargan condiciones (hallazgos manuales) y las siguen hasta su cierre. Es independiente de «Hallazgos» (los de las inspecciones).
--  · Las columnas son por sede. Las 14 columnas base se crean solas la primera vez; no se eliminan (se ocultan). Se pueden agregar más
--    (texto, número, fecha, lista de una opción o de varias) y cambiar nombre, opciones y si son obligatorias.
--  · Los administradores (general o de sede) cambian las columnas directo. El gestor PROPONE el cambio: usa «solicitudes_cambio»
--    (tipo nuevo) y un administrador lo aprueba o lo deniega; al aprobar se ejecuta, al denegar la matriz no cambia.
--  · No toca roles ni permisos: quién puede lo decide el rol del vínculo (app.rol_condiciones). Las propuestas usan «solicitudes.pedir»
--    y «solicitudes.resolver» de la etapa 2.
--  · Las fotos van al almacén privado «condiciones»: <empresa>/<condición>-<8 letras>.jpg · máximo 1 MB.
--  · Estado (pendiente, atrasado, realizado dentro o fuera de plazo) se calcula en la app con las fechas; no se guarda.

-- ───────────────────────── Quién puede ─────────────────────────
create function app.rol_condiciones() returns text language sql stable security definer set search_path = '' as $$
  select case
    when app.es_dueno_plataforma() then 'admin'
    else case (app.mi_vinculo_activo()).rol when 'admin_empresa' then 'admin' when 'admin_sede' then 'admin' when 'gestor' then 'gestor' else null end
  end;
$$;
-- Ver y cargar: administradores y gestores, en sus sedes.
create function app.puedo_ver_condiciones(p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.rol_condiciones() is not null and app.puedo_sede(p_sede);
$$;
-- Configurar las columnas directo: solo administradores (general o de sede), en sus sedes.
create function app.puedo_configurar_condiciones(p_sede uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.rol_condiciones() = 'admin' and app.puedo_sede(p_sede);
$$;

-- ───────────────────────── Tablas ─────────────────────────
create table public.condiciones_columnas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  sede_id uuid not null references public.sedes (id),
  clave text not null check (clave ~ '^[a-z][a-z0-9_]{1,40}$'),
  nombre text not null check (length(trim(nombre)) between 2 and 60),
  tipo text not null check (tipo in ('texto', 'numero', 'fecha', 'lista', 'multiple', 'foto', 'descripcion', 'estado', 'responsable_auto', 'persona')),
  opciones text[] not null default '{}',
  obligatoria boolean not null default false,
  visible boolean not null default true,
  orden integer not null,
  es_base boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (sede_id, clave)
);
create index on public.condiciones_columnas (empresa_id);
comment on table public.condiciones_columnas is 'Columnas de la matriz de condiciones, por sede. Las 14 base se crean solas; el administrador agrega, oculta o elimina las demás.';

create table public.condiciones (
  id uuid primary key,
  empresa_id uuid not null references public.empresas (id),
  sede_id uuid not null references public.sedes (id),
  fecha_hallazgo date not null,
  fecha_programada date,
  fecha_cierre date,
  datos jsonb not null default '{}'::jsonb,
  creado_por uuid not null references public.personas (id),
  creado_por_nombre text not null,
  creado_en timestamptz not null default now(),
  actualizado_por uuid references public.personas (id),
  actualizado_en timestamptz
);
create index on public.condiciones (sede_id, fecha_hallazgo desc);
create index on public.condiciones (empresa_id);
comment on table public.condiciones is 'Condiciones cargadas a mano en la matriz de una sede. Las fechas clave van en columnas; el resto, por columna, en «datos».';

alter table public.condiciones_columnas enable row level security;
alter table public.condiciones enable row level security;
create policy "Columnas de condiciones: ver" on public.condiciones_columnas for select to authenticated using (app.puedo_ver_condiciones(sede_id));
create policy "Condiciones: ver" on public.condiciones for select to authenticated using (app.puedo_ver_condiciones(sede_id));
revoke all on public.condiciones_columnas, public.condiciones from anon;
revoke insert, update, delete, truncate on public.condiciones_columnas, public.condiciones from authenticated;

-- ───────────────────────── Columnas base ─────────────────────────
create function app.columnas_base() returns table (clave text, nombre text, tipo text, opciones text[], obligatoria boolean, orden integer)
language sql immutable set search_path = '' as $$
  values
    ('area', 'Área', 'texto', '{}'::text[], true, 1),
    ('ubicacion', 'Ubicación específica', 'texto', '{}'::text[], true, 2),
    ('fecha_hallazgo', 'Fecha de hallazgo', 'fecha', '{}'::text[], true, 3),
    ('clasificacion', 'Clasificación (nivel de riesgo)', 'lista', array['Tipo A', 'Tipo B'], true, 4),
    ('descripcion', 'Descripción (peligro y riesgo)', 'descripcion', '{}'::text[], true, 5),
    ('evidencia', 'Evidencia', 'foto', '{}'::text[], true, 6),
    ('plan_accion', 'Plan de acción', 'texto', '{}'::text[], true, 7),
    ('fecha_programada', 'Fecha programada', 'fecha', '{}'::text[], true, 8),
    ('fecha_cierre', 'Fecha de levantamiento o cierre', 'fecha', '{}'::text[], false, 9),
    ('estado', 'Estado', 'estado', '{}'::text[], false, 10),
    ('resp_inspeccion', 'Responsable de la inspección', 'responsable_auto', '{}'::text[], false, 11),
    ('resp_levantamiento', 'Responsable del levantamiento', 'persona', '{}'::text[], true, 12),
    ('origen', 'Origen', 'lista', array['Inspección de seguridad', 'Observación de campo', 'Auditoría', 'Reporte de un trabajador', 'Incidente'], true, 13),
    ('motivo', 'Motivo', 'lista', array['Acto subestándar', 'Condición subestándar', 'Falta de mantenimiento', 'Incumplimiento legal', 'Mejora'], true, 14);
$$;

-- Crea las columnas base de la sede la primera vez (y solo las que falten).
create function public.preparar_condiciones(p_sede uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.sedes;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.condiciones_columnas (empresa_id, sede_id, clave, nombre, tipo, opciones, obligatoria, orden, es_base)
  select s.empresa_id, p_sede, b.clave, b.nombre, b.tipo, b.opciones, b.obligatoria, b.orden, true from app.columnas_base() b
  on conflict (sede_id, clave) do nothing;
end $$;

-- Personas entre las que se elige el responsable del levantamiento: las de la sede y los administradores generales de la empresa.
create function public.personas_de_sede(p_sede uuid) returns table (id uuid, nombre text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select p.id, p.apellidos_nombres from public.vinculos v
    join public.personas p on p.id = v.persona_id
    join public.sedes s on s.id = p_sede and s.empresa_id = v.empresa_id
    where v.estado = 'activo'
      and (v.rol = 'admin_empresa' or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and vs.sede_id = p_sede))
    order by p.apellidos_nombres;
end $$;

-- ───────────────────────── Guardar una condición ─────────────────────────
-- p_datos: un valor por clave de columna. Las fechas son 'AAAA-MM-DD'; la descripción es {peligro, riesgo}; la evidencia, la ruta de la foto ya subida.
-- Las columnas ocultas no se piden ni se tocan. Lo obligatorio es lo que diga la configuración de la sede.
create function public.guardar_condicion(p_id uuid, p_sede uuid, p_datos jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.sedes; c public.condiciones_columnas; ex public.condiciones; me public.personas;
  v jsonb; x text; nombre_p text;
  hoy date := (now() at time zone 'America/Lima')::date;
  d_hall date; d_prog date; d_cierre date; f date;
  nuevos jsonb := '{}'::jsonb;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or p_id is null or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos no válidos' using errcode = '22023'; end if;
  perform public.preparar_condiciones(p_sede);
  select * into ex from public.condiciones where id = p_id;
  if ex.id is not null and ex.sede_id <> p_sede then raise exception 'No autorizado' using errcode = '42501'; end if;

  for c in select * from public.condiciones_columnas where sede_id = p_sede order by orden loop
    if c.tipo in ('estado', 'responsable_auto') then continue; end if;
    if not c.visible then
      -- Columna oculta: se conserva lo que ya tenía.
      if c.clave = 'fecha_hallazgo' then d_hall := ex.fecha_hallazgo;
      elsif c.clave = 'fecha_programada' then d_prog := ex.fecha_programada;
      elsif c.clave = 'fecha_cierre' then d_cierre := ex.fecha_cierre;
      elsif ex.id is not null and ex.datos ? c.clave then
        nuevos := nuevos || jsonb_build_object(c.clave, ex.datos -> c.clave);
        if ex.datos ? (c.clave || '_nombre') then nuevos := nuevos || jsonb_build_object(c.clave || '_nombre', ex.datos -> (c.clave || '_nombre')); end if;
      end if;
      continue;
    end if;

    v := p_datos -> c.clave;
    if c.tipo = 'descripcion' then
      if jsonb_typeof(v) is distinct from 'object' or length(trim(coalesce(v ->> 'peligro', ''))) < 3 or length(trim(coalesce(v ->> 'riesgo', ''))) < 3 then
        raise exception 'En la descripción escribe el peligro observado y el riesgo asociado' using errcode = '22023';
      end if;
      if length(v ->> 'peligro') > 500 or length(v ->> 'riesgo') > 500 then raise exception 'La descripción es demasiado larga (máximo 500 letras en cada parte)' using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, jsonb_build_object('peligro', trim(v ->> 'peligro'), 'riesgo', trim(v ->> 'riesgo')));
      continue;
    end if;

    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb or (jsonb_typeof(v) = 'string' and length(trim(v #>> '{}')) = 0) then
      if c.obligatoria then raise exception 'Falta completar: %', c.nombre using errcode = '22023'; end if;
      continue;
    end if;

    if c.tipo = 'fecha' then
      x := v #>> '{}';
      if jsonb_typeof(v) <> 'string' or x !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end if;
      begin f := x::date; exception when others then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end;
      if f::text <> x then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end if;
      if c.clave = 'fecha_hallazgo' then d_hall := f;
      elsif c.clave = 'fecha_programada' then d_prog := f;
      elsif c.clave = 'fecha_cierre' then d_cierre := f;
      else nuevos := nuevos || jsonb_build_object(c.clave, x);
      end if;
    elsif c.tipo = 'numero' then
      if jsonb_typeof(v) <> 'number' then raise exception 'Escribe un número en «%»', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, v);
    elsif c.tipo = 'texto' then
      if jsonb_typeof(v) <> 'string' then raise exception 'Escribe un texto en «%»', c.nombre using errcode = '22023'; end if;
      if length(v #>> '{}') > 500 then raise exception '«%» es demasiado largo (máximo 500 letras)', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, trim(v #>> '{}'));
    elsif c.tipo = 'lista' then
      x := v #>> '{}';
      if jsonb_typeof(v) <> 'string' or (cardinality(c.opciones) > 0 and not (x = any (c.opciones))) then raise exception 'Elige una opción válida en «%»', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, x);
    elsif c.tipo = 'multiple' then
      if jsonb_typeof(v) <> 'array' or exists (
        select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string' or (cardinality(c.opciones) > 0 and not ((e #>> '{}') = any (c.opciones)))) then
        raise exception 'Elige opciones válidas en «%»', c.nombre using errcode = '22023';
      end if;
      nuevos := nuevos || jsonb_build_object(c.clave, v);
    elsif c.tipo = 'foto' then
      x := v #>> '{}';
      if jsonb_typeof(v) <> 'string' or x !~ ('^' || s.empresa_id::text || '/[0-9a-f-]{36}-[0-9a-f]{8}\.(jpg|webp|png)$') then raise exception 'La foto de «%» no es válida', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, x);
    elsif c.tipo = 'persona' then
      begin
        select pe.nombre into nombre_p from public.personas_de_sede(p_sede) pe where pe.id = (v #>> '{}')::uuid;
      exception when invalid_text_representation then nombre_p := null; end;
      if nombre_p is null then raise exception 'Elige una persona de la lista en «%»', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, v #>> '{}', c.clave || '_nombre', nombre_p);
    end if;
  end loop;

  d_hall := coalesce(d_hall, ex.fecha_hallazgo, hoy);
  if d_hall > hoy then raise exception 'La fecha de hallazgo no puede ser futura' using errcode = '22023'; end if;
  if d_prog is not null and d_prog < d_hall then raise exception 'La fecha programada no puede ser anterior a la fecha de hallazgo' using errcode = '22023'; end if;
  if d_cierre is not null and d_cierre < d_hall then raise exception 'La fecha de cierre no puede ser anterior a la fecha de hallazgo' using errcode = '22023'; end if;
  if d_cierre is not null and d_cierre > hoy then raise exception 'La fecha de cierre no puede ser futura' using errcode = '22023'; end if;

  if ex.id is null then
    select * into me from public.personas where id = (select auth.uid());
    insert into public.condiciones (id, empresa_id, sede_id, fecha_hallazgo, fecha_programada, fecha_cierre, datos, creado_por, creado_por_nombre)
    values (p_id, s.empresa_id, p_sede, d_hall, d_prog, d_cierre, nuevos, me.id, me.apellidos_nombres);
  else
    update public.condiciones set fecha_hallazgo = d_hall, fecha_programada = d_prog, fecha_cierre = d_cierre, datos = nuevos,
      actualizado_por = (select auth.uid()), actualizado_en = now()
    where id = p_id;
  end if;
  return p_id;
end $$;

-- ───────────────────────── Cambiar las columnas ─────────────────────────
create function app.revisar_opciones(p_tipo text, o jsonb) returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_tipo not in ('lista', 'multiple') then return; end if;
  if jsonb_typeof(o) is distinct from 'array' then raise exception 'Escribe de 1 a 30 opciones (cada una de hasta 60 letras)' using errcode = '22023'; end if;
  if jsonb_array_length(o) not between 1 and 30
     or exists (select 1 from jsonb_array_elements(o) e where jsonb_typeof(e) <> 'string' or length(trim(e #>> '{}')) not between 1 and 60) then
    raise exception 'Escribe de 1 a 30 opciones (cada una de hasta 60 letras)' using errcode = '22023';
  end if;
  if (select count(distinct lower(trim(e #>> '{}'))) from jsonb_array_elements(o) e) <> jsonb_array_length(o) then
    raise exception 'Hay opciones repetidas' using errcode = '22023';
  end if;
end $$;

create function app.revisar_cambio_columnas(p_sede uuid, d jsonb) returns void language plpgsql stable security definer set search_path = '' as $$
declare op text; c public.condiciones_columnas; t text; n text;
begin
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Datos del cambio no válidos' using errcode = '22023'; end if;
  op := d ->> 'operacion';
  if op = 'agregar' then
    n := trim(coalesce(d ->> 'nombre', '')); t := d ->> 'tipo';
    if length(n) not between 2 and 60 then raise exception 'El nombre de la columna debe tener de 2 a 60 letras' using errcode = '22023'; end if;
    if t is null or t not in ('texto', 'numero', 'fecha', 'lista', 'multiple') then raise exception 'Elige el tipo de columna' using errcode = '22023'; end if;
    if exists (select 1 from public.condiciones_columnas where sede_id = p_sede and lower(trim(nombre)) = lower(n)) then
      raise exception 'Ya existe una columna con ese nombre' using errcode = '22023';
    end if;
    perform app.revisar_opciones(t, d -> 'opciones');
    if d ? 'obligatoria' and jsonb_typeof(d -> 'obligatoria') <> 'boolean' then raise exception 'Datos del cambio no válidos' using errcode = '22023'; end if;
  elsif op in ('modificar', 'ocultar', 'mostrar', 'eliminar') then
    select * into c from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave';
    if c.id is null then raise exception 'La columna no existe' using errcode = '22023'; end if;
    if op = 'eliminar' and c.es_base then raise exception 'Las columnas base no se eliminan: puedes ocultarlas' using errcode = '22023'; end if;
    if op = 'modificar' then
      if d ? 'nombre' then
        n := trim(coalesce(d ->> 'nombre', ''));
        if length(n) not between 2 and 60 then raise exception 'El nombre de la columna debe tener de 2 a 60 letras' using errcode = '22023'; end if;
        if exists (select 1 from public.condiciones_columnas where sede_id = p_sede and clave <> c.clave and lower(trim(nombre)) = lower(n)) then
          raise exception 'Ya existe una columna con ese nombre' using errcode = '22023';
        end if;
      end if;
      t := coalesce(d ->> 'tipo', c.tipo);
      if t <> c.tipo then
        if c.es_base then
          if c.clave not in ('area', 'ubicacion', 'plan_accion', 'clasificacion', 'origen', 'motivo') or t not in ('texto', 'lista', 'multiple') then
            raise exception 'Esa columna no cambia de tipo' using errcode = '22023';
          end if;
        elsif t not in ('texto', 'numero', 'fecha', 'lista', 'multiple') then
          raise exception 'Tipo de columna no válido' using errcode = '22023';
        end if;
      end if;
      if t in ('lista', 'multiple') then perform app.revisar_opciones(t, coalesce(d -> 'opciones', to_jsonb(c.opciones))); end if;
      if d ? 'obligatoria' and jsonb_typeof(d -> 'obligatoria') <> 'boolean' then raise exception 'Datos del cambio no válidos' using errcode = '22023'; end if;
    end if;
  else
    raise exception 'Ese cambio de columnas no se puede hacer' using errcode = '22023';
  end if;
end $$;

create function app.aplicar_cambio_columnas(p_sede uuid, d jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare op text := d ->> 'operacion'; s public.sedes; c public.condiciones_columnas; t text; ops text[];
begin
  select * into s from public.sedes where id = p_sede;
  if op = 'agregar' then
    t := d ->> 'tipo';
    ops := case when t in ('lista', 'multiple') then array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e) else '{}'::text[] end;
    insert into public.condiciones_columnas (empresa_id, sede_id, clave, nombre, tipo, opciones, obligatoria, visible, orden, es_base)
    values (s.empresa_id, p_sede, 'c_' || substr(md5(gen_random_uuid()::text), 1, 8), trim(d ->> 'nombre'), t, ops,
            coalesce((d ->> 'obligatoria')::boolean, false), true,
            coalesce((select max(orden) from public.condiciones_columnas where sede_id = p_sede), 0) + 1, false);
  else
    select * into c from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave' for update;
    if op = 'ocultar' then update public.condiciones_columnas set visible = false where id = c.id;
    elsif op = 'mostrar' then update public.condiciones_columnas set visible = true where id = c.id;
    elsif op = 'eliminar' then
      delete from public.condiciones_columnas where id = c.id;
      update public.condiciones set datos = datos - c.clave - (c.clave || '_nombre') where sede_id = p_sede and (datos ? c.clave);
    elsif op = 'modificar' then
      t := coalesce(d ->> 'tipo', c.tipo);
      update public.condiciones_columnas set
        nombre = coalesce(nullif(trim(d ->> 'nombre'), ''), nombre),
        tipo = t,
        opciones = case when t in ('lista', 'multiple') then coalesce(array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e), c.opciones) else '{}'::text[] end,
        obligatoria = case when c.tipo in ('estado', 'responsable_auto') then false else coalesce((d ->> 'obligatoria')::boolean, obligatoria) end
      where id = c.id;
    end if;
  end if;
end $$;

-- Título legible de la propuesta (lo ve el administrador en «Solicitudes»).
create function app.titulo_cambio_columnas(p_sede uuid, d jsonb) returns text language sql stable security definer set search_path = '' as $$
  select case d ->> 'operacion'
    when 'agregar' then format('Agregar la columna «%s» a la matriz de condiciones', trim(d ->> 'nombre'))
    when 'modificar' then format('Cambiar la columna «%s» de la matriz de condiciones', coalesce((select nombre from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave'), '?'))
    when 'ocultar' then format('Ocultar la columna «%s» de la matriz de condiciones', coalesce((select nombre from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave'), '?'))
    when 'mostrar' then format('Mostrar la columna «%s» de la matriz de condiciones', coalesce((select nombre from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave'), '?'))
    when 'eliminar' then format('Eliminar la columna «%s» de la matriz de condiciones', coalesce((select nombre from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave'), '?'))
    else 'Cambiar las columnas de la matriz de condiciones' end;
$$;

-- El administrador cambia las columnas directo.
create function public.cambiar_columnas_condiciones(p_sede uuid, p_cambio jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.puedo_configurar_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform public.preparar_condiciones(p_sede);
  perform app.revisar_cambio_columnas(p_sede, p_cambio);
  perform app.aplicar_cambio_columnas(p_sede, p_cambio);
end $$;

-- ───────────────────────── El gestor propone, el administrador decide ─────────────────────────
alter table public.solicitudes_cambio drop constraint solicitudes_cambio_tipo_check;
alter table public.solicitudes_cambio add constraint solicitudes_cambio_tipo_check
  check (tipo = any (array['anular_inspeccion', 'corregir_inspeccion', 'cambio_programa', 'publicar_formato', 'retirar_formato', 'cambio_columnas_condiciones']));

do $$
declare v_def text;
begin
  -- Pedir: el objetivo es la sede.
  v_def := pg_get_functiondef('public.solicitar_cambio(text, uuid, jsonb, text)'::regprocedure);
  v_def := replace(v_def, $n$raise exception 'Tipo de solicitud no válido' using errcode = '22023';$n$,
    $r$if p_tipo = 'cambio_columnas_condiciones' then
      if not app.puedo_ver_condiciones(p_objetivo) then raise exception 'No autorizado' using errcode = '42501'; end if;
      perform app.revisar_cambio_columnas(p_objetivo, v_datos);
      v_sede := p_objetivo;
      v_titulo := app.titulo_cambio_columnas(p_objetivo, v_datos);
    else
      raise exception 'Tipo de solicitud no válido' using errcode = '22023';
    end if;$r$);
  if v_def not like '%cambio_columnas_condiciones%' then raise exception 'No se pudo actualizar solicitar_cambio'; end if;
  execute v_def;

  -- Resolver: aprobar ejecuta el cambio a nombre de quien aprueba; denegar no cambia nada.
  v_def := pg_get_functiondef('public.resolver_solicitud(uuid, boolean, text)'::regprocedure);
  v_def := replace(v_def, $n$perform public.cambiar_vigencia_plantilla(s.objetivo_id, false);$n$,
    $r$perform public.cambiar_vigencia_plantilla(s.objetivo_id, false);
  elsif s.tipo = 'cambio_columnas_condiciones' then
    perform app.revisar_cambio_columnas(s.objetivo_id, s.datos);
    perform app.aplicar_cambio_columnas(s.objetivo_id, s.datos);$r$);
  if v_def not like '%cambio_columnas_condiciones%' then raise exception 'No se pudo actualizar resolver_solicitud'; end if;
  execute v_def;
end $$;

-- ───────────────────────── Fotos: almacén privado «condiciones» ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('condiciones', 'condiciones', false, 1048576, array['image/jpeg', 'image/webp', 'image/png']);

create function app.puedo_subir_condicion(p_nombre text) returns boolean language sql stable security definer set search_path = '' as $$
  select p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[0-9a-f]{8}\.(jpg|webp|png)$'
    and app.rol_condiciones() is not null and split_part(p_nombre, '/', 1) = app.mi_empresa()::text;
$$;
-- Ve la foto quien puede ver esa condición; mientras se guarda, quien la subió.
create function app.puedo_ver_condicion_foto(p_nombre text, p_dueno uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.rol_condiciones() is not null and (
    (p_dueno = (select auth.uid()) and split_part(p_nombre, '/', 1) = app.mi_empresa()::text)
    or exists (select 1 from public.condiciones c where c.id::text = left(split_part(p_nombre, '/', 2), 36) and c.empresa_id::text = split_part(p_nombre, '/', 1) and app.puedo_sede(c.sede_id)));
$$;
create policy "Condiciones: subir foto" on storage.objects for insert to authenticated
with check (bucket_id = 'condiciones' and app.puedo_subir_condicion(name));
create policy "Condiciones: ver foto" on storage.objects for select to authenticated
using (bucket_id = 'condiciones' and app.puedo_ver_condicion_foto(name, owner));
-- Sin políticas de cambiar ni borrar: una foto subida no se reemplaza.

-- ───────────────────────── Permisos de las funciones ─────────────────────────
revoke all on function app.rol_condiciones(), app.puedo_ver_condiciones(uuid), app.puedo_configurar_condiciones(uuid), app.columnas_base(),
  app.revisar_opciones(text, jsonb), app.revisar_cambio_columnas(uuid, jsonb), app.aplicar_cambio_columnas(uuid, jsonb), app.titulo_cambio_columnas(uuid, jsonb),
  app.puedo_subir_condicion(text), app.puedo_ver_condicion_foto(text, uuid) from public, anon;
grant execute on function app.rol_condiciones(), app.puedo_ver_condiciones(uuid), app.puedo_configurar_condiciones(uuid),
  app.puedo_subir_condicion(text), app.puedo_ver_condicion_foto(text, uuid) to authenticated;
revoke all on function public.preparar_condiciones(uuid), public.personas_de_sede(uuid), public.guardar_condicion(uuid, uuid, jsonb), public.cambiar_columnas_condiciones(uuid, jsonb) from public, anon;
grant execute on function public.preparar_condiciones(uuid), public.personas_de_sede(uuid), public.guardar_condicion(uuid, uuid, jsonb), public.cambiar_columnas_condiciones(uuid, jsonb) to authenticated;

-- ───────────────────────── Limpieza de la prueba ─────────────────────────
-- Igual que limpiar_pruebas_facultades: solo el dueño de la plataforma, solo la empresa ficticia D (RUC 20000000052), solo lo creado en las últimas 3 horas.
-- Borra condiciones, propuestas de columnas y columnas agregadas por la prueba (las columnas base no se borran). No toca empresas, sedes, personas, vínculos, roles ni permisos.
create function public.limpiar_pruebas_condiciones(p_empresa uuid, p_desde timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a integer; b integer; c integer;
begin
  perform app.exigir_dueno();
  if not exists (select 1 from public.empresas where id = p_empresa and ruc = '20000000052' and es_prueba and razon_social ilike '%ficticia%') then
    raise exception 'Solo se limpia la empresa ficticia D de las pruebas' using errcode = '42501';
  end if;
  if p_desde is null or p_desde < now() - interval '3 hours' or p_desde > now() then
    raise exception 'La hora de inicio debe ser de las últimas 3 horas' using errcode = '22023';
  end if;
  delete from public.condiciones where empresa_id = p_empresa and creado_en >= p_desde;
  get diagnostics a = row_count;
  delete from public.solicitudes_cambio where empresa_id = p_empresa and tipo = 'cambio_columnas_condiciones' and solicitado_en >= p_desde;
  get diagnostics b = row_count;
  delete from public.condiciones_columnas where empresa_id = p_empresa and not es_base and creado_en >= p_desde;
  get diagnostics c = row_count;
  return jsonb_build_object('condiciones', a, 'solicitudes', b, 'columnas', c);
end $$;
revoke all on function public.limpiar_pruebas_condiciones(uuid, timestamptz) from anon, public;
grant execute on function public.limpiar_pruebas_condiciones(uuid, timestamptz) to authenticated;
