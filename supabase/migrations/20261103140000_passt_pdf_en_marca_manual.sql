-- PASST: al marcar una semana como ejecutada, además de la foto opcional se puede cargar un PDF (pedido del dueño, 03/11/2026).
-- · Almacén privado nuevo «passt-pdf» (solo PDF, hasta 10 MB), con las mismas reglas de subida y de lectura que la foto de la marca manual.
-- · Dos columnas nuevas en passt_semanas (ruta y tamaño del PDF).
-- · marcar_semana recibe el PDF (parámetros nuevos con valor por defecto: las llamadas anteriores siguen funcionando).
-- No toca personas, empresas, roles ni permisos. passt_semanas no la usan los módulos de contratistas ni de medio ambiente.
alter table public.passt_semanas add column manual_pdf_ruta text, add column manual_pdf_bytes integer;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passt-pdf', 'passt-pdf', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Quién puede subir: igual que la foto de la marca manual (carpeta de la actividad, de su empresa y con permiso de marcar).
create or replace function app.puedo_subir_passt_pdf(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_nombre ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/passt-[0-9]{1,2}-[0-9a-f]{8}\.pdf$'
    and split_part(p_nombre, '/', 1) = app.mi_empresa()::text
    and exists (
      select 1 from public.passt_nodos n
      where n.id::text = split_part(p_nombre, '/', 2) and n.tipo = 'actividad' and n.vigente and n.empresa_id = app.mi_empresa()
        and exists (select 1 from public.passt_programas pp where pp.id = n.programa_id and app.puedo_ver_programa(pp.empresa_id, pp.sede_id))
        and (app.tengo_permiso('passt.marcar_manual')
             or (n.plantilla_id is null and n.responsable_id = (select auth.uid()) and app.tengo_permiso('passt.ver'))));
$$;

-- Quién puede ver: igual que la foto de la marca manual (dueño de la plataforma, o su empresa y su sede con permiso de ver el PASST).
create or replace function app.puedo_ver_passt_pdf(p_nombre text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.passt_semanas s
    where s.manual_pdf_ruta = p_nombre
      and (app.es_dueno_plataforma()
           or (s.empresa_id = app.mi_empresa() and app.tengo_permiso('passt.ver')
               and exists (select 1 from public.passt_nodos pn join public.passt_programas pp on pp.id = pn.programa_id
                           where pn.id = s.actividad_id and app.puedo_ver_programa(pp.empresa_id, pp.sede_id)))));
$$;
revoke all on function app.puedo_subir_passt_pdf(text), app.puedo_ver_passt_pdf(text) from public, anon;
grant execute on function app.puedo_subir_passt_pdf(text), app.puedo_ver_passt_pdf(text) to authenticated;

create policy "PASST PDF: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'passt-pdf' and app.puedo_subir_passt_pdf(name));
create policy "PASST PDF: ver" on storage.objects for select to authenticated
  using (bucket_id = 'passt-pdf' and app.puedo_ver_passt_pdf(name));

drop function public.marcar_semana(uuid, integer, boolean, text, text, integer);
create function public.marcar_semana(p_actividad uuid, p_semana integer, p_ejecutada boolean, p_comentario text, p_foto_ruta text, p_foto_bytes integer,
                                     p_pdf_ruta text default null, p_pdf_bytes integer default null) returns void
language plpgsql security definer set search_path = '' as $function$
declare n public.passt_nodos; pr public.passt_programas;
begin
  select * into n from public.passt_nodos where id = p_actividad;
  if n.id is null or n.tipo <> 'actividad' or not n.vigente then raise exception 'La actividad no existe' using errcode = '22023'; end if;
  select * into pr from public.passt_programas where id = n.programa_id;
  if not (app.puedo_programa(pr.empresa_id, pr.sede_id, 'passt.marcar_manual')
          or (n.plantilla_id is null and n.responsable_id = (select auth.uid()) and pr.empresa_id = app.mi_empresa() and app.tengo_permiso('passt.ver') and app.puedo_ver_programa(pr.empresa_id, pr.sede_id))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_semana is null or p_semana not between 1 and app.semanas_del_anio(pr.anio) then
    raise exception 'Semana no válida para %', pr.anio using errcode = '22023';
  end if;
  if p_ejecutada and length(trim(coalesce(p_comentario, ''))) < 3 then
    raise exception 'Escribe qué se hizo' using errcode = '22023';
  end if;
  if p_ejecutada and p_foto_ruta is not null and (p_foto_ruta !~ ('^' || pr.empresa_id::text || '/' || n.id::text || '/passt-' || p_semana || '-[0-9a-f]{8}\.(jpg|webp|png)$')
      or p_foto_bytes is null or p_foto_bytes not between 1 and 1048576) then
    raise exception 'La foto no está en la carpeta de la actividad' using errcode = '22023';
  end if;
  if p_ejecutada and p_pdf_ruta is not null and (p_pdf_ruta !~ ('^' || pr.empresa_id::text || '/' || n.id::text || '/passt-' || p_semana || '-[0-9a-f]{8}\.pdf$')
      or p_pdf_bytes is null or p_pdf_bytes not between 1 and 10485760) then
    raise exception 'El PDF no está en la carpeta de la actividad' using errcode = '22023';
  end if;
  insert into public.passt_semanas (actividad_id, empresa_id, semana) values (n.id, n.empresa_id, p_semana) on conflict (actividad_id, semana) do nothing;
  update public.passt_semanas set manual = coalesce(p_ejecutada, false),
    manual_comentario = case when p_ejecutada then left(trim(p_comentario), 1000) end,
    manual_foto_ruta = case when p_ejecutada then p_foto_ruta end, manual_foto_bytes = case when p_ejecutada then p_foto_bytes end,
    manual_pdf_ruta = case when p_ejecutada then p_pdf_ruta end, manual_pdf_bytes = case when p_ejecutada then p_pdf_bytes end,
    manual_por = case when p_ejecutada then (select auth.uid()) end, manual_en = case when p_ejecutada then now() end
  where actividad_id = n.id and semana = p_semana;
  perform app.passt_anotar(pr, n.id, case when p_ejecutada then 'marcado' else 'desmarcado' end,
                           jsonb_build_object('semana', p_semana, 'foto', p_foto_ruta, 'pdf', p_pdf_ruta), p_comentario);
end $function$;
revoke all on function public.marcar_semana(uuid, integer, boolean, text, text, integer, text, integer) from public, anon;
grant execute on function public.marcar_semana(uuid, integer, boolean, text, text, integer, text, integer) to authenticated, service_role;
