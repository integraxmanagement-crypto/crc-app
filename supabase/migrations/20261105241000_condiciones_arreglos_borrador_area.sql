-- Arreglos de la prueba pruebas/condiciones.mjs sobre la migración anterior:
--  · guardar_condicion: el texto «Descripción: …» se agregaba a la lista de faltantes como si fuera una lista; ahora se agrega como texto.
--  · revisar_cambio_columnas: el área ya no cambia de tipo (es la lista de áreas de la empresa).
--  · Las columnas «Área» que hubieran cambiado de tipo vuelven a ser del tipo «area».
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.guardar_condicion(uuid, uuid, jsonb, boolean)'::regprocedure);
  v_def := replace(v_def, $n$falta := falta || 'Descripción: peligro observado y riesgo asociado';$n$, $r$falta := array_append(falta, 'Descripción: peligro observado y riesgo asociado');$r$);
  if v_def not like '%array_append(falta%' then raise exception 'No se pudo actualizar guardar_condicion'; end if;
  execute v_def;

  v_def := pg_get_functiondef('app.revisar_cambio_columnas(uuid, jsonb)'::regprocedure);
  v_def := replace(v_def, $n$c.clave not in ('area', 'ubicacion', 'plan_accion'$n$, $r$c.clave not in ('ubicacion', 'plan_accion'$r$);
  if v_def like '%''area'', ''ubicacion''%' then raise exception 'No se pudo actualizar revisar_cambio_columnas'; end if;
  execute v_def;
end $$;

update public.condiciones_columnas set tipo = 'area', opciones = '{}' where clave = 'area' and es_base and tipo <> 'area';
