-- La regla de crear cuentas ahora exige las sedes (puedo_crear_cuenta con 3 parámetros); se quita la versión vieja para que no quede una regla paralela.
drop function if exists public.puedo_crear_cuenta(uuid, text);
