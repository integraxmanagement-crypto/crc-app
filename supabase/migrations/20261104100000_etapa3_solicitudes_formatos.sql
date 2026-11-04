-- Etapa 3 del punto 2 (decisión del dueño, 03/11/2026): el gestor prepara un borrador de formato (nuevo o cambio de uno publicado) y PIDE publicarlo,
-- o pide retirar un formato. Solo el administrador general decide (la solicitud no tiene sede: el formato es de toda la empresa).
-- Aprobar publica el borrador A NOMBRE del administrador, solo si el borrador sigue igual que cuando se pidió (huella).
-- El gestor ya no retira ni reactiva formatos directo (antes podía: cambiar_vigencia_plantilla pedía «plantillas.editar»).
-- No toca roles ni permisos: usa «solicitudes.pedir» (gestor) y «solicitudes.resolver» (administradores) de la etapa 2.

alter table public.solicitudes_cambio drop constraint solicitudes_cambio_tipo_check;
alter table public.solicitudes_cambio add constraint solicitudes_cambio_tipo_check
  check (tipo = any (array['anular_inspeccion', 'corregir_inspeccion', 'cambio_programa', 'publicar_formato', 'retirar_formato']));

-- Huella del borrador: lo que el administrador revisa es exactamente lo que se publica.
create function app.huella_borrador(p_version uuid) returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(concat_ws('|', v.receta::text, coalesce(v.codigo_formato, ''), coalesce(v.version_formato, ''),
                                                       coalesce(v.fecha_aprobacion::text, ''), coalesce(v.logo, '')), 'UTF8'), 'sha256'), 'hex')
  from public.plantillas_versiones v where v.id = p_version;
$$;
revoke all on function app.huella_borrador(uuid) from public, anon, authenticated;

-- Pedir un cambio (anular/corregir inspecciones, cambiar el programa aprobado, publicar o retirar un formato)
create or replace function public.solicitar_cambio(p_tipo text, p_objetivo uuid, p_datos jsonb, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me public.vinculos := app.mi_vinculo_activo();
  i public.inspecciones; pr public.passt_programas; vv public.plantillas_versiones; pl public.plantillas;
  v_id uuid; v_titulo text; v_sede uuid; v_datos jsonb := coalesce(p_datos, '{}'::jsonb); v_nuevo boolean;
begin
  if me.id is null or me.rol <> 'gestor' or not app.tengo_permiso('solicitudes.pedir') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Escribe el motivo' using errcode = '22023';
  end if;
  if p_tipo in ('anular_inspeccion', 'corregir_inspeccion') then
    select * into i from public.inspecciones where id = p_objetivo;
    if i.id is null or i.empresa_id <> me.empresa_id or not app.puedo_sede(i.sede_id) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if i.estado <> 'cerrada' then raise exception 'Solo se piden cambios sobre inspecciones cerradas' using errcode = '22023'; end if;
    v_sede := i.sede_id;
    if p_tipo = 'anular_inspeccion' then
      if app.tengo_permiso('inspecciones.anular') then raise exception 'Ya tienes permiso para anular: hazlo directo' using errcode = '22023'; end if;
      v_titulo := format('Anular la inspección N.º %s', i.numero);
      v_datos := '{}'::jsonb;
    else
      if app.tengo_permiso('inspecciones.editar_cerrada') then raise exception 'Ya tienes permiso para corregir: hazlo directo' using errcode = '22023'; end if;
      if jsonb_typeof(v_datos -> 'respuestas') is distinct from 'object' or jsonb_typeof(v_datos -> 'edicion') is distinct from 'number' then
        raise exception 'Faltan las respuestas corregidas' using errcode = '22023';
      end if;
      v_titulo := format('Corregir la inspección N.º %s', i.numero);
      v_datos := jsonb_strip_nulls(jsonb_build_object('edicion', v_datos -> 'edicion', 'respuestas', v_datos -> 'respuestas', 'filas', v_datos -> 'filas', 'observacion', v_datos -> 'observacion'));
    end if;
  elsif p_tipo = 'cambio_programa' then
    select * into pr from public.passt_programas where id = p_objetivo;
    if pr.id is null or pr.empresa_id <> me.empresa_id or not app.puedo_ver_programa(pr.empresa_id, pr.sede_id) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if pr.sede_id is not null and not app.puedo_sede(pr.sede_id) then raise exception 'No autorizado' using errcode = '42501'; end if;
    if pr.estado <> 'aprobado' then raise exception 'Mientras el programa está en borrador se edita directo' using errcode = '22023'; end if;
    if app.puedo_programa(pr.empresa_id, pr.sede_id, 'passt.reprogramar') then raise exception 'Ya tienes permiso para cambiar el programa: hazlo directo' using errcode = '22023'; end if;
    perform app.revisar_cambio_programa(pr.id, v_datos);
    v_sede := pr.sede_id;
    v_titulo := format('Cambiar el programa «%s»', pr.nombre);
  elsif p_tipo = 'publicar_formato' then
    select * into vv from public.plantillas_versiones where id = p_objetivo;
    if vv.id is null or vv.empresa_id is null or vv.empresa_id <> me.empresa_id or not app.tengo_permiso('plantillas.editar') then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if app.tengo_permiso('plantillas.publicar') then raise exception 'Ya tienes permiso para publicar: hazlo directo' using errcode = '22023'; end if;
    if vv.estado <> 'borrador' then raise exception 'Solo se pide publicar un borrador' using errcode = '22023'; end if;
    select * into pl from public.plantillas where id = vv.plantilla_id;
    if not pl.vigente then raise exception 'El formato está retirado' using errcode = '22023'; end if;
    if exists (select 1 from public.solicitudes_cambio where tipo = 'publicar_formato' and objetivo_id = p_objetivo and estado = 'pendiente') then
      raise exception 'Ya hay una solicitud pendiente para este borrador' using errcode = '22023';
    end if;
    if vv.codigo_formato is null or vv.version_formato is null or vv.fecha_aprobacion is null then
      raise exception 'Para pedir la publicación, completa el código, la versión y la fecha de aprobación del formato' using errcode = '22023';
    end if;
    perform app.validar_receta(vv.receta, true);
    v_nuevo := not exists (select 1 from public.plantillas_versiones where plantilla_id = vv.plantilla_id and estado in ('vigente', 'retirada'));
    v_titulo := case when v_nuevo then format('Publicar el formato nuevo «%s»', pl.nombre)
                     else format('Publicar un cambio del formato «%s» (versión %s)', pl.nombre, vv.numero) end;
    v_datos := jsonb_build_object('plantilla', pl.id, 'numero', vv.numero, 'nuevo', v_nuevo, 'huella', app.huella_borrador(vv.id));
  elsif p_tipo = 'retirar_formato' then
    select * into pl from public.plantillas where id = p_objetivo;
    if pl.id is null or pl.empresa_id is null or pl.empresa_id <> me.empresa_id or not app.tengo_permiso('plantillas.editar') then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if app.tengo_permiso('plantillas.publicar') then raise exception 'Ya tienes permiso para retirar: hazlo directo' using errcode = '22023'; end if;
    if not pl.vigente then raise exception 'El formato ya está retirado' using errcode = '22023'; end if;
    if exists (select 1 from public.solicitudes_cambio where tipo = 'retirar_formato' and objetivo_id = p_objetivo and estado = 'pendiente') then
      raise exception 'Ya hay una solicitud pendiente para retirar este formato' using errcode = '22023';
    end if;
    v_titulo := format('Retirar el formato «%s»', pl.nombre);
    v_datos := jsonb_build_object('plantilla', pl.id);
  else
    raise exception 'Tipo de solicitud no válido' using errcode = '22023';
  end if;
  insert into public.solicitudes_cambio (empresa_id, sede_id, tipo, estado, objetivo_id, titulo, motivo, datos, solicitado_por)
  values (me.empresa_id, v_sede, p_tipo, 'pendiente', p_objetivo, v_titulo, trim(p_motivo), v_datos, me.persona_id)
  returning id into v_id;
  return v_id;
end $$;

-- Resolver: aprobar ejecuta el cambio a nombre de quien aprueba
create or replace function public.resolver_solicitud(p_id uuid, p_aprobar boolean, p_comentario text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.solicitudes_cambio; vv public.plantillas_versiones;
begin
  select * into s from public.solicitudes_cambio where id = p_id for update;
  if s.id is null or not app.puedo_resolver_solicitud(p_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if s.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta' using errcode = '22023'; end if;
  if not p_aprobar then
    if p_comentario is null or length(trim(p_comentario)) < 3 then raise exception 'Escribe por qué se deniega' using errcode = '22023'; end if;
  elsif s.tipo = 'anular_inspeccion' then
    perform public.anular_inspeccion(s.objetivo_id, s.motivo);
  elsif s.tipo = 'cambio_programa' then
    perform app.aplicar_cambio_programa(s);
  elsif s.tipo = 'corregir_inspeccion' then
    if not exists (select 1 from public.inspecciones_ediciones e
                   where e.inspeccion_id = s.objetivo_id and e.hecho_por = (select auth.uid()) and e.hecho_en >= s.solicitado_en
                     and e.edicion = (s.datos ->> 'edicion')::int) then
      raise exception 'Primero aplica la corrección y luego aprueba la solicitud' using errcode = '22023';
    end if;
  elsif s.tipo = 'publicar_formato' then
    select * into vv from public.plantillas_versiones where id = s.objetivo_id for update;
    if vv.id is null or vv.estado <> 'borrador' then
      raise exception 'El borrador ya no está disponible: deniega la solicitud' using errcode = '22023';
    end if;
    if app.huella_borrador(vv.id) is distinct from s.datos ->> 'huella' then
      raise exception 'El borrador cambió después de la solicitud: revísalo o deniega para que lo pida de nuevo' using errcode = '22023';
    end if;
    perform public.publicar_version(s.objetivo_id);
  elsif s.tipo = 'retirar_formato' then
    perform public.cambiar_vigencia_plantilla(s.objetivo_id, false);
  end if;
  update public.solicitudes_cambio set estado = case when p_aprobar then 'aprobada' else 'denegada' end, resuelto_por = (select auth.uid()), resuelto_en = now(),
    comentario_resolucion = nullif(trim(coalesce(p_comentario, '')), ''), visto_solicitante = false
  where id = p_id;
end $$;

-- Retirar o reactivar un formato: solo quien puede publicar (administrador general o dueño). El gestor lo pide.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.cambiar_vigencia_plantilla(uuid, boolean)'::regprocedure);
  v_def := replace(v_def, '''plantillas.editar''', '''plantillas.publicar''');
  if v_def not like '%plantillas.publicar%' then raise exception 'No se pudo actualizar cambiar_vigencia_plantilla'; end if;
  execute v_def;
end $$;
