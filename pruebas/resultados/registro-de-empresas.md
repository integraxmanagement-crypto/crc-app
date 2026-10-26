# Pruebas del registro de empresas · CRC tarea 3.2

Ejecutadas: 26/10/2026, 2:31:18 p. m. (hora de Lima) · Proyecto Supabase `crc-dev` · Solo datos ficticios.

**Resultado: 71 de 71 pruebas pasaron.**

Cada prueba ingresa con una persona ficticia por la misma puerta que usa la app (clave pública + reglas RLS de la base de datos y del almacén de logos).

## 1. Una empresa no ve la ficha, sedes, contactos ni logos de la otra

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A: la ficha de B no aparece (0 filas) |  |
| ✅ Pasa | ADMIN_A: 0 sedes de B |  |
| ✅ Pasa | ADMIN_A: 0 contactos de B |  |
| ✅ Pasa | ADMIN_A: no puede descargar el logo de B | Object not found |
| ✅ Pasa | ADMIN_A: la carpeta de logos de B se ve vacía |  |
| ✅ Pasa | GESTOR_A: la ficha de B no aparece (0 filas) |  |
| ✅ Pasa | GESTOR_A: 0 sedes de B |  |
| ✅ Pasa | GESTOR_A: 0 contactos de B |  |
| ✅ Pasa | GESTOR_A: no puede descargar el logo de B | Object not found |
| ✅ Pasa | GESTOR_A: la carpeta de logos de B se ve vacía |  |
| ✅ Pasa | USUARIO_A2: la ficha de B no aparece (0 filas) |  |
| ✅ Pasa | USUARIO_A2: 0 sedes de B |  |
| ✅ Pasa | USUARIO_A2: 0 contactos de B |  |
| ✅ Pasa | USUARIO_A2: no puede descargar el logo de B | Object not found |
| ✅ Pasa | USUARIO_A2: la carpeta de logos de B se ve vacía |  |
| ✅ Pasa | Al revés: ADMIN_B no ve la ficha ni los contactos de A |  |

## 2. El logo de A no se puede leer ni escribir desde B

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_B no puede leer el logo de A | Object not found |
| ✅ Pasa | ADMIN_B no puede reemplazar el logo de A | new row violates row-level security policy |
| ✅ Pasa | ADMIN_B no puede subir un logo nuevo en la carpeta de A | new row violates row-level security policy |
| ✅ Pasa | ADMIN_B no puede borrar el logo de A (sigue en su lugar) |  |
| ✅ Pasa | ADMIN_B no puede cambiar qué logo usa A | No autorizado |

## 3. Solo el dueño de la plataforma crea empresas y sedes

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A NO puede crear empresas | No autorizado |
| ✅ Pasa | ADMIN_A NO puede agregar sedes (ni en su propia empresa) | No autorizado |
| ✅ Pasa | GESTOR_A NO puede crear empresas | No autorizado |
| ✅ Pasa | GESTOR_A NO puede agregar sedes (ni en su propia empresa) | No autorizado |
| ✅ Pasa | USUARIO_A2 NO puede crear empresas | No autorizado |
| ✅ Pasa | USUARIO_A2 NO puede agregar sedes (ni en su propia empresa) | No autorizado |
| ✅ Pasa | Sin iniciar sesión NO se pueden crear empresas | permission denied for function crear_empresa |
| ✅ Pasa | Nadie puede insertar empresas directo en la tabla | permission denied for table empresas |
| ✅ Pasa | Nadie puede insertar sedes directo en la tabla | permission denied for table sedes |
| ✅ Pasa | Ningún intento dejó una empresa creada |  |

## 4. Un administrador no puede editar otra empresa (ni la ficha de la suya)

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A NO puede editar la ficha de B | No autorizado |
| ✅ Pasa | ADMIN_A NO puede cambiar los contactos de B | No autorizado |
| ✅ Pasa | ADMIN_A NO puede suspender a B | No autorizado |
| ✅ Pasa | ADMIN_A NO puede desactivar sedes de B | No autorizado |
| ✅ Pasa | ADMIN_A NO puede editar la ficha legal de su propia empresa (solo el dueño) | No autorizado |
| ✅ Pasa | ADMIN_A NO puede desactivar sedes de su propia empresa (solo el dueño) | No autorizado |
| ✅ Pasa | Nadie puede modificar empresas directo en la tabla | permission denied for table empresas |
| ✅ Pasa | La empresa B quedó intacta |  |

## 5. Vista de la empresa: qué puede hacer cada rol de A con su propia empresa

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A ve su ficha |  |
| ✅ Pasa | ADMIN_A ve sus sedes |  |
| ✅ Pasa | ADMIN_A SÍ puede editar los contactos de su empresa |  |
| ✅ Pasa | ADMIN_A ve los 3 contactos de su empresa |  |
| ✅ Pasa | ADMIN_A SÍ puede cambiar los logos de su empresa |  |
| ✅ Pasa | GESTOR_A ve la ficha básica de su empresa (para encabezados) |  |
| ✅ Pasa | GESTOR_A NO ve los contactos (datos personales) de su empresa |  |
| ✅ Pasa | GESTOR_A SÍ puede ver el logo de su empresa |  |
| ✅ Pasa | GESTOR_A NO puede editar contactos | No autorizado |
| ✅ Pasa | GESTOR_A NO puede cambiar logos | new row violates row-level security policy |
| ✅ Pasa | USUARIO_A2 ve la ficha básica de su empresa (para encabezados) |  |
| ✅ Pasa | USUARIO_A2 NO ve los contactos (datos personales) de su empresa |  |
| ✅ Pasa | USUARIO_A2 SÍ puede ver el logo de su empresa |  |
| ✅ Pasa | USUARIO_A2 NO puede editar contactos | No autorizado |
| ✅ Pasa | USUARIO_A2 NO puede cambiar logos | new row violates row-level security policy |

## 6. Validaciones: RUC, CIIU, marca de prueba y archivos

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | RUC 20000000037 rechazado (dígito verificador incorrecto) | El RUC no es válido: revisa los 11 dígitos |
| ✅ Pasa | RUC 30000000036 rechazado (prefijo no válido) | El RUC no es válido: revisa los 11 dígitos |
| ✅ Pasa | RUC 2000000003 rechazado (solo 10 dígitos) | El RUC no es válido: revisa los 11 dígitos |
| ✅ Pasa | RUC 2000000003A rechazado (con una letra) | El RUC no es válido: revisa los 11 dígitos |
| ✅ Pasa | CIIU 9810 rechazado (SUNAT lo marca «NO USAR») | El código CIIU no está en el catálogo oficial o SUNAT indica no usarlo |
| ✅ Pasa | CIIU inexistente rechazado | El código CIIU no está en el catálogo oficial o SUNAT indica no usarlo |
| ✅ Pasa | Una empresa de prueba sin «Ficticia» en la razón social se rechaza | new row for relation "empresas" violates check constraint "empresas_prueba_marcada" |
| ✅ Pasa | No se puede crear una empresa sin su primera sede | Faltan datos de la sede: nombre, dirección, distrito, provincia y departamento |
| ✅ Pasa | Ningún intento inválido dejó una empresa a medias |  |
| ✅ Pasa | El almacén rechaza archivos que no son imagen | mime type text/html is not supported |
| ✅ Pasa | El almacén rechaza imágenes de más de 1 MB | The object exceeded the maximum allowed size |
| ✅ Pasa | Solo se aceptan los nombres positivo/negativo dentro de la carpeta de la empresa | new row violates row-level security policy |

## 7. Empresa suspendida: nadie de ella puede ingresar

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | El dueño suspende la empresa B |  |
| ✅ Pasa | La sesión abierta de ADMIN_B se cerró al suspender | Invalid Refresh Token: Refresh Token Not Found |
| ✅ Pasa | ADMIN_B no puede ingresar mientras B está suspendida | Tu cuenta está inhabilitada. Consulta con el administrador de tu empresa. |
| ✅ Pasa | La empresa A no se ve afectada |  |
| ✅ Pasa | Al reactivar B, ADMIN_B vuelve a ingresar |  |
