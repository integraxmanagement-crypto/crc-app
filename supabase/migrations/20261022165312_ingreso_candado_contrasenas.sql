-- Tarea 3.1 · Candado de servidor ("pimienta"): Supabase guarda una versión transformada de la contraseña,
-- calculada con un secreto que solo conocen las funciones del servidor. Así nadie puede probar contraseñas
-- directamente contra Supabase, saltándose el registro y el bloqueo de la función "ingresar".
-- Esta marca indica qué cuentas ya tienen el candado; las anteriores se pasan solas en su siguiente ingreso.

alter table public.personas
  add column clave_con_candado boolean not null default false;

comment on column public.personas.clave_con_candado is
  'true = la contraseña guardada en Supabase ya está transformada con el secreto del servidor.';
