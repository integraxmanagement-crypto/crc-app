create or replace function app.revisar_sedes_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'vinculos' then perform app.exigir_sedes(new.id);
  else perform app.exigir_sedes(old.vinculo_id);
  end if;
  return null;
end $$;
