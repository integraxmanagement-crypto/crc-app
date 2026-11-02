-- El acceso se limita por permisos de ejecución (solo service_role), como las demás funciones del servidor; la comprobación auth.role() fallaba con las claves nuevas.
do $$
declare d text := pg_get_functiondef('public.alta_vinculo(jsonb)'::regprocedure);
begin
  d := replace(d, E'  if auth.role() is distinct from ''service_role'' then raise exception ''No autorizado'' using errcode = ''42501''; end if;\n', '');
  execute d;
end $$;
revoke all on function public.alta_vinculo(jsonb) from public, anon, authenticated;
grant execute on function public.alta_vinculo(jsonb) to service_role;
