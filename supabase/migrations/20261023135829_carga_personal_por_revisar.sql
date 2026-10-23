-- Carga de personal desde Excel (tarea 3.6, paso 6): personas «por revisar».
-- Si quien carga marca «este Excel es la lista completa del personal activo», los gestores y usuarios activos
-- que no aparecen quedan «por revisar». Nadie se cesa solo: el administrador confirma el cese o que sigue.
-- Los administradores nunca quedan «por revisar».

-- ───────────────────────── Marca en el vínculo ─────────────────────────
alter table public.vinculos
  add column por_revisar_desde timestamptz,
  add column por_revisar_carga uuid references public.cargas_personal (id);

-- vinculos se lee por columnas (permiso por columna desde la 3.1): se agregan las nuevas.
grant select (por_revisar_desde, por_revisar_carga) on public.vinculos to authenticated;

alter table public.cargas_personal add column por_revisar integer not null default 0;

-- Al cesar (o al dejar de estar activo por cualquier vía), la marca se quita sola.
create function app.limpiar_por_revisar() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado <> 'activo' then
    new.por_revisar_desde := null;
    new.por_revisar_carga := null;
  end if;
  return new;
end $$;

create trigger vinculos_limpiar_por_revisar before update on public.vinculos
for each row execute function app.limpiar_por_revisar();

revoke all on function app.limpiar_por_revisar() from public, anon, authenticated;

-- ───────────────────────── «Sigue en la empresa» ─────────────────────────
-- Quita la marca. Lo puede hacer quien puede corregir los datos de esa persona (administrador de su empresa o dueño).
create function public.confirmar_sigue(p_vinculo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.vinculos;
begin
  select * into v from public.vinculos where id = p_vinculo for update;
  if v.id is null or v.persona_id = (select auth.uid())
     or not app.puedo_gestionar(v.empresa_id, v.rol, 'personas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.por_revisar_desde is null then
    raise exception 'Esta persona no está por revisar' using errcode = '22023';
  end if;
  update public.vinculos set por_revisar_desde = null, por_revisar_carga = null where id = p_vinculo;
end $$;

revoke all on function public.confirmar_sigue(uuid) from public, anon;
grant execute on function public.confirmar_sigue(uuid) to authenticated;

-- ───────────────────────── Grabado todo o nada (versión del paso 6) ─────────────────────────
-- Igual que en el paso 5, más:
--   presentes:   vínculos de personas que SÍ están en el Excel → se les quita la marca «por revisar».
--   por_revisar: vínculos que no aparecen; solo se marcan si lista_completa es verdadero.
--                Solo gestores y usuarios activos de esa empresa; nunca administradores ni quien carga.
create or replace function public.grabar_carga(p_empresa uuid, p_por uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  x jsonb;
  v public.vinculos;
  v_id uuid;
  v_rol text;
  v_fila text;
  v_marcadas integer := 0;
begin
  -- Actúa como quien hace la carga (permisos y historial).
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);

  if not app.puedo_gestionar(p_empresa, 'usuario', 'cuentas.crear') then
    raise exception 'No autorizado' using errcode = '42501';
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

  -- Cuentas nuevas: la persona y su vínculo
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
            nullif(x ->> 'puesto_id', '')::uuid, nullif(x ->> 'unidad_id', '')::uuid, p_por);
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
            nullif(x ->> 'puesto_id', '')::uuid, nullif(x ->> 'unidad_id', '')::uuid, p_por);
  end loop;

  -- Ya están en la empresa: se actualizan nombre, fecha de ingreso, puesto, unidad y rol. Nunca administradores.
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'actualizar', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    select * into v from public.vinculos where id = (x ->> 'vinculo_id')::uuid for update;
    if v.id is null or v.empresa_id <> p_empresa or v.estado <> 'activo' or v.rol = 'admin_empresa'
       or v.persona_id = p_por or v_rol not in ('gestor', 'usuario')
       or not app.puedo_gestionar(p_empresa, v.rol, 'personas.editar')
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
  end loop;

  -- Estaban cesadas en esta empresa y se marcaron para reactivar. Conservan su contraseña. Nunca administradores.
  for x in select * from jsonb_array_elements(coalesce(p_datos -> 'reactivar', '[]')) loop
    v_fila := x ->> 'fila';
    v_rol := x ->> 'rol';
    select * into v from public.vinculos where id = (x ->> 'vinculo_id')::uuid for update;
    if v.id is null or v.empresa_id <> p_empresa or v.estado <> 'cesado' or v.rol = 'admin_empresa'
       or v_rol not in ('gestor', 'usuario')
       or not app.puedo_gestionar(p_empresa, v_rol, 'cuentas.crear') then
      raise exception 'Fila %: no se puede reactivar a esta persona', v_fila using errcode = '22023';
    end if;
    if exists (select 1 from public.vinculos where persona_id = v.persona_id and estado = 'activo') then
      raise exception 'Fila %: esta persona ya tiene una cuenta activa en otra empresa', v_fila using errcode = '22023';
    end if;
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

  -- Lista completa: quien no aparece queda «por revisar» (conserva la fecha si ya lo estaba). Nadie se cesa.
  if coalesce((p_datos ->> 'lista_completa')::boolean, false) then
    update public.vinculos set
      por_revisar_desde = coalesce(por_revisar_desde, now()),
      por_revisar_carga = v_id
    where empresa_id = p_empresa and estado = 'activo' and rol in ('gestor', 'usuario') and persona_id <> p_por
      and app.puedo_gestionar(p_empresa, rol, 'personas.editar')
      and id in (select (jsonb_array_elements_text(coalesce(p_datos -> 'por_revisar', '[]')))::uuid);
    get diagnostics v_marcadas = row_count;
    update public.cargas_personal set por_revisar = v_marcadas where id = v_id;
  end if;

  return v_id;
end $$;
