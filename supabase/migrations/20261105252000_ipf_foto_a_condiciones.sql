-- Arreglo: la foto de evidencia de una condición del IPF no llegaba a la matriz porque se registra DESPUÉS de la inspección
-- (la copia a la matriz se hacía antes de que la foto existiera). Ahora, cuando se registra una foto de un IPF, se vuelve a trasladar
-- esa inspección (es idempotente: solo toca condiciones que nadie ha editado ni cerrado). También se repara lo ya trasladado.

create function app.al_registrar_foto_condiciones() returns trigger language plpgsql security definer set search_path = '' as $$
declare i public.inspecciones;
begin
  if new.punto_clave <> 'IPF-C03' then return null; end if;
  begin
    select * into i from public.inspecciones where id = new.inspeccion_id;
    if i.id is not null then perform app.trasladar_ipf(i); end if;
  exception when others then
    raise warning 'No se pudo trasladar la foto del IPF % a la matriz: %', new.inspeccion_id, sqlerrm;
  end;
  return null;
end $$;
create trigger archivos_condiciones after insert on public.archivos
for each row execute function app.al_registrar_foto_condiciones();
revoke all on function app.al_registrar_foto_condiciones() from public, anon, authenticated;

do $$
declare i public.inspecciones;
begin
  for i in select * from public.inspecciones x where x.estado = 'cerrada' and exists (select 1 from public.condiciones c where c.id = md5(x.id::text || '|ipf|0')::uuid) loop
    perform app.trasladar_ipf(i);
  end loop;
end $$;
