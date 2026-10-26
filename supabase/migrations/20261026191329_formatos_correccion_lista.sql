-- Tarea 3.4-B · Corrección encontrada por pruebas/formatos.mjs: al dar de alta un activo nuevo, un valor que no
-- está en la lista de la empresa (p. ej. un agente extintor inventado) pasaba la revisión, porque la comparación
-- con «el valor que ya tenía» daba vacío. Ahora un valor fuera de la lista solo se acepta si es el que el activo ya tenía.

-- Revisa los datos de la ficha según los campos del tipo y devuelve solo los que corresponden.
create or replace function app.validar_datos_activo(p_tipo public.tipos_activo, p_subtipo text, p_datos jsonb, p_anteriores jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c jsonb; v jsonb; v_out jsonb := '{}'::jsonb; k text; v_et text; v_desde jsonb;
begin
  for c in select value from jsonb_array_elements(p_tipo.campos) loop
    k := c ->> 'clave';
    v_et := c ->> 'etiqueta';
    if jsonb_typeof(c -> 'solo_subtipos') = 'array' and jsonb_array_length(c -> 'solo_subtipos') > 0
       and not (c -> 'solo_subtipos') ? coalesce(p_subtipo, '') then
      continue;
    end if;
    v := p_datos -> k;
    if app.es_texto_vacio(v) and jsonb_typeof(c -> 'calcula') = 'object' then
      v_desde := v_out -> (c -> 'calcula' ->> 'desde');
      if v_desde is not null then
        v := to_jsonb(to_char(((v_desde #>> '{}') || '-01')::date + make_interval(months => (c -> 'calcula' ->> 'meses')::int), 'YYYY-MM'));
      end if;
    end if;
    if app.es_texto_vacio(v) then
      if (c ->> 'obligatorio')::boolean then
        raise exception 'Falta «%»', v_et using errcode = '22023';
      end if;
      continue;
    end if;
    case c ->> 'tipo'
      when 'texto' then
        if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) > 200 then
          raise exception '«%»: hasta 200 caracteres', v_et using errcode = '22023';
        end if;
        v := to_jsonb(regexp_replace(trim(v #>> '{}'), '\s+', ' ', 'g'));
      when 'texto_largo' then
        if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) > 2000 then
          raise exception '«%»: hasta 2000 caracteres', v_et using errcode = '22023';
        end if;
        v := to_jsonb(trim(v #>> '{}'));
      when 'numero' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 1000000000 then
          raise exception '«%»: escribe un número', v_et using errcode = '22023';
        end if;
      when 'anio' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 1900 and 2100
           or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
          raise exception '«%»: escribe un año (por ejemplo 2024)', v_et using errcode = '22023';
        end if;
      when 'mes' then
        if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^(19|20)[0-9]{2}-(0[1-9]|1[0-2])$' then
          raise exception '«%»: elige mes y año', v_et using errcode = '22023';
        end if;
      when 'lista' then
        if jsonb_typeof(v) <> 'string' or not (
             exists (select 1 from public.listas l join public.listas_valores lv on lv.lista_id = l.id
                     where l.empresa_id = p_tipo.empresa_id and l.codigo = c ->> 'lista' and lv.vigente and lv.nombre = v #>> '{}')
             or coalesce((p_anteriores -> k) = v, false)) then
          raise exception '«%»: elige un valor de la lista', v_et using errcode = '22023';
        end if;
      else
        raise exception 'Campo no válido' using errcode = '22023';
    end case;
    v_out := v_out || jsonb_build_object(k, v);
  end loop;
  return v_out;
end $$;
