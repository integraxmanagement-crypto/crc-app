-- Quien administra una sede solo toca las sedes de una cuenta que ya comparte al menos una sede con él.
do $$
declare d text := pg_get_functiondef('public.asignar_sedes(uuid,uuid[])'::regprocedure);
begin
  d := replace(d, E'  if not app.soy_general() then\n    foreach s in array (select coalesce(array_agg(x), ''{}'') from (select unnest(v_nuevo) x except',
    E'  if not app.soy_general() then\n    if not exists (select 1 from unnest(v_actual) a where app.puedo_sede(a)) then raise exception ''No autorizado'' using errcode = ''42501''; end if;\n    foreach s in array (select coalesce(array_agg(x), ''{}'') from (select unnest(v_nuevo) x except');
  if position('v_actual) a where app.puedo_sede' in d) = 0 then raise exception 'no se pudo parchar'; end if;
  execute d;
end $$;
