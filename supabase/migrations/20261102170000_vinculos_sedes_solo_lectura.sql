-- La tabla vinculos_sedes quedó con permisos de escritura para anon y authenticated. Solo se lee (la RLS decide qué filas);
-- las escrituras pasan por las funciones asignar_sedes y alta_vinculo.
revoke all on table public.vinculos_sedes from anon, public;
revoke all on table public.vinculos_sedes from authenticated;
grant select on table public.vinculos_sedes to authenticated;
