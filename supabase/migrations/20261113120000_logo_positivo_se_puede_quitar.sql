-- El logo positivo ahora también se puede quitar (pedido del dueño, 13/11/2026): cada logo, positivo y negativo, tiene su propio botón para quitarlo.
-- Sin logo positivo, los registros impresos salen sin logo. Solo cambia la función; no cambia tablas ni columnas.
create or replace function public.registrar_logo(p_empresa uuid, p_tipo text, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.es_dueno_plataforma()
          or (app.tengo_permiso('empresa.editar_logos') and p_empresa = app.mi_empresa())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('positivo', 'negativo') then
    raise exception 'Tipo de logo no válido' using errcode = '22023';
  end if;
  if p_ruta is not null and p_ruta !~ ('^' || p_empresa::text || '/' || p_tipo || '\.(png|jpg|webp)$') then
    raise exception 'Ruta de logo no válida' using errcode = '22023';
  end if;
  if p_tipo = 'positivo' then
    update public.empresas set logo_positivo = p_ruta, actualizado_en = now(), actualizado_por = (select auth.uid()) where id = p_empresa;
  else
    update public.empresas set logo_negativo = p_ruta, actualizado_en = now(), actualizado_por = (select auth.uid()) where id = p_empresa;
  end if;
end $$;
