-- Tarea 3.4-C · Inspecciones, fotos, firmas y Excel de cada organización.
-- Diseño aprobado (D-37) y decisiones del dueño del 26/10/2026: firma de nivel 1 desde la cuenta de cada firmante
-- (los externos firman en papel); la inspección cuenta como hecha al cerrarla el inspector; la ven el administrador
-- y el gestor (y cada firmante, la suya); los borradores viven solo en el equipo; cada organización sube su Excel.
-- Misma regla de siempre: RLS en todo, la app solo LEE y escribe por acciones que revisan permisos. La inspección
-- la graba la función del servidor «registrar-inspeccion», que vuelve a calcular el resultado con el motor de reglas.

-- ───────────────────────── Permisos nuevos (filas, no código) ─────────────────────────
insert into public.permisos (codigo, descripcion) values
  ('inspecciones.registrar', 'Registrar inspecciones en su empresa.'),
  ('inspecciones.ver', 'Ver todas las inspecciones de su empresa, con sus fotos y firmas.'),
  ('inspecciones.editar_cerrada', 'Corregir una inspección ya cerrada (con motivo; queda el historial).'),
  ('inspecciones.anular', 'Anular una inspección (con motivo; no se borra).');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'inspecciones.registrar'),
  ('admin_empresa', 'inspecciones.ver'),
  ('admin_empresa', 'inspecciones.editar_cerrada'),
  ('admin_empresa', 'inspecciones.anular'),
  ('gestor', 'inspecciones.registrar'),
  ('gestor', 'inspecciones.ver');

-- ───────────────────────── Límites por plan (valores aprobados por el dueño, 26/10/2026) ─────────────────────────
create table public.limites_plan (
  plan text primary key check (plan in ('gratuito', 'pago')),
  foto_max_bytes integer check (foto_max_bytes is null or foto_max_bytes > 0),
  espacio_max_bytes bigint check (espacio_max_bytes is null or espacio_max_bytes > 0) -- vacío = sin tope
);
comment on table public.limites_plan is 'Peso máximo por foto y espacio total por empresa, según su plan. Se cambian con una fila, sin programar.';
insert into public.limites_plan (plan, foto_max_bytes, espacio_max_bytes) values
  ('gratuito', 1048576, 262144000),
  ('pago', 1048576, 5368709120);

-- ───────────────────────── Inspecciones ─────────────────────────
create table public.inspecciones (
  id uuid primary key, -- lo crea el equipo (así una misma inspección nunca se graba dos veces)
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  numero integer not null, -- correlativo por empresa
  plantilla_id uuid not null references public.plantillas (id) on delete restrict,
  version_id uuid not null references public.plantillas_versiones (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  unidad_id uuid references public.unidades (id) on delete restrict,
  ubicacion_id uuid references public.ubicaciones (id) on delete restrict,
  activo_id uuid references public.activos (id) on delete restrict,
  activo_foto jsonb, -- datos del activo con que se hizo (código, subtipo, ficha, dotación)
  respuestas jsonb not null default '{}'::jsonb,
  filas jsonb not null default '{}'::jsonb,
  observacion text check (observacion is null or length(observacion) <= 4000),
  resultado text,
  puntaje integer check (puntaje is null or puntaje between 0 and 100),
  hallazgos jsonb not null default '[]'::jsonb, -- calculados por el servidor; la 3.4-D los convierte en seguimiento
  vencidos jsonb not null default '[]'::jsonb,
  avisos jsonb not null default '[]'::jsonb, -- p. ej. versión anterior, hora del equipo dudosa, activo cambiado
  fecha date not null,
  iniciada_en_equipo timestamptz,
  cerrada_en_equipo timestamptz not null,
  recibida_en timestamptz not null default now(),
  inspector_id uuid not null references public.personas (id) on delete restrict, -- la cuenta que la registró
  dispositivo text check (dispositivo is null or length(dispositivo) <= 200),
  estado text not null default 'cerrada' check (estado in ('cerrada', 'anulada')),
  motivo_anulacion text,
  anulada_por uuid references public.personas (id),
  anulada_en timestamptz,
  edicion integer not null default 1,
  huella text not null, -- SHA-256 del contenido (cambia si se corrige)
  constraint inspecciones_anulacion check ((estado = 'anulada') = (motivo_anulacion is not null))
);
comment on table public.inspecciones is 'Inspecciones cerradas. No se borran: se anulan con motivo. Cada corrección deja una copia en inspecciones_ediciones.';
create unique index inspecciones_numero_unico on public.inspecciones (empresa_id, numero);
create index inspecciones_empresa_idx on public.inspecciones (empresa_id, recibida_en desc);
create index inspecciones_activo_idx on public.inspecciones (activo_id);
create index inspecciones_plantilla_idx on public.inspecciones (plantilla_id);

create table public.inspecciones_ediciones (
  id bigint generated always as identity primary key,
  inspeccion_id uuid not null references public.inspecciones (id) on delete restrict,
  empresa_id uuid not null,
  edicion integer not null, -- la edición que se reemplazó
  antes jsonb not null, -- copia completa de cómo estaba
  motivo text not null check (length(motivo) between 3 and 500),
  hecho_por uuid not null,
  hecho_en timestamptz not null default now()
);
comment on table public.inspecciones_ediciones is 'Cada corrección de una inspección cerrada: cómo estaba, quién, cuándo y por qué. Nadie la edita.';
create index inspecciones_ediciones_idx on public.inspecciones_ediciones (inspeccion_id);

-- ───────────────────────── Fotos ─────────────────────────
create table public.archivos (
  id uuid primary key, -- lo crea el equipo
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  inspeccion_id uuid not null references public.inspecciones (id) on delete restrict,
  punto_clave text not null,
  fila integer, -- en un bloque repetible
  ruta text not null unique,
  bytes integer not null check (bytes between 1 and 10485760),
  tipo_mime text not null check (tipo_mime in ('image/jpeg', 'image/webp', 'image/png')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  subido_por uuid not null,
  creado_en timestamptz not null default now()
);
comment on table public.archivos is 'Fotos de las inspecciones. El archivo está en el almacén privado «evidencias»; aquí, su ficha y su huella.';
create index archivos_inspeccion_idx on public.archivos (inspeccion_id);
create index archivos_empresa_idx on public.archivos (empresa_id);

-- ───────────────────────── Firmas (nivel 1, D-32) ─────────────────────────
create table public.firmas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  inspeccion_id uuid not null references public.inspecciones (id) on delete restrict,
  rol_clave text not null, -- la firma de la receta (inspector, responsable_area…)
  rol_titulo text not null,
  orden integer not null default 1,
  persona_id uuid references public.personas (id) on delete restrict, -- firmante de CRC (firma desde su cuenta)
  externo_nombre text check (externo_nombre is null or length(externo_nombre) between 3 and 200),
  externo_documento text check (externo_documento is null or length(externo_documento) between 4 and 20),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'firmada', 'en_papel')),
  imagen_ruta text,
  imagen_bytes integer,
  firmado_en timestamptz,
  firmado_por uuid references public.personas (id), -- la cuenta con la que se firmó
  huella text, -- huella del contenido de la inspección en el momento de firmar
  edicion integer, -- la edición de la inspección que se firmó
  constraint firmas_quien check ((persona_id is null) <> (externo_nombre is null)),
  constraint firmas_externo_en_papel check (externo_nombre is null or estado = 'en_papel'),
  constraint firmas_completa check (estado <> 'firmada' or (imagen_ruta is not null and firmado_en is not null and firmado_por is not null and huella is not null))
);
comment on table public.firmas is 'Firmantes de cada inspección. Los de CRC firman desde su propia cuenta; los externos firman en papel. Firma simple con registro de quién, cuándo y sobre qué contenido.';
create index firmas_inspeccion_idx on public.firmas (inspeccion_id);
create index firmas_persona_idx on public.firmas (persona_id) where estado = 'pendiente';

-- ───────────────────────── Excel de cada organización ─────────────────────────
create table public.plantillas_excel (
  plantilla_id uuid primary key references public.plantillas (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  ruta text not null,
  nombre_archivo text not null check (length(nombre_archivo) between 1 and 200),
  bytes integer not null check (bytes between 1 and 1048576),
  marcas jsonb not null default '[]'::jsonb, -- marcas {{…}} encontradas en el archivo
  subido_por uuid not null,
  subido_en timestamptz not null default now()
);
comment on table public.plantillas_excel is 'Formato Excel de la organización para un formato de inspección: CRC llena una copia por inspección poniendo los datos donde están las marcas {{…}}.';

-- ───────────────────────── Funciones de apoyo ─────────────────────────

-- ¿Esta persona es (o fue) firmante de la inspección?
create function app.soy_firmante(p_inspeccion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.firmas where inspeccion_id = p_inspeccion and persona_id = (select auth.uid()));
$$;

create function app.puedo_ver_inspeccion(p_inspeccion uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.inspecciones i where i.id = p_inspeccion and (
      app.es_dueno_plataforma()
      or (i.empresa_id = app.mi_empresa() and (app.tengo_permiso('inspecciones.ver') or app.soy_firmante(i.id)))
    ));
$$;

-- Huella del contenido de una inspección (lo que se firma). jsonb guarda las claves en orden fijo.
create function app.huella_inspeccion(i public.inspecciones) returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'id', i.id, 'version', i.version_id, 'sede', i.sede_id, 'unidad', i.unidad_id, 'ubicacion', i.ubicacion_id,
    'activo', i.activo_id, 'activo_foto', i.activo_foto, 'respuestas', i.respuestas, 'filas', i.filas,
    'observacion', i.observacion, 'fecha', i.fecha, 'resultado', i.resultado, 'puntaje', i.puntaje,
    'archivos', (select coalesce(jsonb_agg(a.sha256 order by a.ruta), '[]'::jsonb) from public.archivos a where a.inspeccion_id = i.id)
  )::text, 'UTF8'), 'sha256'), 'hex');
$$;

-- Espacio usado por una empresa (fotos y firmas) y su tope según el plan.
create function public.uso_almacenamiento(p_empresa uuid)
returns table (usado bigint, tope bigint, foto_max integer)
language sql stable security definer set search_path = '' as $$
  select
    (select coalesce(sum(bytes), 0) from public.archivos where empresa_id = p_empresa)
      + (select coalesce(sum(imagen_bytes), 0) from public.firmas where empresa_id = p_empresa),
    l.espacio_max_bytes, l.foto_max_bytes
  from public.empresas e left join public.limites_plan l on l.plan = e.plan
  where e.id = p_empresa and (app.es_dueno_plataforma() or e.id = app.mi_empresa());
$$;

-- ───────────────────────── Grabar una inspección (solo la usa la función del servidor) ─────────────────────────
-- La función «registrar-inspeccion» revisa la sesión, vuelve a calcular resultado, puntaje y hallazgos con el motor
-- de reglas y llama aquí con la cuenta de quien registra (p_por). Todo o nada. Si la inspección ya existe
-- (el equipo la reenvió), no se graba de nuevo: responde «ya_recibida».
-- p_datos: { id, plantilla_id, version_id, sede_id, unidad_id, ubicacion_id, activo_id, activo_foto, respuestas, filas,
--            observacion, fecha, iniciada_en_equipo, cerrada_en_equipo, dispositivo, resultado, puntaje, hallazgos,
--            vencidos, avisos, archivos: [{id, punto_clave, fila, ruta, bytes, tipo_mime, sha256}],
--            firmantes: [{rol_clave, rol_titulo, orden, persona_id | externo_nombre + externo_documento}],
--            mi_firma: {rol_clave, orden, ruta, bytes} | null }
create function public.grabar_inspeccion(p_por uuid, p_datos jsonb) returns jsonb
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
      insert into public.firmas (empresa_id, inspeccion_id, rol_clave, rol_titulo, orden, persona_id)
      values (v_empresa, v_id, x ->> 'rol_clave', left(x ->> 'rol_titulo', 120), coalesce((x ->> 'orden')::integer, 1), (x ->> 'persona_id')::uuid);
    else
      insert into public.firmas (empresa_id, inspeccion_id, rol_clave, rol_titulo, orden, externo_nombre, externo_documento, estado)
      values (v_empresa, v_id, x ->> 'rol_clave', left(x ->> 'rol_titulo', 120), coalesce((x ->> 'orden')::integer, 1),
              app.texto(x, 'externo_nombre'), app.texto(x, 'externo_documento'), 'en_papel');
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

-- Corregir una inspección cerrada (solo con señal, decisión b): guarda cómo estaba y reemplaza las respuestas.
-- También la llama solo la función del servidor, que recalcula el resultado.
create function public.corregir_inspeccion(p_por uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.inspecciones;
  v_motivo text := app.texto(p_datos, 'motivo');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);
  select * into i from public.inspecciones where id = (p_datos ->> 'id')::uuid for update;
  if i.id is null or i.empresa_id <> app.mi_empresa() or not app.tengo_permiso('inspecciones.editar_cerrada') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if i.estado <> 'cerrada' then
    raise exception 'Una inspección anulada no se corrige' using errcode = '22023';
  end if;
  if (p_datos ->> 'edicion')::integer is distinct from i.edicion then
    raise exception 'Alguien la cambió antes: vuelve a abrirla' using errcode = '40001';
  end if;
  if v_motivo is null or length(v_motivo) < 3 then
    raise exception 'Escribe el motivo de la corrección' using errcode = '22023';
  end if;
  insert into public.inspecciones_ediciones (inspeccion_id, empresa_id, edicion, antes, motivo, hecho_por)
  values (i.id, i.empresa_id, i.edicion, to_jsonb(i), v_motivo, p_por);
  update public.inspecciones set respuestas = coalesce(p_datos -> 'respuestas', '{}'::jsonb), filas = coalesce(p_datos -> 'filas', '{}'::jsonb),
    observacion = nullif(trim(coalesce(p_datos ->> 'observacion', '')), ''), resultado = p_datos ->> 'resultado',
    puntaje = (p_datos ->> 'puntaje')::integer, hallazgos = coalesce(p_datos -> 'hallazgos', '[]'::jsonb),
    vencidos = coalesce(p_datos -> 'vencidos', '[]'::jsonb), edicion = i.edicion + 1
  where id = i.id returning * into i;
  update public.inspecciones set huella = app.huella_inspeccion(i) where id = i.id returning * into i;
  return jsonb_build_object('estado', 'corregida', 'edicion', i.edicion, 'huella', i.huella);
end $$;

-- Anular (no se borra nada).
create function public.anular_inspeccion(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.inspecciones;
begin
  select * into i from public.inspecciones where id = p_id for update;
  if i.id is null or not app.puedo_en_empresa(i.empresa_id, 'inspecciones.anular') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if i.estado = 'anulada' then
    raise exception 'Ya está anulada' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escribe el motivo de la anulación' using errcode = '22023';
  end if;
  update public.inspecciones set estado = 'anulada', motivo_anulacion = trim(p_motivo), anulada_por = (select auth.uid()), anulada_en = now()
  where id = p_id;
end $$;

-- Firmar desde la propia cuenta una firma pendiente (la imagen ya está en el almacén).
create function public.firmar_inspeccion(p_firma uuid, p_ruta text, p_bytes integer) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.firmas; i public.inspecciones;
begin
  select * into f from public.firmas where id = p_firma for update;
  if f.id is null or f.persona_id is distinct from (select auth.uid()) or (app.mi_vinculo_activo()).empresa_id is distinct from f.empresa_id then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if f.estado <> 'pendiente' then
    raise exception 'Esta firma ya no está pendiente' using errcode = '22023';
  end if;
  select * into i from public.inspecciones where id = f.inspeccion_id;
  if i.estado <> 'cerrada' then
    raise exception 'La inspección está anulada' using errcode = '22023';
  end if;
  if p_ruta <> f.empresa_id::text || '/' || f.inspeccion_id::text || '/firma-' || f.persona_id::text || '-' || f.rol_clave || '.png'
     or p_bytes is null or p_bytes not between 1 and 1048576 then
    raise exception 'La firma no está en la carpeta de la inspección' using errcode = '22023';
  end if;
  update public.firmas set estado = 'firmada', imagen_ruta = p_ruta, imagen_bytes = p_bytes, firmado_en = now(),
    firmado_por = (select auth.uid()), huella = i.huella, edicion = i.edicion
  where id = p_firma;
end $$;

-- Firma hecha a mano en la hoja impresa (decisión del dueño: se puede descargar sin firmas para firmar en papel).
-- La marca quien registró la inspección o un administrador.
create function public.marcar_firma_en_papel(p_firma uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.firmas; i public.inspecciones;
begin
  select * into f from public.firmas where id = p_firma for update;
  select * into i from public.inspecciones where id = f.inspeccion_id;
  if f.id is null or not (i.inspector_id = (select auth.uid()) and i.empresa_id = app.mi_empresa()
                          or app.puedo_en_empresa(i.empresa_id, 'inspecciones.editar_cerrada')) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if f.estado <> 'pendiente' then
    raise exception 'Esta firma ya no está pendiente' using errcode = '22023';
  end if;
  update public.firmas set estado = 'en_papel' where id = p_firma;
end $$;

-- Excel de la organización: se registra después de subir el archivo al almacén «formatos-excel».
create function public.registrar_excel(p_plantilla uuid, p_ruta text, p_nombre text, p_bytes integer, p_marcas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.plantillas;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or pl.empresa_id is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_ruta !~ ('^' || pl.empresa_id::text || '/' || pl.id::text || '-[0-9]+\.xlsx$') or jsonb_typeof(p_marcas) <> 'array' then
    raise exception 'Archivo no válido' using errcode = '22023';
  end if;
  insert into public.plantillas_excel (plantilla_id, empresa_id, ruta, nombre_archivo, bytes, marcas, subido_por)
  values (pl.id, pl.empresa_id, p_ruta, left(p_nombre, 200), p_bytes, p_marcas, (select auth.uid()))
  on conflict (plantilla_id) do update set ruta = excluded.ruta, nombre_archivo = excluded.nombre_archivo, bytes = excluded.bytes,
    marcas = excluded.marcas, subido_por = excluded.subido_por, subido_en = now();
end $$;

create function public.quitar_excel(p_plantilla uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.plantillas;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or pl.empresa_id is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  delete from public.plantillas_excel where plantilla_id = p_plantilla;
end $$;

-- ───────────────────────── Permisos de acceso y reglas RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['limites_plan', 'inspecciones', 'inspecciones_ediciones', 'archivos', 'firmas', 'plantillas_excel'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy "Límites visibles con sesión" on public.limites_plan for select to authenticated using (true);
create policy "Ver inspecciones permitidas" on public.inspecciones for select to authenticated
using ((select app.es_dueno_plataforma())
       or (empresa_id = (select app.mi_empresa()) and ((select app.tengo_permiso('inspecciones.ver')) or app.soy_firmante(id))));
create policy "Ver ediciones permitidas" on public.inspecciones_ediciones for select to authenticated
using ((select app.es_dueno_plataforma()) or (empresa_id = (select app.mi_empresa()) and (select app.tengo_permiso('inspecciones.ver'))));
create policy "Ver fotos permitidas" on public.archivos for select to authenticated
using (app.puedo_ver_inspeccion(inspeccion_id));
create policy "Ver firmas permitidas" on public.firmas for select to authenticated
using (app.puedo_ver_inspeccion(inspeccion_id));
create policy "Ver Excel de mi empresa" on public.plantillas_excel for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

-- ───────────────────────── Almacenes privados ─────────────────────────
-- evidencias: <empresa>/<inspección>/<foto>.jpg y <empresa>/<inspección>/firma-<persona>-<rol>.png · máximo 1 MB por archivo.
-- formatos-excel: <empresa>/<plantilla>-<marca de tiempo>.xlsx · máximo 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidencias', 'evidencias', false, 1048576, array['image/jpeg', 'image/webp', 'image/png']),
  ('formatos-excel', 'formatos-excel', false, 1048576, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

-- Puede subir una foto o su propia firma: quien registra inspecciones en esa empresa (la inspección todavía no existe:
-- se graba después de subir los archivos), o el firmante designado, para su firma pendiente.
create function app.puedo_subir_evidencia(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(([0-9a-f-]{36}\.(jpg|webp|png))|(firma-[0-9a-f-]{36}-[a-z0-9_-]{1,30}\.png))$'
    and split_part(p_nombre, '/', 1) = app.mi_empresa()::text
    and (
      (app.tengo_permiso('inspecciones.registrar')
        and not exists (select 1 from public.inspecciones where id::text = split_part(p_nombre, '/', 2)))
      or exists (
        select 1 from public.firmas f
        where f.inspeccion_id::text = split_part(p_nombre, '/', 2) and f.persona_id = (select auth.uid()) and f.estado = 'pendiente'
          and split_part(p_nombre, '/', 3) = 'firma-' || f.persona_id::text || '-' || f.rol_clave || '.png')
    );
$$;

-- Ve los archivos de una inspección quien puede ver la inspección. Mientras se sincroniza (la inspección
-- todavía no existe), quien los subió puede comprobar que llegaron.
create function app.puedo_ver_evidencia(p_nombre text, p_dueno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.puedo_ver_inspeccion(nullif(split_part(p_nombre, '/', 2), '')::uuid)
      or (p_dueno = (select auth.uid()) and split_part(p_nombre, '/', 1) = app.mi_empresa()::text);
$$;

create function app.puedo_excel(p_nombre text, p_editar boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[0-9]+\.xlsx$' and (
    app.es_dueno_plataforma()
    or (split_part(p_nombre, '/', 1) = app.mi_empresa()::text
        and (not p_editar or app.tengo_permiso('plantillas.editar'))));
$$;

create policy "Evidencias: subir" on storage.objects for insert to authenticated
with check (bucket_id = 'evidencias' and app.puedo_subir_evidencia(name));
create policy "Evidencias: ver" on storage.objects for select to authenticated
using (bucket_id = 'evidencias' and app.puedo_ver_evidencia(name, owner));
create policy "Excel: ver" on storage.objects for select to authenticated
using (bucket_id = 'formatos-excel' and app.puedo_excel(name, false));
create policy "Excel: subir" on storage.objects for insert to authenticated
with check (bucket_id = 'formatos-excel' and app.puedo_excel(name, true));
-- Sin políticas de cambiar ni borrar: una foto o firma subida no se reemplaza.

revoke all on function app.soy_firmante(uuid), app.puedo_ver_inspeccion(uuid), app.huella_inspeccion(public.inspecciones),
  app.puedo_subir_evidencia(text), app.puedo_ver_evidencia(text, uuid), app.puedo_excel(text, boolean) from public, anon;
grant execute on function app.soy_firmante(uuid), app.puedo_ver_inspeccion(uuid), app.puedo_subir_evidencia(text),
  app.puedo_ver_evidencia(text, uuid), app.puedo_excel(text, boolean) to authenticated;
revoke all on function app.huella_inspeccion(public.inspecciones) from authenticated;

-- grabar_inspeccion y corregir_inspeccion: solo la función del servidor (después de recalcular el resultado).
revoke all on function public.grabar_inspeccion(uuid, jsonb), public.corregir_inspeccion(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.grabar_inspeccion(uuid, jsonb), public.corregir_inspeccion(uuid, jsonb) to service_role;

do $$
declare f text;
begin
  foreach f in array array['uso_almacenamiento(uuid)', 'anular_inspeccion(uuid, text)', 'firmar_inspeccion(uuid, text, integer)',
                           'registrar_excel(uuid, text, text, integer, jsonb)', 'quitar_excel(uuid)', 'marcar_firma_en_papel(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
