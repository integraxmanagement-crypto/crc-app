-- Arreglo (prueba pruebas/condiciones.mjs): cambiar solo el nombre de una columna de lista borraba sus opciones.
-- Ahora las opciones solo cambian si el cambio las trae.
create or replace function app.aplicar_cambio_columnas(p_sede uuid, d jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare op text := d ->> 'operacion'; s public.sedes; c public.condiciones_columnas; t text; ops text[];
begin
  select * into s from public.sedes where id = p_sede;
  if op = 'agregar' then
    t := d ->> 'tipo';
    ops := case when t in ('lista', 'multiple') then array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e) else '{}'::text[] end;
    insert into public.condiciones_columnas (empresa_id, sede_id, clave, nombre, tipo, opciones, obligatoria, visible, orden, es_base)
    values (s.empresa_id, p_sede, 'c_' || substr(md5(gen_random_uuid()::text), 1, 8), trim(d ->> 'nombre'), t, ops,
            coalesce((d ->> 'obligatoria')::boolean, false), true,
            coalesce((select max(orden) from public.condiciones_columnas where sede_id = p_sede), 0) + 1, false);
  else
    select * into c from public.condiciones_columnas where sede_id = p_sede and clave = d ->> 'clave' for update;
    if op = 'ocultar' then update public.condiciones_columnas set visible = false where id = c.id;
    elsif op = 'mostrar' then update public.condiciones_columnas set visible = true where id = c.id;
    elsif op = 'eliminar' then
      delete from public.condiciones_columnas where id = c.id;
      update public.condiciones set datos = datos - c.clave - (c.clave || '_nombre') where sede_id = p_sede and (datos ? c.clave);
    elsif op = 'modificar' then
      t := coalesce(d ->> 'tipo', c.tipo);
      update public.condiciones_columnas set
        nombre = coalesce(nullif(trim(d ->> 'nombre'), ''), nombre),
        tipo = t,
        opciones = case when t not in ('lista', 'multiple') then '{}'::text[]
                        when d ? 'opciones' then array(select trim(e) from jsonb_array_elements_text(d -> 'opciones') e)
                        else c.opciones end,
        obligatoria = case when c.tipo in ('estado', 'responsable_auto') then false else coalesce((d ->> 'obligatoria')::boolean, obligatoria) end
      where id = c.id;
    end if;
  end if;
end $$;
