-- Gestión de Planes de Acción (pedido del dueño, 06/11/2026): una segunda matriz por sede, igual de configurable que la de condiciones
-- (columnas, obligatorias, borradores, tarjetas, trabajo sin señal, propuestas del gestor), que recibe los planes de acción de todas las
-- inspecciones. Se reutilizan las mismas tablas con una columna «matriz» ('condiciones' o 'planes').
--  · Columnas base de planes: Área · Descripción del hallazgo · Responsable del ACR · Fecha del hallazgo · Acción correctiva ·
--    Responsable del levantamiento · Plazo inicial propuesto · Fecha de levantamiento · Estado (se calcula).
--  · Cada formato de inspección decide a dónde van sus hallazgos: condiciones o planes de acción (plantillas.destino_hallazgos).
--    Sin elegir: el IPF va a condiciones y todos los demás a planes de acción.
--  · Los hallazgos de «Hallazgos» y la matriz de planes están SINCRONIZADOS: cada hallazgo es una fila; cerrar o reabrir en un lado lo hace en el otro;
--    la acción, el responsable y el plazo se cambian en cualquiera de los dos. Los hallazgos que ya existían se traen a la matriz.
-- No toca roles ni permisos ni unidades.

-- ───────────────────────── Esquema ─────────────────────────
alter table public.condiciones_columnas add column matriz text not null default 'condiciones' check (matriz in ('condiciones', 'planes'));
alter table public.condiciones add column matriz text not null default 'condiciones' check (matriz in ('condiciones', 'planes'));
alter table public.condiciones add column hallazgo_id uuid unique references public.hallazgos (id) on delete set null;
alter table public.condiciones_tarjetas add column matriz text not null default 'condiciones' check (matriz in ('condiciones', 'planes'));
alter table public.condiciones_columnas drop constraint condiciones_columnas_sede_id_clave_key;
alter table public.condiciones_columnas add constraint condiciones_columnas_sede_matriz_clave_key unique (sede_id, matriz, clave);
create index on public.condiciones (sede_id, matriz);
alter table public.plantillas add column destino_hallazgos text check (destino_hallazgos is null or destino_hallazgos in ('condiciones', 'planes'));
comment on column public.plantillas.destino_hallazgos is 'A dónde van los hallazgos de este formato: matriz de condiciones o de planes de acción. Vacío = por defecto (IPF a condiciones, el resto a planes).';

-- A dónde van los hallazgos de una inspección: lo elegido para su formato o, si no, el IPF a condiciones y el resto a planes de acción.
create function app.destino_hallazgos(p_plantilla uuid, p_version uuid) returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select destino_hallazgos from public.plantillas where id = p_plantilla),
    case when exists (
      select 1 from public.plantillas_versiones v, jsonb_array_elements(coalesce(v.receta -> 'secciones', '[]'::jsonb)) s
      where v.id = p_version and s ->> 'clave' = 'condiciones' and (s -> 'puntos' -> 0 ->> 'clave') like 'IPF-C%') then 'condiciones' else 'planes' end);
$$;

-- ───────────────────────── Columnas y tarjetas base por matriz ─────────────────────────
drop function app.columnas_base();
create function app.columnas_base(p_matriz text default 'condiciones') returns table (clave text, nombre text, tipo text, opciones text[], obligatoria boolean, orden integer)
language sql immutable set search_path = '' as $$
  select * from (values
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
    ('motivo', 'Motivo', 'lista', array['Acto subestándar', 'Condición subestándar', 'Falta de mantenimiento', 'Incumplimiento legal', 'Mejora'], true, 14)
  ) c (clave, nombre, tipo, opciones, obligatoria, orden) where p_matriz = 'condiciones'
  union all
  select * from (values
    ('area', 'Área', 'area', '{}'::text[], true, 1),
    ('descripcion_hallazgo', 'Descripción del hallazgo', 'texto', '{}'::text[], true, 2),
    ('resp_acr', 'Responsable del ACR', 'persona', '{}'::text[], true, 3),
    ('fecha_hallazgo', 'Fecha del hallazgo', 'fecha', '{}'::text[], true, 4),
    ('accion_correctiva', 'Acción correctiva', 'texto', '{}'::text[], true, 5),
    ('resp_levantamiento', 'Responsable del levantamiento', 'persona', '{}'::text[], true, 6),
    ('fecha_programada', 'Plazo inicial propuesto', 'fecha', '{}'::text[], true, 7),
    ('fecha_cierre', 'Fecha de levantamiento', 'fecha', '{}'::text[], false, 8),
    ('estado', 'Estado', 'estado', '{}'::text[], false, 9)
  ) p (clave, nombre, tipo, opciones, obligatoria, orden) where p_matriz = 'planes';
$$;

drop function app.sembrar_condiciones(uuid);
create function app.sembrar_condiciones(p_sede uuid, p_matriz text default 'condiciones') returns void language plpgsql security definer set search_path = '' as $$
declare s public.sedes;
begin
  select * into s from public.sedes where public.sedes.id = p_sede;
  if s.id is null then return; end if;
  insert into public.condiciones_columnas (empresa_id, sede_id, matriz, clave, nombre, tipo, opciones, obligatoria, orden, es_base)
  select s.empresa_id, p_sede, p_matriz, b.clave, b.nombre, b.tipo, b.opciones, b.obligatoria, b.orden, true from app.columnas_base(p_matriz) b
  on conflict (sede_id, matriz, clave) do nothing;
  if not exists (select 1 from public.condiciones_tarjetas where sede_id = p_sede and matriz = p_matriz and fija) then
    insert into public.condiciones_tarjetas (empresa_id, sede_id, matriz, titulo, columna, operador, fija, orden) values
      (s.empresa_id, p_sede, p_matriz, 'Borradores que requieren atención', 'borrador', 'borrador', true, 1),
      (s.empresa_id, p_sede, p_matriz, 'Sin plazo definido', 'fecha_programada', 'vacia', true, 2);
  end if;
end $$;

drop function public.preparar_condiciones(uuid);
create function public.preparar_condiciones(p_sede uuid, p_matriz text default 'condiciones') returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_matriz not in ('condiciones', 'planes') then raise exception 'Matriz no válida' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes where public.sedes.id = p_sede) or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform app.sembrar_condiciones(p_sede, p_matriz);
end $$;

drop function app.faltan_condicion(uuid, date, jsonb);
create function app.faltan_condicion(p_sede uuid, p_programada date, p_datos jsonb, p_matriz text default 'condiciones') returns text[] language plpgsql stable security definer set search_path = '' as $$
declare c public.condiciones_columnas; falta text[] := '{}'; v jsonb;
begin
  for c in select * from public.condiciones_columnas
           where sede_id = p_sede and matriz = p_matriz and visible and (obligatoria or tipo = 'descripcion') and tipo not in ('estado', 'responsable_auto') and clave not in ('fecha_cierre', 'fecha_hallazgo') order by orden loop
    if c.clave = 'fecha_programada' then
      if p_programada is null then falta := array_append(falta, c.nombre); end if;
      continue;
    end if;
    v := p_datos -> c.clave;
    if c.tipo = 'descripcion' then
      if jsonb_typeof(v) is distinct from 'object' or length(trim(coalesce(v ->> 'peligro', ''))) < 3 or length(trim(coalesce(v ->> 'riesgo', ''))) < 3 then falta := array_append(falta, c.nombre); end if;
    elsif v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb or (jsonb_typeof(v) = 'string' and length(trim(v #>> '{}')) = 0) then
      falta := array_append(falta, c.nombre);
    end if;
  end loop;
  return falta;
end $$;

-- ───────────────────────── Guardar (con borrador) ─────────────────────────
drop function public.guardar_condicion(uuid, uuid, jsonb, boolean);
create function public.guardar_condicion(p_id uuid, p_sede uuid, p_datos jsonb, p_borrador boolean default false, p_matriz text default 'condiciones') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.sedes; c public.condiciones_columnas; ex public.condiciones; me public.personas; u public.unidades;
  v jsonb; x text; nombre_p text; falta text[] := '{}';
  hoy date := (now() at time zone 'America/Lima')::date;
  d_hall date; d_prog date; f date;
  nuevos jsonb := '{}'::jsonb;
  vacio boolean;
begin
  if p_matriz not in ('condiciones', 'planes') then raise exception 'Matriz no válida' using errcode = '22023'; end if;
  select * into s from public.sedes where public.sedes.id = p_sede;
  if s.id is null or p_id is null or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos no válidos' using errcode = '22023'; end if;
  perform public.preparar_condiciones(p_sede, p_matriz);
  select * into ex from public.condiciones where public.condiciones.id = p_id;
  if ex.id is not null and (ex.sede_id <> p_sede or ex.matriz <> p_matriz) then raise exception 'No autorizado' using errcode = '42501'; end if;

  for c in select * from public.condiciones_columnas where sede_id = p_sede and matriz = p_matriz order by orden loop
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
        falta := array_append(falta, 'Descripción: peligro observado y riesgo asociado');
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
    -- Quien carga es el responsable de la inspección (o del ACR) si no se eligió a otra persona.
    if vacio and c.clave in ('resp_inspeccion', 'resp_acr') and ex.id is null
       and exists (select 1 from public.personas_de_sede(p_sede) pe where pe.id = (select auth.uid())) then
      v := to_jsonb((select auth.uid())::text); vacio := false;
    end if;
    if vacio then
      if c.obligatoria then falta := array_append(falta, c.nombre); end if;
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
      if length(v #>> '{}') > 1000 then raise exception '«%» es demasiado largo (máximo 1000 letras)', c.nombre using errcode = '22023'; end if;
      nuevos := nuevos || jsonb_build_object(c.clave, trim(v #>> '{}'));
    elsif c.tipo = 'area' then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 200 then raise exception 'Elige un área válida en «%»', c.nombre using errcode = '22023'; end if;
      x := trim(v #>> '{}');
      u := null;
      begin
        if p_datos ->> (c.clave || '_id') is not null then
          select * into u from public.unidades where public.unidades.id = (p_datos ->> (c.clave || '_id'))::uuid and empresa_id = s.empresa_id and vigente;
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
    select * into me from public.personas where public.personas.id = (select auth.uid());
    insert into public.condiciones (id, empresa_id, sede_id, matriz, fecha_hallazgo, fecha_programada, datos, creado_por, creado_por_nombre, borrador)
    values (p_id, s.empresa_id, p_sede, p_matriz, d_hall, d_prog, nuevos, me.id, me.apellidos_nombres, cardinality(falta) > 0);
  else
    update public.condiciones set fecha_hallazgo = d_hall, fecha_programada = d_prog, datos = nuevos, borrador = cardinality(falta) > 0,
      actualizado_por = (select auth.uid()), actualizado_en = now()
    where public.condiciones.id = p_id;
    -- Un plan ligado a un hallazgo: la acción, el responsable y el plazo se pasan al hallazgo (siguen sincronizados).
    if ex.hallazgo_id is not null and p_matriz = 'planes' then
      update public.hallazgos set accion = left(nullif(nuevos ->> 'accion_correctiva', ''), 1000), responsable_id = nullif(nuevos ->> 'resp_levantamiento', '')::uuid, plazo = d_prog
      where public.hallazgos.id = ex.hallazgo_id and estado in ('abierto', 'en_proceso');
    end if;
  end if;
  return p_id;
end $$;

-- ───────────────────────── Validar el cierre ─────────────────────────
-- Cerrar un plan ligado a un hallazgo cierra también el hallazgo (queda anotado que se cerró desde la matriz).
create function app.cerrar_hallazgo_desde_matriz(p_hallazgo uuid, p_por uuid) returns void language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos;
begin
  select * into h from public.hallazgos where public.hallazgos.id = p_hallazgo for update;
  if h.id is null or h.estado not in ('abierto', 'en_proceso') then return; end if;
  update public.hallazgos set estado = 'cerrado', cerrado_en = now(), cerrado_por = p_por, cierre_comentario = 'Cerrado desde la gestión de planes de acción'
  where public.hallazgos.id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, hecho_por)
  values (h.id, h.empresa_id, 'cerrado', 'Cerrado desde la gestión de planes de acción', p_por);
end $$;

create or replace function public.validar_cierre_condicion(p_id uuid, p_fecha date) returns void language plpgsql security definer set search_path = '' as $$
declare c public.condiciones; hoy date := (now() at time zone 'America/Lima')::date;
begin
  select * into c from public.condiciones where public.condiciones.id = p_id for update;
  if c.id is null or not app.puedo_ver_condiciones(c.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if c.borrador then raise exception 'Completa primero los datos: sigue como borrador' using errcode = '22023'; end if;
  if p_fecha is null then raise exception 'Elige la fecha de cierre' using errcode = '22023'; end if;
  if p_fecha < c.fecha_hallazgo then raise exception 'La fecha de cierre no puede ser anterior a la fecha de hallazgo' using errcode = '22023'; end if;
  if p_fecha > hoy then raise exception 'La fecha de cierre no puede ser futura' using errcode = '22023'; end if;
  if c.hallazgo_id is not null then perform app.cerrar_hallazgo_desde_matriz(c.hallazgo_id, (select auth.uid())); end if;
  update public.condiciones set fecha_cierre = p_fecha, actualizado_por = (select auth.uid()), actualizado_en = now() where public.condiciones.id = p_id;
end $$;

-- ───────────────────────── Cambiar las columnas (por matriz) ─────────────────────────
create or replace function app.revisar_cambio_columnas(p_sede uuid, d jsonb) returns void language plpgsql stable security definer set search_path = '' as $$
declare op text; c public.condiciones_columnas; t text; n text; m text;
begin
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Datos del cambio no válidos' using errcode = '22023'; end if;
  op := d ->> 'operacion';
  m := coalesce(d ->> 'matriz', 'condiciones');
  if m not in ('condiciones', 'planes') then raise exception 'Matriz no válida' using errcode = '22023'; end if;
  if op = 'agregar' then
    n := trim(coalesce(d ->> 'nombre', '')); t := d ->> 'tipo';
    if length(n) not between 2 and 60 then raise exception 'El nombre de la columna debe tener de 2 a 60 letras' using errcode = '22023'; end if;
    if t is null or t not in ('texto', 'numero', 'fecha', 'lista', 'multiple') then raise exception 'Elige el tipo de columna' using errcode = '22023'; end if;
    if exists (select 1 from public.condiciones_columnas where sede_id = p_sede and matriz = m and lower(trim(nombre)) = lower(n)) then
      raise exception 'Ya existe una columna con ese nombre' using errcode = '22023';
    end if;
    perform app.revisar_opciones(t, d -> 'opciones');
    if d ? 'obligatoria' and jsonb_typeof(d -> 'obligatoria') <> 'boolean' then raise exception 'Datos del cambio no válidos' using errcode = '22023'; end if;
  elsif op in ('modificar', 'ocultar', 'mostrar', 'eliminar') then
    select * into c from public.condiciones_columnas where sede_id = p_sede and matriz = m and clave = d ->> 'clave';
    if c.id is null then raise exception 'La columna no existe' using errcode = '22023'; end if;
    if op = 'eliminar' and c.es_base then raise exception 'Las columnas base no se eliminan: puedes ocultarlas' using errcode = '22023'; end if;
    if op = 'modificar' then
      if d ? 'nombre' then
        n := trim(coalesce(d ->> 'nombre', ''));
        if length(n) not between 2 and 60 then raise exception 'El nombre de la columna debe tener de 2 a 60 letras' using errcode = '22023'; end if;
        if exists (select 1 from public.condiciones_columnas where sede_id = p_sede and matriz = m and clave <> c.clave and lower(trim(nombre)) = lower(n)) then
          raise exception 'Ya existe una columna con ese nombre' using errcode = '22023';
        end if;
      end if;
      t := coalesce(d ->> 'tipo', c.tipo);
      if t <> c.tipo then
        if c.es_base then
          if c.clave not in ('ubicacion', 'plan_accion', 'clasificacion', 'origen', 'motivo', 'descripcion_hallazgo', 'accion_correctiva') or t not in ('texto', 'lista', 'multiple') then
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

create or replace function app.aplicar_cambio_columnas(p_sede uuid, d jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare op text := d ->> 'operacion'; m text := coalesce(d ->> 'matriz', 'condiciones'); s public.sedes; c public.condiciones_columnas; t text; ops text[];
begin
  select * into s from public.sedes where public.sedes.id = p_sede;
  if op = 'agregar' then
    t := d ->> 'tipo';
    ops := case when t in ('lista', 'multiple') then array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e) else '{}'::text[] end;
    insert into public.condiciones_columnas (empresa_id, sede_id, matriz, clave, nombre, tipo, opciones, obligatoria, visible, orden, es_base)
    values (s.empresa_id, p_sede, m, 'c_' || substr(md5(gen_random_uuid()::text), 1, 8), trim(d ->> 'nombre'), t, ops,
            coalesce((d ->> 'obligatoria')::boolean, false), true,
            coalesce((select max(orden) from public.condiciones_columnas where sede_id = p_sede and matriz = m), 0) + 1, false);
  else
    select * into c from public.condiciones_columnas where sede_id = p_sede and matriz = m and clave = d ->> 'clave' for update;
    if op = 'ocultar' then update public.condiciones_columnas set visible = false where public.condiciones_columnas.id = c.id;
    elsif op = 'mostrar' then update public.condiciones_columnas set visible = true where public.condiciones_columnas.id = c.id;
    elsif op = 'eliminar' then
      delete from public.condiciones_columnas where public.condiciones_columnas.id = c.id;
      update public.condiciones set datos = datos - c.clave - (c.clave || '_nombre') where sede_id = p_sede and matriz = m and (datos ? c.clave);
    elsif op = 'modificar' then
      t := coalesce(d ->> 'tipo', c.tipo);
      update public.condiciones_columnas set
        nombre = coalesce(nullif(trim(d ->> 'nombre'), ''), nombre),
        tipo = t,
        opciones = case when t not in ('lista', 'multiple') then '{}'::text[]
                        when d ? 'opciones' then array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e)
                        else c.opciones end,
        obligatoria = case when c.tipo in ('estado', 'responsable_auto') then false else coalesce((d ->> 'obligatoria')::boolean, obligatoria) end
      where public.condiciones_columnas.id = c.id;
    end if;
  end if;
end $$;

create or replace function app.titulo_cambio_columnas(p_sede uuid, d jsonb) returns text language sql stable security definer set search_path = '' as $$
  select case d ->> 'operacion'
    when 'agregar' then format('Agregar la columna «%s» a la matriz de %s', trim(d ->> 'nombre'), m.nombre)
    when 'modificar' then format('Cambiar la columna «%s» de la matriz de %s', coalesce(k.nombre, '?'), m.nombre)
    when 'ocultar' then format('Ocultar la columna «%s» de la matriz de %s', coalesce(k.nombre, '?'), m.nombre)
    when 'mostrar' then format('Mostrar la columna «%s» de la matriz de %s', coalesce(k.nombre, '?'), m.nombre)
    when 'eliminar' then format('Eliminar la columna «%s» de la matriz de %s', coalesce(k.nombre, '?'), m.nombre)
    else format('Cambiar las columnas de la matriz de %s', m.nombre) end
  from (select case coalesce(d ->> 'matriz', 'condiciones') when 'planes' then 'planes de acción' else 'condiciones' end as nombre, coalesce(d ->> 'matriz', 'condiciones') as clave) m
  left join public.condiciones_columnas k on k.sede_id = p_sede and k.matriz = m.clave and k.clave = d ->> 'clave';
$$;

create or replace function public.cambiar_columnas_condiciones(p_sede uuid, p_cambio jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.puedo_configurar_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform public.preparar_condiciones(p_sede, coalesce(p_cambio ->> 'matriz', 'condiciones'));
  perform app.revisar_cambio_columnas(p_sede, p_cambio);
  perform app.aplicar_cambio_columnas(p_sede, p_cambio);
end $$;

-- ───────────────────────── Tarjetas (por matriz) ─────────────────────────
drop function public.guardar_tarjeta_condicion(uuid, uuid, text, text, text, text);
create function public.guardar_tarjeta_condicion(p_sede uuid, p_id uuid, p_titulo text, p_columna text, p_operador text, p_valor text, p_matriz text default 'condiciones') returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.sedes; t public.condiciones_tarjetas; v_id uuid;
begin
  select * into s from public.sedes where public.sedes.id = p_sede;
  if s.id is null or not app.puedo_configurar_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform public.preparar_condiciones(p_sede, p_matriz);
  if length(trim(coalesce(p_titulo, ''))) not between 2 and 80 then raise exception 'Escribe el título de la tarjeta (de 2 a 80 letras)' using errcode = '22023'; end if;
  if p_operador not in ('vacia', 'igual', 'distinto') then raise exception 'Elige qué cuenta la tarjeta' using errcode = '22023'; end if;
  if not exists (select 1 from public.condiciones_columnas where sede_id = p_sede and matriz = p_matriz and clave = p_columna) then raise exception 'Elige una columna de la matriz' using errcode = '22023'; end if;
  if p_operador in ('igual', 'distinto') and length(trim(coalesce(p_valor, ''))) = 0 then raise exception 'Escribe el valor que debe tener la columna' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.condiciones_tarjetas (empresa_id, sede_id, matriz, titulo, columna, operador, valor, orden)
    values (s.empresa_id, p_sede, p_matriz, trim(p_titulo), p_columna, p_operador, case when p_operador = 'vacia' then null else trim(p_valor) end,
            coalesce((select max(orden) from public.condiciones_tarjetas where sede_id = p_sede and matriz = p_matriz), 0) + 1)
    returning public.condiciones_tarjetas.id into v_id;
  else
    select * into t from public.condiciones_tarjetas where public.condiciones_tarjetas.id = p_id and sede_id = p_sede and matriz = p_matriz;
    if t.id is null or t.fija then raise exception 'Esa tarjeta no se puede cambiar' using errcode = '22023'; end if;
    update public.condiciones_tarjetas set titulo = trim(p_titulo), columna = p_columna, operador = p_operador, valor = case when p_operador = 'vacia' then null else trim(p_valor) end
    where public.condiciones_tarjetas.id = p_id returning public.condiciones_tarjetas.id into v_id;
  end if;
  return v_id;
end $$;

-- «Extrapolar al IPF» solo trae condiciones de la matriz de condiciones.
create or replace function public.condiciones_abiertas_ipf(p_sede uuid, p_fecha date, p_unidad uuid, p_ubicacion uuid)
returns table (id uuid, fecha_hallazgo date, peligro text, riesgo text, plan_accion text, responsable uuid, fecha_programada date, evidencia text, area text, ubicacion text, estado text)
language plpgsql stable security definer set search_path = '' as $$
declare s public.sedes; u_nombre text; ub_nombre text;
begin
  select * into s from public.sedes where public.sedes.id = p_sede;
  if s.id is null or not (app.tengo_permiso('inspecciones.registrar') and app.puedo_sede(p_sede)) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_fecha is null then raise exception 'Elige la fecha de la inspección' using errcode = '22023'; end if;
  if p_unidad is not null then select nombre into u_nombre from public.unidades where public.unidades.id = p_unidad and empresa_id = s.empresa_id; end if;
  if p_ubicacion is not null then select nombre into ub_nombre from public.ubicaciones where public.ubicaciones.id = p_ubicacion and empresa_id = s.empresa_id; end if;
  return query
    select c.id, c.fecha_hallazgo, c.datos -> 'descripcion' ->> 'peligro', c.datos -> 'descripcion' ->> 'riesgo', c.datos ->> 'plan_accion',
           nullif(c.datos ->> 'resp_levantamiento', '')::uuid, c.fecha_programada, c.datos ->> 'evidencia', c.datos ->> 'area', c.datos ->> 'ubicacion',
           case when c.fecha_programada is not null and c.fecha_programada < p_fecha then 'atrasado' else 'pendiente' end
    from public.condiciones c
    where c.sede_id = p_sede and c.matriz = 'condiciones' and not c.borrador and c.fecha_hallazgo <= p_fecha and (c.fecha_cierre is null or c.fecha_cierre > p_fecha)
      and (p_unidad is null or c.datos ->> 'area_id' = p_unidad::text or (u_nombre is not null and lower(c.datos ->> 'area') = lower(u_nombre)))
      and (p_ubicacion is null or (ub_nombre is not null and lower(coalesce(c.datos ->> 'ubicacion', '')) = lower(ub_nombre)))
    order by c.fecha_hallazgo, c.creado_en;
end $$;

-- ───────────────────────── Los hallazgos nacen como filas de la matriz de planes ─────────────────────────
create function app.hallazgo_a_plan(h public.hallazgos) returns void language plpgsql security definer set search_path = '' as $$
declare i public.inspecciones; propios jsonb; dn jsonb; falta text[]; area_n text; area_id uuid; insp_nombre text; resp_n text; v_id uuid;
begin
  select * into i from public.inspecciones where public.inspecciones.id = h.inspeccion_id;
  if i.id is null or app.destino_hallazgos(i.plantilla_id, i.version_id) <> 'planes' then return; end if;
  v_id := md5('plan|' || h.id::text)::uuid;
  if h.estado = 'anulado' then
    delete from public.condiciones where public.condiciones.id = v_id and actualizado_por is null;
    return;
  end if;
  perform app.sembrar_condiciones(h.sede_id, 'planes');
  if i.unidad_id is not null then select u.nombre, u.id into area_n, area_id from public.unidades u where u.id = i.unidad_id; end if;
  select apellidos_nombres into insp_nombre from public.personas where public.personas.id = i.inspector_id;
  if h.responsable_id is not null then select apellidos_nombres into resp_n from public.personas where public.personas.id = h.responsable_id; end if;
  -- Lo que es del hallazgo (descripción, acción, responsable del levantamiento y plazo) se mantiene al día; lo demás lo edita la matriz.
  propios := jsonb_strip_nulls(jsonb_build_object('descripcion_hallazgo', left(h.texto, 1000), 'accion_correctiva', h.accion,
              'resp_levantamiento', h.responsable_id::text, 'resp_levantamiento_nombre', resp_n));
  dn := propios || jsonb_strip_nulls(jsonb_build_object('area', area_n, 'area_id', area_id::text, 'resp_acr', i.inspector_id::text, 'resp_acr_nombre', insp_nombre));
  insert into public.condiciones (id, empresa_id, sede_id, matriz, hallazgo_id, fecha_hallazgo, fecha_programada, fecha_cierre, datos, creado_por, creado_por_nombre, borrador)
  values (v_id, h.empresa_id, h.sede_id, 'planes', h.id, i.fecha, h.plazo, case when h.estado = 'cerrado' then (h.cerrado_en at time zone 'America/Lima')::date end, dn,
          i.inspector_id, coalesce(insp_nombre, 'Inspector'), false)
  on conflict (id) do update set datos = public.condiciones.datos || propios, fecha_programada = excluded.fecha_programada,
    fecha_cierre = case when h.estado = 'cerrado' then coalesce(public.condiciones.fecha_cierre, excluded.fecha_cierre) else null end, actualizado_en = now();
  update public.condiciones set borrador = cardinality(app.faltan_condicion(sede_id, fecha_programada, datos, 'planes')) > 0 where public.condiciones.id = v_id;
end $$;

create function app.al_cambiar_hallazgo_plan() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform app.hallazgo_a_plan(new);
  exception when others then
    raise warning 'No se pudo llevar el hallazgo % a la matriz de planes de acción: %', new.id, sqlerrm;
  end;
  return null;
end $$;
create trigger hallazgos_a_planes after insert or update on public.hallazgos
for each row execute function app.al_cambiar_hallazgo_plan();

-- Las condiciones del IPF y las fotos solo se trasladan si el formato manda sus hallazgos a condiciones.
create or replace function app.al_cerrar_inspeccion_condiciones() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if app.destino_hallazgos(new.plantilla_id, new.version_id) = 'condiciones' then perform app.trasladar_ipf(new); end if;
  exception when others then
    raise warning 'No se pudo trasladar el IPF % a la matriz de condiciones: %', new.id, sqlerrm;
  end;
  return null;
end $$;

-- Elegir a dónde van los hallazgos de un formato (administrador general; el formato debe ser de su empresa).
create function public.fijar_destino_formato(p_plantilla uuid, p_destino text) returns void language plpgsql security definer set search_path = '' as $$
declare p public.plantillas;
begin
  select * into p from public.plantillas where public.plantillas.id = p_plantilla;
  if p.id is null or p.empresa_id is null or not (app.es_dueno_plataforma() or (p.empresa_id = app.mi_empresa() and app.tengo_permiso('plantillas.publicar'))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_destino is not null and p_destino not in ('condiciones', 'planes') then raise exception 'Elige condiciones o planes de acción' using errcode = '22023'; end if;
  update public.plantillas set destino_hallazgos = p_destino where public.plantillas.id = p_plantilla;
end $$;

-- Los hallazgos que ya existían pasan a la matriz de planes.
do $$
declare h public.hallazgos;
begin
  for h in select * from public.hallazgos where estado <> 'anulado' order by creado_en loop
    perform app.hallazgo_a_plan(h);
  end loop;
end $$;

-- ───────────────────────── Permisos de las funciones ─────────────────────────
revoke all on function app.destino_hallazgos(uuid, uuid), app.columnas_base(text), app.sembrar_condiciones(uuid, text), app.faltan_condicion(uuid, date, jsonb, text),
  app.cerrar_hallazgo_desde_matriz(uuid, uuid), app.hallazgo_a_plan(public.hallazgos), app.al_cambiar_hallazgo_plan() from public, anon, authenticated;
revoke all on function public.preparar_condiciones(uuid, text), public.guardar_condicion(uuid, uuid, jsonb, boolean, text), public.validar_cierre_condicion(uuid, date),
  public.guardar_tarjeta_condicion(uuid, uuid, text, text, text, text, text), public.fijar_destino_formato(uuid, text) from public, anon;
grant execute on function public.preparar_condiciones(uuid, text), public.guardar_condicion(uuid, uuid, jsonb, boolean, text), public.validar_cierre_condicion(uuid, date),
  public.guardar_tarjeta_condicion(uuid, uuid, text, text, text, text, text), public.fijar_destino_formato(uuid, text) to authenticated;
