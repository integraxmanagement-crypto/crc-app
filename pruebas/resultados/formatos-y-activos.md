# Formatos de inspección, activos y listas (tarea 3.4-B)

Fecha: 2026-10-29 · Resultado: **103 de 103** · Cuentas y datos ficticios de crc-dev.

## 1. Sin sesión no se ve nada

| Prueba | Resultado |
|---|---|
| Sin sesión: listas no devuelve filas | ✅ |
| Sin sesión: listas_valores no devuelve filas | ✅ |
| Sin sesión: tipos_activo no devuelve filas | ✅ |
| Sin sesión: ubicaciones no devuelve filas | ✅ |
| Sin sesión: activos no devuelve filas | ✅ |
| Sin sesión: activos_historial no devuelve filas | ✅ |
| Sin sesión: plantillas no devuelve filas | ✅ |
| Sin sesión: plantillas_versiones no devuelve filas | ✅ |
| Sin sesión: no se puede llamar a ninguna acción (copiar plantilla) | ✅ |

## 2. Contenido base de CRC: lo ven todos, nadie de una empresa lo cambia

| Prueba | Resultado |
|---|---|
| Usuario A2 ve las 6 plantillas base | ✅ |
| Las 6 recetas guardadas son idénticas al anexo (src/formatos/base.ts) y están publicadas con huella | ✅ |
| Hay 4 tipos de activo base | ✅ |
| Admin A no puede editar una versión base | ✅ |
| Admin A no puede abrir un borrador de una plantilla base | ✅ |
| Admin A no puede publicar una versión base | ✅ |

## 3. Nadie escribe directo en las tablas nuevas

| Prueba | Resultado |
|---|---|
| Admin A no puede insertar directo en listas | ✅ |
| Ni el dueño puede cambiar directo listas | ✅ |
| Ni el dueño puede borrar directo en listas | ✅ |
| Admin A no puede insertar directo en listas_valores | ✅ |
| Ni el dueño puede cambiar directo listas_valores | ✅ |
| Ni el dueño puede borrar directo en listas_valores | ✅ |
| Admin A no puede insertar directo en tipos_activo | ✅ |
| Ni el dueño puede cambiar directo tipos_activo | ✅ |
| Ni el dueño puede borrar directo en tipos_activo | ✅ |
| Admin A no puede insertar directo en ubicaciones | ✅ |
| Ni el dueño puede cambiar directo ubicaciones | ✅ |
| Ni el dueño puede borrar directo en ubicaciones | ✅ |
| Admin A no puede insertar directo en activos | ✅ |
| Ni el dueño puede cambiar directo activos | ✅ |
| Ni el dueño puede borrar directo en activos | ✅ |
| Admin A no puede insertar directo en activos_historial | ✅ |
| Ni el dueño puede cambiar directo activos_historial | ✅ |
| Ni el dueño puede borrar directo en activos_historial | ✅ |
| Admin A no puede insertar directo en plantillas | ✅ |
| Ni el dueño puede cambiar directo plantillas | ✅ |
| Ni el dueño puede borrar directo en plantillas | ✅ |
| Admin A no puede insertar directo en plantillas_versiones | ✅ |
| Ni el dueño puede cambiar directo plantillas_versiones | ✅ |
| Ni el dueño puede borrar directo en plantillas_versiones | ✅ |

## 4. Copiar una plantilla base y editarla (constructor)

| Prueba | Resultado |
|---|---|
| Si la empresa ya tiene el formato de extintores, no se copia otra vez | ✅ |
| Gestor A puede copiar la plantilla base de extintores a su empresa | ✅ |
| No se reactiva una segunda copia del mismo formato base | ✅ |
| La copia nace como borrador v1 | ✅ |
| Al copiar, la empresa recibe su propio tipo «extintor» | ✅ |
| …y sus listas (agentes, unidades, soportes) | ✅ |
| Gestor A puede editar el borrador (texto, punto nuevo, plazo, código, versión, fecha y logo) | ✅ |
| La plantilla base no cambió (misma huella y mismo texto) | ✅ |
| No se puede guardar una clave repetida | ✅ |
| No se puede poner severidad (queda para la v1.1) | ✅ |
| No se puede guardar una regla que usa un punto inexistente | ✅ |
| No se puede guardar un tipo de respuesta que no existe | ✅ |

## 5. Publicar y versiones (lo publicado no cambia)

| Prueba | Resultado |
|---|---|
| Gestor A NO puede publicar (solo el administrador) | ✅ |
| Usuario A2 no puede editar formatos | ✅ |
| Admin A publica la v1 | ✅ |
| La v1 queda vigente, con huella y con quién la publicó | ✅ |
| Una versión publicada no se puede editar | ✅ |
| Una versión publicada no se puede descartar | ✅ |
| Gestor A abre un borrador v2 copiando la v1 | ✅ |
| El borrador es la v2 y trae la receta de la v1 | ✅ |
| Pedir otro borrador devuelve el mismo (solo hay uno a la vez) | ✅ |
| Admin A publica la v2 | ✅ |
| La v1 queda retirada sin ningún cambio (misma huella y receta) y la v2 vigente | ✅ |
| No se publica sin código, versión y fecha de aprobación del formato | ✅ |
| Descartar el único borrador descarta la copia entera | ✅ |

## 6. Separación entre empresas en los formatos

| Prueba | Resultado |
|---|---|
| ADMIN_B no ve la plantilla de A | ✅ |
| ADMIN_B no ve las versiones de A | ✅ |
| GESTOR_B no ve la plantilla de A | ✅ |
| GESTOR_B no ve las versiones de A | ✅ |
| Admin B no puede abrir borradores de A | ✅ |
| Admin B no puede copiar a su empresa una plantilla de A | ✅ |
| Admin B no puede crear plantillas en la empresa A | ✅ |
| Admin B no puede desactivar una plantilla de A | ✅ |
| Admin B no puede agregar valores a una lista de A | ✅ |
| Admin B no ve las listas de A | ✅ |
| Admin A sí agrega valores a su lista | ✅ |
| …y la lista base no cambia | ✅ |

## 7. Activos, ubicaciones y tipos

| Prueba | Resultado |
|---|---|
| Admin A activa el tipo DACI para su empresa | ✅ |
| Activarlo otra vez no lo duplica | ✅ |
| Admin B no puede activar tipos en A | ✅ |
| Gestor A crea un tipo nuevo («luces de emergencia») con la ficha básica | ✅ |
| Gestor A crea una ubicación en su sede y área | ✅ |
| Admin A no puede crear una ubicación en una sede de B | ✅ |
| …ni asociarla a un área de B | ✅ |
| Gestor A da de alta un extintor | ✅ |
| El próximo mantenimiento se calcula solo (+12 meses: 2027-03) | ✅ |
| No se repite el código en el mismo tipo (sin importar mayúsculas) | ✅ |
| Un agente que no está en la lista de la empresa se rechaza | ✅ |
| Sin los datos obligatorios de la ficha se rechaza | ✅ |
| El responsable no puede ser de otra empresa | ✅ |
| La sede no puede ser de otra empresa | ✅ |
| Usuario A2 no puede dar de alta activos | ✅ |
| Admin B no puede editar un activo de A | ✅ |
| Admin B no ve los activos de A | ✅ |
| Admin B no ve el historial de los activos de A | ✅ |
| Un panel DACI sin modelo se rechaza (obligatorio solo para panel) | ✅ |
| Los pulsadores reciben número de ítem correlativo | ✅ |
| Un dispositivo DACI sin subtipo se rechaza | ✅ |
| Gestor A da de baja el extintor (con fecha y motivo) | ✅ |
| El activo no se borra: queda «baja» | ✅ |
| Un activo de baja no se edita | ✅ |
| Se puede reactivar | ✅ |
| El historial guarda alta, baja y reactivación | ✅ |
| Nadie puede borrar el activo directo | ✅ |
