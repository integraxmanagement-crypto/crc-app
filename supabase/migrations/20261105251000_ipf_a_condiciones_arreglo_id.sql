-- Arreglo: en condiciones_abiertas_ipf la columna «id» de sedes chocaba con el parámetro de salida «id».
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.condiciones_abiertas_ipf(uuid, date, uuid, uuid)'::regprocedure);
  v_def := replace(v_def, $n$select * into s from public.sedes where id = p_sede;$n$, $r$select * into s from public.sedes where public.sedes.id = p_sede;$r$);
  if v_def not like '%public.sedes.id = p_sede%' then raise exception 'No se pudo actualizar condiciones_abiertas_ipf'; end if;
  execute v_def;
end $$;
