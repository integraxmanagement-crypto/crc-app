# Revisión de las 6 funciones del servidor de CRC

- **Fecha:** 05/11/2026 · **Entorno:** `crc-dev` · **Versión de la app:** v0.9.6
- **Cómo se hizo:** solo leyendo. Se leyó el código de cada función en el repositorio (`supabase/functions/`), el código común que usan (`_compartido/`) y, en la base de datos, las reglas que esas funciones consultan (`puedo_crear_cuenta`, `puedo_dar_contrasena`, `grabar_carga`, `grabar_inspeccion`, `corregir_inspeccion`, la guardia de sedes y quién puede ejecutar cada una). No se cambió nada ni se llamó a ninguna función.
- **Sin claves:** aquí solo aparecen **nombres** de secretos, nunca valores.

---

## Antes de empezar: cómo funcionan todas

1. **Supabase no revisa la sesión por ellas.** Las 6 tienen apagada la revisión automática de Supabase (`verify_jwt = false`). Por eso cada función revisa la sesión por su cuenta.
2. **Cómo revisan la sesión** (pieza común `quienLlama`): toman el «pase» que manda la app (encabezado `Authorization`) y le preguntan a Supabase de quién es (`auth.getUser`). Si no hay pase, si está vencido o si es falso, la función responde **401 «Inicia sesión para continuar»** y no hace nada más.
3. **Quién decide el permiso:** en todas, **la base de datos**, no el archivo de la función. Hay dos formas:
   - la función pregunta **como la persona** (`clienteComo`): por ejemplo «¿puedo crear esta cuenta?»;
   - o llama a una acción de la base pasándole quién llama (`p_por`); la acción se pone «en los zapatos» de esa persona y revisa empresa, sede y permiso antes de grabar.
4. **Las acciones internas no están abiertas a la app:** `alta_vinculo`, `grabar_carga`, `grabar_inspeccion`, `corregir_inspeccion`, `registrar_contrasena_dada`, `marcar_contrasena_cambiada` y `bloqueo_ingreso` **solo las puede ejecutar el servidor**. Ni la app ni alguien sin sesión pueden llamarlas directamente.
5. **Origen permitido:** solo responden a navegadores que vienen de la app publicada o de `localhost`. Esto no es una protección de seguridad real (un programa puede llamar sin navegador); la protección real es la sesión y los permisos.
6. **Si falta el secreto `CRC_PIMIENTA`**, las funciones que tocan contraseñas se detienen con «mantenimiento» antes de hacer nada.

---

## 1. `ingresar`

| | |
|---|---|
| **Cómo comprueba la sesión** | **No pide sesión, a propósito:** es la puerta de entrada, sirve justo para obtenerla. |
| **Qué exige** | Tipo de documento válido (DNI, CE o pasaporte), número de 6 a 12 letras o números y una contraseña. Luego: que el documento no esté bloqueado (5 fallos en 15 min por documento, 30 por dirección de internet), que la contraseña sea correcta y que el **portero** (`portero_ingreso`) acepte a la persona (vínculo activo en una empresa activa). |
| **¿Ejecuta algo sin sesión?** | Sí, y es lo esperado: **anota el intento** en `intentos_ingreso` y prueba la contraseña. No crea ni cambia nada más. |

Observaciones:
- **Cuentas antiguas sin candado:** hay un camino para cuentas creadas antes del candado (prueba la contraseña sin transformar y, si es correcta, le pone el candado). Hoy **no queda ninguna** cuenta así en `crc-dev` (0 de 146), así que ese camino no se usa. En `crc-prod` todas nacerán con candado.
- **Dirección de internet:** la función toma la dirección del primer valor del encabezado `x-forwarded-for`. **Por confirmar** si la plataforma de Supabase escribe ese encabezado o si quien llama puede inventarlo. Si se pudiera inventar, alguien podría esquivar el bloqueo **por dirección** (30 fallos), pero **no** el bloqueo por documento (5 fallos), que sigue funcionando. También quedaría una dirección falsa en el registro de intentos.

## 2. `crear-cuenta`

| | |
|---|---|
| **Cómo comprueba la sesión** | `quienLlama` al inicio: sin sesión válida → 401 y no hace nada. |
| **Qué permiso exige** | Pregunta a la base **como la persona**: `puedo_crear_cuenta(empresa, rol, sedes)`. Responde sí solo si tiene el permiso `cuentas.crear`, si **puede asignar ese rol** (tabla `roles_asignables`: el dueño crea administradores; el administrador general y el de sede crean gestores, usuarios gestores y usuarios; el gestor solo usuarios y usuarios gestores) y si **todas las sedes elegidas son suyas** (salvo el dueño o el administrador general). Sin ese sí → 403. |
| **¿Ejecuta algo sin comprobar la sesión?** | **No.** Antes de la pregunta de permiso solo **lee** las sedes activas de la empresa para elegir una sede por defecto; no graba nada. |

Observaciones:
- La cuenta se graba en tres pasos (cuenta de ingreso, persona, vínculo). Si uno falla, la función **deshace** lo anterior. No es una sola transacción, pero se limpia sola.
- Si la persona ya existe sin vínculo activo (cambió de empresa), solo se crea el vínculo nuevo, después de la misma revisión de permiso.

## 3. `cambiar-contrasena`

| | |
|---|---|
| **Cómo comprueba la sesión** | `quienLlama` al inicio: sin sesión válida → 401. Solo cambia la contraseña **de la propia cuenta** de quien llama (no acepta otra persona). |
| **Qué exige** | La **contraseña actual correcta**, comprobada con el mismo camino del ingreso (registro de intentos, bloqueo y portero). Una contraseña nueva que cumpla las reglas del servidor y que sea distinta de la actual. |
| **¿Ejecuta algo sin comprobar la sesión?** | **No.** Una cuenta cesada tampoco puede cambiarla: el portero rechaza la comprobación de la contraseña actual. |

Observaciones:
- Al cambiarla se cierran todas las sesiones de la cuenta y se abre una nueva solo para ese equipo. Se anota la fecha del cambio, que sirve para la caducidad de 90 días de los administradores.

## 4. `dar-contrasena`

Tiene tres formas:

| Forma | Cómo comprueba quién llama | Qué permiso exige |
|---|---|---|
| **Individual** | `quienLlama`: sin sesión → 401. | Pregunta a la base **como la persona**: `puedo_dar_contrasena(persona)`. Sí solo si la persona destino está activa, no es uno mismo y quien llama la puede gestionar con el permiso `cuentas.contrasena`, que solo tienen el administrador general y el de sede (dentro de sus sedes) y el dueño. El gestor **no** da contraseñas. |
| **En bloque** | `quienLlama`: sin sesión → 401. | Que quien llama esté en `duenos_plataforma` (solo el dueño). La empresa debe estar activa; máximo 300 cuentas por vez; nunca se incluye a sí mismo. |
| **Rescate** | **No usa sesión:** exige la **clave secreta del proyecto** de Supabase en lugar de la sesión. | Solo funciona si el documento es de un **dueño de la plataforma**. Con cualquier otra cuenta → 403. |

**¿Ejecuta algo sin comprobar la sesión?** Solo la forma **rescate**, y a propósito: es el plan para cuando se pierde `CRC_PIMIENTA` (lo usa `herramientas/rescate-dueno.mjs` desde la computadora del dueño). Necesita la clave secreta de Supabase, que solo existe en Supabase y, el día del rescate, en un archivo local que se borra al terminar. Quien tenga esa clave ya tiene control total del proyecto, así que esta forma no abre una puerta nueva.

Observaciones:
- **Comparación de la clave del rescate:** se compara letra por letra sin cortar al primer error, así no se puede adivinar por tiempos. Solo revela si el largo coincide, lo cual no ayuda a adivinarla.
- **Detalle de funcionamiento (no de seguridad):** la forma **en bloque** solo acepta los roles `admin_empresa`, `gestor` y `usuario`. **No incluye** `admin_sede` ni `usuario_gestor`, que se crearon después. El dueño no puede restablecer en bloque a esos dos roles (sí uno por uno). Conviene agregarlos cuando el dueño lo decida (toca la función, no las tablas).
- Comprobé que lo publicado en Supabase de esta función coincide con el repositorio (solo cambia un detalle de tamaño máximo del mensaje, sin efecto en la seguridad).

## 5. `carga-personal`

| | |
|---|---|
| **Cómo comprueba la sesión** | `quienLlama` al inicio: sin sesión válida → 401. |
| **Qué permiso exige** | **Dos veces:** (1) la función pregunta **como la persona** `puedo_crear_cuenta(empresa, 'usuario', sedes)`: sin ese sí → 403, también para la vista previa. (2) Al grabar, la acción `grabar_carga` se pone en los zapatos de quien carga y **revisa fila por fila**: que pueda crear o editar **ese rol** en particular, que las sedes de la carga sean suyas, que no toque administradores ni a sí mismo y que pueda gestionar a cada persona que actualiza. Si una sola fila no cumple, no se graba nada. |
| **¿Ejecuta algo sin comprobar la sesión?** | **No.** Antes del permiso solo **lee** las sedes para elegir una por defecto. |

Observaciones:
- La revisión de la función usa solo el rol «usuario», pero la acción de la base vuelve a revisar el rol real de cada fila. Por ejemplo, un gestor que suba un Excel con una fila de rol «gestor» recibe «rol no permitido» en esa fila y no se graba nada.
- **Vista previa:** para decir qué pasará con cada fila, la vista previa consulta toda la base. Quien puede cargar personal se entera de dos cosas:
  - si un documento **ya tiene cuenta activa en otra empresa**, sin decir cuál. Eso es lo que pidió el dueño en la tarea 3.6;
  - el **nombre actual** de una persona de su misma empresa que esté en **otra sede**, si escribe su documento en el Excel. Grabarla después no se permite.

  El riesgo es bajo (hay que saber el número de documento), pero se anota. **Por confirmar con el dueño** si se quiere que la vista previa diga solo «no puedes tocar a esta persona» en esos casos.
- Si falla la creación de una cuenta o la grabación, la función borra las cuentas que alcanzó a crear.

## 6. `registrar-inspeccion`

| | |
|---|---|
| **Cómo comprueba la sesión** | `quienLlama` al inicio: sin sesión válida → 401. |
| **Qué permiso exige** | **Registrar:** la acción `grabar_inspeccion` se pone en los zapatos de quien llama y exige un vínculo activo, que no deba cambiar ni tenga vencida su contraseña, el permiso `inspecciones.registrar`, y que el formato, la sede, el área, la ubicación, el activo y los firmantes sean **de su empresa**. Además, una **guardia de sedes** en la tabla de inspecciones exige que la sede sea **una de sus sedes** (salvo el administrador general y el dueño). Un reenvío solo responde «ya recibida» si la inspección es de la misma persona. **Corregir:** la acción `corregir_inspeccion` exige que la inspección sea de su empresa, el permiso `inspecciones.editar_cerrada` (solo administradores) y la guardia de sedes. |
| **¿Ejecuta algo sin comprobar la sesión?** | **No.** |

Observaciones:
- **Lecturas antes del permiso:** antes de llamar a la base, la función lee el formato, el activo y la lista de fotos para recalcular el resultado. Lo hace con permisos del servidor, así que todavía no se revisó si son de la empresa de quien llama. Si alguien con sesión enviara a propósito el identificador de un formato de **otra empresa**, la respuesta de error podría mostrarle algunos textos de ese formato (títulos de firmas o claves de puntos). No se graba nada y la base lo rechaza después. El riesgo es bajo, porque esos identificadores son imposibles de adivinar (36 caracteres al azar) y la app no los muestra de otras empresas. Mejora posible: preguntar primero si el formato es de la empresa de quien llama. **Decide el dueño.**
- El resultado, el puntaje y los hallazgos **siempre los recalcula el servidor**: lo que mande el celular no cuenta.
- Las fotos y la firma deben estar ya subidas en la carpeta de esa empresa y esa inspección, y con el tamaño exacto indicado.

---

## Resumen

| Función | ¿Pide sesión? | Permiso (lo decide la base) | ¿Algo sin sesión? |
|---|---|---|---|
| `ingresar` | No (es la entrada) | Bloqueo por intentos + contraseña + portero | Solo anota el intento y prueba la contraseña (esperado) |
| `crear-cuenta` | Sí | `puedo_crear_cuenta` (permiso, rol asignable y sedes) | No |
| `cambiar-contrasena` | Sí | Solo la propia cuenta + contraseña actual | No |
| `dar-contrasena` | Sí (individual y en bloque) | `puedo_dar_contrasena` · en bloque solo el dueño | Solo el **rescate**, con la clave secreta del proyecto y solo para cuentas del dueño (esperado) |
| `carga-personal` | Sí | `puedo_crear_cuenta` + revisión fila por fila en `grabar_carga` | No |
| `registrar-inspeccion` | Sí | `grabar_inspeccion` / `corregir_inspeccion` + guardia de sedes | No |

**Conclusión:** las 6 funciones revisan la sesión por su cuenta, salvo dos casos que existen a propósito: el ingreso y el rescate del dueño. No encontré ninguna función que grabe o cambie datos de una empresa sin comprobar la sesión y el permiso. En los casos sensibles el permiso se revisa dos veces: en la función y otra vez dentro de la base.

## Hallazgos para decidir (ninguno es urgente)

| # | Función | Qué | Riesgo | Propuesta |
|---|---|---|---|---|
| 1 | `ingresar` / `cambiar-contrasena` | La dirección de internet se toma de un encabezado que **quizás** se pueda inventar | Bajo: solo esquiva el bloqueo por dirección; el bloqueo por documento sigue | Confirmar con la documentación de Supabase; si se puede inventar, tomar el valor que pone la plataforma |
| 2 | `registrar-inspeccion` | Lee el formato antes de comprobar que es de la empresa de quien llama; un error puede mostrar textos de otro formato | Bajo (identificadores imposibles de adivinar) | Comprobar la empresa del formato antes de calcular |
| 3 | `carga-personal` | La vista previa muestra el nombre de alguien de otra sede si se escribe su documento | Bajo | Mostrar solo «no puedes tocar a esta persona» |
| 4 | `dar-contrasena` | El restablecimiento en bloque no incluye `admin_sede` ni `usuario_gestor` | Ninguno (falta de función) | Agregar esos roles a la lista |
| 5 | Todas | La dirección de la app está fija en el código | Ninguno hoy; hay que cambiarla para `crc-prod` | Ya anotado en la arquitectura (§9) |

Los cambios 1 a 4 tocan solo el código de las funciones, no tablas compartidas (empresas, sedes, personas, vínculos, roles ni permisos).

## Lo publicado frente a lo revisado

- `dar-contrasena`: comprobé que lo publicado coincide con el repositorio.
- Las otras 5: revisé las fechas. Después de cada publicación solo cambiaron, en el código común, una ayuda nueva (para el rescate), el tamaño máximo del mensaje y el texto de una etiqueta («No genera plan de acción»). Nada de eso toca la sesión ni los permisos. **No las comparé letra por letra:** se puede hacer si el dueño lo pide.
