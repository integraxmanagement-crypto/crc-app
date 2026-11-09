-- Cerrar un plan de acción desde la inspección exige que su fila en la matriz de gestión de planes de acción tenga completas las columnas
-- obligatorias (pedido del dueño, 09/11/2026). Antes se podía cerrar aunque la matriz estuviera incompleta.
-- Solo cambia la función de cierre; no cambia tablas.
create or replace function public.cerrar_hallazgo(p_id uuid, p_comentario text, p_foto_ruta text, p_foto_bytes integer) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hallazgos; falta text[];
begin
  h := app.hallazgo_para(p_id, false);
  if h.estado not in ('abierto', 'en_proceso') then
    raise exception 'El hallazgo ya está cerrado o anulado' using errcode = '22023';
  end if;
  select app.faltan_condicion(c.sede_id, c.fecha_programada, c.datos, 'planes') into falta
  from public.condiciones c where c.hallazgo_id = h.id and c.matriz = 'planes';
  if falta is not null and cardinality(falta) > 0 then
    raise exception 'Antes de cerrarlo, completa en la matriz de gestión de planes de acción: %', array_to_string(falta, ', ') using errcode = '22023';
  end if;
  if length(trim(coalesce(p_comentario, ''))) < 3 then
    raise exception 'Escribe qué se hizo para cerrarlo' using errcode = '22023';
  end if;
  if p_foto_ruta is not null and (p_foto_ruta !~ ('^' || h.empresa_id::text || '/' || h.inspeccion_id::text || '/cierre-' || h.id::text || '-[0-9a-f]{8}\.(jpg|webp|png)$')
      or p_foto_bytes is null or p_foto_bytes not between 1 and 1048576) then
    raise exception 'La foto no está en la carpeta del hallazgo' using errcode = '22023';
  end if;
  update public.hallazgos set estado = 'cerrado', cerrado_en = now(), cerrado_por = (select auth.uid()), cierre_comentario = left(trim(p_comentario), 1000),
    cierre_foto_ruta = p_foto_ruta, cierre_foto_bytes = p_foto_bytes
  where id = h.id;
  insert into public.hallazgos_historial (hallazgo_id, empresa_id, cambio, comentario, despues, hecho_por)
  values (h.id, h.empresa_id, 'cerrado', left(trim(p_comentario), 1000), jsonb_build_object('foto', p_foto_ruta), (select auth.uid()));
end $$;
