-- Cargo de cada firmante, escrito a mano al llenar la inspección (pedido del dueño, 29/10/2026): ya no se toma el puesto
-- con el que la persona está vinculada. Columna nueva en «firmas»; no toca personas, empresas, roles ni permisos.
alter table public.firmas add column cargo text check (cargo is null or length(cargo) between 1 and 120);
comment on column public.firmas.cargo is 'Cargo del firmante escrito a mano en la inspección (sale en el Excel y el PDF).';

create or replace function public.grabar_inspeccion(p_por uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_datos ->> 'id')::uuid;
  v_empresa uuid;
  v_vinculo public.vinculos;
  pv public.plantillas_versiones;
  pl public.plantillas;
  a public.activos;
  x jsonb;
  i public.inspecciones;
  v_numero integer;
  v_avisos jsonb := coalesce(p_datos -> 'avisos', '[]'::jsonb);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);

  -- Reenvío de una inspección que ya llegó: no se graba dos veces.
  select * into i from public.inspecciones where id = v_id;
  if i.id is not null then
    if i.inspector_id <> p_por then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    return jsonb_build_object('estado', 'ya_recibida', 'id', i.id, 'numero', i.numero);
  end if;

  -- La persona debe seguir activa en su empresa (una cuenta cesada no sube datos, D-27).
  v_vinculo := app.mi_vinculo_activo();
  if v_vinculo.id is null then
    raise exception 'Tu cuenta está inhabilitada: la inspección no se puede recibir' using errcode = '42501';
  end if;
  v_empresa := v_vinculo.empresa_id;
  if not app.tengo_permiso('inspecciones.registrar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into pv from public.plantillas_versiones where id = (p_datos ->> 'version_id')::uuid;
  select * into pl from public.plantillas where id = pv.plantilla_id;
  if pv.id is null or pl.id <> (p_datos ->> 'plantilla_id')::uuid or pl.empresa_id is distinct from v_empresa then
    raise exception 'El formato no es de tu empresa' using errcode = '22023';
  end if;
  if pv.estado = 'borrador' then
    raise exception 'Solo se inspecciona con una versión publicada' using errcode = '22023';
  end if;
  if pv.estado = 'retirada' then
    v_avisos := v_avisos || '["version_anterior"]'::jsonb; -- se llenó sin señal antes de que se publicara otra (caso c)
  end if;

  if not exists (select 1 from public.sedes where id = (p_datos ->> 'sede_id')::uuid and empresa_id = v_empresa) then
    raise exception 'La sede no es de tu empresa' using errcode = '22023';
  end if;
  if nullif(p_datos ->> 'unidad_id', '') is not null
     and not exists (select 1 from public.unidades where id = (p_datos ->> 'unidad_id')::uuid and empresa_id = v_empresa) then
    raise exception 'El área no es de tu empresa' using errcode = '22023';
  end if;
  if nullif(p_datos ->> 'ubicacion_id', '') is not null
     and not exists (select 1 from public.ubicaciones where id = (p_datos ->> 'ubicacion_id')::uuid and empresa_id = v_empresa) then
    raise exception 'La ubicación no es de tu empresa' using errcode = '22023';
  end if;
  if pl.aplica_a = 'activo' then
    select * into a from public.activos where id = nullif(p_datos ->> 'activo_id', '')::uuid;
    if a.id is null or a.empresa_id <> v_empresa or a.tipo_id <> pl.tipo_activo_id then
      raise exception 'El activo no corresponde a este formato' using errcode = '22023';
    end if;
    if a.estado = 'baja' then
      v_avisos := v_avisos || '["activo_de_baja"]'::jsonb; -- se dio de baja mientras tanto (caso d)
    end if;
  elsif nullif(p_datos ->> 'activo_id', '') is not null then
    raise exception 'Este formato se aplica a un área, no a un activo' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('inspecciones:' || v_empresa::text));
  select coalesce(max(numero), 0) + 1 into v_numero from public.inspecciones where empresa_id = v_empresa;

  insert into public.inspecciones (id, empresa_id, numero, plantilla_id, version_id, sede_id, unidad_id, ubicacion_id, activo_id,
    activo_foto, respuestas, filas, observacion, resultado, puntaje, hallazgos, vencidos, avisos, fecha, iniciada_en_equipo,
    cerrada_en_equipo, inspector_id, dispositivo, huella)
  values (v_id, v_empresa, v_numero, pl.id, pv.id, (p_datos ->> 'sede_id')::uuid, nullif(p_datos ->> 'unidad_id', '')::uuid,
    nullif(p_datos ->> 'ubicacion_id', '')::uuid, a.id, p_datos -> 'activo_foto', coalesce(p_datos -> 'respuestas', '{}'::jsonb),
    coalesce(p_datos -> 'filas', '{}'::jsonb), nullif(trim(coalesce(p_datos ->> 'observacion', '')), ''), p_datos ->> 'resultado',
    (p_datos ->> 'puntaje')::integer, coalesce(p_datos -> 'hallazgos', '[]'::jsonb), coalesce(p_datos -> 'vencidos', '[]'::jsonb),
    v_avisos, (p_datos ->> 'fecha')::date, (p_datos ->> 'iniciada_en_equipo')::timestamptz, (p_datos ->> 'cerrada_en_equipo')::timestamptz,
    p_por, left(p_datos ->> 'dispositivo', 200), 'pendiente');

  -- Fotos: deben estar en la carpeta de esta empresa y de esta inspección.
  for x in select value from jsonb_array_elements(coalesce(p_datos -> 'archivos', '[]'::jsonb)) loop
    if x ->> 'ruta' <> v_empresa::text || '/' || v_id::text || '/' || (x ->> 'id') || '.' || split_part(x ->> 'ruta', '.', 2) then
      raise exception 'Una foto no está en la carpeta de la inspección' using errcode = '22023';
    end if;
    insert into public.archivos (id, empresa_id, inspeccion_id, punto_clave, fila, ruta, bytes, tipo_mime, sha256, subido_por)
    values ((x ->> 'id')::uuid, v_empresa, v_id, x ->> 'punto_clave', (x ->> 'fila')::integer, x ->> 'ruta', (x ->> 'bytes')::integer,
            x ->> 'tipo_mime', x ->> 'sha256', p_por);
  end loop;

  select * into i from public.inspecciones where id = v_id;
  update public.inspecciones set huella = app.huella_inspeccion(i) where id = v_id returning * into i;

  -- Firmantes designados. Los de CRC deben estar activos en la empresa; los externos firman en papel.
  for x in select value from jsonb_array_elements(coalesce(p_datos -> 'firmantes', '[]'::jsonb)) loop
    if nullif(x ->> 'persona_id', '') is not null then
      if not exists (select 1 from public.vinculos where persona_id = (x ->> 'persona_id')::uuid and empresa_id = v_empresa and estado = 'activo') then
        raise exception 'Un firmante no es una persona activa de tu empresa' using errcode = '22023';
      end if;
      insert into public.firmas (empresa_id, inspeccion_id, rol_clave, rol_titulo, orden, persona_id, cargo)
      values (v_empresa, v_id, x ->> 'rol_clave', left(x ->> 'rol_titulo', 120), coalesce((x ->> 'orden')::integer, 1), (x ->> 'persona_id')::uuid,
              left(app.texto(x, 'cargo'), 120));
    else
      insert into public.firmas (empresa_id, inspeccion_id, rol_clave, rol_titulo, orden, externo_nombre, externo_documento, cargo, estado)
      values (v_empresa, v_id, x ->> 'rol_clave', left(x ->> 'rol_titulo', 120), coalesce((x ->> 'orden')::integer, 1),
              app.texto(x, 'externo_nombre'), app.texto(x, 'externo_documento'), left(app.texto(x, 'cargo'), 120), 'en_papel');
    end if;
  end loop;

  -- La firma de quien registra, hecha en su equipo con su cuenta.
  x := p_datos -> 'mi_firma';
  if jsonb_typeof(x) = 'object' then
    if x ->> 'ruta' <> v_empresa::text || '/' || v_id::text || '/firma-' || p_por::text || '-' || (x ->> 'rol_clave') || '.png' then
      raise exception 'La firma no está en la carpeta de la inspección' using errcode = '22023';
    end if;
    update public.firmas set estado = 'firmada', imagen_ruta = x ->> 'ruta', imagen_bytes = (x ->> 'bytes')::integer,
      firmado_en = coalesce((x ->> 'firmado_en')::timestamptz, now()), firmado_por = p_por, huella = i.huella, edicion = i.edicion
    where inspeccion_id = v_id and persona_id = p_por and rol_clave = x ->> 'rol_clave' and estado = 'pendiente';
    if not found then
      raise exception 'Tu firma no corresponde a ningún firmante designado' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object('estado', 'grabada', 'id', v_id, 'numero', v_numero, 'huella', i.huella);
end $$;
