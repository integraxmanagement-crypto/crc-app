-- Análisis de seguridad del 12/11/2026, hallazgo M1: el bloqueo por intentos se podía saltar con pedidos simultáneos.
-- Antes: la función del servidor preguntaba «¿está bloqueado?» y recién DESPUÉS de probar la contraseña anotaba el fallo.
-- Cien pedidos enviados en el mismo instante pasaban todos la pregunta antes de que se anotara el primer fallo.
-- Ahora: cada intento se RESERVA en la base de datos antes de probar la contraseña, de uno en uno por documento y por
-- dirección de internet (candado de transacción). La reserva cuenta como fallo hasta que la función anota el resultado real.

-- 1. Nuevo estado «en_curso»: intento reservado cuyo resultado todavía no se anota.
alter table public.intentos_ingreso drop constraint intentos_ingreso_resultado_check;
alter table public.intentos_ingreso add constraint intentos_ingreso_resultado_check
  check (resultado in ('exito', 'fallo', 'bloqueado', 'inhabilitada', 'limite_supabase', 'error', 'en_curso'));

-- 2. El bloqueo cuenta también los intentos en curso (mismas reglas: 5 por documento, 30 por dirección, 15 minutos).
create or replace function public.bloqueo_ingreso(p_tipo text, p_numero text, p_ip text) returns timestamptz
language sql stable security definer set search_path = '' as $$
  with ultimo_exito as (
    select coalesce(max(creado_en), '-infinity'::timestamptz) as t from public.intentos_ingreso
    where tipo_documento = p_tipo and numero_documento = p_numero and resultado = 'exito'
  ),
  fallos_doc as (
    select i.creado_en from public.intentos_ingreso i, ultimo_exito u
    where i.tipo_documento = p_tipo and i.numero_documento = p_numero and i.resultado in ('fallo', 'en_curso')
      and i.creado_en > now() - interval '15 minutes' and i.creado_en > u.t
  ),
  fallos_ip as (
    select creado_en from public.intentos_ingreso
    where p_ip is not null and ip = p_ip and resultado in ('fallo', 'en_curso') and creado_en > now() - interval '15 minutes'
  )
  select greatest(
    case when (select count(*) from fallos_doc) >= 5 then (select max(creado_en) from fallos_doc) + interval '15 minutes' end,
    case when (select count(*) from fallos_ip) >= 30 then (select max(creado_en) from fallos_ip) + interval '15 minutes' end
  );
$$;

-- 3. Reserva un intento. Devuelve {"id": n} si puede seguir, o {"hasta": fecha} si está bloqueado (y lo anota como «bloqueado»).
--    Los candados se toman siempre en el mismo orden (documento, luego dirección) y se sueltan solos al terminar la función.
create function public.reservar_intento(p_tipo text, p_numero text, p_ip text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hasta timestamptz; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('crc-ingreso-doc:' || p_tipo || ':' || p_numero, 0));
  if p_ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('crc-ingreso-ip:' || p_ip, 0));
  end if;
  v_hasta := public.bloqueo_ingreso(p_tipo, p_numero, p_ip);
  if v_hasta is not null and v_hasta > now() then
    insert into public.intentos_ingreso (tipo_documento, numero_documento, resultado, ip) values (p_tipo, p_numero, 'bloqueado', p_ip);
    return jsonb_build_object('hasta', v_hasta);
  end if;
  insert into public.intentos_ingreso (tipo_documento, numero_documento, resultado, ip)
  values (p_tipo, p_numero, 'en_curso', p_ip) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- 4. Anota el resultado real de un intento reservado (solo una vez).
create function public.cerrar_intento(p_id bigint, p_resultado text) returns void
language sql security definer set search_path = '' as $$
  update public.intentos_ingreso set resultado = p_resultado where id = p_id and resultado = 'en_curso';
$$;

-- Solo las usan las funciones del servidor.
revoke all on function public.reservar_intento(text, text, text), public.cerrar_intento(bigint, text) from public, anon, authenticated;
grant execute on function public.reservar_intento(text, text, text), public.cerrar_intento(bigint, text) to service_role;
