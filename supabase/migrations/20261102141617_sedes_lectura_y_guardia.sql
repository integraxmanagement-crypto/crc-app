-- Etapa 1 del punto 2 (02/11/2026): sedes y administrador de sede. PARTE 2: lectura por sede, funciones de lectura del servidor, fotos y firmas, PASST por sede,
-- guardia de sede en las tablas con sede y cuentas por sede. No toca personas ni empresas; cambia las reglas de lectura de vinculos, personas y de las tablas con sede.

-- Cambia un texto dentro de una función existente (y falla si no lo encuentra, para no dejar nada a medias).
create function pg_temp.parchar(p_funcion regprocedure, p_viejo text, p_nuevo text) returns void language plpgsql as $$
declare d text;
begin
  d := pg_get_functiondef(p_funcion);
  if position(p_viejo in d) = 0 then raise exception 'No se encontró el texto a cambiar en %: %', p_funcion, p_viejo; end if;
  execute replace(d, p_viejo, p_nuevo);
end $$;

-- ───── 1. Lectura de las tablas con sede ─────
drop policy "Ver activos de mi empresa" on public.activos;
create policy "Ver activos de mi empresa" on public.activos for select using (
  (select app.es_dueno_plataforma()) or (empresa_id = (select app.mi_empresa()) and app.puedo_sede(sede_id)));
drop policy "Ver ubicaciones de mi empresa" on public.ubicaciones;
create policy "Ver ubicaciones de mi empresa" on public.ubicaciones for select using (
  (select app.es_dueno_plataforma()) or (empresa_id = (select app.mi_empresa()) and app.puedo_sede(sede_id)));
drop policy "Ver historial de activos de mi empresa" on public.activos_historial;
create policy "Ver historial de activos de mi empresa" on public.activos_historial for select using (
  (select app.es_dueno_plataforma()) or exists (select 1 from public.activos a where a.id = activos_historial.activo_id));

drop policy "Ver hallazgos permitidos" on public.hallazgos;
create policy "Ver hallazgos permitidos" on public.hallazgos for select using (
  (select app.es_dueno_plataforma())
  or (empresa_id = (select app.mi_empresa())
      and ((app.tengo_permiso('hallazgos.gestionar') and app.puedo_sede(sede_id))
           or (app.tengo_permiso('hallazgos.cerrar_propios') and responsable_id = (select auth.uid())))));
create or replace function app.puedo_ver_hallazgo(p_hallazgo uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.hallazgos h where h.id = p_hallazgo and (
      app.es_dueno_plataforma()
      or (h.empresa_id = app.mi_empresa() and ((app.tengo_permiso('hallazgos.gestionar') and app.puedo_sede(h.sede_id))
          or (app.tengo_permiso('hallazgos.cerrar_propios') and h.responsable_id = (select auth.uid()))))));
$$;

drop policy "Ver inspecciones permitidas" on public.inspecciones;
create policy "Ver inspecciones permitidas" on public.inspecciones for select using (
  (select app.es_dueno_plataforma())
  or (empresa_id = (select app.mi_empresa()) and ((app.tengo_permiso('inspecciones.ver') and app.puedo_sede(sede_id)) or app.soy_firmante(id))));
create or replace function app.puedo_ver_inspeccion(p_inspeccion uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inspecciones i where i.id = p_inspeccion and (
      app.es_dueno_plataforma()
      or (i.empresa_id = app.mi_empresa() and ((app.tengo_permiso('inspecciones.ver') and app.puedo_sede(i.sede_id)) or app.soy_firmante(i.id)))));
$$;
drop policy "Ver ediciones permitidas" on public.inspecciones_ediciones;
create policy "Ver ediciones permitidas" on public.inspecciones_ediciones for select using (
  (select app.es_dueno_plataforma()) or (app.tengo_permiso('inspecciones.ver') and app.puedo_ver_inspeccion(inspeccion_id)));

-- PASST: un programa de una sede lo ve quien tiene esa sede; uno general (sin sede), quien tiene permiso en la empresa. Sus partes siguen al programa.
drop policy "Ver PASST de mi empresa" on public.passt_programas;
create policy "Ver PASST de mi empresa" on public.passt_programas for select using (app.puedo_ver_programa(empresa_id, sede_id));
drop policy "Ver PASST de mi empresa" on public.passt_nodos;
create policy "Ver PASST de mi empresa" on public.passt_nodos for select using (
  exists (select 1 from public.passt_programas pr where pr.id = passt_nodos.programa_id));
drop policy "Ver PASST de mi empresa" on public.passt_historial;
create policy "Ver PASST de mi empresa" on public.passt_historial for select using (
  exists (select 1 from public.passt_programas pr where pr.id = passt_historial.programa_id));
drop policy "Ver PASST de mi empresa" on public.passt_semanas;
create policy "Ver PASST de mi empresa" on public.passt_semanas for select using (
  exists (select 1 from public.passt_nodos n where n.id = passt_semanas.actividad_id));
drop policy "Ver PASST de mi empresa" on public.passt_metas;
create policy "Ver PASST de mi empresa" on public.passt_metas for select using (
  exists (select 1 from public.passt_nodos n where n.id = passt_metas.nodo_id));

-- ───── 2. Fotos y firmas siguen a su inspección, su plan de acción o su actividad (y ahora todos miran la sede) ─────
select pg_temp.parchar('app.puedo_ver_evidencia(text, uuid)'::regprocedure,
  '(s.empresa_id = app.mi_empresa() and app.tengo_permiso(''passt.ver''))',
  '(s.empresa_id = app.mi_empresa() and app.tengo_permiso(''passt.ver'') and exists (select 1 from public.passt_nodos pn join public.passt_programas pp on pp.id = pn.programa_id where pn.id = s.actividad_id and app.puedo_ver_programa(pp.empresa_id, pp.sede_id)))');
select pg_temp.parchar('app.puedo_subir_evidencia(text)'::regprocedure,
  'and split_part(p_nombre, ''/'', 3) like ''cierre-'' || h.id::text || ''-%''',
  'and split_part(p_nombre, ''/'', 3) like ''cierre-'' || h.id::text || ''-%'' and (h.responsable_id = (select auth.uid()) or app.puedo_sede(h.sede_id))');
select pg_temp.parchar('app.puedo_subir_evidencia(text)'::regprocedure,
  'n.vigente and n.empresa_id = app.mi_empresa()',
  'n.vigente and n.empresa_id = app.mi_empresa() and exists (select 1 from public.passt_programas pp where pp.id = n.programa_id and app.puedo_ver_programa(pp.empresa_id, pp.sede_id))');

-- ───── 3. Funciones de lectura del servidor (se saltan las reglas de las tablas): filtran por sede ─────
select pg_temp.parchar('public.avance_periodo(uuid, uuid, date, date)'::regprocedure,
  'if not exists (select 1 from public.sedes s where s.id = p_sede and s.empresa_id = pl.empresa_id) then',
  'if not app.puedo_sede(p_sede) then raise exception ''No autorizado'' using errcode = ''42501''; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede and s.empresa_id = pl.empresa_id) then');
select pg_temp.parchar('public.passt_ejecucion(uuid)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.ver'')', 'not app.puedo_ver_programa(pr.empresa_id, pr.sede_id)');
select pg_temp.parchar('public.passt_ejecucion(uuid)'::regprocedure,
  '(pr.sede_id is null or i.sede_id = pr.sede_id)', '(pr.sede_id is null or i.sede_id = pr.sede_id) and app.puedo_sede(i.sede_id)');
select pg_temp.parchar('public.passt_hallazgos(uuid)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.ver'')', 'not app.puedo_ver_programa(pr.empresa_id, pr.sede_id)');
select pg_temp.parchar('public.passt_hallazgos(uuid)'::regprocedure,
  '(pr.sede_id is null or h.sede_id = pr.sede_id)', '(pr.sede_id is null or h.sede_id = pr.sede_id) and app.puedo_sede(h.sede_id)');
-- N.º de trabajadores en modo automático: solo las personas de mis sedes (el administrador general, todas). En modo manual es el número de la empresa.
select pg_temp.parchar('public.numero_trabajadores(uuid)'::regprocedure,
  'v.empresa_id = e.id and v.estado = ''activo'')',
  'v.empresa_id = e.id and v.estado = ''activo'' and (app.soy_general() or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and app.puedo_sede(vs.sede_id))))');

create or replace function public.passt_responsables(p_empresa uuid) returns table (persona_id uuid, apellidos_nombres text, rol text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.apellidos_nombres, v.rol
  from public.vinculos v join public.personas p on p.id = v.persona_id
  where v.empresa_id = p_empresa and v.estado = 'activo' and v.rol in ('admin_empresa', 'admin_sede', 'gestor')
    and app.puedo_en_empresa(p_empresa, 'passt.ver')
    and (v.rol = 'admin_empresa' or app.soy_general()
         or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and app.puedo_sede(vs.sede_id)))
  order by p.apellidos_nombres;
$$;

create or replace function public.personas_de_mi_empresa() returns table (persona_id uuid, apellidos_nombres text, puesto text, area text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.apellidos_nombres, v.puesto, v.area
  from public.vinculos v
  join public.personas p on p.id = v.persona_id
  where v.empresa_id = app.mi_empresa()
    and v.estado = 'activo'
    and app.tengo_permiso('personas.ver_nombres')
    and (v.rol = 'admin_empresa' or app.soy_general()
         or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and app.puedo_sede(vs.sede_id)))
  order by p.apellidos_nombres;
$$;

create or replace function public.uso_almacenamiento(p_empresa uuid) returns table (usado bigint, tope bigint, foto_max integer)
language sql stable security definer set search_path = '' as $$
  select
    (select coalesce(sum(a.bytes), 0) from public.archivos a join public.inspecciones i on i.id = a.inspeccion_id
      where a.empresa_id = p_empresa and (app.soy_general() or app.puedo_sede(i.sede_id)))
      + (select coalesce(sum(f.imagen_bytes), 0) from public.firmas f join public.inspecciones i on i.id = f.inspeccion_id
      where f.empresa_id = p_empresa and (app.soy_general() or app.puedo_sede(i.sede_id))),
    l.espacio_max_bytes, l.foto_max_bytes
  from public.empresas e left join public.limites_plan l on l.plan = e.plan
  where e.id = p_empresa and (app.es_dueno_plataforma() or e.id = app.mi_empresa());
$$;

-- ───── 4. PASST: programa de una sede y programa general ─────
select pg_temp.parchar('app.passt_para_cambiar(uuid, text)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.editar'')', 'not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.editar'')');
select pg_temp.parchar('app.passt_para_cambiar(uuid, text)'::regprocedure,
  'if not app.puedo_en_empresa(pr.empresa_id, ''passt.reprogramar'') then', 'if not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.reprogramar'') then');
select pg_temp.parchar('public.guardar_nodo(uuid, uuid, jsonb)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.reprogramar'')', 'not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.reprogramar'')');
select pg_temp.parchar('public.guardar_nodo(uuid, uuid, jsonb)'::regprocedure,
  'rol in (''admin_empresa'', ''gestor'')', 'rol in (''admin_empresa'', ''admin_sede'', ''gestor'')');
select pg_temp.parchar('public.programar_semana(uuid, integer, boolean, text)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.reprogramar'')', 'not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.reprogramar'')');
select pg_temp.parchar('public.aprobar_programa(uuid)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.aprobar'')', 'not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.aprobar'')');
select pg_temp.parchar('public.cambiar_vigencia_programa(uuid, boolean)'::regprocedure,
  'not app.puedo_en_empresa(pr.empresa_id, ''passt.aprobar'')', 'not app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.aprobar'')');
select pg_temp.parchar('public.crear_programa(uuid, jsonb)'::regprocedure,
  'not app.puedo_en_empresa(p_empresa, ''passt.editar'')', 'not app.puedo_programa(p_empresa, v_sede, ''passt.editar'')');
select pg_temp.parchar('public.duplicar_programa(uuid, jsonb)'::regprocedure,
  'not app.puedo_en_empresa(o.empresa_id, ''passt.editar'')', 'not app.puedo_programa(o.empresa_id, o.sede_id, ''passt.editar'') or not app.puedo_programa(o.empresa_id, nullif(p_datos ->> ''sede_id'', '''')::uuid, ''passt.editar'')');
select pg_temp.parchar('public.marcar_semana(uuid, integer, boolean, text, text, integer)'::regprocedure,
  'app.puedo_en_empresa(pr.empresa_id, ''passt.marcar_manual'')', 'app.puedo_programa(pr.empresa_id, pr.sede_id, ''passt.marcar_manual'')');
select pg_temp.parchar('public.marcar_semana(uuid, integer, boolean, text, text, integer)'::regprocedure,
  'and app.tengo_permiso(''passt.ver'')))', 'and app.tengo_permiso(''passt.ver'') and app.puedo_ver_programa(pr.empresa_id, pr.sede_id)))');

-- ───── 5. Cuentas por sede ─────
select pg_temp.parchar('public.cesar_vinculo(uuid, date, text)'::regprocedure,
  'not app.puedo_gestionar(v.empresa_id, v.rol, ''cuentas.cesar'')', 'not app.puedo_gestionar_vinculo(v.id, ''cuentas.cesar'')');
select pg_temp.parchar('public.reactivar_vinculo(uuid)'::regprocedure,
  'not app.puedo_gestionar(v.empresa_id, v.rol, ''cuentas.cesar'')', 'not app.puedo_gestionar_vinculo(v.id, ''cuentas.cesar'')');
select pg_temp.parchar('public.confirmar_sigue(uuid)'::regprocedure,
  'not app.puedo_gestionar(v.empresa_id, v.rol, ''personas.editar'')', 'not app.puedo_gestionar_vinculo(v.id, ''personas.editar'')');
select pg_temp.parchar('public.actualizar_persona(uuid, jsonb)'::regprocedure,
  'not app.puedo_gestionar(v.empresa_id, v.rol, ''personas.editar'')', 'not app.puedo_gestionar_vinculo(v.id, ''personas.editar'')');

-- Carga de personal: toda la carga va a las sedes elegidas (que deben ser del que carga); nadie toca cuentas con sedes fuera de las suyas.
create or replace function public.grabar_carga(p_empresa uuid, p_por uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  x jsonb;
  v public.vinculos;
  v_id uuid;
  v_rol text;
  v_fila text;
  v_marcadas integer := 0;
  v_nv uuid;
  v_sedes uuid[];
begin
  -- Actúa como quien hace la carga (permisos y historial).
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);

  if not app.puedo_gestionar(p_empresa, 'usuario', 'cuentas.crear') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- Sedes de la carga: las elegidas, o la única sede de la empresa, o la única sede de quien carga.
  v_sedes := coalesce(array(select jsonb_array_elements_text(coalesce(p_datos -> 'sedes', '[]'))::uuid), '{}');
  if cardinality(v_sedes) = 0 then
    if app.empresa_con_una_sede(p_empresa) then v_sedes := array[(select id from public.sedes where empresa_id = p_empresa and activa)];
    else v_sedes := coalesce(array(select vs.sede_id from public.vinculos_sedes vs where vs.vinculo_id = (app.mi_vinculo_activo()).id), '{}'); end if;
  end if;
  if cardinality(v_sedes) = 0 then
    raise exception 'Elige la sede de esta carga' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_sedes) s where not exists (select 1 from public.sedes where id = s and empresa_id = p_empresa and activa) or not app.puedo_sede(s)) then
    raise exception 'La sede de la carga no es una de tus sedes' using errcode = '42501';
  end if;

  insert into public.cargas_personal (empresa_id, hecha_por, filas, nuevas, altas, actualizadas, reactivadas, sin_cambios, lista_completa)
  values (
    p_empresa, p_por, (p_datos ->> 'filas')::integer,
    jsonb_array_length(coalesce(p_datos -> 'nuevas', '[]')),
    jsonb_array_length(coalesce(p_datos -> 'altas', '[]')),
    jsonb_array_length(coalesce(p_datos -> 'actualizar', '[]')),
    jsonb_array_length(coalesce(p_datos -> 'reactivar', '[]')),
    coalesce((p_datos ->> 'sin_cambios')::integer, 0),
    coalesce((p_datos ->> 'lista_completa')::boolean, false)
  )
  returning id into v_id;

  -- Cuentas nuevas: la persona y su vínculo (con las sedes de la carga)
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'nuevas', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    if v_rol not in ('gestor', 'usuario') or not app.puedo_gestionar(p_empresa, v_rol, 'cuentas.crear') then
      raise exception 'Fila %: rol no permitido', v_fila using errcode = '22023';
    end if;
    insert into public.personas (id, tipo_documento, numero_documento, apellidos_nombres, creado_por, clave_con_candado)
    values ((x ->> 'persona_id')::uuid, x ->> 'tipo', x ->> 'numero', x ->> 'nombres', p_por, true);
    insert into public.vinculos (persona_id, empresa_id, rol, fecha_ingreso, puesto_id, unidad_id, creado_por)
    values ((x ->> 'persona_id')::uuid, p_empresa, v_rol, (x ->> 'fecha')::date,
            nullif(x ->> 'puesto_id', '')::uuid, nullif(x ->> 'unidad_id', '')::uuid, p_por)
    returning id into v_nv;
    insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id) select v_nv, s, p_empresa from unnest(v_sedes) s;
  end loop;

  -- Ya tenían cuenta en CRC (cesadas en otra empresa): solo el vínculo nuevo; conservan su contraseña.
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'altas', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    if v_rol not in ('gestor', 'usuario') or not app.puedo_gestionar(p_empresa, v_rol, 'cuentas.crear') then
      raise exception 'Fila %: rol no permitido', v_fila using errcode = '22023';
    end if;
    if exists (select 1 from public.vinculos where persona_id = (x ->> 'persona_id')::uuid and estado = 'activo') then
      raise exception 'Fila %: esta persona ya tiene una cuenta activa en otra empresa', v_fila using errcode = '22023';
    end if;
    insert into public.vinculos (persona_id, empresa_id, rol, fecha_ingreso, puesto_id, unidad_id, creado_por)
    values ((x ->> 'persona_id')::uuid, p_empresa, v_rol, (x ->> 'fecha')::date,
            nullif(x ->> 'puesto_id', '')::uuid, nullif(x ->> 'unidad_id', '')::uuid, p_por)
    returning id into v_nv;
    insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id) select v_nv, s, p_empresa from unnest(v_sedes) s;
  end loop;

  -- Ya están en la empresa: se actualizan nombre, fecha de ingreso, puesto, unidad y rol. Nunca administradores. Solo cuentas con todas sus sedes dentro de las mías.
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'actualizar', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    select * into v from public.vinculos where id = (x ->> 'vinculo_id')::uuid for update;
    if v.id is null or v.empresa_id <> p_empresa or v.estado <> 'activo' or v.rol in ('admin_empresa', 'admin_sede')
       or v.persona_id = p_por or v_rol not in ('gestor', 'usuario')
       or not app.puedo_gestionar_vinculo(v.id, 'personas.editar')
       or not app.puedo_gestionar(p_empresa, v_rol, 'personas.editar') then
      raise exception 'Fila %: no se puede actualizar a esta persona', v_fila using errcode = '22023';
    end if;
    update public.personas set apellidos_nombres = x ->> 'nombres' where id = v.persona_id;
    update public.vinculos set
      rol = v_rol,
      fecha_ingreso = (x ->> 'fecha')::date,
      puesto_id = nullif(x ->> 'puesto_id', '')::uuid,
      unidad_id = nullif(x ->> 'unidad_id', '')::uuid
    where id = v.id;
    insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id) select v.id, s, p_empresa from unnest(v_sedes) s on conflict do nothing;
  end loop;

  -- Estaban cesadas en esta empresa y se marcaron para reactivar. Conservan su contraseña. Nunca administradores.
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'reactivar', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    select * into v from public.vinculos where id = (x ->> 'vinculo_id')::uuid for update;
    if v.id is null or v.empresa_id <> p_empresa or v.estado <> 'cesado' or v.rol in ('admin_empresa', 'admin_sede')
       or v_rol not in ('gestor', 'usuario')
       or not app.puedo_gestionar(p_empresa, v_rol, 'cuentas.crear') then
      raise exception 'Fila %: no se puede reactivar a esta persona', v_fila using errcode = '22023';
    end if;
    if exists (select 1 from public.vinculos where persona_id = v.persona_id and estado = 'activo') then
      raise exception 'Fila %: esta persona ya tiene una cuenta activa en otra empresa', v_fila using errcode = '22023';
    end if;
    insert into public.vinculos_sedes (vinculo_id, sede_id, empresa_id) select v.id, s, p_empresa from unnest(v_sedes) s on conflict do nothing;
    update public.vinculos set
      estado = 'activo', fecha_cese = null, motivo_cese = null,
      rol = v_rol,
      fecha_ingreso = (x ->> 'fecha')::date,
      puesto_id = nullif(x ->> 'puesto_id', '')::uuid,
      unidad_id = nullif(x ->> 'unidad_id', '')::uuid
    where id = v.id;
  end loop;

  -- Quien aparece en el Excel ya no está «por revisar».
  update public.vinculos set por_revisar_desde = null, por_revisar_carga = null
  where empresa_id = p_empresa and por_revisar_desde is not null
    and id in (select (jsonb_array_elements_text(coalesce(p_datos -> 'presentes', '[]')))::uuid);

  -- Lista completa: quien no aparece queda «por revisar» (conserva la fecha si ya lo estaba). Nadie se cesa. Solo personas de las sedes de la carga.
  if coalesce((p_datos ->> 'lista_completa')::boolean, false) then
    update public.vinculos set
      por_revisar_desde = coalesce(por_revisar_desde, now()),
      por_revisar_carga = v_id
    where empresa_id = p_empresa and estado = 'activo' and rol in ('gestor', 'usuario') and persona_id <> p_por
      and app.puedo_gestionar_vinculo(id, 'personas.editar')
      and exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = vinculos.id and vs.sede_id = any (v_sedes))
      and id in (select (jsonb_array_elements_text(coalesce(p_datos -> 'por_revisar', '[]')))::uuid);
    get diagnostics v_marcadas = row_count;
    update public.cargas_personal set por_revisar = v_marcadas where id = v_id;
  end if;

  return v_id;
end $$;

-- ───── 6. Guardia de sede en las tablas con sede (además de la revisión de cada función) ─────
-- Quien no es administrador general solo cambia filas de SUS sedes. El responsable de un plan de acción puede trabajar el suyo aunque sea de otra sede.
-- Una inspección de un activo debe tener la sede de ese activo (para todos). La sede de una inspección nunca se toma del equipo sin revisarla: debe ser una de las sedes de la cuenta.
create function app.guardia_sede() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_vin public.vinculos;
  j jsonb;
  v_sede uuid;
begin
  if tg_table_name = 'inspecciones' and tg_op = 'INSERT' and (to_jsonb(new) ->> 'activo_id') is not null
     and not exists (select 1 from public.activos a where a.id = (to_jsonb(new) ->> 'activo_id')::uuid and a.sede_id = (to_jsonb(new) ->> 'sede_id')::uuid) then
    raise exception 'El activo no es de la sede de la inspección' using errcode = '22023';
  end if;
  if v_uid is null or app.es_dueno_plataforma() then return coalesce(new, old); end if;
  v_vin := app.mi_vinculo_activo();
  if v_vin.id is null or v_vin.rol = 'admin_empresa' then return coalesce(new, old); end if;
  if tg_table_name = 'hallazgos' and tg_op = 'UPDATE' and (to_jsonb(old) ->> 'responsable_id')::uuid = v_uid then return new; end if;
  for j in select x from (select case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end as x
                          union all select case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end) t where x is not null loop
    v_sede := nullif(j ->> 'sede_id', '')::uuid;
    if tg_table_name = 'passt_programas' then v_sede := app.sede_efectiva((j ->> 'empresa_id')::uuid, v_sede); end if;
    if v_sede is null or not app.puedo_sede(v_sede) then
      raise exception '%', case when tg_table_name = 'inspecciones' then 'Ya no tienes acceso a esa sede: la inspección no se puede recibir' else 'No autorizado' end
        using errcode = '42501';
    end if;
  end loop;
  return coalesce(new, old);
end $$;
create trigger activos_guardia_sede before insert or update or delete on public.activos for each row execute function app.guardia_sede();
create trigger ubicaciones_guardia_sede before insert or update or delete on public.ubicaciones for each row execute function app.guardia_sede();
create trigger hallazgos_guardia_sede before insert or update or delete on public.hallazgos for each row execute function app.guardia_sede();
create trigger inspecciones_guardia_sede before insert or update or delete on public.inspecciones for each row execute function app.guardia_sede();
create trigger passt_programas_guardia_sede before insert or update or delete on public.passt_programas for each row execute function app.guardia_sede();
