-- Nivel 2, punto 1 (04/11/2026): 14 funciones auxiliares del esquema interno «app» eran ejecutables por anon (por el permiso que Postgres da a PUBLIC al crear una función).
-- Hoy NO son alcanzables: la API solo publica «public» y anon no tiene acceso al esquema «app». Se cierra igual (defensa en profundidad): si algún día se expusiera «app»,
-- o se diera acceso al esquema a anon, esas funciones no responderían. Las cuentas con sesión (authenticated) conservan el permiso: las usan las políticas de seguridad y las funciones.
-- No cambia tablas, roles ni permisos de CRC (nada de lo que usan los módulos de contratistas y medio ambiente).

revoke all on function
  app.empresa_con_una_sede(uuid), app.exigir_sedes(uuid), app.guardia_sede(), app.passt_tipo_padre(text), app.puedo_gestionar_vinculo(uuid, text),
  app.puedo_programa(uuid, uuid, text), app.puedo_sede(uuid), app.puedo_ver_programa(uuid, uuid), app.puedo_ver_vinculo(uuid), app.revisar_sedes_vinculo(),
  app.sede_efectiva(uuid, uuid), app.semanas_del_anio(integer), app.soy_general(), app.validar_vinculo_sede()
from anon, public;

grant execute on function
  app.empresa_con_una_sede(uuid), app.exigir_sedes(uuid), app.guardia_sede(), app.passt_tipo_padre(text), app.puedo_gestionar_vinculo(uuid, text),
  app.puedo_programa(uuid, uuid, text), app.puedo_sede(uuid), app.puedo_ver_programa(uuid, uuid), app.puedo_ver_vinculo(uuid), app.revisar_sedes_vinculo(),
  app.sede_efectiva(uuid, uuid), app.semanas_del_anio(integer), app.soy_general(), app.validar_vinculo_sede()
to authenticated;
