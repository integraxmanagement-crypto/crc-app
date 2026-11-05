-- Etapa 4b (04/11/2026): «Conoce al equipo de SST» como organigrama y con interruptor por empresa que maneja solo el dueño de la plataforma.
-- Tabla NUEVA (no cambia tablas compartidas). equipo_sst() ahora trae también al administrador general, a los de sede y a los usuarios gestores,
-- cada fila con su rol; el WhatsApp sigue saliendo solo para los gestores. Si el dueño deshabilita la sección para una empresa, nadie de ella recibe filas.

create table public.equipo_sst_config (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  habilitado boolean not null default true,
  actualizado_en timestamptz not null default now()
);
alter table public.equipo_sst_config enable row level security;
create policy "Equipo SST config: dueño o de la empresa" on public.equipo_sst_config for select to authenticated
  using (app.es_dueno_plataforma() or empresa_id = app.mi_empresa());

-- Sin fila = habilitado.
create function public.equipo_sst_habilitado() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.habilitado from public.equipo_sst_config c where c.empresa_id = app.mi_empresa()), true);
$$;

create function public.fijar_equipo_sst(p_empresa uuid, p_habilitado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_dueno();
  if not exists (select 1 from public.empresas where id = p_empresa) then raise exception 'La empresa no existe' using errcode = '22023'; end if;
  insert into public.equipo_sst_config (empresa_id, habilitado) values (p_empresa, coalesce(p_habilitado, true))
  on conflict (empresa_id) do update set habilitado = excluded.habilitado, actualizado_en = now();
end $$;

drop function public.equipo_sst();
create function public.equipo_sst() returns table (vinculo_id uuid, nombre text, rol text, puesto text, whatsapp text, sedes text[])
language sql stable security definer set search_path = '' as $$
  select v.id, p.apellidos_nombres, v.rol, coalesce(pu.nombre, v.puesto),
         case when v.rol = 'gestor' then c.whatsapp end,
         coalesce((select array_agg(s.nombre order by s.nombre) from public.vinculos_sedes vs join public.sedes s on s.id = vs.sede_id where vs.vinculo_id = v.id), '{}')
  from public.vinculos v
  join public.personas p on p.id = v.persona_id
  left join public.puestos pu on pu.id = v.puesto_id
  left join public.contacto_sst c on c.vinculo_id = v.id
  where app.mi_empresa() is not null and public.equipo_sst_habilitado()
    and v.empresa_id = app.mi_empresa() and v.estado = 'activo'
    and v.rol in ('admin_empresa', 'admin_sede', 'gestor', 'usuario_gestor')
    and (app.soy_general() or v.rol = 'admin_empresa'
         or exists (select 1 from public.vinculos_sedes mia join public.vinculos_sedes suya on suya.sede_id = mia.sede_id
                    where mia.vinculo_id = (app.mi_vinculo_activo()).id and suya.vinculo_id = v.id))
  order by v.rol, p.apellidos_nombres;
$$;

revoke all on table public.equipo_sst_config from anon, public, authenticated;
grant select on table public.equipo_sst_config to authenticated;
revoke all on function public.equipo_sst_habilitado(), public.fijar_equipo_sst(uuid, boolean), public.equipo_sst() from anon, public;
grant execute on function public.equipo_sst_habilitado(), public.fijar_equipo_sst(uuid, boolean), public.equipo_sst() to authenticated;
