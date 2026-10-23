-- Carga de personal desde Excel (tarea 3.6, paso 5): grabado todo o nada y registro de cada carga.
-- La función del servidor «carga-personal» revisa otra vez todas las filas, crea las cuentas nuevas
-- y luego llama a grabar_carga, que graba personas y vínculos en UNA sola transacción:
-- si una fila falla, no se graba ninguna (y la función borra las cuentas que había creado).

-- ───────────────────────── Registro de cargas ─────────────────────────
-- Quién cargó, cuándo y cuántas personas. Nunca guarda contraseñas, nombres de las filas ni el archivo.
create table public.cargas_personal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  hecha_por uuid not null references public.personas (id),
  hecha_en timestamptz not null default now(),
  filas integer not null check (filas between 1 and 300),
  nuevas integer not null default 0,        -- cuentas nuevas (recibieron contraseña inicial)
  altas integer not null default 0,         -- ya tenían cuenta en CRC: se dieron de alta en esta empresa
  actualizadas integer not null default 0,
  reactivadas integer not null default 0,
  sin_cambios integer not null default 0,
  lista_completa boolean not null default false
);

create index cargas_personal_empresa_idx on public.cargas_personal (empresa_id, hecha_en desc);

alter table public.cargas_personal enable row level security;
revoke all on public.cargas_personal from anon, authenticated;
grant select on public.cargas_personal to authenticated;

create policy "Ver las cargas de mi empresa" on public.cargas_personal for select to authenticated
using (
  (select app.es_dueno_plataforma())
  or ((select app.tengo_permiso('cuentas.crear')) and empresa_id = (select app.mi_empresa()))
);

-- ───────────────────────── Grabado todo o nada ─────────────────────────
-- Solo la llama la función del servidor (service_role), después de revisar las filas y de crear las cuentas nuevas.
-- p_por es quien hace la carga: se usa como «quien llama» para que los permisos y el historial lo registren a él.
-- p_datos: { filas, sin_cambios, lista_completa,
--            nuevas:     [{fila, persona_id, tipo, numero, nombres, fecha, rol, puesto_id, unidad_id}],
--            altas:      [{fila, persona_id, fecha, rol, puesto_id, unidad_id}],
--            actualizar: [{fila, vinculo_id, nombres, fecha, rol, puesto_id, unidad_id}],
--            reactivar:  [{fila, vinculo_id, fecha, rol, puesto_id, unidad_id}] }
create function public.grabar_carga(p_empresa uuid, p_por uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  x jsonb;
  v public.vinculos;
  v_id uuid;
  v_rol text;
  v_fila text;
begin
  -- Actúa como quien hace la carga (permisos y historial).
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);

  if not app.puedo_gestionar(p_empresa, 'usuario', 'cuentas.crear') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

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
  return v_id;
end $$;

revoke all on function public.grabar_carga(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.grabar_carga(uuid, uuid, jsonb) to service_role;
