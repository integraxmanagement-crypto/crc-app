-- Tarea 3.2 · Registro de empresas: ficha completa, sedes, contactos, catálogo CIIU y logos.
-- Misma regla que la 3.1: todo con RLS; desde la app solo se lee; los cambios pasan por acciones que revisan permisos.
-- Decisiones del dueño (22/10/2026): el administrador solo edita contactos y logos (1A); ubicación en texto libre (2A);
-- empresa suspendida = nadie de ella ingresa (3A, ya lo hace el portero); logos PNG/JPG/WebP ≤ 1 MB (4A);
-- RUC con prefijo y dígito verificador (5A). Este archivo no contiene datos de prueba.

-- ───────────────────────── RUC ─────────────────────────
-- Formato SUNAT: 11 dígitos, prefijo 10/15/16/17/20 y dígito verificador (módulo 11, pesos 5,4,3,2,7,6,5,4,3,2).
create function app.ruc_valido(p_ruc text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  suma int := 0;
  digito int;
begin
  if p_ruc is null or p_ruc !~ '^(10|15|16|17|20)[0-9]{9}$' then
    return false;
  end if;
  for i in 1..10 loop
    suma := suma + substr(p_ruc, i, 1)::int * pesos[i];
  end loop;
  digito := 11 - (suma % 11);
  if digito = 10 then digito := 0; elsif digito = 11 then digito := 1; end if;
  return digito = substr(p_ruc, 11, 1)::int;
end $$;

-- ───────────────────────── Catálogo CIIU ─────────────────────────
create table public.catalogo_ciiu (
  codigo text primary key check (codigo ~ '^[0-9]{4,5}$'),
  descripcion text not null,
  seccion text,                 -- letra de la sección (A, B, C…), si la fuente la trae
  version text not null,        -- p. ej. "CIIU Rev. 4"
  fuente text not null,         -- de dónde se cargó
  fecha_fuente date not null,   -- fecha que indica la fuente
  busqueda text not null        -- código + descripción en minúsculas y sin tildes, para buscar por palabras
);
comment on table public.catalogo_ciiu is 'Lista oficial de actividades económicas (CIIU) con versión, fuente y fecha. Solo lectura.';
create index catalogo_ciiu_busqueda_idx on public.catalogo_ciiu (busqueda);

-- ───────────────────────── Ficha de la empresa ─────────────────────────
alter table public.empresas drop constraint empresas_estado_check;
update public.empresas set estado = 'suspendida' where estado = 'inactiva';
alter table public.empresas
  add constraint empresas_estado_check check (estado in ('activa', 'suspendida')),
  add constraint empresas_ruc_valido check (app.ruc_valido(ruc)),
  add column nombre_comercial text check (nombre_comercial is null or length(trim(nombre_comercial)) between 2 and 200),
  add column domicilio_direccion text check (domicilio_direccion is null or length(trim(domicilio_direccion)) between 3 and 250),
  add column domicilio_distrito text check (domicilio_distrito is null or length(trim(domicilio_distrito)) between 2 and 100),
  add column domicilio_provincia text check (domicilio_provincia is null or length(trim(domicilio_provincia)) between 2 and 100),
  add column domicilio_departamento text check (domicilio_departamento is null or length(trim(domicilio_departamento)) between 2 and 100),
  add column ciiu_codigo text references public.catalogo_ciiu (codigo),
  add column actividad_texto text check (actividad_texto is null or length(trim(actividad_texto)) between 3 and 300),
  add column plan text not null default 'gratuito' check (plan in ('gratuito', 'pago')),
  add column logo_positivo text,
  add column logo_negativo text,
  add column es_prueba boolean not null default false,
  add column actualizado_en timestamptz not null default now(),
  add column actualizado_por uuid references auth.users (id);
-- Toda empresa de prueba lleva "Ficticia" en la razón social, para no confundirla nunca con una real.
alter table public.empresas
  add constraint empresas_prueba_marcada check (not es_prueba or razon_social ilike '%ficticia%');
comment on column public.empresas.actividad_texto is 'Texto de la actividad que se imprime en los encabezados de registros y formatos. Se edita sin cambiar el CIIU.';
comment on column public.empresas.es_prueba is 'true = empresa ficticia de prueba (solo en crc-dev). Nunca se mezcla con datos reales.';
create index empresas_ciiu_idx on public.empresas (ciiu_codigo);

-- ───────────────────────── Sedes ─────────────────────────
create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  nombre text not null check (length(trim(nombre)) between 2 and 120),
  direccion text not null check (length(trim(direccion)) between 3 and 250),
  distrito text not null check (length(trim(distrito)) between 2 and 100),
  provincia text not null check (length(trim(provincia)) between 2 and 100),
  departamento text not null check (length(trim(departamento)) between 2 and 100),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now()
);
comment on table public.sedes is 'Sedes de cada empresa (al menos una activa). No se borran: se desactivan.';
create index sedes_empresa_idx on public.sedes (empresa_id);
create unique index sedes_nombre_unico on public.sedes (empresa_id, lower(trim(nombre)));

-- ───────────────────────── Contactos (datos personales) ─────────────────────────
create table public.empresas_contactos (
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  tipo text not null check (tipo in ('representante_legal', 'administrador', 'respaldo')),
  nombre text not null check (length(trim(nombre)) between 3 and 200),
  telefono text not null check (telefono ~ '^\+?[0-9]{6,15}$'),
  correo text not null check (correo ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' and length(correo) <= 200),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id),
  primary key (empresa_id, tipo)
);
comment on table public.empresas_contactos is 'Representante legal, administrador de contacto y respaldo (opcional). Datos personales: solo los ve el administrador de la empresa y el dueño.';

-- ───────────────────────── Permisos nuevos ─────────────────────────
insert into public.permisos (codigo, descripcion) values
  ('empresa.ver_contactos', 'Ver los contactos de su empresa (datos personales).'),
  ('empresa.editar_contactos', 'Editar los contactos de su empresa.'),
  ('empresa.editar_logos', 'Subir o cambiar los logos de su empresa.');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'empresa.ver_contactos'),
  ('admin_empresa', 'empresa.editar_contactos'),
  ('admin_empresa', 'empresa.editar_logos');

-- ───────────────────────── Acceso y RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['catalogo_ciiu', 'sedes', 'empresas_contactos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy "Catálogo visible con sesión" on public.catalogo_ciiu for select to authenticated using (true);

create policy "Ver sedes de mi empresa" on public.sedes for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

create policy "Ver contactos permitidos" on public.empresas_contactos for select to authenticated
using (
  (select app.es_dueno_plataforma())
  or ((select app.tengo_permiso('empresa.ver_contactos')) and empresa_id = (select app.mi_empresa()))
);

-- ───────────────────────── Acciones (solo por aquí se escribe) ─────────────────────────

create function app.texto(d jsonb, k text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(trim(d ->> k), '\s+', ' ', 'g'), '');
$$;

create function app.exigir_dueno() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.es_dueno_plataforma() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

create function app.validar_ficha(d jsonb) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not app.ruc_valido(app.texto(d, 'ruc')) then
    raise exception 'El RUC no es válido: revisa los 11 dígitos' using errcode = '22023';
  end if;
  if app.texto(d, 'razon_social') is null or app.texto(d, 'domicilio_direccion') is null
     or app.texto(d, 'domicilio_distrito') is null or app.texto(d, 'domicilio_provincia') is null
     or app.texto(d, 'domicilio_departamento') is null or app.texto(d, 'ciiu_codigo') is null
     or app.texto(d, 'actividad_texto') is null then
    raise exception 'Faltan datos de la ficha: razón social, domicilio legal completo, CIIU y texto de la actividad' using errcode = '22023';
  end if;
  if not exists (select 1 from public.catalogo_ciiu where codigo = app.texto(d, 'ciiu_codigo')) then
    raise exception 'El código CIIU no está en el catálogo oficial' using errcode = '22023';
  end if;
end $$;

-- Crea la empresa con su primera sede. Solo el dueño de la plataforma.
create function public.crear_empresa(p_ficha jsonb, p_sede jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app.exigir_dueno();
  perform app.validar_ficha(p_ficha);
  if exists (select 1 from public.empresas where ruc = app.texto(p_ficha, 'ruc')) then
    raise exception 'Ya existe una empresa con ese RUC' using errcode = '23505';
  end if;
  insert into public.empresas (ruc, razon_social, nombre_comercial, domicilio_direccion, domicilio_distrito,
    domicilio_provincia, domicilio_departamento, ciiu_codigo, actividad_texto, plan, es_prueba, creado_por, actualizado_por)
  values (app.texto(p_ficha, 'ruc'), app.texto(p_ficha, 'razon_social'), app.texto(p_ficha, 'nombre_comercial'),
    app.texto(p_ficha, 'domicilio_direccion'), upper(app.texto(p_ficha, 'domicilio_distrito')),
    upper(app.texto(p_ficha, 'domicilio_provincia')), upper(app.texto(p_ficha, 'domicilio_departamento')),
    app.texto(p_ficha, 'ciiu_codigo'), app.texto(p_ficha, 'actividad_texto'),
    coalesce(app.texto(p_ficha, 'plan'), 'gratuito'), coalesce((p_ficha ->> 'es_prueba')::boolean, false),
    (select auth.uid()), (select auth.uid()))
  returning id into v_id;
  perform public.guardar_sede(v_id, null, p_sede);
  return v_id;
end $$;

-- Edita la ficha (no el estado). Solo el dueño.
create function public.actualizar_empresa(p_empresa uuid, p_ficha jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_dueno();
  perform app.validar_ficha(p_ficha);
  if exists (select 1 from public.empresas where ruc = app.texto(p_ficha, 'ruc') and id <> p_empresa) then
    raise exception 'Ya existe otra empresa con ese RUC' using errcode = '23505';
  end if;
  update public.empresas set
    ruc = app.texto(p_ficha, 'ruc'), razon_social = app.texto(p_ficha, 'razon_social'),
    nombre_comercial = app.texto(p_ficha, 'nombre_comercial'),
    domicilio_direccion = app.texto(p_ficha, 'domicilio_direccion'),
    domicilio_distrito = upper(app.texto(p_ficha, 'domicilio_distrito')),
    domicilio_provincia = upper(app.texto(p_ficha, 'domicilio_provincia')),
    domicilio_departamento = upper(app.texto(p_ficha, 'domicilio_departamento')),
    ciiu_codigo = app.texto(p_ficha, 'ciiu_codigo'), actividad_texto = app.texto(p_ficha, 'actividad_texto'),
    plan = coalesce(app.texto(p_ficha, 'plan'), plan),
    es_prueba = coalesce((p_ficha ->> 'es_prueba')::boolean, es_prueba),
    actualizado_en = now(), actualizado_por = (select auth.uid())
  where id = p_empresa;
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
end $$;

-- Activa o suspende. Al suspender se cierran todas las sesiones de su gente (el portero ya no los deja volver).
create function public.cambiar_estado_empresa(p_empresa uuid, p_estado text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_dueno();
  if p_estado not in ('activa', 'suspendida') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  update public.empresas set estado = p_estado, actualizado_en = now(), actualizado_por = (select auth.uid())
  where id = p_empresa;
  if not found then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_estado = 'suspendida' then
    delete from auth.sessions where user_id in (
      select persona_id from public.vinculos where empresa_id = p_empresa and estado = 'activo');
  end if;
end $$;

-- Crea (p_sede null) o edita una sede. Solo el dueño.
create function public.guardar_sede(p_empresa uuid, p_sede uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app.exigir_dueno();
  if app.texto(p_datos, 'nombre') is null or app.texto(p_datos, 'direccion') is null or app.texto(p_datos, 'distrito') is null
     or app.texto(p_datos, 'provincia') is null or app.texto(p_datos, 'departamento') is null then
    raise exception 'Faltan datos de la sede: nombre, dirección, distrito, provincia y departamento' using errcode = '22023';
  end if;
  if p_sede is null then
    insert into public.sedes (empresa_id, nombre, direccion, distrito, provincia, departamento, creado_por)
    values (p_empresa, app.texto(p_datos, 'nombre'), app.texto(p_datos, 'direccion'), upper(app.texto(p_datos, 'distrito')),
      upper(app.texto(p_datos, 'provincia')), upper(app.texto(p_datos, 'departamento')), (select auth.uid()))
    returning id into v_id;
  else
    update public.sedes set nombre = app.texto(p_datos, 'nombre'), direccion = app.texto(p_datos, 'direccion'),
      distrito = upper(app.texto(p_datos, 'distrito')), provincia = upper(app.texto(p_datos, 'provincia')),
      departamento = upper(app.texto(p_datos, 'departamento')), actualizado_en = now()
    where id = p_sede and empresa_id = p_empresa
    returning id into v_id;
    if v_id is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay una sede con ese nombre en esta empresa' using errcode = '23505';
end $$;

-- Activa o desactiva una sede. No se puede dejar a la empresa sin sedes activas.
create function public.cambiar_estado_sede(p_sede uuid, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid;
begin
  perform app.exigir_dueno();
  select empresa_id into v_empresa from public.sedes where id = p_sede for update;
  if v_empresa is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not p_activa and (select count(*) from public.sedes where empresa_id = v_empresa and activa and id <> p_sede) = 0 then
    raise exception 'La empresa debe tener al menos una sede activa' using errcode = '22023';
  end if;
  update public.sedes set activa = p_activa, actualizado_en = now() where id = p_sede;
end $$;

-- Guarda los contactos. El dueño, o el administrador de ESA empresa.
-- p_datos: { representante_legal: {nombre, telefono, correo}, administrador: {...}, respaldo: {...} | null }
create function public.guardar_contactos(p_empresa uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text;
  c jsonb;
begin
  if not (app.es_dueno_plataforma()
          or (app.tengo_permiso('empresa.editar_contactos') and p_empresa = app.mi_empresa())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  foreach v_tipo in array array['representante_legal', 'administrador', 'respaldo'] loop
    c := p_datos -> v_tipo;
    if c is null or jsonb_typeof(c) <> 'object' or app.texto(c, 'nombre') is null then
      if v_tipo = 'respaldo' then
        delete from public.empresas_contactos where empresa_id = p_empresa and tipo = 'respaldo';
        continue;
      end if;
      raise exception 'Faltan los datos del contacto: %', replace(v_tipo, '_', ' ') using errcode = '22023';
    end if;
    insert into public.empresas_contactos (empresa_id, tipo, nombre, telefono, correo, actualizado_por)
    values (p_empresa, v_tipo, app.texto(c, 'nombre'),
      regexp_replace(coalesce(c ->> 'telefono', ''), '[\s()-]', '', 'g'), lower(app.texto(c, 'correo')), (select auth.uid()))
    on conflict (empresa_id, tipo) do update set nombre = excluded.nombre, telefono = excluded.telefono,
      correo = excluded.correo, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
  end loop;
exception when check_violation then
  raise exception 'Revisa los contactos: nombre (mín. 3 letras), teléfono (6 a 15 números) y correo' using errcode = '22023';
end $$;

-- Anota (o quita) el logo ya subido al almacén. El dueño, o el administrador de ESA empresa.
create function public.registrar_logo(p_empresa uuid, p_tipo text, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.es_dueno_plataforma()
          or (app.tengo_permiso('empresa.editar_logos') and p_empresa = app.mi_empresa())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('positivo', 'negativo') then
    raise exception 'Tipo de logo no válido' using errcode = '22023';
  end if;
  if p_ruta is not null and p_ruta !~ ('^' || p_empresa::text || '/' || p_tipo || '\.(png|jpg|webp)$') then
    raise exception 'Ruta de logo no válida' using errcode = '22023';
  end if;
  if p_tipo = 'positivo' and p_ruta is null then
    raise exception 'El logo positivo no se puede quitar, solo reemplazar' using errcode = '22023';
  end if;
  if p_tipo = 'positivo' then
    update public.empresas set logo_positivo = p_ruta, actualizado_en = now(), actualizado_por = (select auth.uid()) where id = p_empresa;
  else
    update public.empresas set logo_negativo = p_ruta, actualizado_en = now(), actualizado_por = (select auth.uid()) where id = p_empresa;
  end if;
end $$;

revoke all on function app.ruc_valido(text), app.texto(jsonb, text), app.exigir_dueno(), app.validar_ficha(jsonb) from public, anon;
grant execute on function app.ruc_valido(text), app.texto(jsonb, text), app.exigir_dueno(), app.validar_ficha(jsonb) to authenticated;

revoke all on function public.crear_empresa(jsonb, jsonb), public.actualizar_empresa(uuid, jsonb),
  public.cambiar_estado_empresa(uuid, text), public.guardar_sede(uuid, uuid, jsonb), public.cambiar_estado_sede(uuid, boolean),
  public.guardar_contactos(uuid, jsonb), public.registrar_logo(uuid, text, text) from public, anon;
grant execute on function public.crear_empresa(jsonb, jsonb), public.actualizar_empresa(uuid, jsonb),
  public.cambiar_estado_empresa(uuid, text), public.guardar_sede(uuid, uuid, jsonb), public.cambiar_estado_sede(uuid, boolean),
  public.guardar_contactos(uuid, jsonb), public.registrar_logo(uuid, text, text) to authenticated;

-- ───────────────────────── Almacén de logos (privado) ─────────────────────────
-- Ruta obligatoria: <id de la empresa>/positivo.png | negativo.webp …  Máximo 1 MB; solo PNG, JPG y WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

create function app.ruta_logo_valida(p_nombre text) returns boolean
language sql immutable set search_path = '' as $$
  select p_nombre ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(positivo|negativo)\.(png|jpg|webp)$';
$$;

create function app.puedo_editar_logo(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.ruta_logo_valida(p_nombre) and (
    app.es_dueno_plataforma()
    or (app.tengo_permiso('empresa.editar_logos') and split_part(p_nombre, '/', 1) = app.mi_empresa()::text)
  );
$$;

create function app.puedo_ver_logo(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.es_dueno_plataforma() or split_part(p_nombre, '/', 1) = app.mi_empresa()::text;
$$;

revoke all on function app.ruta_logo_valida(text), app.puedo_editar_logo(text), app.puedo_ver_logo(text) from public, anon;
grant execute on function app.ruta_logo_valida(text), app.puedo_editar_logo(text), app.puedo_ver_logo(text) to authenticated;

create policy "Logos: ver los de mi empresa" on storage.objects for select to authenticated
using (bucket_id = 'logos' and app.puedo_ver_logo(name));
create policy "Logos: subir los de mi empresa" on storage.objects for insert to authenticated
with check (bucket_id = 'logos' and app.puedo_editar_logo(name));
create policy "Logos: reemplazar los de mi empresa" on storage.objects for update to authenticated
using (bucket_id = 'logos' and app.puedo_editar_logo(name))
with check (bucket_id = 'logos' and app.puedo_editar_logo(name));
create policy "Logos: borrar los de mi empresa" on storage.objects for delete to authenticated
using (bucket_id = 'logos' and app.puedo_editar_logo(name));
