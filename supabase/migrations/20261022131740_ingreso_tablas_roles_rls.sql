-- Tarea 3.1 · Ingreso y seguridad: tablas base, roles y seguridad por fila (RLS).
-- Regla de oro: TODA tabla nace con RLS activado. La app (navegador) solo puede LEER;
-- las escrituras pasan por funciones que revisan permisos (cese, reactivación, crear cuenta).

-- Esquema interno para funciones de apoyo. No se expone por la API de Supabase.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ───────────────────────── Catálogos ─────────────────────────

create table public.tipos_documento (
  codigo text primary key check (codigo ~ '^[a-z]{2,5}$'),
  nombre text not null,
  patron text not null,           -- forma válida del número (expresión regular)
  orden smallint not null default 0
);
comment on table public.tipos_documento is 'Tipos de documento aceptados para ingresar (DNI, carnet de extranjería, pasaporte).';

insert into public.tipos_documento (codigo, nombre, patron, orden) values
  ('dni', 'DNI', '^[0-9]{8}$', 1),
  ('ce', 'Carnet de extranjería', '^[A-Z0-9]{6,12}$', 2),
  ('pas', 'Pasaporte', '^[A-Z0-9]{6,12}$', 3);

create table public.roles (
  codigo text primary key check (codigo ~ '^[a-z_]{3,30}$'),
  nombre text not null,
  descripcion text not null,
  orden smallint not null default 0,
  creado_en timestamptz not null default now()
);
comment on table public.roles is 'Roles dentro de una empresa. Se guardan aquí (no en el código) para poder agregar más.';

insert into public.roles (codigo, nombre, descripcion, orden) values
  ('admin_empresa', 'Administrador de empresa', 'Crea y da de baja cuentas de gestores y usuarios de su empresa.', 1),
  ('gestor', 'Gestor', 'Equipo SSO: llena registros, inspecciones y documentos. No crea cuentas.', 2),
  ('usuario', 'Usuario', 'Trabajador: ve solo lo suyo (planes de acción y, más adelante, capacitaciones).', 3);

create table public.permisos (
  codigo text primary key check (codigo ~ '^[a-z_]+\.[a-z_]+$'),
  descripcion text not null
);
comment on table public.permisos is 'Acciones que un rol puede tener permitidas.';

insert into public.permisos (codigo, descripcion) values
  ('cuentas.crear', 'Crear cuentas en su empresa (solo con los roles que puede asignar).'),
  ('cuentas.cesar', 'Cesar y reactivar cuentas de su empresa (solo de los roles que puede asignar).'),
  ('personas.ver_empresa', 'Ver la lista de personas y vínculos de su empresa.');

create table public.roles_permisos (
  rol text not null references public.roles (codigo) on update cascade,
  permiso text not null references public.permisos (codigo) on update cascade,
  primary key (rol, permiso)
);
comment on table public.roles_permisos is 'Qué permisos tiene cada rol.';

insert into public.roles_permisos (rol, permiso) values
  ('admin_empresa', 'cuentas.crear'),
  ('admin_empresa', 'cuentas.cesar'),
  ('admin_empresa', 'personas.ver_empresa');

create table public.roles_asignables (
  rol text not null references public.roles (codigo) on update cascade,
  rol_asignable text not null references public.roles (codigo) on update cascade,
  primary key (rol, rol_asignable)
);
comment on table public.roles_asignables is 'Qué roles puede dar (y cesar) cada rol. El dueño de la plataforma puede todos.';

insert into public.roles_asignables (rol, rol_asignable) values
  ('admin_empresa', 'gestor'),
  ('admin_empresa', 'usuario');

-- ───────────────────────── Empresas y personas ─────────────────────────

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  ruc text not null unique check (ruc ~ '^[0-9]{11}$'),
  razon_social text not null check (length(trim(razon_social)) between 2 and 200),
  estado text not null default 'activa' check (estado in ('activa', 'inactiva')),
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id)
);
comment on table public.empresas is 'Empresas clientes. Solo el dueño de la plataforma las da de alta.';

create table public.personas (
  id uuid primary key references auth.users (id) on delete restrict,
  tipo_documento text not null references public.tipos_documento (codigo),
  numero_documento text not null,
  apellidos_nombres text not null check (length(trim(apellidos_nombres)) between 3 and 200),
  debe_cambiar_contrasena boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  unique (tipo_documento, numero_documento)
);
comment on table public.personas is 'Una fila por persona, para siempre (no se borra). Su empresa y puesto van en vinculos.';

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete restrict,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  rol text not null references public.roles (codigo) on update cascade,
  fecha_ingreso date not null,
  puesto text check (puesto is null or length(trim(puesto)) between 2 and 120),
  area text check (area is null or length(trim(area)) between 2 and 120),
  estado text not null default 'activo' check (estado in ('activo', 'cesado')),
  fecha_cese date,
  motivo_cese text,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id),
  actualizado_en timestamptz not null default now(),
  constraint cese_completo check (
    (estado = 'activo' and fecha_cese is null and motivo_cese is null)
    or (estado = 'cesado' and fecha_cese is not null and length(trim(motivo_cese)) >= 3)
  ),
  constraint cese_despues_de_ingreso check (fecha_cese is null or fecha_cese >= fecha_ingreso)
);
comment on table public.vinculos is 'Vínculo persona–empresa con rol, puesto, área y estado (activo/cesado). Es el historial laboral.';

-- Una persona solo puede tener UN vínculo activo a la vez (una sola empresa).
create unique index vinculos_un_activo_por_persona on public.vinculos (persona_id) where estado = 'activo';
create index vinculos_empresa_idx on public.vinculos (empresa_id);

create table public.vinculos_historial (
  id bigint generated always as identity primary key,
  vinculo_id uuid not null references public.vinculos (id) on delete restrict,
  persona_id uuid not null,
  empresa_id uuid not null,
  accion text not null check (accion in ('alta', 'cese', 'reactivacion', 'cambio')),
  estado text not null,
  rol text not null,
  fecha_cese date,
  motivo_cese text,
  hecho_por uuid,
  hecho_en timestamptz not null default now()
);
comment on table public.vinculos_historial is 'Registro automático de altas, ceses y reactivaciones. Nadie lo edita.';
create index vinculos_historial_empresa_idx on public.vinculos_historial (empresa_id);
create index vinculos_historial_vinculo_idx on public.vinculos_historial (vinculo_id);

create table public.duenos_plataforma (
  persona_id uuid primary key references public.personas (id) on delete restrict,
  creado_en timestamptz not null default now()
);
comment on table public.duenos_plataforma is 'Personas de Integrax con permiso total (dar de alta empresas, crear administradores).';

-- ───────────────────────── Permisos de acceso ─────────────────────────
-- Nadie entra sin sesión (anon). Con sesión (authenticated) solo se LEE, y RLS filtra qué filas.

do $$
declare t text;
begin
  foreach t in array array['tipos_documento', 'roles', 'permisos', 'roles_permisos', 'roles_asignables',
                           'empresas', 'personas', 'vinculos', 'vinculos_historial', 'duenos_plataforma']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
