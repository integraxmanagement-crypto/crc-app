-- Tarea 3.4-D (parte 1) · Frecuencia por formato, períodos e indicador de avance. Decisiones del dueño del 27/10/2026:
-- frecuencias semanal, mensual, bimestral, trimestral, semestral, anual y «sin frecuencia»; solo el administrador la
-- cambia (permiso que ya tiene: plantillas.publicar, sin filas nuevas en permisos); valores iniciales de las bases;
-- el total de un período son los equipos de la sede que existían al terminarlo y no estaban dados de baja.
-- Los períodos (semanas ISO, cada semana en el mes de su jueves) los calcula la app; aquí llegan como fechas.

alter table public.plantillas drop constraint plantillas_frecuencia_check;
alter table public.plantillas add constraint plantillas_frecuencia_check
  check (frecuencia in ('semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual', 'sin_frecuencia'));

-- Valores iniciales aprobados para las plantillas base (las copias ya hechas por las empresas no cambian).
update public.plantillas set frecuencia = 'trimestral' where empresa_id is null and codigo = 'loto';
update public.plantillas set frecuencia = 'mensual' where empresa_id is null and codigo = 'ipf';

-- Nombre y descripción: quien edita formatos. La frecuencia, una vez creado el formato, solo el administrador.
create or replace function public.guardar_plantilla(p_plantilla uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pl public.plantillas;
  v_nombre text := app.texto(p_datos, 'nombre');
  v_desc text := app.texto(p_datos, 'descripcion');
  v_frec text;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or not app.puedo_en_empresa(pl.empresa_id, 'plantillas.editar') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  v_frec := coalesce(app.texto(p_datos, 'frecuencia'), pl.frecuencia);
  if v_nombre is null or length(v_nombre) not between 3 and 160 or length(coalesce(v_desc, '')) > 400 then
    raise exception 'Revisa el nombre (3 a 160) y la descripción (hasta 400)' using errcode = '22023';
  end if;
  if v_frec not in ('semanal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual', 'sin_frecuencia') then
    raise exception 'Frecuencia no válida' using errcode = '22023';
  end if;
  if v_frec <> pl.frecuencia and not app.puedo_en_empresa(pl.empresa_id, 'plantillas.publicar') then
    raise exception 'Solo el administrador cambia la frecuencia' using errcode = '42501';
  end if;
  update public.plantillas set nombre = v_nombre, descripcion = v_desc, frecuencia = v_frec, actualizado_en = now()
  where id = p_plantilla;
end $$;

-- Avance de un formato en una sede y un período [p_desde, p_hasta].
--  · Formatos de activo: una fila por equipo que cuenta en el período, con su última inspección cerrada en él (si hay).
--    Cuenta si existía al terminar el período y no estaba dado de baja en ese momento. Inoperativo = inspeccionado.
--  · Formatos de área: una fila por inspección cerrada en el período (no hay total).
create function public.avance_periodo(p_plantilla uuid, p_sede uuid, p_desde date, p_hasta date)
returns table (activo_id uuid, codigo text, numero integer, subtipo text, ubicacion_id uuid, unidad_id uuid,
               inspeccion_id uuid, inspeccion_numero integer, fecha date, resultado text, hallazgos integer)
language plpgsql stable security definer set search_path = '' as $$
declare pl public.plantillas;
begin
  select * into pl from public.plantillas where id = p_plantilla;
  if pl.id is null or pl.empresa_id is null or not app.puedo_en_empresa(pl.empresa_id, 'inspecciones.ver') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'Período no válido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede and s.empresa_id = pl.empresa_id) then
    raise exception 'La sede no es de la empresa' using errcode = '22023';
  end if;
  if pl.aplica_a = 'activo' then
    return query
      select a.id, a.codigo, a.numero, a.subtipo, a.ubicacion_id, a.unidad_id,
             u.id, u.numero, u.fecha, u.resultado, coalesce(jsonb_array_length(u.hallazgos), 0)
      from public.activos a
      left join lateral (
        select i.id, i.numero, i.fecha, i.resultado, i.hallazgos from public.inspecciones i
        where i.activo_id = a.id and i.plantilla_id = pl.id and i.estado = 'cerrada' and i.fecha between p_desde and p_hasta
        order by i.fecha desc, i.numero desc limit 1
      ) u on true
      where a.empresa_id = pl.empresa_id and a.tipo_id = pl.tipo_activo_id and a.sede_id = p_sede
        and a.creado_en::date <= p_hasta
        and (a.estado = 'activo' or a.fecha_baja > p_hasta)
      order by a.codigo;
  else
    return query
      select null::uuid, null::text, null::integer, null::text, i.ubicacion_id, i.unidad_id,
             i.id, i.numero, i.fecha, i.resultado, coalesce(jsonb_array_length(i.hallazgos), 0)
      from public.inspecciones i
      where i.plantilla_id = pl.id and i.sede_id = p_sede and i.estado = 'cerrada' and i.fecha between p_desde and p_hasta
      order by i.fecha, i.numero;
  end if;
end $$;

revoke all on function public.avance_periodo(uuid, uuid, date, date) from public, anon;
grant execute on function public.avance_periodo(uuid, uuid, date, date) to authenticated;
