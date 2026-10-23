-- Tarea 3.3 · Decisión 4A: los intentos de ingreso se borran solos a los 90 días.
-- Plazo provisional, a validar con el abogado (tareas 5.3 y 5.8): contiene direcciones de internet (Ley 29733).
-- Usa pg_cron, el programador de tareas incluido en Supabase (sin costo), activado con autorización del dueño.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Devuelve cuántos intentos borró. También limpia el propio registro de ejecuciones de esta tarea (30 días).
create function app.borrar_intentos_antiguos() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_borrados integer;
begin
  delete from public.intentos_ingreso where creado_en < now() - interval '90 days';
  get diagnostics v_borrados = row_count;
  delete from cron.job_run_details
  where end_time < now() - interval '30 days'
    and jobid in (select jobid from cron.job where jobname = 'borrar-intentos-90-dias');
  return v_borrados;
end $$;

revoke all on function app.borrar_intentos_antiguos() from public, anon, authenticated;

-- Todos los días a las 03:15 de Lima (08:15 UTC).
select cron.schedule('borrar-intentos-90-dias', '15 8 * * *', 'select app.borrar_intentos_antiguos()');
