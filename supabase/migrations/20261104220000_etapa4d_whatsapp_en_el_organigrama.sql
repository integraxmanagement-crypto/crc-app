-- Etapa 4d (04/11/2026): el WhatsApp del gestor aparece en su puesto del organigrama solo si el gestor publicó su número.
-- Para eso cada puesto puede vincularse a la cuenta de un gestor. El vínculo es privado (nadie lee la tabla; solo lo ven, por función, quienes editan ese puesto).
-- Tabla NUEVA (no cambia tablas compartidas).

create table public.equipo_sst_enlaces (
  nodo_id uuid primary key references public.equipo_sst_nodos (id) on delete cascade,
  vinculo_id uuid not null references public.vinculos (id) on delete cascade
);
alter table public.equipo_sst_enlaces enable row level security;   -- sin políticas ni permisos: solo se usa por las funciones

-- Vincula (o desvincula, con p_vinculo nulo) un puesto con un gestor activo de esa sede.
create function public.vincular_nodo_equipo(p_nodo uuid, p_vinculo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.equipo_sst_nodos; v public.vinculos;
begin
  select * into n from public.equipo_sst_nodos where id = p_nodo;
  if n.id is null or n.empresa_id is distinct from app.mi_empresa() or not app.puedo_editar_equipo(n.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_vinculo is null then
    delete from public.equipo_sst_enlaces where nodo_id = p_nodo;
    return;
  end if;
  select * into v from public.vinculos where id = p_vinculo;
  if v.id is null or v.empresa_id <> n.empresa_id or v.rol <> 'gestor' or v.estado <> 'activo' then raise exception 'Solo se vincula a un gestor activo de la empresa' using errcode = '22023'; end if;
  if n.sede_id is not null and not exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and vs.sede_id = n.sede_id) then
    raise exception 'No autorizado: ese gestor no atiende la sede del puesto' using errcode = '42501';
  end if;
  insert into public.equipo_sst_enlaces (nodo_id, vinculo_id) values (p_nodo, p_vinculo)
  on conflict (nodo_id) do update set vinculo_id = excluded.vinculo_id;
end $$;

-- Gestores que se pueden vincular a un puesto de esa sede (nulo = toda la empresa; solo el administrador general).
create function public.gestores_para_vincular(p_sede uuid) returns table (vinculo_id uuid, nombre text)
language sql stable security definer set search_path = '' as $$
  select v.id, p.apellidos_nombres
  from public.vinculos v join public.personas p on p.id = v.persona_id
  where app.puedo_editar_equipo(p_sede) and v.empresa_id = app.mi_empresa() and v.rol = 'gestor' and v.estado = 'activo'
    and (p_sede is null or exists (select 1 from public.vinculos_sedes vs where vs.vinculo_id = v.id and vs.sede_id = p_sede))
  order by p.apellidos_nombres;
$$;

-- El WhatsApp de los puestos que ve quien consulta: solo de gestores activos que publicaron su número. Quien edita el puesto ve además a qué cuenta está vinculado.
create function public.contactos_equipo_sst() returns table (nodo_id uuid, whatsapp text, vinculo_id uuid)
language sql stable security definer set search_path = '' as $$
  select n.id, c.whatsapp, case when app.puedo_editar_equipo(n.sede_id) then e.vinculo_id end
  from public.equipo_sst_enlaces e
  join public.equipo_sst_nodos n on n.id = e.nodo_id
  join public.vinculos v on v.id = e.vinculo_id and v.rol = 'gestor' and v.estado = 'activo'
  left join public.contacto_sst c on c.vinculo_id = e.vinculo_id
  where app.veo_nodo_equipo(n.empresa_id, n.sede_id)
    and (c.whatsapp is not null or app.puedo_editar_equipo(n.sede_id));
$$;

-- Armar con el equipo actual: ahora también vincula a cada gestor con su puesto.
create or replace function public.armar_equipo_sst_actual() returns integer
language plpgsql security definer set search_path = '' as $$
declare e uuid := app.mi_empresa(); r record; padre uuid; nuevo uuid; cuantos integer := 0;
begin
  if e is null or not app.puedo_editar_equipo(null) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if exists (select 1 from public.equipo_sst_nodos where empresa_id = e) then raise exception 'El organigrama ya tiene puestos: no se arma de nuevo' using errcode = '22023'; end if;
  create temp table sem (nodo uuid, rol text, sede uuid) on commit drop;
  for r in
    select v.id as vid, v.rol, p.apellidos_nombres as nombre, coalesce(pu.nombre, v.puesto) as puesto,
           (select vs.sede_id from public.vinculos_sedes vs where vs.vinculo_id = v.id order by vs.sede_id limit 1) as sede
    from public.vinculos v join public.personas p on p.id = v.persona_id left join public.puestos pu on pu.id = v.puesto_id
    where v.empresa_id = e and v.estado = 'activo' and v.rol in ('admin_empresa', 'admin_sede', 'gestor', 'usuario_gestor')
    order by case v.rol when 'admin_empresa' then 1 when 'admin_sede' then 2 when 'gestor' then 3 else 4 end, p.apellidos_nombres
  loop
    padre := case r.rol
      when 'admin_empresa' then null
      when 'admin_sede' then (select nodo from sem where rol = 'admin_empresa' limit 1)
      when 'gestor' then coalesce((select nodo from sem where rol = 'admin_sede' and sede = r.sede limit 1), (select nodo from sem where rol = 'admin_empresa' limit 1))
      else coalesce((select nodo from sem where rol = 'gestor' and sede = r.sede limit 1), (select nodo from sem where rol = 'admin_sede' and sede = r.sede limit 1),
                    (select nodo from sem where rol = 'admin_empresa' limit 1)) end;
    insert into public.equipo_sst_nodos (empresa_id, sede_id, padre_id, puesto, nombre, creado_por)
    values (e, case when r.rol = 'admin_empresa' then null else r.sede end, padre,
            left(coalesce(nullif(btrim(r.puesto), ''), 'Equipo de SST'), 60), left(r.nombre, 80), (select auth.uid()))
    returning id into nuevo;
    insert into sem values (nuevo, r.rol, r.sede);
    if r.rol = 'gestor' then insert into public.equipo_sst_enlaces (nodo_id, vinculo_id) values (nuevo, r.vid); end if;
    cuantos := cuantos + 1;
  end loop;
  return cuantos;
end $$;

revoke all on table public.equipo_sst_enlaces from anon, public, authenticated;
revoke all on function public.vincular_nodo_equipo(uuid, uuid), public.gestores_para_vincular(uuid), public.contactos_equipo_sst() from anon, public;
grant execute on function public.vincular_nodo_equipo(uuid, uuid), public.gestores_para_vincular(uuid), public.contactos_equipo_sst() to authenticated;
