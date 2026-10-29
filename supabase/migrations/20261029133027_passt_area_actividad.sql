-- Revisión del formato LOTO (29/10/2026, aprobado por el dueño): cada actividad del PASST puede tener su área.
-- Ejemplo: estrategia «Eficacia LOTO» con una actividad por área, cada una con sus semanas. Una actividad con área
-- queda ejecutada solo con una inspección del formato vinculado hecha en esa área (o en una subárea) esa semana.
-- Solo cambia passt_nodos (un dato nuevo) y sus funciones. No toca personas, empresas, sedes, unidades, roles ni permisos.

alter table public.passt_nodos add column unidad_id uuid references public.unidades (id) on delete restrict;
comment on column public.passt_nodos.unidad_id is 'Área de la actividad (opcional). Con área, solo la ejecuta una inspección de esa área.';
alter table public.passt_nodos drop constraint passt_nodos_actividad;
alter table public.passt_nodos add constraint passt_nodos_actividad
  check (tipo = 'actividad' or (responsable_id is null and plantilla_id is null and meta_pct is null and unidad_id is null));

create or replace function public.guardar_nodo(p_programa uuid, p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pr public.passt_programas; n public.passt_nodos; padre public.passt_nodos; v_tipo text; v_padre_tipo text; v_resp uuid; v_plant uuid; v_meta numeric; v_id uuid; v_unidad uuid;
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
    if v_meta not between 0 and 100 then raise exception 'La meta debe estar entre 0 y 100 %%' using errcode = '22023'; end if;
  end if;
  if p_id is null then
    insert into public.passt_nodos (programa_id, empresa_id, padre_id, tipo, orden, texto, recursos, responsable_id, meta_pct, observaciones, plantilla_id, unidad_id)
    values (pr.id, pr.empresa_id, padre.id, v_tipo,
            coalesce((select max(orden) from public.passt_nodos where padre_id = padre.id), 0) + 1, v_texto,
            case when v_tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
            v_resp, case when v_tipo = 'actividad' then v_meta end, left(app.texto(p_datos, 'observaciones'), 1000), v_plant, v_unidad)
    returning id into v_id;
  else
    update public.passt_nodos set texto = v_texto,
      recursos = case when tipo = 'objetivo_especifico' then left(app.texto(p_datos, 'recursos'), 1000) end,
      responsable_id = v_resp, meta_pct = case when tipo = 'actividad' then v_meta end,
      observaciones = left(app.texto(p_datos, 'observaciones'), 1000), plantilla_id = v_plant, unidad_id = v_unidad
    where id = p_id returning id into v_id;
  end if;
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
  insert into public.passt_programas (empresa_id, sede_id, anio, nombre, codigo_formato, version_formato, meta_cumplimiento, duplicado_de, creado_por)
  values (o.empresa_id, v_sede, v_anio, coalesce(app.texto(p_datos, 'nombre'), o.nombre || ' (copia)'), o.codigo_formato, o.version_formato,
          o.meta_cumplimiento, o.id, (select auth.uid()))
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
  insert into public.passt_semanas (actividad_id, empresa_id, semana, programada)
  select (mapa ->> s.actividad_id::text)::uuid, s.empresa_id, s.semana, true
  from public.passt_semanas s where mapa ? s.actividad_id::text and s.programada and s.semana <= v_max;
  perform app.passt_anotar(pr, null, 'duplicado', jsonb_build_object('de', o.id), null);
  return pr.id;
end $$;

create or replace function public.passt_ejecucion(p_programa uuid)
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
      -- Actividad con área: solo cuenta una inspección de esa área o de una de sus subáreas.
      and (n.unidad_id is null or exists (
        select 1 from public.unidades u1 left join public.unidades u2 on u2.id = u1.padre_id
        where u1.id = i.unidad_id and (u1.id = n.unidad_id or u1.padre_id = n.unidad_id or u2.padre_id = n.unidad_id)))
    where n.programa_id = pr.id and n.tipo = 'actividad' and n.vigente and n.plantilla_id is not null
    group by n.id, extract(week from i.fecha);
end $$;
