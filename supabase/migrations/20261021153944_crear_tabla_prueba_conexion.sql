-- Tabla de prueba para comprobar que la app se conecta. Solo datos ficticios.
-- Aplicada en el proyecto crc-dev el 21/10/2026.
create table public.prueba_conexion (
  id bigint generated always as identity primary key,
  mensaje text not null,
  creado_en timestamptz not null default now()
);

comment on table public.prueba_conexion is 'Tabla de prueba (datos ficticios) para verificar la conexión de la app. Se puede borrar más adelante.';

-- Seguridad por fila: activada desde la primera tabla.
alter table public.prueba_conexion enable row level security;

-- La app (clave pública) solo puede LEER esta tabla de prueba; nadie puede escribir desde la app.
revoke all on public.prueba_conexion from anon, authenticated;
grant select on public.prueba_conexion to anon, authenticated;

create policy "Lectura pública de la tabla de prueba"
  on public.prueba_conexion
  for select
  to anon, authenticated
  using (true);

insert into public.prueba_conexion (mensaje) values
  ('Conexión de prueba CRC: OK'),
  ('Dato ficticio de ejemplo');
