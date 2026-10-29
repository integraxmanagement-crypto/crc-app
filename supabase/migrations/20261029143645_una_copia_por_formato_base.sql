-- Revisión de diseño, obs. 12 (29/10/2026, aprobado por el dueño): una empresa tiene un solo formato activo por cada
-- formato base de CRC. No se copia otra vez el mismo formato base ni se reactiva una segunda copia; copiar un formato
-- propio de la empresa (para hacer una variante) sigue permitido. Solo cambia dos funciones de plantillas.
-- No toca personas, empresas, sedes, unidades, roles ni permisos.

create or replace function public.copiar_plantilla(p_empresa uuid, p_origen uuid) returns uuid
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
  -- Un solo formato por cada formato base de CRC en la empresa (revisión de diseño, obs. 12, 29/10/2026): si ya lo
  -- tiene activo, se edita ese (nueva versión) o se desactiva antes. Copiar un formato propio de la empresa sí se puede.
  if o.empresa_id is null and exists (select 1 from public.plantillas where empresa_id = p_empresa and base_id = o.id and vigente) then
    raise exception 'La empresa ya tiene este formato: edítalo (nueva versión) o desactívalo antes de copiarlo otra vez' using errcode = '22023';
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

create or replace function public.cambiar_vigencia_plantilla(p_plantilla uuid, p_vigente boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare pl public.plantillas;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or p_vigente is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_vigente and pl.base_id is not null
     and exists (select 1 from public.plantillas b where b.id = pl.base_id and b.empresa_id is null)
     and exists (select 1 from public.plantillas where empresa_id = pl.empresa_id and base_id = pl.base_id and vigente and id <> pl.id) then
    raise exception 'La empresa ya tiene otro formato activo copiado del mismo formato base' using errcode = '22023';
  end if;
  update public.plantillas set vigente = p_vigente, actualizado_en = now() where id = p_plantilla;
end $$;
