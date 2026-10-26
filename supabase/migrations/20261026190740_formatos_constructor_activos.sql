-- Tarea 3.4-B · Formatos de inspección: listas, tipos de activo, ubicaciones, activos y plantillas versionadas.
-- Diseño aprobado por el dueño el 26/10/2026 (D-37). Misma regla de siempre: todo con RLS, la app solo LEE y
-- los cambios pasan por acciones que revisan los permisos por dentro. Las filas con empresa vacía son el
-- contenido BASE de CRC (plantillas, tipos y listas que cada empresa copia y adapta): las ven todos con sesión
-- y solo las cambia el dueño de la plataforma. Este archivo no tiene datos; la base va en la migración siguiente.

-- ───────────────────────── Permisos nuevos (filas, no código) ─────────────────────────
insert into public.permisos (codigo, descripcion) values
  ('plantillas.editar', 'Copiar plantillas base y editar los borradores de los formatos de su empresa.'),
  ('plantillas.publicar', 'Publicar una versión de un formato de su empresa (pasa a ser la vigente).'),
  ('activos.editar', 'Dar de alta, editar y dar de baja activos, ubicaciones, tipos de activo y listas de formatos de su empresa.');
insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'plantillas.editar'),
  ('admin_empresa', 'plantillas.publicar'),
  ('admin_empresa', 'activos.editar'),
  ('gestor', 'plantillas.editar'),
  ('gestor', 'activos.editar');

-- ¿Puedo hacer esto en esta empresa? Empresa vacía = contenido base: solo el dueño de la plataforma.
create function app.puedo_en_empresa(p_empresa uuid, p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_empresa is null then app.es_dueno_plataforma()
    else (app.es_dueno_plataforma() and exists (select 1 from public.empresas where id = p_empresa))
      or (app.tengo_permiso(p_permiso) and p_empresa = app.mi_empresa())
  end;
$$;

-- Texto para un código interno a partir de un nombre («Luces de emergencia» → luces_de_emergencia).
create function app.codigo_de(p_texto text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '_' from regexp_replace(lower(translate(coalesce(p_texto, ''),
    'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '_', 'g')), 40);
$$;

create function app.es_texto_vacio(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '');
$$;

-- ───────────────────────── Listas de los formatos ─────────────────────────
create table public.listas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete restrict, -- vacía = lista base de CRC
  codigo text not null check (codigo ~ '^[a-z0-9][a-z0-9_]{1,39}$'),
  nombre text not null check (length(nombre) between 2 and 120),
  base_id uuid references public.listas (id) on delete restrict,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.listas is 'Listas editables de los formatos (agentes extintores, tipos de soporte, tipos de bloqueo…). Empresa vacía = lista base de CRC.';
create unique index listas_codigo_unico on public.listas (coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

create table public.listas_valores (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete restrict, -- copia de la de la lista (para RLS)
  nombre text not null check (length(nombre) between 1 and 120),
  orden integer not null default 0,
  vigente boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index listas_valores_unico on public.listas_valores (lista_id, lower(nombre));
create index listas_valores_lista_idx on public.listas_valores (lista_id);

create trigger listas_valores_limpiar before insert or update on public.listas_valores
for each row execute function app.limpiar_nombre_lista();

-- ───────────────────────── Tipos de activo ─────────────────────────
create table public.tipos_activo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete restrict, -- vacía = tipo base de CRC
  codigo text not null check (codigo ~ '^[a-z0-9][a-z0-9_]{1,39}$'),
  nombre text not null check (length(nombre) between 2 and 120),
  subtipos jsonb not null default '[]'::jsonb check (jsonb_typeof(subtipos) = 'array'),
  campos jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'), -- ficha fija del tipo (decisión del dueño, 26/10)
  dotacion boolean not null default false, -- cada activo guarda sus cantidades esperadas (casetas)
  base_id uuid references public.tipos_activo (id) on delete restrict,
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.tipos_activo is 'Extintor, caseta, bomba, dispositivo de alarma… con sus subtipos y los campos de su ficha. Empresa vacía = tipo base.';
create unique index tipos_activo_codigo_unico on public.tipos_activo (coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

-- ───────────────────────── Ubicaciones (empresa → sede → área → ubicación) ─────────────────────────
create table public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  unidad_id uuid references public.unidades (id) on delete restrict, -- área o subárea (opcional)
  nombre text not null check (length(nombre) between 2 and 120),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.ubicaciones is 'Lugares dentro de una sede (p. ej. «Pasillo 2, junto a la puerta»), opcionalmente de un área de la estructura.';
create unique index ubicaciones_nombre_unico on public.ubicaciones (sede_id, lower(nombre));
create index ubicaciones_empresa_idx on public.ubicaciones (empresa_id);

create trigger ubicaciones_limpiar before insert or update on public.ubicaciones
for each row execute function app.limpiar_nombre_lista();

-- ───────────────────────── Activos ─────────────────────────
create table public.activos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  tipo_id uuid not null references public.tipos_activo (id) on delete restrict,
  numero integer not null, -- correlativo automático por tipo (el «ítem»); nunca se reutiliza
  codigo text not null check (length(codigo) between 1 and 40),
  subtipo text,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  unidad_id uuid references public.unidades (id) on delete restrict,
  ubicacion_id uuid references public.ubicaciones (id) on delete restrict,
  responsable_id uuid references public.personas (id) on delete restrict,
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  dotacion jsonb not null default '{}'::jsonb check (jsonb_typeof(dotacion) = 'object'),
  estado text not null default 'activo' check (estado in ('activo', 'baja')),
  fecha_baja date,
  motivo_baja text,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id),
  constraint activos_baja_completa check (
    (estado = 'activo' and fecha_baja is null and motivo_baja is null)
    or (estado = 'baja' and fecha_baja is not null and length(trim(motivo_baja)) >= 3)
  )
);
comment on table public.activos is 'Catálogo de activos de cada empresa. No se borran: se dan de baja con fecha y motivo.';
create unique index activos_codigo_unico on public.activos (empresa_id, tipo_id, lower(codigo));
create unique index activos_numero_unico on public.activos (empresa_id, tipo_id, numero);
create index activos_sede_idx on public.activos (sede_id);

create table public.activos_historial (
  id bigint generated always as identity primary key,
  activo_id uuid not null references public.activos (id) on delete restrict,
  empresa_id uuid not null,
  accion text not null check (accion in ('alta', 'cambio', 'baja', 'reactivacion')),
  antes jsonb,
  despues jsonb not null,
  hecho_por uuid,
  hecho_en timestamptz not null default now()
);
comment on table public.activos_historial is 'Registro automático de cada alta, cambio, baja y reactivación de un activo. Nadie lo edita.';
create index activos_historial_activo_idx on public.activos_historial (activo_id);

create function app.registrar_historial_activo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_accion text;
begin
  if tg_op = 'INSERT' then v_accion := 'alta';
  elsif old.estado = 'activo' and new.estado = 'baja' then v_accion := 'baja';
  elsif old.estado = 'baja' and new.estado = 'activo' then v_accion := 'reactivacion';
  else v_accion := 'cambio';
  end if;
  insert into public.activos_historial (activo_id, empresa_id, accion, antes, despues, hecho_por)
  values (new.id, new.empresa_id, v_accion, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new),
          coalesce((select auth.uid()), new.creado_por));
  return new;
end $$;
create trigger activos_historial_auto after insert or update on public.activos
for each row execute function app.registrar_historial_activo();

-- ───────────────────────── Plantillas y versiones ─────────────────────────
create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete restrict, -- vacía = plantilla base de CRC
  base_id uuid references public.plantillas (id) on delete restrict, -- de qué plantilla se copió
  codigo text check (codigo is null or codigo ~ '^[a-z0-9][a-z0-9_]{1,39}$'),
  nombre text not null check (length(nombre) between 3 and 160),
  descripcion text check (descripcion is null or length(descripcion) <= 400),
  aplica_a text not null check (aplica_a in ('activo', 'area')),
  tipo_activo_id uuid references public.tipos_activo (id) on delete restrict,
  frecuencia text not null default 'sin_frecuencia' check (frecuencia in ('semanal', 'mensual', 'sin_frecuencia')),
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now(),
  constraint plantillas_tipo_si_activo check ((aplica_a = 'activo') = (tipo_activo_id is not null))
);
comment on table public.plantillas is 'Formatos de inspección. Las de empresa vacía son las 6 plantillas base de CRC; cada empresa las copia y adapta.';
create index plantillas_empresa_idx on public.plantillas (empresa_id);

create table public.plantillas_versiones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.plantillas (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete restrict, -- copia de la de la plantilla (para RLS)
  numero integer not null check (numero >= 1),
  estado text not null default 'borrador' check (estado in ('borrador', 'vigente', 'retirada')),
  codigo_formato text check (codigo_formato is null or length(codigo_formato) between 1 and 40),
  version_formato text check (version_formato is null or length(version_formato) between 1 and 20),
  fecha_aprobacion date,
  logo text not null default 'positivo' check (logo in ('positivo', 'negativo', 'ninguno')),
  receta jsonb not null,
  huella text, -- SHA-256 de la receta al publicar
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id),
  publicado_en timestamptz,
  publicado_por uuid references auth.users (id),
  unique (plantilla_id, numero)
);
comment on table public.plantillas_versiones is 'Versiones de cada formato. Al publicarse quedan congeladas: cada inspección guardará la versión que usó.';
create unique index plantillas_una_vigente on public.plantillas_versiones (plantilla_id) where estado = 'vigente';
create unique index plantillas_un_borrador on public.plantillas_versiones (plantilla_id) where estado = 'borrador';

-- Una versión publicada no se cambia nunca: solo puede pasar de vigente a retirada. Los borradores sí.
create function app.proteger_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.estado <> 'borrador' then
      raise exception 'Una versión publicada no se puede borrar' using errcode = '22023';
    end if;
    return old;
  end if;
  if old.estado = 'borrador' then return new; end if;
  if old.estado = 'vigente' and new.estado = 'retirada'
     and (to_jsonb(new) - 'estado') = (to_jsonb(old) - 'estado') then
    return new;
  end if;
  raise exception 'Una versión publicada no se puede cambiar: abre un borrador nuevo' using errcode = '22023';
end $$;
create trigger plantillas_versiones_proteger before update or delete on public.plantillas_versiones
for each row execute function app.proteger_version();

-- ───────────────────────── Revisión de la receta (igual que validarReceta() de la app) ─────────────────────────
create function app.validar_receta(r jsonb, p_publicar boolean) returns void
language plpgsql immutable set search_path = '' as $$
declare
  s jsonb; pt jsonb; g jsonb; f jsonb; c jsonb;
  v_claves text[] := '{}'; v_secciones text[] := '{}'; v_rep text[] := '{}'; v_fijas text[] := '{}';
  v_sino text[] := '{}'; v_firmas text[] := '{}'; v_total integer := 0;
  v_clave text; v_tipo text; v_evaluable boolean; v_marca text;
begin
  if r is null or jsonb_typeof(r) <> 'object' or r ->> 'version' is distinct from '1'
     or jsonb_typeof(r -> 'secciones') is distinct from 'array' or jsonb_typeof(r -> 'firmas') is distinct from 'array'
     or jsonb_typeof(r -> 'reglas') is distinct from 'array' then
    raise exception 'El formato no tiene la estructura esperada' using errcode = '22023';
  end if;
  if length(r::text) > 200000 then
    raise exception 'El formato es demasiado grande' using errcode = '22023';
  end if;
  foreach v_clave in array array['puntaje', 'na_favorable', 'hallazgo_vencimiento', 'observacion_general'] loop
    if jsonb_typeof(r -> v_clave) is distinct from 'boolean' then
      raise exception 'Falta la opción «%» del formato', v_clave using errcode = '22023';
    end if;
  end loop;
  if not app.es_texto_vacio(r -> 'resultado_defecto')
     and (jsonb_typeof(r -> 'resultado_defecto') <> 'string' or length(trim(r ->> 'resultado_defecto')) not between 2 and 60) then
    raise exception 'El resultado por defecto debe tener entre 2 y 60 letras (o quedar vacío)' using errcode = '22023';
  end if;
  if jsonb_array_length(r -> 'secciones') > 40 then
    raise exception 'Máximo 40 secciones' using errcode = '22023';
  end if;

  for s in select value from jsonb_array_elements(r -> 'secciones') loop
    v_clave := s ->> 'clave';
    if v_clave is null or v_clave !~ '^[a-z0-9][a-z0-9_-]{0,29}$' or v_clave = any(v_secciones) then
      raise exception 'Hay una sección con clave interna repetida o no válida' using errcode = '22023';
    end if;
    v_secciones := v_secciones || v_clave;
    if length(coalesce(s ->> 'titulo', '')) > 120 or (p_publicar and length(trim(coalesce(s ->> 'titulo', ''))) < 2) then
      raise exception 'Revisa el título de la sección (2 a 120 letras)' using errcode = '22023';
    end if;
    if jsonb_typeof(s -> 'puntos') is distinct from 'array' then
      raise exception 'La sección «%» no tiene lista de puntos', s ->> 'titulo' using errcode = '22023';
    end if;
    if p_publicar and jsonb_array_length(s -> 'puntos') = 0 then
      raise exception 'La sección «%» no tiene puntos', s ->> 'titulo' using errcode = '22023';
    end if;
    if jsonb_typeof(s -> 'repetible') = 'object' then
      v_rep := v_rep || v_clave;
      if jsonb_typeof(s -> 'repetible' -> 'minimo') is distinct from 'number' or (s -> 'repetible' ->> 'minimo')::numeric not between 0 and 50
         or (s -> 'repetible' ->> 'minimo')::numeric <> trunc((s -> 'repetible' ->> 'minimo')::numeric)
         or jsonb_typeof(s -> 'repetible' -> 'genera_hallazgo') is distinct from 'boolean' then
        raise exception 'La sección «%»: revisa el bloque repetible', s ->> 'titulo' using errcode = '22023';
      end if;
    else
      v_fijas := v_fijas || v_clave;
    end if;

    for pt in select value from jsonb_array_elements(s -> 'puntos') loop
      v_total := v_total + 1;
      v_clave := pt ->> 'clave';
      if v_clave is null or v_clave !~ '^[A-Z0-9][A-Z0-9_-]{0,29}$' then
        raise exception 'La clave «%» no es válida: usa mayúsculas, números y guiones', coalesce(v_clave, '') using errcode = '22023';
      end if;
      if v_clave = any(v_claves) then
        raise exception 'La clave «%» está repetida', v_clave using errcode = '22023';
      end if;
      v_claves := v_claves || v_clave;
      if length(coalesce(pt ->> 'texto', '')) > 300 or (p_publicar and length(trim(coalesce(pt ->> 'texto', ''))) < 2) then
        raise exception '%: revisa el texto del punto (2 a 300 letras)', v_clave using errcode = '22023';
      end if;
      v_tipo := pt ->> 'tipo';
      if v_tipo is null or v_tipo not in ('cumple', 'si_no', 'numero', 'texto', 'texto_largo', 'lista', 'fecha', 'hora', 'foto', 'persona', 'calculo') then
        raise exception '%: tipo de respuesta no válido', v_clave using errcode = '22023';
      end if;
      v_evaluable := v_tipo in ('cumple', 'si_no');
      if v_tipo = 'si_no' then v_sino := v_sino || v_clave; end if;
      foreach v_marca in array array['obligatorio', 'critico', 'obs_si_no_cumple', 'foto_si_no_cumple', 'pide_accion'] loop
        if jsonb_typeof(pt -> v_marca) is distinct from 'boolean' then
          raise exception '%: faltan marcas del punto', v_clave using errcode = '22023';
        end if;
      end loop;
      if coalesce(pt ->> 'hallazgo', '') not in ('nunca', 'no_cumple', 'fuera_rango') then
        raise exception '%: indica si genera hallazgo', v_clave using errcode = '22023';
      end if;
      if pt ->> 'hallazgo' = 'no_cumple' and not v_evaluable then
        raise exception '%: solo los puntos √/X/N/A o Sí/No generan hallazgo «si no cumple»', v_clave using errcode = '22023';
      end if;
      if pt ->> 'hallazgo' = 'fuera_rango' and v_tipo <> 'numero' then
        raise exception '%: «fuera de rango» solo va en puntos de tipo número', v_clave using errcode = '22023';
      end if;
      if not v_evaluable and ((pt ->> 'critico')::boolean or (pt ->> 'obs_si_no_cumple')::boolean
         or (pt ->> 'foto_si_no_cumple')::boolean or (pt ->> 'pide_accion')::boolean) then
        raise exception '%: crítico, observación, foto o acción solo van en puntos √/X/N/A o Sí/No', v_clave using errcode = '22023';
      end if;
      if (not app.es_texto_vacio(pt -> 'min') and jsonb_typeof(pt -> 'min') <> 'number')
         or (not app.es_texto_vacio(pt -> 'max') and jsonb_typeof(pt -> 'max') <> 'number') then
        raise exception '%: el mínimo y el máximo deben ser números', v_clave using errcode = '22023';
      end if;
      if jsonb_typeof(pt -> 'min') = 'number' and jsonb_typeof(pt -> 'max') = 'number' and (pt ->> 'min')::numeric > (pt ->> 'max')::numeric then
        raise exception '%: el mínimo es mayor que el máximo', v_clave using errcode = '22023';
      end if;
      if not app.es_texto_vacio(pt -> 'cantidad') and (jsonb_typeof(pt -> 'cantidad') <> 'number'
         or (pt ->> 'cantidad')::numeric not between 0 and 9999 or (pt ->> 'cantidad')::numeric <> trunc((pt ->> 'cantidad')::numeric)) then
        raise exception '%: la cantidad esperada debe ser un número entero entre 0 y 9999', v_clave using errcode = '22023';
      end if;
      if not app.es_texto_vacio(pt -> 'peso') and (jsonb_typeof(pt -> 'peso') <> 'number' or (pt ->> 'peso')::numeric not between 0 and 100) then
        raise exception '%: el peso debe estar entre 0 y 100', v_clave using errcode = '22023';
      end if;
      if v_tipo = 'lista' and app.es_texto_vacio(pt -> 'lista')
         and (jsonb_typeof(pt -> 'opciones') is distinct from 'array' or jsonb_array_length(pt -> 'opciones') = 0) then
        raise exception '%: elige una lista o escribe las opciones', v_clave using errcode = '22023';
      end if;
      if v_tipo = 'calculo' and coalesce(pt ->> 'formula', '') not in ('puntaje', 'antiguedad') then
        raise exception '%: elige qué se calcula', v_clave using errcode = '22023';
      end if;
      if v_tipo = 'calculo' and pt ->> 'formula' = 'antiguedad' and app.es_texto_vacio(pt -> 'campo') then
        raise exception '%: elige el dato del activo', v_clave using errcode = '22023';
      end if;
      if not app.es_texto_vacio(pt -> 'severidad') then
        raise exception '%: la severidad todavía no se usa (v1.1)', v_clave using errcode = '22023';
      end if;
      if not app.es_texto_vacio(pt -> 'solo_subtipos') and jsonb_typeof(pt -> 'solo_subtipos') <> 'array' then
        raise exception '%: revisa los subtipos', v_clave using errcode = '22023';
      end if;
    end loop;
  end loop;

  if v_total > 300 then
    raise exception 'Máximo 300 puntos' using errcode = '22023';
  end if;
  if p_publicar and v_total = 0 then
    raise exception 'El formato no tiene ningún punto' using errcode = '22023';
  end if;
  for s in select value from jsonb_array_elements(r -> 'secciones') where jsonb_typeof(value -> 'repetible') = 'object' loop
    if not app.es_texto_vacio(s -> 'repetible' -> 'activa_con') and not ((s -> 'repetible' ->> 'activa_con') = any(v_sino)) then
      raise exception 'La sección «%» se activa con un punto Sí/No que no existe', s ->> 'titulo' using errcode = '22023';
    end if;
  end loop;

  if jsonb_array_length(r -> 'firmas') > 6 then
    raise exception 'Máximo 6 firmas' using errcode = '22023';
  end if;
  for f in select value from jsonb_array_elements(r -> 'firmas') loop
    v_clave := f ->> 'clave';
    if v_clave is null or v_clave !~ '^[a-z0-9][a-z0-9_-]{0,29}$' or v_clave = any(v_firmas) then
      raise exception 'Hay una firma con clave interna repetida o no válida' using errcode = '22023';
    end if;
    v_firmas := v_firmas || v_clave;
    if length(trim(coalesce(f ->> 'titulo', ''))) not between 2 and 120
       or jsonb_typeof(f -> 'obligatoria') is distinct from 'boolean' or jsonb_typeof(f -> 'externo') is distinct from 'boolean'
       or jsonb_typeof(f -> 'minimo') is distinct from 'number' or (f ->> 'minimo')::numeric not between 1 and 10 then
      raise exception 'Revisa la firma «%»', coalesce(f ->> 'titulo', '') using errcode = '22023';
    end if;
  end loop;

  if jsonb_array_length(r -> 'reglas') > 20 then
    raise exception 'Máximo 20 reglas' using errcode = '22023';
  end if;
  for g in select value from jsonb_array_elements(r -> 'reglas') loop
    if length(trim(coalesce(g ->> 'etiqueta', ''))) not between 2 and 60 then
      raise exception 'Cada regla debe decir qué resultado da (2 a 60 letras)' using errcode = '22023';
    end if;
    case g ->> 'tipo'
      when 'vencido' then
        if jsonb_typeof(g -> 'controles') is distinct from 'array' or jsonb_array_length(g -> 'controles') = 0 then
          raise exception 'Regla «%»: agrega al menos un dato a controlar', g ->> 'etiqueta' using errcode = '22023';
        end if;
        for c in select value from jsonb_array_elements(g -> 'controles') loop
          if app.es_texto_vacio(c -> 'campo') or coalesce(c ->> 'tipo', '') not in ('fecha_limite', 'anios')
             or (c ->> 'tipo' = 'anios' and not app.es_texto_vacio(c -> 'anios')
                 and (jsonb_typeof(c -> 'anios') <> 'number' or (c ->> 'anios')::numeric not between 1 and 100)) then
            raise exception 'Regla «%»: revisa los datos a controlar', g ->> 'etiqueta' using errcode = '22023';
          end if;
        end loop;
      when 'x_en' then
        if coalesce(g ->> 'alcance', '') not in ('todos', 'criticos', 'claves', 'seccion') then
          raise exception 'Regla «%»: elige dónde se busca el «no cumple»', g ->> 'etiqueta' using errcode = '22023';
        end if;
        if g ->> 'alcance' = 'claves' and (jsonb_typeof(g -> 'claves') is distinct from 'array' or jsonb_array_length(g -> 'claves') = 0
           or exists (select 1 from jsonb_array_elements_text(g -> 'claves') x where not (x = any(v_claves)))) then
          raise exception 'Regla «%»: elige puntos que existan', g ->> 'etiqueta' using errcode = '22023';
        end if;
        if g ->> 'alcance' = 'seccion' and not (coalesce(g ->> 'seccion', '') = any(v_fijas)) then
          raise exception 'Regla «%»: elige una sección (no repetible) que exista', g ->> 'etiqueta' using errcode = '22023';
        end if;
      when 'respuesta' then
        if not (coalesce(g ->> 'clave', '') = any(v_claves)) or app.es_texto_vacio(g -> 'valor') then
          raise exception 'Regla «%»: elige un punto que exista y la respuesta', g ->> 'etiqueta' using errcode = '22023';
        end if;
      when 'filas' then
        if not (coalesce(g ->> 'seccion', '') = any(v_rep)) then
          raise exception 'Regla «%»: la sección repetible no existe', g ->> 'etiqueta' using errcode = '22023';
        end if;
      when 'observacion' then null;
      when 'fuera_rango' then null;
      else
        raise exception 'Hay una regla de un tipo no válido' using errcode = '22023';
    end case;
  end loop;
end $$;

-- ───────────────────────── Copias del contenido base ─────────────────────────

-- Copia a la empresa las listas base que le falten (por código).
create function app.copiar_listas(p_empresa uuid, p_codigos text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare b record; v_id uuid;
begin
  for b in select * from public.listas l where l.empresa_id is null and l.codigo = any(p_codigos)
           and not exists (select 1 from public.listas x where x.empresa_id = p_empresa and x.codigo = l.codigo) loop
    insert into public.listas (empresa_id, codigo, nombre, base_id, creado_por)
    values (p_empresa, b.codigo, b.nombre, b.id, (select auth.uid())) returning id into v_id;
    insert into public.listas_valores (lista_id, empresa_id, nombre, orden)
    select v_id, p_empresa, v.nombre, v.orden from public.listas_valores v where v.lista_id = b.id and v.vigente;
  end loop;
end $$;

-- Tipo de la empresa que corresponde a un tipo base (lo copia, con sus listas, si todavía no lo tiene).
create function app.tipo_de_empresa(p_empresa uuid, p_tipo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.tipos_activo; v_id uuid;
begin
  select * into t from public.tipos_activo where id = p_tipo;
  if t.id is null then
    raise exception 'El tipo de activo no existe' using errcode = '22023';
  end if;
  if t.empresa_id is not null then
    if t.empresa_id <> p_empresa then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    return t.id;
  end if;
  select id into v_id from public.tipos_activo where empresa_id = p_empresa and (base_id = t.id or codigo = t.codigo) limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.tipos_activo (empresa_id, codigo, nombre, subtipos, campos, dotacion, base_id, creado_por)
  values (p_empresa, t.codigo, t.nombre, t.subtipos, t.campos, t.dotacion, t.id, (select auth.uid()))
  returning id into v_id;
  perform app.copiar_listas(p_empresa, array(select c ->> 'lista' from jsonb_array_elements(t.campos) c where c ->> 'lista' is not null));
  return v_id;
end $$;

-- Listas que usa una receta.
create function app.listas_de_receta(r jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct p ->> 'lista'), '{}')
  from jsonb_array_elements(r -> 'secciones') s, jsonb_array_elements(s -> 'puntos') p
  where coalesce(p ->> 'lista', '') <> '';
$$;

-- ───────────────────────── Acciones: listas ─────────────────────────

create function public.crear_lista(p_empresa uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'); v_id uuid;
begin
  if p_empresa is null or not app.puedo_en_empresa(p_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_nombre) not between 2 and 120 or length(app.codigo_de(v_nombre)) < 2 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    insert into public.listas (empresa_id, codigo, nombre, creado_por)
    values (p_empresa, app.codigo_de(v_nombre), v_nombre, (select auth.uid())) returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya existe una lista con ese nombre' using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.copiar_lista_base(p_empresa uuid, p_codigo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_empresa is null or not app.puedo_en_empresa(p_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform app.copiar_listas(p_empresa, array[p_codigo]);
end $$;

create function public.guardar_valor_lista(p_lista uuid, p_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  l public.listas;
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  select * into l from public.listas where id = coalesce(p_lista, (select lista_id from public.listas_valores where id = p_id));
  if l.id is null or not app.puedo_en_empresa(l.empresa_id, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if length(v_nombre) not between 1 and 120 then
    raise exception 'Escribe el valor (hasta 120 caracteres)' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.listas_valores (lista_id, empresa_id, nombre, orden)
      values (l.id, l.empresa_id, v_nombre, (select coalesce(max(orden), 0) + 1 from public.listas_valores where lista_id = l.id))
      returning id into v_id;
    else
      update public.listas_valores set nombre = v_nombre where id = p_id and lista_id = l.id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ese valor ya está en la lista' using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.cambiar_vigencia_valor_lista(p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid; v_existe boolean;
begin
  select empresa_id, true into v_empresa, v_existe from public.listas_valores where id = p_id;
  if not coalesce(v_existe, false) or p_vigente is null or not app.puedo_en_empresa(v_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.listas_valores set vigente = p_vigente where id = p_id;
end $$;

-- ───────────────────────── Acciones: tipos de activo ─────────────────────────

create function public.activar_tipo_activo(p_empresa uuid, p_tipo_base uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if p_empresa is null or not app.puedo_en_empresa(p_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tipos_activo where id = p_tipo_base and empresa_id is null) then
    raise exception 'El tipo base no existe' using errcode = '22023';
  end if;
  return app.tipo_de_empresa(p_empresa, p_tipo_base);
end $$;

-- Revisa y limpia la lista de subtipos: [{codigo, nombre}]. Los códigos que ya existían se conservan.
create function app.limpiar_subtipos(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare s jsonb; v_out jsonb := '[]'::jsonb; v_codigos text[] := '{}'; v_cod text; v_nom text;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 20 then
    raise exception 'Revisa los subtipos (máximo 20)' using errcode = '22023';
  end if;
  for s in select value from jsonb_array_elements(p) loop
    v_nom := regexp_replace(trim(coalesce(s ->> 'nombre', '')), '\s+', ' ', 'g');
    v_cod := coalesce(nullif(s ->> 'codigo', ''), app.codigo_de(v_nom));
    if length(v_nom) not between 2 and 80 or v_cod !~ '^[a-z0-9][a-z0-9_]{1,39}$' then
      raise exception 'Cada subtipo necesita un nombre (2 a 80 letras)' using errcode = '22023';
    end if;
    if v_cod = any(v_codigos) then
      raise exception 'Hay subtipos repetidos' using errcode = '22023';
    end if;
    v_codigos := v_codigos || v_cod;
    v_out := v_out || jsonb_build_array(jsonb_build_object('codigo', v_cod, 'nombre', v_nom));
  end loop;
  return v_out;
end $$;

-- Crea un tipo nuevo de la empresa (con la ficha básica) o cambia el nombre y los subtipos de uno existente.
-- La ficha de los tipos no se edita en la v1 (decisión del dueño, 26/10/2026).
create function public.guardar_tipo_activo(p_empresa uuid, p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.tipos_activo;
  v_nombre text := app.texto(p_datos, 'nombre');
  v_subtipos jsonb := app.limpiar_subtipos(coalesce(p_datos -> 'subtipos', '[]'::jsonb));
  v_id uuid;
begin
  if p_id is not null then
    select * into t from public.tipos_activo where id = p_id;
  end if;
  if (p_id is not null and (t.id is null or t.empresa_id is null)) or coalesce(t.empresa_id, p_empresa) is null
     or not app.puedo_en_empresa(coalesce(t.empresa_id, p_empresa), 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_nombre is null or length(v_nombre) not between 2 and 120 or length(app.codigo_de(v_nombre)) < 2 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.tipos_activo (empresa_id, codigo, nombre, subtipos, campos, creado_por)
      values (p_empresa, app.codigo_de(v_nombre), v_nombre, v_subtipos,
              '[{"clave": "datos_tecnicos", "etiqueta": "Datos técnicos", "tipo": "texto_largo", "obligatorio": false}]'::jsonb,
              (select auth.uid()))
      returning id into v_id;
    else
      if exists (select 1 from public.activos a where a.tipo_id = p_id and a.subtipo is not null
                 and not exists (select 1 from jsonb_array_elements(v_subtipos) s where s ->> 'codigo' = a.subtipo)) then
        raise exception 'Hay activos con un subtipo que quieres quitar: cámbialos antes' using errcode = '23503';
      end if;
      update public.tipos_activo set nombre = v_nombre, subtipos = v_subtipos where id = p_id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ya existe un tipo de activo con ese nombre' using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.cambiar_vigencia_tipo_activo(p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := (select empresa_id from public.tipos_activo where id = p_id);
begin
  if v_empresa is null or p_vigente is null or not app.puedo_en_empresa(v_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.tipos_activo set vigente = p_vigente where id = p_id;
end $$;

-- ───────────────────────── Acciones: ubicaciones ─────────────────────────

create function public.guardar_ubicacion(p_empresa uuid, p_id uuid, p_sede uuid, p_unidad uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := case when p_id is null then p_empresa else (select empresa_id from public.ubicaciones where id = p_id) end;
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if v_empresa is null or not app.puedo_en_empresa(v_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede and empresa_id = v_empresa) then
    raise exception 'La sede no es de la empresa' using errcode = '22023';
  end if;
  if p_unidad is not null and not exists (select 1 from public.unidades where id = p_unidad and empresa_id = v_empresa and nivel <> 'gerencia') then
    raise exception 'Elige un área o subárea de la empresa' using errcode = '22023';
  end if;
  if length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.ubicaciones (empresa_id, sede_id, unidad_id, nombre, creado_por)
      values (v_empresa, p_sede, p_unidad, v_nombre, (select auth.uid())) returning id into v_id;
    else
      if exists (select 1 from public.activos where ubicacion_id = p_id and sede_id <> p_sede) then
        raise exception 'Hay activos en esta ubicación: no se puede pasar a otra sede' using errcode = '23503';
      end if;
      update public.ubicaciones set sede_id = p_sede, unidad_id = p_unidad, nombre = v_nombre where id = p_id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ya existe una ubicación con ese nombre en la sede' using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.cambiar_vigencia_ubicacion(p_id uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_empresa uuid := (select empresa_id from public.ubicaciones where id = p_id);
begin
  if v_empresa is null or p_vigente is null or not app.puedo_en_empresa(v_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.ubicaciones set vigente = p_vigente where id = p_id;
end $$;

-- ───────────────────────── Acciones: activos ─────────────────────────

-- Revisa los datos de la ficha según los campos del tipo y devuelve solo los que corresponden.
create function app.validar_datos_activo(p_tipo public.tipos_activo, p_subtipo text, p_datos jsonb, p_anteriores jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c jsonb; v jsonb; v_out jsonb := '{}'::jsonb; k text; v_et text; v_desde jsonb;
begin
  for c in select value from jsonb_array_elements(p_tipo.campos) loop
    k := c ->> 'clave';
    v_et := c ->> 'etiqueta';
    if jsonb_typeof(c -> 'solo_subtipos') = 'array' and jsonb_array_length(c -> 'solo_subtipos') > 0
       and not (c -> 'solo_subtipos') ? coalesce(p_subtipo, '') then
      continue;
    end if;
    v := p_datos -> k;
    if app.es_texto_vacio(v) and jsonb_typeof(c -> 'calcula') = 'object' then
      v_desde := v_out -> (c -> 'calcula' ->> 'desde');
      if v_desde is not null then
        v := to_jsonb(to_char(((v_desde #>> '{}') || '-01')::date + make_interval(months => (c -> 'calcula' ->> 'meses')::int), 'YYYY-MM'));
      end if;
    end if;
    if app.es_texto_vacio(v) then
      if (c ->> 'obligatorio')::boolean then
        raise exception 'Falta «%»', v_et using errcode = '22023';
      end if;
      continue;
    end if;
    case c ->> 'tipo'
      when 'texto' then
        if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) > 200 then
          raise exception '«%»: hasta 200 caracteres', v_et using errcode = '22023';
        end if;
        v := to_jsonb(regexp_replace(trim(v #>> '{}'), '\s+', ' ', 'g'));
      when 'texto_largo' then
        if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) > 2000 then
          raise exception '«%»: hasta 2000 caracteres', v_et using errcode = '22023';
        end if;
        v := to_jsonb(trim(v #>> '{}'));
      when 'numero' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 1000000000 then
          raise exception '«%»: escribe un número', v_et using errcode = '22023';
        end if;
      when 'anio' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 1900 and 2100
           or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
          raise exception '«%»: escribe un año (por ejemplo 2024)', v_et using errcode = '22023';
        end if;
      when 'mes' then
        if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])$' then
          raise exception '«%»: elige mes y año', v_et using errcode = '22023';
        end if;
      when 'lista' then
        if jsonb_typeof(v) <> 'string' or not (
             exists (select 1 from public.listas l join public.listas_valores lv on lv.lista_id = l.id
                     where l.empresa_id = p_tipo.empresa_id and l.codigo = c ->> 'lista' and lv.vigente and lv.nombre = v #>> '{}')
             or (p_anteriores -> k) = v) then
          raise exception '«%»: elige un valor de la lista', v_et using errcode = '22023';
        end if;
      else
        raise exception 'Campo no válido' using errcode = '22023';
    end case;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return v_out;
end $$;

-- Crea (p_id vacío) o edita un activo. p_datos: tipo_id (solo al crear), codigo, subtipo, sede_id, unidad_id,
-- ubicacion_id, responsable_id, datos {…}, dotacion {clave: cantidad}.
create function public.guardar_activo(p_empresa uuid, p_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.activos;
  t public.tipos_activo;
  v_empresa uuid;
  v_codigo text := app.texto(p_datos, 'codigo');
  v_subtipo text := app.texto(p_datos, 'subtipo');
  v_sede uuid := nullif(p_datos ->> 'sede_id', '')::uuid;
  v_unidad uuid := nullif(p_datos ->> 'unidad_id', '')::uuid;
  v_ubicacion uuid := nullif(p_datos ->> 'ubicacion_id', '')::uuid;
  v_responsable uuid := nullif(p_datos ->> 'responsable_id', '')::uuid;
  v_datos jsonb;
  v_dotacion jsonb := '{}'::jsonb;
  d record;
  v_id uuid;
begin
  if p_id is not null then
    select * into a from public.activos where id = p_id for update;
    if a.id is null then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    v_empresa := a.empresa_id;
  else
    v_empresa := p_empresa;
  end if;
  if v_empresa is null or not app.puedo_en_empresa(v_empresa, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if a.id is not null and a.estado <> 'activo' then
    raise exception 'El activo está de baja: reactívalo para editarlo' using errcode = '22023';
  end if;
  select * into t from public.tipos_activo
  where id = coalesce(a.tipo_id, nullif(p_datos ->> 'tipo_id', '')::uuid) and empresa_id = v_empresa;
  if t.id is null then
    raise exception 'Elige un tipo de activo de la empresa' using errcode = '22023';
  end if;
  if a.id is null and not t.vigente then
    raise exception 'El tipo de activo está desactivado' using errcode = '22023';
  end if;
  if v_codigo is null or length(v_codigo) > 40 then
    raise exception 'Escribe el código (hasta 40 caracteres)' using errcode = '22023';
  end if;
  if jsonb_array_length(t.subtipos) > 0 then
    if v_subtipo is null or not exists (select 1 from jsonb_array_elements(t.subtipos) s where s ->> 'codigo' = v_subtipo) then
      raise exception 'Elige el subtipo' using errcode = '22023';
    end if;
  else
    v_subtipo := null;
  end if;
  if not exists (select 1 from public.sedes where id = v_sede and empresa_id = v_empresa and (activa or v_sede = a.sede_id)) then
    raise exception 'Elige una sede activa de la empresa' using errcode = '22023';
  end if;
  if v_unidad is not null and not exists (select 1 from public.unidades where id = v_unidad and empresa_id = v_empresa and nivel <> 'gerencia') then
    raise exception 'Elige un área o subárea de la empresa' using errcode = '22023';
  end if;
  if v_ubicacion is not null and not exists (
       select 1 from public.ubicaciones where id = v_ubicacion and empresa_id = v_empresa and sede_id = v_sede
         and (vigente or v_ubicacion = a.ubicacion_id)) then
    raise exception 'La ubicación no es de esa sede (o está desactivada)' using errcode = '22023';
  end if;
  if v_responsable is not null and v_responsable is distinct from a.responsable_id and not exists (
       select 1 from public.vinculos where persona_id = v_responsable and empresa_id = v_empresa and estado = 'activo') then
    raise exception 'El responsable debe ser una persona activa de la empresa' using errcode = '22023';
  end if;
  v_datos := app.validar_datos_activo(t, v_subtipo, coalesce(p_datos -> 'datos', '{}'::jsonb), coalesce(a.datos, '{}'::jsonb));
  if t.dotacion and jsonb_typeof(p_datos -> 'dotacion') = 'object' then
    for d in select key, value from jsonb_each(p_datos -> 'dotacion') loop
      if app.es_texto_vacio(d.value) then continue; end if;
      if d.key !~ '^[A-Z0-9][A-Z0-9_-]{0,29}$' or jsonb_typeof(d.value) <> 'number'
         or (d.value #>> '{}')::numeric not between 0 and 9999 or (d.value #>> '{}')::numeric <> trunc((d.value #>> '{}')::numeric) then
        raise exception 'Las cantidades de la dotación deben ser números enteros entre 0 y 9999' using errcode = '22023';
      end if;
      v_dotacion := v_dotacion || jsonb_build_object(d.key, d.value);
    end loop;
  end if;

  begin
    if a.id is null then
      perform pg_advisory_xact_lock(hashtext('activos:' || v_empresa::text || t.id::text));
      insert into public.activos (empresa_id, tipo_id, numero, codigo, subtipo, sede_id, unidad_id, ubicacion_id,
                                  responsable_id, datos, dotacion, creado_por, actualizado_por)
      values (v_empresa, t.id,
              (select coalesce(max(numero), 0) + 1 from public.activos where empresa_id = v_empresa and tipo_id = t.id),
              v_codigo, v_subtipo, v_sede, v_unidad, v_ubicacion, v_responsable, v_datos, v_dotacion,
              (select auth.uid()), (select auth.uid()))
      returning id into v_id;
    else
      update public.activos set codigo = v_codigo, subtipo = v_subtipo, sede_id = v_sede, unidad_id = v_unidad,
        ubicacion_id = v_ubicacion, responsable_id = v_responsable, datos = v_datos, dotacion = v_dotacion,
        actualizado_en = now(), actualizado_por = (select auth.uid())
      where id = a.id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ya existe un activo de ese tipo con el código %', v_codigo using errcode = '23505';
  end;
  return v_id;
end $$;

create function public.dar_baja_activo(p_id uuid, p_fecha date, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.activos;
begin
  select * into a from public.activos where id = p_id for update;
  if a.id is null or not app.puedo_en_empresa(a.empresa_id, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if a.estado <> 'activo' then
    raise exception 'El activo ya está de baja' using errcode = '22023';
  end if;
  if p_fecha is null or p_fecha > current_date or length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Indica la fecha (hasta hoy) y el motivo de la baja' using errcode = '22023';
  end if;
  update public.activos set estado = 'baja', fecha_baja = p_fecha, motivo_baja = trim(p_motivo),
    actualizado_en = now(), actualizado_por = (select auth.uid())
  where id = p_id;
end $$;

create function public.reactivar_activo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.activos;
begin
  select * into a from public.activos where id = p_id for update;
  if a.id is null or not app.puedo_en_empresa(a.empresa_id, 'activos.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if a.estado <> 'baja' then
    raise exception 'El activo no está de baja' using errcode = '22023';
  end if;
  update public.activos set estado = 'activo', fecha_baja = null, motivo_baja = null,
    actualizado_en = now(), actualizado_por = (select auth.uid())
  where id = p_id;
end $$;

-- ───────────────────────── Acciones: plantillas y versiones ─────────────────────────

-- Copia una plantilla (base de CRC u otra de la misma empresa) como borrador v1 de la empresa.
-- La plantilla de origen no cambia. Trae el tipo de activo y las listas que use, si la empresa no los tiene.
create function public.copiar_plantilla(p_empresa uuid, p_origen uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.plantillas;
  v public.plantillas_versiones;
  v_tipo uuid;
  v_id uuid;
begin
  if p_empresa is null or not app.puedo_en_empresa(p_empresa, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into o from public.plantillas where id = p_origen;
  if o.id is null or (o.empresa_id is not null and o.empresa_id <> p_empresa) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select * into v from public.plantillas_versiones where plantilla_id = o.id and estado = 'vigente';
  if v.id is null then
    raise exception 'Solo se copia un formato que tenga una versión publicada' using errcode = '22023';
  end if;
  if o.tipo_activo_id is not null then
    v_tipo := app.tipo_de_empresa(p_empresa, o.tipo_activo_id);
  end if;
  perform app.copiar_listas(p_empresa, app.listas_de_receta(v.receta));
  insert into public.plantillas (empresa_id, base_id, codigo, nombre, descripcion, aplica_a, tipo_activo_id, frecuencia, creado_por)
  values (p_empresa, o.id, o.codigo, case when o.empresa_id is null then o.nombre else left(o.nombre || ' (copia)', 160) end,
          o.descripcion, o.aplica_a, v_tipo, o.frecuencia, (select auth.uid()))
  returning id into v_id;
  insert into public.plantillas_versiones (plantilla_id, empresa_id, numero, estado, logo, receta, creado_por, actualizado_por,
                                           codigo_formato, version_formato, fecha_aprobacion)
  values (v_id, p_empresa, 1, 'borrador', v.logo, v.receta, (select auth.uid()), (select auth.uid()),
          case when o.empresa_id is null then null else v.codigo_formato end,
          case when o.empresa_id is null then null else v.version_formato end,
          case when o.empresa_id is null then null else v.fecha_aprobacion end);
  return v_id;
end $$;

-- Formato nuevo desde cero (p_datos: nombre, aplica_a, tipo_activo_id, frecuencia).
create function public.nueva_plantilla(p_empresa uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := app.texto(p_datos, 'nombre');
  v_aplica text := coalesce(app.texto(p_datos, 'aplica_a'), 'activo');
  v_tipo uuid := nullif(p_datos ->> 'tipo_activo_id', '')::uuid;
  v_id uuid;
begin
  if p_empresa is null or not app.puedo_en_empresa(p_empresa, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_nombre is null or length(v_nombre) not between 3 and 160 then
    raise exception 'El nombre debe tener entre 3 y 160 caracteres' using errcode = '22023';
  end if;
  if v_aplica not in ('activo', 'area') then
    raise exception 'Indica a qué se aplica' using errcode = '22023';
  end if;
  if v_aplica = 'activo' and not exists (select 1 from public.tipos_activo where id = v_tipo and empresa_id = p_empresa and vigente) then
    raise exception 'Elige un tipo de activo de la empresa' using errcode = '22023';
  end if;
  insert into public.plantillas (empresa_id, nombre, aplica_a, tipo_activo_id, frecuencia, creado_por)
  values (p_empresa, v_nombre, v_aplica, case when v_aplica = 'activo' then v_tipo end,
          coalesce(nullif(p_datos ->> 'frecuencia', ''), 'sin_frecuencia'), (select auth.uid()))
  returning id into v_id;
  insert into public.plantillas_versiones (plantilla_id, empresa_id, numero, receta, creado_por, actualizado_por)
  values (v_id, p_empresa, 1,
          '{"version": 1, "secciones": [], "firmas": [{"clave": "inspector", "titulo": "Inspector", "obligatoria": true, "externo": false, "minimo": 1}], "reglas": [], "resultado_defecto": null, "puntaje": false, "na_favorable": true, "hallazgo_vencimiento": false, "observacion_general": true}'::jsonb,
          (select auth.uid()), (select auth.uid()));
  return v_id;
end $$;

-- Nombre, descripción y frecuencia sugerida (se pueden cambiar siempre: no forman parte de la versión).
create function public.guardar_plantilla(p_plantilla uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pl public.plantillas;
  v_nombre text := app.texto(p_datos, 'nombre');
  v_desc text := app.texto(p_datos, 'descripcion');
  v_frec text := coalesce(app.texto(p_datos, 'frecuencia'), 'sin_frecuencia');
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_nombre is null or length(v_nombre) not between 3 and 160 or length(coalesce(v_desc, '')) > 400 then
    raise exception 'Revisa el nombre (3 a 160) y la descripción (hasta 400)' using errcode = '22023';
  end if;
  if v_frec not in ('semanal', 'mensual', 'sin_frecuencia') then
    raise exception 'Frecuencia no válida' using errcode = '22023';
  end if;
  update public.plantillas set nombre = v_nombre, descripcion = v_desc, frecuencia = v_frec, actualizado_en = now()
  where id = p_plantilla;
end $$;

create function public.cambiar_vigencia_plantilla(p_plantilla uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.plantillas;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or p_vigente is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.plantillas set vigente = p_vigente, actualizado_en = now() where id = p_plantilla;
end $$;

-- Guarda el borrador (encabezado y receta). p_datos: codigo_formato, version_formato, fecha_aprobacion, logo, receta.
create function public.guardar_borrador(p_version uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.plantillas_versiones;
  v_fecha text := app.texto(p_datos, 'fecha_aprobacion');
  v_logo text := coalesce(app.texto(p_datos, 'logo'), 'positivo');
begin
  select * into v from public.plantillas_versiones where id = p_version for update;
  if v.id is null or not app.puedo_en_empresa(v.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado <> 'borrador' then
    raise exception 'Solo se edita un borrador: abre uno nuevo' using errcode = '22023';
  end if;
  if v_fecha is not null and v_fecha !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Fecha de aprobación no válida' using errcode = '22023';
  end if;
  if v_logo not in ('positivo', 'negativo', 'ninguno') then
    raise exception 'Logo no válido' using errcode = '22023';
  end if;
  perform app.validar_receta(p_datos -> 'receta', false);
  if v.empresa_id is not null then
    perform app.copiar_listas(v.empresa_id, app.listas_de_receta(p_datos -> 'receta'));
  end if;
  update public.plantillas_versiones set
    codigo_formato = app.texto(p_datos, 'codigo_formato'),
    version_formato = app.texto(p_datos, 'version_formato'),
    fecha_aprobacion = v_fecha::date,
    logo = v_logo,
    receta = p_datos -> 'receta',
    actualizado_en = now(),
    actualizado_por = (select auth.uid())
  where id = p_version;
end $$;

-- Abre un borrador nuevo copiando la última versión (si ya hay uno, devuelve ese).
create function public.nuevo_borrador(p_plantilla uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pl public.plantillas; u public.plantillas_versiones; v_id uuid;
begin
  select * into pl from public.plantillas where id = p_plantilla for update;
  if pl.id is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select id into v_id from public.plantillas_versiones where plantilla_id = p_plantilla and estado = 'borrador';
  if v_id is not null then return v_id; end if;
  select * into u from public.plantillas_versiones where plantilla_id = p_plantilla order by numero desc limit 1;
  insert into public.plantillas_versiones (plantilla_id, empresa_id, numero, logo, receta, codigo_formato, version_formato,
                                           fecha_aprobacion, creado_por, actualizado_por)
  values (p_plantilla, pl.empresa_id, coalesce(u.numero, 0) + 1, coalesce(u.logo, 'positivo'), u.receta, u.codigo_formato,
          u.version_formato, u.fecha_aprobacion, (select auth.uid()), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- Publica el borrador: queda congelado y pasa a ser la versión vigente (la anterior queda retirada).
create function public.publicar_version(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.plantillas_versiones;
begin
  select * into v from public.plantillas_versiones where id = p_version for update;
  if v.id is null or not app.puedo_en_empresa(v.empresa_id, 'plantillas.publicar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado <> 'borrador' then
    raise exception 'Esta versión ya fue publicada' using errcode = '22023';
  end if;
  perform app.validar_receta(v.receta, true);
  if v.empresa_id is not null and (v.codigo_formato is null or v.version_formato is null or v.fecha_aprobacion is null) then
    raise exception 'Para publicar, completa el código, la versión y la fecha de aprobación del formato' using errcode = '22023';
  end if;
  update public.plantillas_versiones set estado = 'retirada' where plantilla_id = v.plantilla_id and estado = 'vigente';
  update public.plantillas_versiones set estado = 'vigente', publicado_en = now(), publicado_por = (select auth.uid()),
    huella = encode(extensions.digest(convert_to(v.receta::text, 'UTF8'), 'sha256'), 'hex')
  where id = p_version;
  update public.plantillas set actualizado_en = now() where id = v.plantilla_id;
end $$;

-- Descarta un borrador. Si la plantilla nunca se publicó, se descarta entera.
create function public.descartar_borrador(p_version uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.plantillas_versiones;
begin
  select * into v from public.plantillas_versiones where id = p_version for update;
  if v.id is null or not app.puedo_en_empresa(v.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v.estado <> 'borrador' then
    raise exception 'Solo se descarta un borrador' using errcode = '22023';
  end if;
  delete from public.plantillas_versiones where id = p_version;
  if not exists (select 1 from public.plantillas_versiones where plantilla_id = v.plantilla_id) then
    delete from public.plantillas where id = v.plantilla_id;
  end if;
end $$;

-- ───────────────────────── Permisos de acceso y reglas RLS ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['listas', 'listas_valores', 'tipos_activo', 'ubicaciones', 'activos', 'activos_historial',
                           'plantillas', 'plantillas_versiones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Contenido base (empresa vacía): lo ve cualquiera con sesión. Lo de cada empresa: solo esa empresa y el dueño.
create policy "Ver listas base y de mi empresa" on public.listas for select to authenticated
using (empresa_id is null or (select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver valores base y de mi empresa" on public.listas_valores for select to authenticated
using (empresa_id is null or (select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver tipos base y de mi empresa" on public.tipos_activo for select to authenticated
using (empresa_id is null or (select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver plantillas base y de mi empresa" on public.plantillas for select to authenticated
using (empresa_id is null or (select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver versiones base y de mi empresa" on public.plantillas_versiones for select to authenticated
using (empresa_id is null or (select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver ubicaciones de mi empresa" on public.ubicaciones for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver activos de mi empresa" on public.activos for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));
create policy "Ver historial de activos de mi empresa" on public.activos_historial for select to authenticated
using ((select app.es_dueno_plataforma()) or empresa_id = (select app.mi_empresa()));

-- Funciones internas: no se llaman desde la app.
revoke all on function app.registrar_historial_activo(), app.proteger_version(), app.copiar_listas(uuid, text[]),
  app.tipo_de_empresa(uuid, uuid), app.validar_datos_activo(public.tipos_activo, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function app.puedo_en_empresa(uuid, text), app.codigo_de(text), app.es_texto_vacio(jsonb),
  app.validar_receta(jsonb, boolean), app.listas_de_receta(jsonb), app.limpiar_subtipos(jsonb) from public, anon;
grant execute on function app.puedo_en_empresa(uuid, text), app.codigo_de(text), app.es_texto_vacio(jsonb),
  app.validar_receta(jsonb, boolean), app.listas_de_receta(jsonb), app.limpiar_subtipos(jsonb) to authenticated;

-- Acciones que usa la app (revisan los permisos por dentro).
do $$
declare f text;
begin
  foreach f in array array[
    'crear_lista(uuid, text)', 'copiar_lista_base(uuid, text)', 'guardar_valor_lista(uuid, uuid, text)',
    'cambiar_vigencia_valor_lista(uuid, boolean)', 'activar_tipo_activo(uuid, uuid)', 'guardar_tipo_activo(uuid, uuid, jsonb)',
    'cambiar_vigencia_tipo_activo(uuid, boolean)', 'guardar_ubicacion(uuid, uuid, uuid, uuid, text)',
    'cambiar_vigencia_ubicacion(uuid, boolean)', 'guardar_activo(uuid, uuid, jsonb)', 'dar_baja_activo(uuid, date, text)',
    'reactivar_activo(uuid)', 'copiar_plantilla(uuid, uuid)', 'nueva_plantilla(uuid, jsonb)', 'guardar_plantilla(uuid, jsonb)',
    'cambiar_vigencia_plantilla(uuid, boolean)', 'guardar_borrador(uuid, jsonb)', 'nuevo_borrador(uuid)',
    'publicar_version(uuid)', 'descartar_borrador(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
