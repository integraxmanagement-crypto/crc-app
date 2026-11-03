-- Etapa 2: la carga de personal desde Excel acepta también «usuario_gestor».
-- Igual que antes, quien carga solo asigna los roles que su rol puede asignar (app.puedo_gestionar mira roles_asignables):
-- el gestor carga usuarios y usuarios gestores; el administrador, además, gestores.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.grabar_carga(uuid, uuid, jsonb)'::regprocedure);
  v_def := replace(v_def, 'not in (''gestor'', ''usuario'')', 'not in (''gestor'', ''usuario_gestor'', ''usuario'')');
  v_def := replace(v_def, 'rol in (''gestor'', ''usuario'') and persona_id', 'rol in (''gestor'', ''usuario_gestor'', ''usuario'') and persona_id');
  if v_def not like '%usuario_gestor%' then raise exception 'No se pudo actualizar grabar_carga'; end if;
  execute v_def;
end $$;
