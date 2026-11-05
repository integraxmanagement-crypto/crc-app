-- Arreglo: aunque alguien ya hubiera abierto o editado la condición, la foto del IPF debe llegar si todavía no tenía.
-- Solo se agrega la foto cuando falta (nunca se cambia una foto que ya tiene). También repara las condiciones ya trasladadas sin foto.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('app.trasladar_ipf(public.inspecciones)'::regprocedure);
  v_def := replace(v_def, $n$      where public.condiciones.actualizado_por is null and public.condiciones.fecha_cierre is null;$n$,
    $r$      where public.condiciones.actualizado_por is null and public.condiciones.fecha_cierre is null;
    if ev is not null then
      update public.condiciones set datos = datos || jsonb_build_object('evidencia', ev) where id = v_id and not (datos ? 'evidencia');
    end if;$r$);
  if v_def not like '%not (datos ? ''evidencia'')%' then raise exception 'No se pudo actualizar trasladar_ipf'; end if;
  execute v_def;
end $$;

update public.condiciones c set datos = c.datos || jsonb_build_object('evidencia', 'evidencias:' || a.ruta)
from public.archivos a
where a.punto_clave = 'IPF-C03' and a.fila is not null
  and c.id = md5(a.inspeccion_id::text || '|ipf|' || a.fila::text)::uuid
  and not (c.datos ? 'evidencia');
