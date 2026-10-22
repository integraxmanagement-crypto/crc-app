-- Tarea 3.1 · Opción B: registro de intentos de ingreso y bloqueo temporal.
-- Lo escribe solo la función del servidor "ingresar"; el dueño de la plataforma lo puede revisar.

create table public.intentos_ingreso (
  id bigint generated always as identity primary key,
  tipo_documento text not null,
  numero_documento text not null,
  resultado text not null check (resultado in ('exito', 'fallo', 'bloqueado', 'inhabilitada', 'limite_supabase', 'error')),
  ip text,
  creado_en timestamptz not null default now()
);
comment on table public.intentos_ingreso is 'Cada intento de ingreso: documento escrito, resultado, dirección de internet y hora. Solo lo ve el dueño de la plataforma.';
create index intentos_ingreso_doc_idx on public.intentos_ingreso (tipo_documento, numero_documento, creado_en desc);
create index intentos_ingreso_ip_idx on public.intentos_ingreso (ip, creado_en desc);

alter table public.intentos_ingreso enable row level security;
revoke all on public.intentos_ingreso from anon, authenticated;
grant select on public.intentos_ingreso to authenticated;
create policy "El dueño revisa los intentos" on public.intentos_ingreso for select to authenticated
using ((select app.es_dueno_plataforma()));

-- ¿Hasta cuándo está bloqueado el ingreso? null = no está bloqueado.
--  · 5 fallos con el mismo documento en 15 minutos (desde su último ingreso correcto) → 15 minutos de bloqueo.
--  · 30 fallos desde la misma dirección de internet en 15 minutos (con cualquier documento) → 15 minutos.
-- Se aplica igual si el documento no existe, para no revelar quién tiene cuenta.
create function public.bloqueo_ingreso(p_tipo text, p_numero text, p_ip text) returns timestamptz
language sql stable security definer set search_path = '' as $$
  with ultimo_exito as (
    select coalesce(max(creado_en), '-infinity'::timestamptz) as t from public.intentos_ingreso
    where tipo_documento = p_tipo and numero_documento = p_numero and resultado = 'exito'
  ),
  fallos_doc as (
    select i.creado_en from public.intentos_ingreso i, ultimo_exito u
    where i.tipo_documento = p_tipo and i.numero_documento = p_numero and i.resultado = 'fallo'
      and i.creado_en > now() - interval '15 minutes' and i.creado_en > u.t
  ),
  fallos_ip as (
    select creado_en from public.intentos_ingreso
    where p_ip is not null and ip = p_ip and resultado = 'fallo' and creado_en > now() - interval '15 minutes'
  )
  select greatest(
    case when (select count(*) from fallos_doc) >= 5 then (select max(creado_en) from fallos_doc) + interval '15 minutes' end,
    case when (select count(*) from fallos_ip) >= 30 then (select max(creado_en) from fallos_ip) + interval '15 minutes' end
  );
$$;

revoke all on function public.bloqueo_ingreso(text, text, text) from public, anon, authenticated;
grant execute on function public.bloqueo_ingreso(text, text, text) to service_role;
