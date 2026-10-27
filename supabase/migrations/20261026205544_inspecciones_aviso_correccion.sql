-- Tarea 3.4-C · Corrección encontrada por pruebas/inspecciones.mjs: el aviso «alguien la cambió antes» usaba el código
-- 40001, que el servidor de Supabase reintenta solo; ahora usa el código de dato no válido (22023), como los demás avisos.

-- Corregir una inspección cerrada (solo con señal, decisión b): guarda cómo estaba y reemplaza las respuestas.
-- También la llama solo la función del servidor, que recalcula el resultado.
create or replace function public.corregir_inspeccion(p_por uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  i public.inspecciones;
  v_motivo text := app.texto(p_datos, 'motivo');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_por, 'role', 'authenticated')::text, true);
  select * into i from public.inspecciones where id = (p_datos ->> 'id')::uuid for update;
  if i.id is null or i.empresa_id <> app.mi_empresa() or not app.tengo_permiso('inspecciones.editar_cerrada') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if i.estado <> 'cerrada' then
    raise exception 'Una inspección anulada no se corrige' using errcode = '22023';
  end if;
  if (p_datos ->> 'edicion')::integer is distinct from i.edicion then
    raise exception 'Alguien la cambió antes: vuelve a abrirla' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) < 3 then
    raise exception 'Escribe el motivo de la corrección' using errcode = '22023';
  end if;
  insert into public.inspecciones_ediciones (inspeccion_id, empresa_id, edicion, antes, motivo, hecho_por)
  values (i.id, i.empresa_id, i.edicion, to_jsonb(i), v_motivo, p_por);
  update public.inspecciones set respuestas = coalesce(p_datos -> 'respuestas', '{}'::jsonb), filas = coalesce(p_datos -> 'filas', '{}'::jsonb),
    observacion = nullif(trim(coalesce(p_datos ->> 'observacion', '')), ''), resultado = p_datos ->> 'resultado',
    puntaje = (p_datos ->> 'puntaje')::integer, hallazgos = coalesce(p_datos -> 'hallazgos', '[]'::jsonb),
    vencidos = coalesce(p_datos -> 'vencidos', '[]'::jsonb), edicion = i.edicion + 1
  where id = i.id returning * into i;
  update public.inspecciones set huella = app.huella_inspeccion(i) where id = i.id returning * into i;
  return jsonb_build_object('estado', 'corregida', 'edicion', i.edicion, 'huella', i.huella);
end $$;
