# Prueba de separación entre empresas · CRC tareas 3.1, 3.2, 3.3 y 3.6

Ejecutada: 23/10/2026, 8:48:34 a. m. (hora de Lima) · Proyecto Supabase `crc-dev` · Solo datos ficticios.

**Resultado: 84 de 84 pruebas pasaron.**

Cada prueba ingresa con una persona de prueba por la misma puerta que usa la app (clave pública + reglas RLS) e intenta ver o tocar lo que no le corresponde.

## 1. Una persona de la empresa A no ve nada de la empresa B

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | USUARIO_A2: solo ve su empresa (A) | ve 20000000010 |
| ✅ Pasa | USUARIO_A2: si pide la empresa B por su código, recibe 0 filas |  |
| ✅ Pasa | USUARIO_A2: 0 vínculos de B |  |
| ✅ Pasa | USUARIO_A2: 0 personas de B |  |
| ✅ Pasa | USUARIO_A2: 0 registros del historial de B |  |
| ✅ Pasa | GESTOR_A: solo ve su empresa (A) | ve 20000000010 |
| ✅ Pasa | GESTOR_A: si pide la empresa B por su código, recibe 0 filas |  |
| ✅ Pasa | GESTOR_A: 0 vínculos de B |  |
| ✅ Pasa | GESTOR_A: 0 personas de B |  |
| ✅ Pasa | GESTOR_A: 0 registros del historial de B |  |
| ✅ Pasa | ADMIN_A: solo ve su empresa (A) | ve 20000000010 |
| ✅ Pasa | ADMIN_A: si pide la empresa B por su código, recibe 0 filas |  |
| ✅ Pasa | ADMIN_A: 0 vínculos de B |  |
| ✅ Pasa | ADMIN_A: 0 personas de B |  |
| ✅ Pasa | ADMIN_A: 0 registros del historial de B |  |

## 2. Dentro de la empresa A, cada rol ve solo lo que le toca

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Usuario A2: solo ve su propia ficha | 1 ficha(s) |
| ✅ Pasa | Usuario A2: NO recibe la lista de personas de su empresa |  |
| ✅ Pasa | Gestor A: recibe la lista de personas activas de A | 11 personas |
| ✅ Pasa | Gestor A: la lista trae solo nombres, puesto y área (sin documento) | apellidos_nombres, area, persona_id, puesto |
| ✅ Pasa | Gestor A: la lista no incluye a nadie de B |  |
| ✅ Pasa | Gestor A: no puede leer los documentos de otras personas |  |
| ✅ Pasa | Administrador A: ve las fichas de las personas de A | 12 fichas |
| ✅ Pasa | Administrador A: ninguna ficha es de B |  |

## 3. Un administrador de A no puede crear ni leer cuentas de B

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Admin A NO puede crear un usuario en la empresa B | No autorizado |
| ✅ Pasa | Admin A NO puede crear otro administrador (solo el dueño) | No autorizado |
| ✅ Pasa | Gestor A NO puede crear cuentas | No autorizado |
| ✅ Pasa | Usuario A2 NO puede crear cuentas | No autorizado |
| ✅ Pasa | Sin iniciar sesión NO se puede crear cuentas | Inicia sesión para continuar |
| ✅ Pasa | Admin A NO puede leer la cuenta del gestor B aunque conozca su código |  |
| ✅ Pasa | Admin A NO puede cesar la cuenta del gestor B | No autorizado |
| ✅ Pasa | Nadie puede escribir directo en las tablas desde la app (insertar) | permission denied for table vinculos |
| ✅ Pasa | Nadie puede escribir directo en las tablas desde la app (modificar) | permission denied for table empresas |
| ✅ Pasa | Nadie puede escribir directo en las tablas desde la app (borrar) | permission denied for table personas |
| ✅ Pasa | Admin B tampoco ve fichas de personas que solo estuvieron en A |  |

## 4. Una persona cesada no puede ingresar

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | USUARIO_A (cesada) no puede ingresar | Tu cuenta está inhabilitada. Consulta con el administrador de tu empresa. |

## 5. Sin iniciar sesión no se ve nada

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Sin sesión: la tabla empresas no entrega datos | permission denied for table empresas |
| ✅ Pasa | Sin sesión: la tabla personas no entrega datos | permission denied for table personas |
| ✅ Pasa | Sin sesión: la tabla vinculos no entrega datos | permission denied for table vinculos |
| ✅ Pasa | Sin sesión: la tabla vinculos_historial no entrega datos | permission denied for table vinculos_historial |
| ✅ Pasa | Sin sesión: la tabla roles no entrega datos | permission denied for table roles |

## 6. Cambio de empresa: la persona pasa de A a B y el historial se conserva

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | Admin B da de alta en B a la persona cesada en A (misma cuenta, sin contraseña nueva) |  |
| ✅ Pasa | No puede estar activa en dos empresas a la vez | Esta persona ya tiene un vínculo activo. Primero debe ser cesada allí. |
| ✅ Pasa | Ahora puede ingresar otra vez (activa en B) |  |
| ✅ Pasa | Ve solo la empresa B, ya no la A |  |
| ✅ Pasa | Admin A conserva el historial de su ex trabajadora (alta y cese en A) |  |
| ✅ Pasa | Admin A NO ve su nuevo vínculo en B |  |
| ✅ Pasa | Admin B NO ve su historial en A |  |

## 7. El dueño de la plataforma ve todas las empresas

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | El dueño ve A y B (y las demás empresas de prueba) | 3 empresas |

## 8. Ampliación 3.2: sedes, contactos y logos tampoco cruzan entre empresas

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A: solo ve sedes de su empresa | 1 sedes |
| ✅ Pasa | ADMIN_A: ningún contacto de la otra empresa |  |
| ✅ Pasa | ADMIN_A: la carpeta de logos de la otra empresa se ve vacía |  |
| ✅ Pasa | GESTOR_A: solo ve sedes de su empresa | 1 sedes |
| ✅ Pasa | GESTOR_A: ningún contacto de la otra empresa |  |
| ✅ Pasa | GESTOR_A: la carpeta de logos de la otra empresa se ve vacía |  |
| ✅ Pasa | USUARIO_A2: solo ve sedes de su empresa | 1 sedes |
| ✅ Pasa | USUARIO_A2: ningún contacto de la otra empresa |  |
| ✅ Pasa | USUARIO_A2: la carpeta de logos de la otra empresa se ve vacía |  |
| ✅ Pasa | ADMIN_B: solo ve sedes de su empresa | 1 sedes |
| ✅ Pasa | ADMIN_B: ningún contacto de la otra empresa |  |
| ✅ Pasa | ADMIN_B: la carpeta de logos de la otra empresa se ve vacía |  |
| ✅ Pasa | GESTOR_B: solo ve sedes de su empresa | 1 sedes |
| ✅ Pasa | GESTOR_B: ningún contacto de la otra empresa |  |
| ✅ Pasa | GESTOR_B: la carpeta de logos de la otra empresa se ve vacía |  |
| ✅ Pasa | ADMIN_A no puede descargar el logo de B | Object not found |
| ✅ Pasa | Sin iniciar sesión no se puede descargar ningún logo | Object not found |

## 9. Ampliación 3.3 y 3.6: estructura (gerencia, área, subárea), puestos, contraseñas dadas y acciones sobre personas no cruzan entre empresas

| Resultado | Prueba | Detalle |
|---|---|---|
| ✅ Pasa | ADMIN_A: solo ve la estructura y los puestos de su empresa | 5 unidades, 4 puestos |
| ✅ Pasa | ADMIN_A: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | GESTOR_A: solo ve la estructura y los puestos de su empresa | 5 unidades, 4 puestos |
| ✅ Pasa | GESTOR_A: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | USUARIO_A2: solo ve la estructura y los puestos de su empresa | 5 unidades, 4 puestos |
| ✅ Pasa | USUARIO_A2: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | ADMIN_B: solo ve la estructura y los puestos de su empresa | 3 unidades, 4 puestos |
| ✅ Pasa | ADMIN_B: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | GESTOR_B: solo ve la estructura y los puestos de su empresa | 3 unidades, 4 puestos |
| ✅ Pasa | GESTOR_B: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | USUARIO_B: solo ve la estructura y los puestos de su empresa | 3 unidades, 4 puestos |
| ✅ Pasa | USUARIO_B: ninguna contraseña dada en la otra empresa |  |
| ✅ Pasa | ADMIN_A no puede crear gerencias en B | No autorizado |
| ✅ Pasa | ADMIN_A no puede colgar una subárea de un área de B | La unidad superior no es válida |
| ✅ Pasa | ADMIN_A no puede borrar un área de B | No autorizado |
| ✅ Pasa | ADMIN_A no puede desactivar un área de B | No autorizado |
| ✅ Pasa | ADMIN_A no puede corregir datos de una persona de B | No autorizado |
| ✅ Pasa | ADMIN_A no puede dar contraseña nueva a una persona de B | 403 |
| ✅ Pasa | Sin iniciar sesión no se ve ninguna unidad de la estructura |  |
