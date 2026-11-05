-- Prueba del bloqueo por dirección de internet (revisión de funciones, 05/11/2026). Solo crc-dev, datos ficticios.
-- Usa la dirección 203.0.113.50, reservada para documentación (RFC 5737): no es de nadie. Nunca se usa la dirección real
-- (si se bloqueara, las demás pruebas quedarían fuera 15 minutos).
-- Se corre en tres partes desde el editor SQL de Supabase (o por la herramienta de Claude Code):

-- ── PARTE 1 (antes de node pruebas/revision-funciones.mjs): 30 fallos ficticios desde la dirección inventada ──
insert into public.intentos_ingreso (tipo_documento, numero_documento, resultado, ip)
select 'dni', '9800' || lpad(g::text, 4, '0'), 'fallo', '203.0.113.50' from generate_series(1, 30) g;

-- ── PARTE 2: el bloqueo por dirección sigue funcionando (debe salir una hora, no vacío) ──
-- y no alcanza a un documento ni a una dirección distintos (debe salir vacío).
select public.bloqueo_ingreso('dni', '99990001', '203.0.113.50') as bloqueada_hasta,
       public.bloqueo_ingreso('dni', '99990001', '203.0.113.51') as otra_direccion;

-- Luego: node pruebas/revision-funciones.mjs (manda un intento con «X-Forwarded-For: 203.0.113.50» y comprueba
-- que NO sale bloqueado y que la dirección anotada es la real).

-- ── PARTE 3 (al terminar): borrar los fallos ficticios y los intentos de la prueba ──
-- (los documentos 9800xxxx son los de la parte 1; los 99xxxxxx, los que inventa la prueba: ninguno existe en CRC)
delete from public.intentos_ingreso
where creado_en > now() - interval '1 day'
  and (ip = '203.0.113.50' or numero_documento like '9800____' or numero_documento like '99______');
