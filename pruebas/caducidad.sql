-- Prueba con fechas viejas de la caducidad de contraseña de administradores (nivel 2, punto 3). Solo crc-dev, solo la empresa ficticia D.
-- Se corre completa en el editor SQL de Supabase (o con la herramienta de Claude). Todo ocurre dentro de una transacción que se DESHACE al final
-- (termina con un error a propósito que dice «PRUEBA OK …»): no cambia ninguna fila. Si una comprobación falla, el mensaje dice cuál.
do $$
declare
  d uuid := (select id from public.empresas where ruc = '20000000052');
  adm uuid; sed uuid; ges uuid; usu uuid; due uuid;
begin
  select v.persona_id into adm from public.vinculos v where v.empresa_id = d and v.estado = 'activo' and v.rol = 'admin_empresa' limit 1;
  select v.persona_id into sed from public.vinculos v where v.empresa_id = d and v.estado = 'activo' and v.rol = 'admin_sede' limit 1;
  select v.persona_id into ges from public.vinculos v where v.empresa_id = d and v.estado = 'activo' and v.rol = 'gestor' limit 1;
  select v.persona_id into usu from public.vinculos v where v.empresa_id = d and v.estado = 'activo' and v.rol = 'usuario' limit 1;
  select persona_id into due from public.duenos_plataforma limit 1;
  if adm is null or sed is null or ges is null or usu is null or due is null then raise exception 'Faltan cuentas de prueba'; end if;

  -- Encendido para la empresa D, todos con la clave de hace 91 días
  insert into public.contrasenas_politica (empresa_id, caduca_admin) values (d, true) on conflict (empresa_id) do update set caduca_admin = true;
  insert into public.contrasenas_vigencia (persona_id, cambiada_en) select p, now() - interval '91 days' from unnest(array[adm, sed, ges, usu, due]) p
    on conflict (persona_id) do update set cambiada_en = excluded.cambiada_en;

  if not app.contrasena_vencida_de(adm) then raise exception 'FALLA a: el administrador general con 91 días debía estar vencido'; end if;
  if not app.contrasena_vencida_de(sed) then raise exception 'FALLA b: el administrador de sede con 91 días debía estar vencido'; end if;
  if app.contrasena_vencida_de(ges) then raise exception 'FALLA c: un gestor nunca debe vencer'; end if;
  if app.contrasena_vencida_de(usu) then raise exception 'FALLA d: un usuario nunca debe vencer'; end if;
  if app.contrasena_vencida_de(due) then raise exception 'FALLA e: el dueño de la plataforma nunca debe vencer'; end if;

  update public.contrasenas_vigencia set cambiada_en = now() - interval '89 days' where persona_id in (adm, sed);
  if app.contrasena_vencida_de(adm) or app.contrasena_vencida_de(sed) then raise exception 'FALLA f: con 89 días no debe estar vencido'; end if;

  update public.contrasenas_vigencia set cambiada_en = now() - interval '91 days' where persona_id in (adm, sed);
  update public.contrasenas_politica set caduca_admin = false where empresa_id = d;
  if app.contrasena_vencida_de(adm) or app.contrasena_vencida_de(sed) then raise exception 'FALLA g: con el interruptor apagado nadie debe vencer'; end if;
  update public.contrasenas_politica set caduca_admin = true where empresa_id = d;
  if not app.contrasena_vencida_de(adm) then raise exception 'FALLA h: al volver a encender debía estar vencido'; end if;

  -- Cambiar la clave renueva la fecha
  perform public.marcar_contrasena_cambiada(adm);
  if app.contrasena_vencida_de(adm) then raise exception 'FALLA i: al cambiar la clave ya no debe estar vencido'; end if;
  if (select cambiada_en from public.contrasenas_vigencia where persona_id = adm) < now() - interval '1 minute' then raise exception 'FALLA j: no se renovó la fecha'; end if;

  -- Administrador cesado: no vence (sin vínculo activo)
  update public.vinculos set estado = 'cesado', fecha_cese = current_date, motivo_cese = 'Prueba (ficticio)' where persona_id = sed and empresa_id = d and estado = 'activo';
  if app.contrasena_vencida_de(sed) then raise exception 'FALLA k: un administrador cesado no debe vencer'; end if;

  -- Cuenta sin fila de fechas: cuenta desde su creación
  delete from public.contrasenas_vigencia where persona_id = adm;
  if app.contrasena_vencida_de(adm) and (select creado_en from public.personas where id = adm) > now() - interval '90 days' then raise exception 'FALLA l: sin fecha y creada hace poco no debe vencer'; end if;

  -- La sesión del vencido no ve su vínculo activo (igual que «debe cambiar su contraseña»)
  update public.contrasenas_vigencia set cambiada_en = now() - interval '91 days' where persona_id = adm;
  insert into public.contrasenas_vigencia (persona_id, cambiada_en) values (adm, now() - interval '91 days') on conflict (persona_id) do update set cambiada_en = excluded.cambiada_en;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (app.mi_vinculo_activo()).id is not null then raise exception 'FALLA m: un administrador vencido no debe tener vínculo activo hasta cambiar la clave'; end if;
  if not public.contrasena_vencida() then raise exception 'FALLA n: contrasena_vencida() debía decir que sí'; end if;
  reset role;

  raise exception 'PRUEBA OK: 14 comprobaciones de fechas pasaron (se deshace todo)';
end $$;
