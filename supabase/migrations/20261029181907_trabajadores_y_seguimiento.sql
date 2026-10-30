-- Revisión de diseño, 29/10/2026 (aprobado por el dueño):
-- 1) N.º de trabajadores como dato de la empresa, con dos modos: «automático» (se cuenta el personal activo) o «manual»
--    (lo digita el administrador). Lo usan todos los formatos y el PASST con la marca {{trabajadores}}.
-- 2) PASST con seguimiento «por semana» (como hasta ahora) o «por mes», elegido al crear el programa.
-- Cambia la tabla empresas (que usan también los módulos de contratistas y medio ambiente) y passt_programas.

alter table public.empresas
  add column trabajadores_modo text not null default 'automatico' check (trabajadores_modo in ('automatico', 'manual')),
  add column trabajadores_manual integer check (trabajadores_manual is null or trabajadores_manual between 0 and 1000000);
comment on column public.empresas.trabajadores_modo is 'automatico = cantidad de personas activas de la empresa; manual = el número que digita el administrador.';

alter table public.passt_programas
  add column seguimiento text not null default 'semana' check (seguimiento in ('semana', 'mes'));
comment on column public.passt_programas.seguimiento is 'semana = una casilla por semana ISO; mes = una casilla por mes (se guarda en la primera semana del mes).';

-- N.º de trabajadores de la empresa según su modo: lo ve cualquier persona de la empresa (y el dueño de la plataforma).
create or replace function public.numero_trabajadores(p_empresa uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when app.es_dueno_plataforma() or p_empresa = app.mi_empresa() then
    (select case when e.trabajadores_modo = 'manual' then e.trabajadores_manual
                 else (select count(*)::integer from public.vinculos v where v.empresa_id = e.id and v.estado = 'activo') end
     from public.empresas e where e.id = p_empresa) end;
$$;

-- Elegir el modo y, si es manual, digitar el número. Lo hace el dueño o quien edita los datos de contacto de su empresa.
create or replace function public.guardar_trabajadores(p_empresa uuid, p_modo text, p_cantidad integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.es_dueno_plataforma() or (app.tengo_permiso('empresa.editar_contactos') and p_empresa = app.mi_empresa())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_modo not in ('automatico', 'manual') then raise exception 'Elige automático o manual' using errcode = '22023'; end if;
  if p_modo = 'manual' and (p_cantidad is null or p_cantidad not between 0 and 1000000) then
    raise exception 'Escribe la cantidad de trabajadores' using errcode = '22023';
  end if;
  update public.empresas set trabajadores_modo = p_modo, trabajadores_manual = case when p_modo = 'manual' then p_cantidad end, actualizado_en = now()
  where id = p_empresa;
end $$;

-- El PASST usa el mismo número.
create or replace function public.passt_trabajadores(p_empresa uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when app.puedo_en_empresa(p_empresa, 'passt.ver') then public.numero_trabajadores(p_empresa) end;
$$;

create or replace function public.crear_programa(p_empresa uuid, p_datos jsonb) returns uuid
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
  if coalesce(app.texto(p_datos, 'seguimiento'), 'semana') not in ('semana', 'mes') then
    raise exception 'El seguimiento es por semana o por mes' using errcode = '22023';
  end if;
  insert into public.passt_programas (empresa_id, sede_id, anio, nombre, seguimiento, creado_por)
  values (p_empresa, v_sede, v_anio, coalesce(v_nombre, 'Programa anual de SST ' || v_anio), coalesce(app.texto(p_datos, 'seguimiento'), 'semana'), (select auth.uid()))
  returning * into pr;
  insert into public.passt_nodos (programa_id, empresa_id, tipo, orden, texto)
  values (pr.id, p_empresa, 'objetivo_general', 1, coalesce(app.texto(p_datos, 'objetivo_general'), 'Objetivo general ' || v_anio));
  perform app.passt_anotar(pr, null, 'creado', null, null);
  return pr.id;
end $$;

create or replace function public.duplicar_programa(p_id uuid, p_datos jsonb) returns uuid
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
  insert into public.passt_programas (empresa_id, sede_id, anio, nombre, codigo_formato, version_formato, meta_cumplimiento, seguimiento, duplicado_de, creado_por)
  values (o.empresa_id, v_sede, v_anio, coalesce(app.texto(p_datos, 'nombre'), o.nombre || ' (copia)'), o.codigo_formato, o.version_formato,
          o.meta_cumplimiento, o.seguimiento, o.id, (select auth.uid()))
  returning * into pr;
  -- Del padre al hijo: primero el objetivo general, luego los objetivos, las secciones y las actividades.
  for n in
    select * from public.passt_nodos where programa_id = o.id and vigente
    order by case tipo when 'objetivo_general' then 1 when 'objetivo_especifico' then 2 when 'seccion' then 3 else 4 end, orden
  loop
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id, unidad_id)
    values (pr.id, pr.empresa_id, (mapa ->> n.padre_id::text)::uuid, n.tipo, n.orden, n.texto, n.recursos, n.responsable_id, n.meta_pct, n.observaciones, n.plantilla_id, n.unidad_id)
    returning id into v_nuevo;
    mapa := mapa || jsonb_build_object(n.id::text, v_nuevo);
  end loop;
  insert into public.passt_metas (nodo_id, empresa_id, orden, texto, indicador)
  select (mapa ->> m.nodo_id::text)::uuid, m.empresa_id, m.orden, m.texto, m.indicador
  from public.passt_metas m where mapa ? m.nodo_id::text;
  if o.seguimiento = 'mes' then
    -- Por mes: la casilla del mes va en la primera semana de ese mes del año nuevo (cada semana cuenta en el mes de su jueves).
    insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
    select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id,
           (select min(w) from generate_series(1, v_max) w
            where extract(month from make_date(v_anio, 1, 4) - (extract(isodow from make_date(v_anio, 1, 4))::integer - 1) + (w - 1) * 7 + 3)
                = extract(month from make_date(o.anio, 1, 4) - (extract(isodow from make_date(o.anio, 1, 4))::integer - 1) + (s.semana - 1) * 7 + 3)), true
    from public.passt_semanas s where mapa ? s.actividad_id::text and s.programada;
  else
    insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
    select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id, s.semana, true
    from public.passt_semanas s where mapa ? s.actividad_id::text and s.programada and s.semana <= v_max;
  end if;
  perform app.passt_anotar(pr, null, 'duplicado', jsonb_build_object('de', o.id), null);
  return pr.id;
end $$;
