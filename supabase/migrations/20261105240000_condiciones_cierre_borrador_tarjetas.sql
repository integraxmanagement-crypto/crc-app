-- Gestión de condiciones, segunda parte (pedido del dueño, 05/11/2026):
--  1. El cierre ya no se pide al cargar: se «valida» después (validar_cierre_condicion) con la fecha de cierre.
--  2. Borradores: una condición incompleta se guarda como borrador (p_borrador = true) y cuenta en una tarjeta de atención; al completarla deja de serlo.
--  3. Tarjetas del encabezado (condiciones_tarjetas): dos fijas (borradores y sin plazo) y las que cree el administrador sobre cualquier columna.
--  4. Área con autocompletado: la columna «Área» pasa a tipo «area» y se enlaza con la estructura de la empresa (unidades) sin cambiar esa tabla.
--  5. Responsables: el de la inspección pasa a ser una persona elegible (por defecto, quien carga) y el del levantamiento puede ser cualquier persona de la empresa.
-- No toca roles ni permisos ni la tabla unidades (solo la lee).

alter table public.condiciones add column borrador boolean not null default false;
create index on public.condiciones (sede_id) where borrador;

alter table public.condiciones_columnas drop constraint condiciones_columnas_tipo_check;
alter table public.condiciones_columnas add constraint condiciones_columnas_tipo_check
  check (tipo in ('texto', 'numero', 'fecha', 'lista', 'multiple', 'foto', 'descripcion', 'estado', 'responsable_auto', 'persona', 'area'));
update public.condiciones_columnas set tipo = 'area' where clave = 'area' and es_base and tipo = 'texto';
update public.condiciones_columnas set tipo = 'persona' where clave = 'resp_inspeccion' and es_base and tipo = 'responsable_auto';

create or replace function app.columnas_base() returns table (clave text, nombre text, tipo text, opciones text[], obligatoria boolean, orden integer)
language sql immutable set search_path = '' as $$
  values
    ('area', 'Área', 'area', '{}'::text[], true, 1),
    ('ubicacion', 'Ubicación específica', 'texto', '{}'::text[], true, 2),
    ('fecha_hallazgo', 'Fecha de hallazgo', 'fecha', '{}'::text[], true, 3),
    ('clasificacion', 'Clasificación (nivel de riesgo)', 'lista', array['Tipo A', 'Tipo B'], true, 4),
    ('descripcion', 'Descripción (peligro y riesgo)', 'descripcion', '{}'::text[], true, 5),
    ('evidencia', 'Evidencia', 'foto', '{}'::text[], true, 6),
    ('plan_accion', 'Plan de acción', 'texto', '{}'::text[], true, 7),
    ('fecha_programada', 'Fecha programada', 'fecha', '{}'::text[], true, 8),
    ('fecha_cierre', 'Fecha de levantamiento o cierre', 'fecha', '{}'::text[], false, 9),
    ('estado', 'Estado', 'estado', '{}'::text[], false, 10),
    ('resp_inspeccion', 'Responsable de la inspección', 'persona', '{}'::text[], false, 11),
    ('resp_levantamiento', 'Responsable del levantamiento', 'persona', '{}'::text[], true, 12),
    ('origen', 'Origen', 'lista', array['Inspección de seguridad', 'Observación de campo', 'Auditoría', 'Reporte de un trabajador', 'Incidente'], true, 13),
    ('motivo', 'Motivo', 'lista', array['Acto subestándar', 'Condición subestándar', 'Falta de mantenimiento', 'Incumplimiento legal', 'Mejora'], true, 14);
$$;

-- Cualquier persona de la empresa (activa) puede ser responsable.
create or replace function public.personas_de_sede(p_sede uuid) returns table (id uuid, nombre text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select p.id, p.apellidos_nombres from public.vinculos v
    join public.personas p on p.id = v.persona_id
    join public.sedes s on s.id = p_sede and s.empresa_id = v.empresa_id
    where v.estado = 'activo'
    order by p.apellidos_nombres;
end $$;

-- ───────────────────────── Tarjetas ─────────────────────────
create table public.condiciones_tarjetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  sede_id uuid not null references public.sedes (id),
  titulo text not null check (length(trim(titulo)) between 2 and 80),
  columna text not null check (columna ~ '^[a-z][a-z0-9_]{1,40}$'),
  operador text not null check (operador in ('borrador', 'vacia', 'igual', 'distinto')),
  valor text check (valor is null or length(valor) <= 120),
  fija boolean not null default false,
  orden integer not null,
  creado_en timestamptz not null default now()
);
create index on public.condiciones_tarjetas (sede_id);
comment on table public.condiciones_tarjetas is 'Tarjetas con conteo del encabezado de la matriz de condiciones. Las dos fijas (borradores y sin plazo) las crea el sistema; el administrador agrega más sobre cualquier columna.';
alter table public.condiciones_tarjetas enable row level security;
create policy "Tarjetas de condiciones: ver" on public.condiciones_tarjetas for select to authenticated using (app.puedo_ver_condiciones(sede_id));
revoke all on public.condiciones_tarjetas from anon;
revoke insert, update, delete, truncate on public.condiciones_tarjetas from authenticated;

create or replace function public.preparar_condiciones(p_sede uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.sedes;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  insert into public.condiciones_columnas (empresa_id, sede_id, clave, nombre, tipo, opciones, obligatoria, orden, es_base)
  select s.empresa_id, p_sede, b.clave, b.nombre, b.tipo, b.opciones, b.obligatoria, b.orden, true from app.columnas_base() b
  on conflict (sede_id, clave) do nothing;
  if not exists (select 1 from public.condiciones_tarjetas where sede_id = p_sede and fija) then
    insert into public.condiciones_tarjetas (empresa_id, sede_id, titulo, columna, operador, fija, orden) values
      (s.empresa_id, p_sede, 'Borradores que requieren atención', 'borrador', 'borrador', true, 1),
      (s.empresa_id, p_sede, 'Sin plazo definido', 'fecha_programada', 'vacia', true, 2);
  end if;
end $$;

create function public.guardar_tarjeta_condicion(p_sede uuid, p_id uuid, p_titulo text, p_columna text, p_operador text, p_valor text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.sedes; t public.condiciones_tarjetas; v_id uuid;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or not app.puedo_configurar_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform public.preparar_condiciones(p_sede);
  if length(trim(coalesce(p_titulo, ''))) not between 2 and 80 then raise exception 'Escribe el título de la tarjeta (de 2 a 80 letras)' using errcode = '22023'; end if;
  if p_operador not in ('vacia', 'igual', 'distinto') then raise exception 'Elige qué cuenta la tarjeta' using errcode = '22023'; end if;
  if not exists (select 1 from public.condiciones_columnas where sede_id = p_sede and clave = p_columna) then raise exception 'Elige una columna de la matriz' using errcode = '22023'; end if;
  if p_operador in ('igual', 'distinto') and length(trim(coalesce(p_valor, ''))) = 0 then raise exception 'Escribe el valor que debe tener la columna' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.condiciones_tarjetas (empresa_id, sede_id, titulo, columna, operador, valor, orden)
    values (s.empresa_id, p_sede, trim(p_titulo), p_columna, p_operador, case when p_operador = 'vacia' then null else trim(p_valor) end,
            coalesce((select max(orden) from public.condiciones_tarjetas where sede_id = p_sede), 0) + 1)
    returning id into v_id;
  else
    select * into t from public.condiciones_tarjetas where id = p_id and sede_id = p_sede;
    if t.id is null or t.fija then raise exception 'Esa tarjeta no se puede cambiar' using errcode = '22023'; end if;
    update public.condiciones_tarjetas set titulo = trim(p_titulo), columna = p_columna, operador = p_operador, valor = case when p_operador = 'vacia' then null else trim(p_valor) end
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.quitar_tarjeta_condicion(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare t public.condiciones_tarjetas;
begin
  select * into t from public.condiciones_tarjetas where id = p_id;
  if t.id is null or not app.puedo_configurar_condiciones(t.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if t.fija then raise exception 'Las tarjetas fijas no se quitan' using errcode = '22023'; end if;
  delete from public.condiciones_tarjetas where id = p_id;
end $$;

-- ───────────────────────── Guardar (con borrador) ─────────────────────────
drop function public.guardar_condicion(uuid, uuid, jsonb);
create function public.guardar_condicion(p_id uuid, p_sede uuid, p_datos jsonb, p_borrador boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.sedes; c public.condiciones_columnas; ex public.condiciones; me public.personas; u public.unidades;
  v jsonb; x text; nombre_p text; falta text[] := '{}';
  hoy date := (now() at time zone 'America/Lima')::date;
  d_hall date; d_prog date; f date;
  nuevos jsonb := '{}'::jsonb;
  vacio boolean;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or p_id is null or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos no válidos' using errcode = '22023'; end if;
  perform public.preparar_condiciones(p_sede);
  select * into ex from public.condiciones where id = p_id;
  if ex.id is not null and ex.sede_id <> p_sede then raise exception 'No autorizado' using errcode = '42501'; end if;

  for c in select * from public.condiciones_columnas where sede_id = p_sede order by orden loop
    -- El estado se calcula solo y el cierre se valida aparte: no se piden al cargar.
    if c.tipo in ('estado', 'responsable_auto') or c.clave = 'fecha_cierre' then continue; end if;
    if not c.visible then
      if c.clave = 'fecha_hallazgo' then d_hall := ex.fecha_hallazgo;
      elsif c.clave = 'fecha_programada' then d_prog := ex.fecha_programada;
      elsif ex.id is not null and ex.datos ? c.clave then
        nuevos := nuevos || jsonb_build_object(c.clave, ex.datos -> c.clave);
        if ex.datos ? (c.clave || '_nombre') then nuevos := nuevos || jsonb_build_object(c.clave || '_nombre', ex.datos -> (c.clave || '_nombre')); end if;
        if ex.datos ? (c.clave || '_id') then nuevos := nuevos || jsonb_build_object(c.clave || '_id', ex.datos -> (c.clave || '_id')); end if;
      end if;
      continue;
    end if;

    v := p_datos -> c.clave;

    if c.tipo = 'descripcion' then
      if jsonb_typeof(v) is distinct from 'object' or length(trim(coalesce(v ->> 'peligro', ''))) < 3 or length(trim(coalesce(v ->> 'riesgo', ''))) < 3 then
        falta := falta || 'Descripción: peligro observado y riesgo asociado';
        if jsonb_typeof(v) = 'object' then
          nuevos := nuevos || jsonb_build_object(c.clave, jsonb_build_object('peligro', trim(coalesce(v ->> 'peligro', '')), 'riesgo', trim(coalesce(v ->> 'riesgo', ''))));
        end if;
        continue;
      end if;
      if length(v ->> 'peligro') > 500 or length(v ->> 'riesgo') > 500 then raise exception 'La descripción es demasiado larga (máximo 500 letras en cada parte)' using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, jsonb_build_object('peligro', trim(v ->> 'peligro'), 'riesgo', trim(v ->> 'riesgo')));
      continue;
    end if;

    vacio := v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb or (jsonb_typeof(v) = 'string' and length(trim(v #>> '{}')) = 0);
    -- Quien carga es el responsable de la inspección si no se eligió a otra persona.
    if vacio and c.clave = 'resp_inspeccion' and ex.id is null
       and exists (select 1 from public.personas_de_sede(p_sede) pe where pe.id = (select auth.uid())) then
      v := to_jsonb((select auth.uid())::text); vacio := false;
    end if;
    if vacio then
      if c.obligatoria then falta := falta || c.nombre; end if;
      continue;
    end if;

    if c.tipo = 'fecha' then
      x := v #>> '{}';
      if jsonb_typeof(v) <> 'string' or x !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end if;
      begin f := x::date; exception when others then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end;
      if f::text <> x then raise exception 'Fecha no válida en «%»', c.nombre using errcode = '22023'; end if;
      if c.clave = 'fecha_hallazgo' then d_hall := f;
      elsif c.clave = 'fecha_programada' then d_prog := f;
      else nuevos := nuevos || jsonb_build_object(c.clave, x);
      end if;
    elsif c.tipo = 'numero' then
      if jsonb_typeof(v) <> 'number' then raise exception 'Escribe un número en «%»', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, v);
    elsif c.tipo = 'texto' then
      if jsonb_typeof(v) <> 'string' then raise exception 'Escribe un texto en «%»', c.nombre using errcode = '22023'; end if;
      if length(v #>> '{}') > 500 then raise exception '«%» es demasiado largo (máximo 500 letras)', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, trim(v #>> '{}'));
    elsif c.tipo = 'area' then
      -- Texto del área; si trae su identificador debe ser una unidad vigente de la empresa (y se usa su nombre). Sin identificador, se busca por nombre.
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 200 then raise exception 'Elige un área válida en «%»', c.nombre using errcode = '22023'; end if;
      x := trim(v #>> '{}');
      u := null;
      begin
        if p_datos ->> (c.clave || '_id') is not null then
          select * into u from public.unidades where id = (p_datos ->> (c.clave || '_id'))::uuid and empresa_id = s.empresa_id and vigente;
          if u.id is null then raise exception 'Elige un área de la lista en «%»', c.nombre using errcode = '22023'; end if;
        end if;
      exception when invalid_text_representation then raise exception 'Elige un área de la lista en «%»', c.nombre using errcode = '22023'; end;
      if u.id is null then
        select * into u from public.unidades where empresa_id = s.empresa_id and vigente and nivel in ('area', 'subarea') and lower(nombre) = lower(x)
          and (select count(*) from public.unidades z where z.empresa_id = s.empresa_id and z.vigente and z.nivel in ('area', 'subarea') and lower(z.nombre) = lower(x)) = 1;
      end if;
      nuevos := nuevos || jsonb_build_object(c.clave, coalesce(u.nombre, x));
      if u.id is not null then nuevos := nuevos || jsonb_build_object(c.clave || '_id', u.id::text); end if;
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
      -- Las fotos que vienen de una inspección (IPF) se guardan con el prefijo «evidencias:» y solo se aceptan si ya estaban en esta condición.
      if jsonb_typeof(v) = 'string' and x like 'evidencias:%' and ex.id is not null and ex.datos ->> c.clave = x then
        nuevos := nuevos || jsonb_build_object(c.clave, x);
      elsif jsonb_typeof(v) <> 'string' or x !~ ('^' || s.empresa_id::text || '/[0-9a-f-]{36}-[0-9a-f]{8}\.(jpg|webp|png)$') then
        raise exception 'La foto de «%» no es válida', c.nombre using errcode = '22023';
      else
        nuevos := nuevos || jsonb_build_object(c.clave, x);
      end if;
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

  if cardinality(falta) > 0 and not p_borrador then
    raise exception 'Falta completar: %', array_to_string(falta, ', ') using errcode = '22023';
  end if;

  if ex.id is null then
    select * into me from public.personas where id = (select auth.uid());
    insert into public.condiciones (id, empresa_id, sede_id, fecha_hallazgo, fecha_programada, datos, creado_por, creado_por_nombre, borrador)
    values (p_id, s.empresa_id, p_sede, d_hall, d_prog, nuevos, me.id, me.apellidos_nombres, cardinality(falta) > 0);
  else
    update public.condiciones set fecha_hallazgo = d_hall, fecha_programada = d_prog, datos = nuevos, borrador = cardinality(falta) > 0,
      actualizado_por = (select auth.uid()), actualizado_en = now()
    where id = p_id;
  end if;
  return p_id;
end $$;

-- ───────────────────────── Validar el cierre ─────────────────────────
create function public.validar_cierre_condicion(p_id uuid, p_fecha date) returns void language plpgsql security definer set search_path = '' as $$
declare c public.condiciones; hoy date := (now() at time zone 'America/Lima')::date;
begin
  select * into c from public.condiciones where id = p_id for update;
  if c.id is null or not app.puedo_ver_condiciones(c.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if c.borrador then raise exception 'Completa primero los datos de la condición: sigue como borrador' using errcode = '22023'; end if;
  if p_fecha is null then raise exception 'Elige la fecha de cierre' using errcode = '22023'; end if;
  if p_fecha < c.fecha_hallazgo then raise exception 'La fecha de cierre no puede ser anterior a la fecha de hallazgo' using errcode = '22023'; end if;
  if p_fecha > hoy then raise exception 'La fecha de cierre no puede ser futura' using errcode = '22023'; end if;
  update public.condiciones set fecha_cierre = p_fecha, actualizado_por = (select auth.uid()), actualizado_en = now() where id = p_id;
end $$;

-- La limpieza de la prueba también borra las tarjetas que haya creado.
create or replace function public.limpiar_pruebas_condiciones(p_empresa uuid, p_desde timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a integer; b integer; c integer; d integer;
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
  delete from public.condiciones_tarjetas where empresa_id = p_empresa and not fija and creado_en >= p_desde;
  get diagnostics d = row_count;
  return jsonb_build_object('condiciones', a, 'solicitudes', b, 'columnas', c, 'tarjetas', d);
end $$;

-- ───────────────────────── Permisos de las funciones ─────────────────────────
revoke all on function public.guardar_condicion(uuid, uuid, jsonb, boolean), public.validar_cierre_condicion(uuid, date),
  public.guardar_tarjeta_condicion(uuid, uuid, text, text, text, text), public.quitar_tarjeta_condicion(uuid) from public, anon;
grant execute on function public.guardar_condicion(uuid, uuid, jsonb, boolean), public.validar_cierre_condicion(uuid, date),
  public.guardar_tarjeta_condicion(uuid, uuid, text, text, text, text), public.quitar_tarjeta_condicion(uuid) to authenticated;
