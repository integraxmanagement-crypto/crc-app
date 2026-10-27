-- Tarea 3.4-C · Decisión del dueño (27/10/2026): del firmante externo se guardan nombre y documento, marcado como
-- externo, aunque firme en papel. La base de datos ya no acepta un externo sin documento.
alter table public.firmas add constraint firmas_externo_con_documento
  check (externo_nombre is null or externo_documento is not null);
