-- Nivel 2, punto 3 (04/11/2026): caducidad de la contraseña de los administradores (empresa y sede) a los 90 días, con interruptor por empresa.
-- Reglas del dueño: solo administradores de empresa y de sede; NO el dueño de la plataforma (no tiene vínculo de empresa); las cuentas existentes cuentan
-- desde la fecha de activación; se enciende o apaga por empresa (solo el dueño); en crc-dev queda APAGADO en las empresas ficticias que usan las pruebas.
-- NO escribe en personas ni vinculos: la «clave vencida» se calcula con dos tablas NUEVAS y se trata como hoy se trata «debe cambiar su contraseña».
-- Cambia dos funciones: marcar_contrasena_cambiada (además de lo de siempre, anota la fecha) y app.mi_vinculo_activo (una condición más: clave no vencida).

create table public.contrasenas_vigencia (
  persona_id uuid primary key references public.personas (id) on delete cascade,
  cambiada_en timestamptz not null default now()
);
create table public.contrasenas_politica (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  caduca_admin boolean not null,
  actualizado_en timestamptz not null default now()
);
alter table public.contrasenas_vigencia enable row level security;   -- sin políticas ni permisos: solo las funciones la usan
alter table public.contrasenas_politica enable row level security;
create policy "Politica de contraseñas: solo el dueño" on public.contrasenas_politica for select to authenticated using (app.es_dueno_plataforma());

-- ¿La contraseña de esta persona venció? Solo administradores de empresa o de sede con vínculo activo, en empresas con la caducidad encendida
-- (sin fila = encendida). Sin fecha guardada cuenta desde la creación de la cuenta.
create function app.contrasena_vencida_de(p_persona uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.personas p
    left join public.contrasenas_vigencia g on g.persona_id = p.id
    where p.id = p_persona
      and coalesce(g.cambiada_en, p.creado_en) < now() - interval '90 days'
      and exists (
        select 1 from public.vinculos v
        where v.persona_id = p.id and v.estado = 'activo' and v.rol in ('admin_empresa', 'admin_sede')
          and coalesce((select c.caduca_admin from public.contrasenas_politica c where c.empresa_id = v.empresa_id), true)));
$$;

create function public.contrasena_vencida() returns boolean language sql stable security definer set search_path = '' as $$
  select app.contrasena_vencida_de((select auth.uid()));
$$;

-- Solo el dueño de la plataforma enciende o apaga la caducidad de una empresa.
create function public.fijar_caducidad_admin(p_empresa uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_dueno();
  if not exists (select 1 from public.empresas where id = p_empresa) then raise exception 'La empresa no existe' using errcode = '22023'; end if;
  insert into public.contrasenas_politica (empresa_id, caduca_admin) values (p_empresa, coalesce(p_activo, true))
  on conflict (empresa_id) do update set caduca_admin = excluded.caduca_admin, actualizado_en = now();
end $$;

-- Al cambiar la contraseña (ya la llama la función del servidor «cambiar-contrasena») se anota la fecha.
create or replace function public.marcar_contrasena_cambiada(p_persona uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.personas set debe_cambiar_contrasena = false where id = p_persona;
  insert into public.contrasenas_vigencia (persona_id, cambiada_en) values (p_persona, now())
  on conflict (persona_id) do update set cambiada_en = now();
end $$;

-- Quien tiene la clave vencida no tiene vínculo activo hasta cambiarla (igual que «debe cambiar su contraseña»).
create or replace function app.mi_vinculo_activo() returns public.vinculos
language sql stable security definer set search_path = '' as $$
  select v.* from public.vinculos v
  join public.empresas e on e.id = v.empresa_id
  join public.personas p on p.id = v.persona_id
  where v.persona_id = (select auth.uid()) and v.estado = 'activo' and e.estado = 'activa'
    and not p.debe_cambiar_contrasena
    and not app.contrasena_vencida_de(p.id)
  limit 1;
$$;

-- Activación: los administradores actuales cuentan desde hoy (nadie queda bloqueado el día de la activación).
insert into public.contrasenas_vigencia (persona_id, cambiada_en)
select distinct v.persona_id, now() from public.vinculos v where v.estado = 'activo' and v.rol in ('admin_empresa', 'admin_sede')
on conflict (persona_id) do nothing;
-- En crc-dev las empresas ficticias (las que usan las pruebas automáticas) quedan con la caducidad APAGADA.
insert into public.contrasenas_politica (empresa_id, caduca_admin) select id, false from public.empresas where es_prueba
on conflict (empresa_id) do nothing;

revoke all on table public.contrasenas_vigencia, public.contrasenas_politica from anon, public, authenticated;
grant select on table public.contrasenas_politica to authenticated;
revoke all on function app.contrasena_vencida_de(uuid) from anon, public, authenticated;
revoke all on function public.contrasena_vencida(), public.fijar_caducidad_admin(uuid, boolean) from anon, public;
grant execute on function public.contrasena_vencida(), public.fijar_caducidad_admin(uuid, boolean) to authenticated;
