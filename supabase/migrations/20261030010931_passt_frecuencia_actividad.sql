-- Frecuencia en la actividad del programa anual (pedido del dueño, 29/10/2026): un formato no tiene un período propio; la frecuencia
-- nace en la actividad del PASST (que puede vincular un formato como referencia, opcional). Dos formas: periódica (semanal, mensual,
-- bimestral, trimestral, semestral o anual: se programan solas las semanas del año) o manual (se eligen las semanas o meses a mano).
-- Solo el administrador (permiso passt.reprogramar) define la frecuencia o programa semanas. No toca personas, empresas, roles ni permisos.
alter table public.passt_nodos add column frecuencia text check (frecuencia is null or frecuencia in ('semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'));
comment on column public.passt_nodos.frecuencia is 'Frecuencia de una actividad: vacía = manual (semanas o meses elegidos a mano).';

-- Programa solas las semanas del año según la frecuencia: semanal = todas; las demás, una por período (la primera semana de su primer mes).
create function app.passt_aplicar_frecuencia(p_nodo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas; v_total integer; v_lunes1 date; v_paso integer;
begin
  select * into n from public.passt_nodos where id = p_nodo;
  if n.id is null or n.tipo <> 'actividad' or n.frecuencia is null then return; end if;
  select * into pr from public.passt_programas where id = n.programa_id;
  v_total := app.semanas_del_anio(pr.anio);
  v_lunes1 := make_date(pr.anio, 1, 4) - (extract(isodow from make_date(pr.anio, 1, 4))::integer - 1);
  v_paso := case n.frecuencia when 'mensual' then 1 when 'bimestral' then 2 when 'trimestral' then 3 when 'semestral' then 6 when 'anual' then 12 else 0 end;
  insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
  select n.id, n.empresa_id, w, false from generate_series(1, v_total) w
  on conflict (actividad_id, semana) do nothing;
  update public.passt_semanas set programada = false where actividad_id = n.id;
  update public.passt_semanas s set programada = true
  where s.actividad_id = n.id and s.semana <= v_total and (
    v_paso = 0
    or s.semana in (
      select min(w) from generate_series(1, v_total) w
      group by extract(month from v_lunes1 + (w - 1) * 7 + 3)
      having ((extract(month from v_lunes1 + (min(w) - 1) * 7 + 3)::integer - 1) % v_paso) = 0));
end $$;
revoke all on function app.passt_aplicar_frecuencia(uuid) from public, anon, authenticated;

create or replace function public.guardar_nodo(p_programa uuid, p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas; n public.passt_nodos; padre public.passt_nodos; v_tipo text; v_padre_tipo text; v_resp uuid; v_plant uuid; v_meta numeric; v_id uuid; v_unidad uuid; v_frec text;
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
    -- Área de la actividad (revisión del formato LOTO, 29/10/2026): con área, solo la ejecuta una inspección de esa área.
    v_unidad := nullif(p_datos ->> 'unidad_id', '')::uuid;
    if v_unidad is not null and not exists (select 1 from public.unidades where id = v_unidad and empresa_id = pr.empresa_id and vigente) then
      raise exception 'El área debe ser de la empresa y estar vigente' using errcode = '22023';
    end if;
    -- Frecuencia de la actividad (pedido del dueño, 29/10/2026): periódica (se programan solas las semanas del año) o manual (vacía).
    -- Solo el administrador la define o la cambia.
    v_frec := nullif(p_datos ->> 'frecuencia', '');
    if v_frec is not null and v_frec not in ('semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual') then
      raise exception 'Frecuencia no válida' using errcode = '22023';
    end if;
    if v_frec is distinct from n.frecuencia and not app.puedo_en_empresa(pr.empresa_id, 'passt.reprogramar') then
      raise exception 'Solo el administrador define la frecuencia de una actividad' using errcode = '42501';
    end if;
    if v_meta not between 0 and 100 then raise exception 'La meta debe estar entre 0 y 100 %%' using errcode = '22023'; end if;
  end if;
  if p_id is null then
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id, unidad_id, frecuencia)
    values (pr.id, pr.empresa_id, padre.id, v_tipo,
            coalesce((select max(orden) from public.passt_nodos where padre_id = padre.id), 0) + 1, v_texto,
            case when v_tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
            v_resp, case when v_tipo = 'actividad' then v_meta end, left(app.texto(p_datos, 'observaciones'), 1000), v_plant, v_unidad, case when v_tipo = 'actividad' then v_frec end)
    returning id into v_id;
  else
    update public.passt_nodos set texto = v_texto,
      recursos = case when tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
      responsable_id = v_resp, meta_pct = case when tipo = 'actividad' then v_meta end,
      observaciones = left(app.texto(p_datos, 'observaciones'), 1000), plantilla_id = v_plant, unidad_id = v_unidad, frecuencia = case when tipo = 'actividad' then v_frec end
    where id = p_id returning id into v_id;
  end if;
  if v_tipo = 'actividad' and v_frec is not null and v_frec is distinct from n.frecuencia then perform app.passt_aplicar_frecuencia(v_id); end if;
  update public.passt_programas set actualizado_en = now() where id = pr.id;
  if pr.estado = 'aprobado' then perform app.passt_anotar(pr, v_id, 'estructura', p_datos - 'motivo', p_datos ->> 'motivo'); end if;
  return v_id;
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
  for n in
    select * from public.passt_nodos where programa_id = o.id and vigente
    order by case tipo when 'objetivo_general' then 1 when 'objetivo_especifico' then 2 when 'seccion' then 3 else 4 end, orden
  loop
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id, unidad_id, frecuencia)
    values (pr.id, pr.empresa_id, (mapa ->> n.padre_id::text)::uuid, n.tipo, n.orden, n.texto, n.recursos, n.responsable_id, n.meta_pct, n.observaciones, n.plantilla_id, n.unidad_id, n.frecuencia)
    returning id into v_nuevo;
    mapa := mapa || jsonb_build_object(n.id::text, v_nuevo);
  end loop;
  insert into public.passt_metas (nodo_id, empresa_id, orden, texto, indicador)
  select (mapa ->> m.nodo_id::text)::uuid, m.empresa_id, m.orden, m.texto, m.indicador
  from public.passt_metas m where mapa ? m.nodo_id::text;
  -- Las actividades manuales copian sus semanas; las periódicas se programan solas según su frecuencia en el año nuevo.
  if o.seguimiento = 'mes' then
    insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
    select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id,
           (select min(w) from generate_series(1, v_max) w
            where extract(month from make_date(v_anio, 1, 4) - (extract(isodow from make_date(v_anio, 1, 4))::integer - 1) + (w - 1) * 7 + 3)
                = extract(month from make_date(o.anio, 1, 4) - (extract(isodow from make_date(o.anio, 1, 4))::integer - 1) + (s.semana - 1) * 7 + 3)), true
    from public.passt_semanas s join public.passt_nodos nn on nn.id = s.actividad_id
    where mapa ? s.actividad_id::text and s.programada and nn.frecuencia is null;
  else
    insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
    select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id, s.semana, true
    from public.passt_semanas s join public.passt_nodos nn on nn.id = s.actividad_id
    where mapa ? s.actividad_id::text and s.programada and s.semana <= v_max and nn.frecuencia is null;
  end if;
  for v_nuevo in select id from public.passt_nodos where programa_id = pr.id and frecuencia is not null loop
    perform app.passt_aplicar_frecuencia(v_nuevo);
  end loop;
  perform app.passt_anotar(pr, null, 'duplicado', jsonb_build_object('de', o.id), null);
  return pr.id;
end $$;

-- Programar semanas a mano: solo el administrador. Al hacerlo, la actividad pasa a ser manual (sin frecuencia periódica).
create or replace function public.programar_semana(p_actividad uuid, p_semana integer, p_programada boolean, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.passt_nodos; pr public.passt_programas;
begin
  select * into n from public.passt_nodos where id = p_actividad;
  if n.id is null or n.tipo <> 'actividad' or not n.vigente then raise exception 'La actividad no existe' using errcode = '22023'; end if;
  pr := app.passt_para_cambiar(n.programa_id, p_motivo);
  if not app.puedo_en_empresa(pr.empresa_id, 'passt.reprogramar') then
    raise exception 'Solo el administrador programa las semanas' using errcode = '42501';
  end if;
  if p_semana is null or p_semana not between 1 and app.semanas_del_anio(pr.anio) then
    raise exception 'Semana no válida para %', pr.anio using errcode = '22023';
  end if;
  insert into public.passt_semanas (actividad_id, empresa_id, semana, programada) values (n.id, n.empresa_id, p_semana, coalesce(p_programada, false))
  on conflict (actividad_id, semana) do update set programada = excluded.programada;
  update public.passt_nodos set frecuencia = null where id = n.id and frecuencia is not null;
  if pr.estado = 'aprobado' then
    perform app.passt_anotar(pr, n.id, 'reprogramado', jsonb_build_object('semana', p_semana, 'programada', p_programada), p_motivo);
  end if;
end $$;
