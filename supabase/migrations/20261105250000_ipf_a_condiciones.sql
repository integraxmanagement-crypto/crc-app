-- Las condiciones del IPF pasan solas a la matriz de condiciones (pedido del dueño, 05/11/2026) y el IPF puede traer las condiciones abiertas de la matriz.
--  · Al cerrarse (o corregirse) un IPF, cada fila de «Condición insegura» se vuelca a la matriz de su sede. Lo que falte de las columnas obligatorias
--    (p. ej. clasificación o motivo) deja la condición como borrador, pero igual se traslada todo lo que el IPF trae.
--  · Las filas traídas de la matriz («Extrapolar condiciones») quedan vinculadas a la condición original (no se duplican).
--  · Los planes de acción del IPF (hallazgos) siguen como están.
-- No toca roles, permisos ni la tabla unidades.

-- Crear las columnas y tarjetas base de una sede sin pedir permiso (lo usan los procesos internos).
create function app.sembrar_condiciones(p_sede uuid) returns void language plpgsql security definer set search_path = '' as $$
declare s public.sedes;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null then return; end if;
  insert into public.condiciones_columnas (empresa_id, sede_id, clave, nombre, tipo, opciones, obligatoria, orden, es_base)
  select s.empresa_id, p_sede, b.clave, b.nombre, b.tipo, b.opciones, b.obligatoria, b.orden, true from app.columnas_base() b
  on conflict (sede_id, clave) do nothing;
  if not exists (select 1 from public.condiciones_tarjetas where sede_id = p_sede and fija) then
    insert into public.condiciones_tarjetas (empresa_id, sede_id, titulo, columna, operador, fija, orden) values
      (s.empresa_id, p_sede, 'Borradores que requieren atención', 'borrador', 'borrador', true, 1),
      (s.empresa_id, p_sede, 'Sin plazo definido', 'fecha_programada', 'vacia', true, 2);
  end if;
end $$;

create or replace function public.preparar_condiciones(p_sede uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.sedes where id = p_sede) or not app.puedo_ver_condiciones(p_sede) then raise exception 'No autorizado' using errcode = '42501'; end if;
  perform app.sembrar_condiciones(p_sede);
end $$;

-- Qué falta para que una condición no sea borrador: las columnas visibles obligatorias sin dato (y la descripción, que siempre pide peligro y riesgo).
create function app.faltan_condicion(p_sede uuid, p_programada date, p_datos jsonb) returns text[] language plpgsql stable security definer set search_path = '' as $$
declare c public.condiciones_columnas; falta text[] := '{}'; v jsonb;
begin
  for c in select * from public.condiciones_columnas
           where sede_id = p_sede and visible and (obligatoria or tipo = 'descripcion') and tipo not in ('estado', 'responsable_auto') and clave not in ('fecha_cierre', 'fecha_hallazgo') order by orden loop
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

-- Vuelca a la matriz las filas de «Condición insegura» de un IPF cerrado. Es idempotente: cada fila tiene un identificador propio (inspección + número de fila).
create function app.trasladar_ipf(i public.inspecciones) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_rec jsonb; r jsonb; k integer; n integer; v_id uuid; v_link uuid; dn jsonb; falta text[]; prog date;
  peligro text; riesgo text; accion text; v_resp uuid; nombre_resp text; insp_nombre text; area_n text; area_id uuid; ubic text; ev text; c public.condiciones;
begin
  if i.estado <> 'cerrada' then return; end if;
  select receta into v_rec from public.plantillas_versiones where id = i.version_id;
  if not exists (select 1 from jsonb_array_elements(coalesce(v_rec -> 'secciones', '[]'::jsonb)) s where s ->> 'clave' = 'condiciones' and (s -> 'puntos' -> 0 ->> 'clave') like 'IPF-C%') then return; end if;
  perform app.sembrar_condiciones(i.sede_id);
  select apellidos_nombres into insp_nombre from public.personas where id = i.inspector_id;
  if i.unidad_id is not null then select u.nombre, u.id into area_n, area_id from public.unidades u where u.id = i.unidad_id; end if;
  if i.ubicacion_id is not null then select nombre into ubic from public.ubicaciones where id = i.ubicacion_id; end if;

  n := jsonb_array_length(coalesce(i.filas -> 'condiciones', '[]'::jsonb));
  for k in 0 .. n - 1 loop
    r := (i.filas -> 'condiciones') -> k;
    peligro := nullif(trim(coalesce(r -> 'IPF-C01' ->> 'valor', '')), '');
    riesgo := nullif(trim(coalesce(r -> 'IPF-C02' ->> 'valor', '')), '');
    accion := left(nullif(trim(coalesce(r -> 'IPF-C04' ->> 'valor', '')), ''), 500);
    begin prog := nullif(r -> 'IPF-C06' ->> 'valor', '')::date; exception when others then prog := null; end;
    begin v_resp := nullif(r -> 'IPF-C05' ->> 'valor', '')::uuid; exception when others then v_resp := null; end;
    nombre_resp := null;
    if v_resp is not null then
      select p.apellidos_nombres into nombre_resp from public.vinculos v join public.personas p on p.id = v.persona_id where v.persona_id = v_resp and v.empresa_id = i.empresa_id and v.estado = 'activo' limit 1;
      if nombre_resp is null then v_resp := null; end if;
    end if;
    begin v_link := nullif(r -> '_condicion' ->> 'valor', '')::uuid; exception when others then v_link := null; end;

    if v_link is not null then
      -- Fila traída de la matriz: se actualiza esa misma condición (no se crea otra).
      select * into c from public.condiciones where id = v_link and sede_id = i.sede_id and fecha_cierre is null;
      if c.id is not null then
        dn := c.datos;
        if accion is not null then dn := dn || jsonb_build_object('plan_accion', accion); end if;
        if v_resp is not null then dn := dn || jsonb_build_object('resp_levantamiento', v_resp::text, 'resp_levantamiento_nombre', nombre_resp); end if;
        prog := coalesce(prog, c.fecha_programada);
        falta := app.faltan_condicion(i.sede_id, prog, dn);
        update public.condiciones set datos = dn, fecha_programada = prog, borrador = cardinality(falta) > 0, actualizado_en = now() where id = c.id;
      end if;
      continue;
    end if;

    if peligro is null and riesgo is null and accion is null and v_resp is null and prog is null then continue; end if;
    v_id := md5(i.id::text || '|ipf|' || k::text)::uuid;
    ev := null;
    select 'evidencias:' || a.ruta into ev from public.archivos a where a.inspeccion_id = i.id and a.punto_clave = 'IPF-C03' and a.fila = k order by a.creado_en limit 1;
    dn := jsonb_strip_nulls(jsonb_build_object(
      'area', area_n, 'area_id', area_id::text, 'ubicacion', ubic,
      'descripcion', jsonb_build_object('peligro', coalesce(peligro, ''), 'riesgo', coalesce(riesgo, '')),
      'evidencia', ev, 'plan_accion', accion,
      'resp_levantamiento', v_resp::text, 'resp_levantamiento_nombre', nombre_resp,
      'resp_inspeccion', i.inspector_id::text, 'resp_inspeccion_nombre', insp_nombre,
      'origen', 'Inspección de seguridad'));
    if prog is not null and prog < i.fecha then prog := null; end if;
    falta := app.faltan_condicion(i.sede_id, prog, dn);
    insert into public.condiciones (id, empresa_id, sede_id, fecha_hallazgo, fecha_programada, datos, creado_por, creado_por_nombre, borrador)
    values (v_id, i.empresa_id, i.sede_id, i.fecha, prog, dn, i.inspector_id, coalesce(insp_nombre, 'Inspector'), cardinality(falta) > 0)
    on conflict (id) do update set datos = excluded.datos, fecha_programada = excluded.fecha_programada, fecha_hallazgo = excluded.fecha_hallazgo, borrador = excluded.borrador, actualizado_en = now()
      where public.condiciones.actualizado_por is null and public.condiciones.fecha_cierre is null;
  end loop;
end $$;

-- Nunca debe fallar el registro de una inspección por culpa de la matriz.
create function app.al_cerrar_inspeccion_condiciones() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform app.trasladar_ipf(new);
  exception when others then
    raise warning 'No se pudo trasladar el IPF % a la matriz de condiciones: %', new.id, sqlerrm;
  end;
  return null;
end $$;
create trigger inspecciones_condiciones after insert or update of filas, estado on public.inspecciones
for each row execute function app.al_cerrar_inspeccion_condiciones();

-- ───────────────────────── Extrapolar condiciones al IPF ─────────────────────────
-- Las condiciones abiertas de la matriz (pendientes o atrasadas a la fecha de la inspección) de un área y, si se da, una ubicación.
-- Lo usa quien llena el IPF (permiso de registrar inspecciones), aunque no pueda ver la matriz.
create function public.condiciones_abiertas_ipf(p_sede uuid, p_fecha date, p_unidad uuid, p_ubicacion uuid)
returns table (id uuid, fecha_hallazgo date, peligro text, riesgo text, plan_accion text, responsable uuid, fecha_programada date, evidencia text, area text, ubicacion text, estado text)
language plpgsql stable security definer set search_path = '' as $$
declare s public.sedes; u_nombre text; ub_nombre text;
begin
  select * into s from public.sedes where id = p_sede;
  if s.id is null or not (app.tengo_permiso('inspecciones.registrar') and app.puedo_sede(p_sede)) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_fecha is null then raise exception 'Elige la fecha de la inspección' using errcode = '22023'; end if;
  if p_unidad is not null then select nombre into u_nombre from public.unidades where public.unidades.id = p_unidad and empresa_id = s.empresa_id; end if;
  if p_ubicacion is not null then select nombre into ub_nombre from public.ubicaciones where public.ubicaciones.id = p_ubicacion and empresa_id = s.empresa_id; end if;
  return query
    select c.id, c.fecha_hallazgo, c.datos -> 'descripcion' ->> 'peligro', c.datos -> 'descripcion' ->> 'riesgo', c.datos ->> 'plan_accion',
           nullif(c.datos ->> 'resp_levantamiento', '')::uuid, c.fecha_programada, c.datos ->> 'evidencia', c.datos ->> 'area', c.datos ->> 'ubicacion',
           case when c.fecha_programada is not null and c.fecha_programada < p_fecha then 'atrasado' else 'pendiente' end
    from public.condiciones c
    where c.sede_id = p_sede and not c.borrador and c.fecha_hallazgo <= p_fecha and (c.fecha_cierre is null or c.fecha_cierre > p_fecha)
      and (p_unidad is null or c.datos ->> 'area_id' = p_unidad::text or (u_nombre is not null and lower(c.datos ->> 'area') = lower(u_nombre)))
      and (p_ubicacion is null or (ub_nombre is not null and lower(coalesce(c.datos ->> 'ubicacion', '')) = lower(ub_nombre)))
    order by c.fecha_hallazgo, c.creado_en;
end $$;

revoke all on function app.sembrar_condiciones(uuid), app.faltan_condicion(uuid, date, jsonb), app.trasladar_ipf(public.inspecciones), app.al_cerrar_inspeccion_condiciones() from public, anon, authenticated;
revoke all on function public.condiciones_abiertas_ipf(uuid, date, uuid, uuid) from public, anon;
grant execute on function public.condiciones_abiertas_ipf(uuid, date, uuid, uuid) to authenticated;
