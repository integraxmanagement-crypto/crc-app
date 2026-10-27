# CRC · Centinel Risk Control

Sistema de gestión de seguridad y salud en el trabajo (SST / SGSST) para empresas y profesionales.

> **Estado actual (v0.6.0, 27/10/2026):** ingreso y seguridad (3.1), registro de empresas (3.2), usuarios y roles (3.3), carga de personal desde Excel (3.6), formatos de inspección y activos (3.4-B) e **inspecciones en el celular (3.4-C)**: se llenan con o sin señal, con fotos y firmas, se envían solas al volver la señal y cada organización puede usar su propio formato en Excel. **Todavía no** hay seguimiento de hallazgos ni programación (3.4-D), ni programa anual (3.4-E).

- **App publicada (pruebas internas):** https://crc-app-phi.vercel.app
- **Repositorio:** https://github.com/integraxmanagement-crypto/crc-app

---

## Qué es cada pieza (en simple)

| Pieza | Qué hace | Plan |
|---|---|---|
| **GitHub** (`crc-app`) | Guarda el código y su historial. | Repositorio privado |
| **React + Vite** | El "kit" con el que está construida la app. | Gratis (código abierto) |
| **PWA** | Permite instalar la app en el celular y abrirla sin señal. | Incluido |
| **Supabase** (`crc-dev`) | Base de datos, cuentas de ingreso y funciones del servidor. Cada empresa ve solo sus datos gracias a las reglas de seguridad por fila (RLS). | Gratuito, solo para construir |
| **Vercel** | Publica la app en internet. | Hobby (gratuito), **solo uso interno y no comercial** |

## Cómo abrir el proyecto en una computadora

Necesitas tener instalados **Git** y **Node.js** (versión 20 o superior).

1. Descarga el código (la primera vez se abrirá el navegador para iniciar sesión en GitHub):
   ```bash
   git clone https://github.com/integraxmanagement-crypto/crc-app.git
   cd crc-app
   ```
2. Instala las piezas del proyecto:
   ```bash
   npm install
   ```
3. Crea el archivo de claves: copia `.env.example` con el nombre `.env.local` y completa los dos valores. Los encuentras en Supabase → proyecto `crc-dev` → *Project Settings* → *API Keys*. Usa **solo la clave pública** (empieza con `sb_publishable_`). **Nunca** pongas la clave secreta.
4. Abre la app en modo desarrollo:
   ```bash
   npm run dev
   ```
   y entra a la dirección que aparece (normalmente http://localhost:5173).

Otros comandos útiles:

| Comando | Para qué sirve |
|---|---|
| `npm run build` | Prepara la versión final (carpeta `dist`). |
| `npm run preview` | Abre esa versión final en tu equipo, con modo sin conexión incluido. |
| `npm run lint` | Revisa el código en busca de errores comunes. |

## Cómo se publica

La publicación es **automática**: cada vez que se sube un cambio a la rama `main` de GitHub, Vercel construye y publica la nueva versión en unos segundos. Los celulares que ya tienen la app instalada se actualizan solos la próxima vez que la abran con señal.

- Las claves de Supabase en Vercel están en: *Vercel → crc-app → Settings → Environment Variables* (`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Si una publicación sale mal, en *Vercel → crc-app → Deployments* se puede volver a la versión anterior con **Rollback**.

## Cómo instalarla en un celular Android

1. Abre https://crc-app-phi.vercel.app en **Chrome**.
2. Toca el botón **"Instalar en este equipo"** (o menú ⋮ → **Instalar aplicación**).
3. Aparecerá el ícono de CRC en la pantalla de inicio. Ábrela una vez con señal; desde entonces abre también sin conexión.

## Ingreso y seguridad (tarea 3.1)

### Cómo se ingresa
- Pantalla de ingreso: **tipo de documento** (DNI, carnet de extranjería o pasaporte), **número** y **contraseña**. Sin correo ni teléfono.
- Supabase exige un correo por cuenta; CRC usa uno **interno** armado con el documento, por ejemplo `dni-12345678@usuarios.crc.invalid`. La terminación `.invalid` está reservada (norma RFC 2606): nunca recibe correos. La persona nunca lo ve.
- No hay registro libre: las cuentas las crea el **dueño de la plataforma** (administradores) o el **administrador de la empresa** (gestores y usuarios), con una **contraseña inicial al azar de 12 caracteres** que se muestra una sola vez y se debe cambiar en el primer ingreso.
- Si el documento no existe o la contraseña está mal, el mensaje es el mismo: "Documento o contraseña incorrectos."

### Reglas de contraseña (las revisa el servidor)
Mínimo 8 caracteres (máx. 64), con **minúscula, mayúscula, número y símbolo**; que no contenga el número de documento; nada de secuencias ni repeticiones (`Abcd-1234`); ni contraseñas o palabras comunes (`Peru2026!`).

### Quién ve qué
| Rol | Ve | Puede |
|---|---|---|
| Dueño de la plataforma (Integrax) | Todas las empresas y personas; el registro de intentos de ingreso | Crear, cesar y dar contraseña a administradores; restablecer contraseñas en bloque |
| Administrador de empresa | Su empresa: personas (con documento, también los cesados), historial y contraseñas dadas | Crear, corregir, cesar, reactivar y dar contraseña nueva a gestores y usuarios de **su** empresa; editar sus áreas y puestos |
| Gestor | Su ficha y la **lista de personas activas** de su empresa (solo nombres, puesto y área; sin documento) | — (no crea cuentas) |
| Usuario | Solo su ficha y su empresa | — |

Los roles y permisos están en tablas (`roles`, `permisos`, `roles_permisos`, `roles_asignables`), no en el código: para agregar un rol basta con agregar filas.

### Cese y cambio de empresa
- Cesar una cuenta exige **fecha y motivo**; no se borra nada y queda en `vinculos_historial`. Al cesar se cierran todas sus sesiones; si estaba sin señal, queda fuera en cuanto vuelve a conectarse.
- Un **"portero"** (Custom Access Token Hook `portero_ingreso`) impide ingresar a quien no tiene un vínculo activo: ve "Tu cuenta está inhabilitada".
- Una persona solo puede estar activa en **una** empresa. Si cambia de empresa, se cesa en la primera y se da de alta en la segunda con la misma cuenta; cada empresa conserva su historial y no ve el de la otra.

### Protección contra intentos de adivinar contraseñas
- Todo ingreso pasa por la función del servidor `ingresar`, que **anota cada intento** en `intentos_ingreso` (documento, resultado, dirección de internet y hora). Solo lo ve el dueño, en la app (**Intentos**). Se **borran solos a los 90 días** (plazo provisional, a validar con el abogado).
- **5 fallos** con el mismo documento en 15 min → ese documento se bloquea **15 min** (también si el documento no existe). **30 fallos** desde la misma dirección de internet → esa dirección se bloquea 15 min.
- **Candado de servidor:** Supabase no guarda la contraseña que escribe la persona sino una versión transformada con un secreto (`CRC_PIMIENTA`) que solo conocen las funciones. Así nadie puede saltarse el bloqueo probando contraseñas directo contra Supabase.

> ⚠️ **El secreto `CRC_PIMIENTA` es vital.** Está en Supabase → *Edge Functions → Secrets* y en el gestor de contraseñas del dueño. Si se pierde o se cambia, **nadie podrá ingresar** hasta que se den contraseñas nuevas (ver «Plan de rescate» más abajo). Nunca va en el código ni en GitHub.

### Configuración hecha en el panel de Supabase (no está en el código)
- *Authentication → Sign In / Providers*: registro libre **apagado**; contraseña mínima 8 con minúscula, mayúscula, número y símbolo.
- *Authentication → Auth Hooks*: "Customize Access Token" → `public.portero_ingreso`.
- *Authentication → Rate Limits*: **IP Address Forwarding** activado.
- *Edge Functions → Secrets*: `CRC_PIMIENTA`.

### Pruebas automáticas (solo cuentas ficticias)
Están en `pruebas/` y usan las cuentas de `.env.pruebas.local` (archivo local, **no** se sube a GitHub). Se ejecutan con `node pruebas/<nombre>.mjs`:

| Prueba | Qué demuestra |
|---|---|
| `separacion.mjs` | Ninguna empresa ve ni toca datos de otra; roles; cambio de empresa. Guarda un informe en `pruebas/resultados/`. |
| `cese.mjs` | Cese, reactivación y bloqueo del ingreso de una persona cesada. |
| `bloqueo.mjs` | Registro de intentos y bloqueo por documento (deja a USUARIO_B bloqueado 15 min). |
| `candado.mjs` | La puerta trasera está cerrada: ni con la contraseña correcta se entra directo a Supabase. |
| `reglas-contrasena.mjs` | Reglas de contraseña aplicadas por el servidor. |
| `empresas.mjs` | Registro de empresas (3.2): separación de ficha, sedes, contactos y logos; solo el dueño crea empresas y sedes; RUC, CIIU y archivos; suspensión. Informe en `pruebas/resultados/`. |
| `carga.mjs` | Carga desde Excel (3.6): permisos, todo o nada, hoja de entrega, actualizar, reactivar, administradores que no se tocan y «por revisar». Usa DNI al azar 71xxxxxx: cada corrida deja unas pocas cuentas ficticias más. |
| `carga-excel.mjs` | Carga desde Excel (3.6), prueba final: lee `pruebas/excel/CRC_prueba_carga_25_filas_FICTICIO.xlsx` con el lector de la app y revisa fila por fila la respuesta del servidor; archivos dañado, no Excel, .xls, CSV, más de 1 MB, sin personas y 301 personas; límites del servidor. No graba nada. Informe en `pruebas/resultados/`. |
| `motor.mjs` | Motor de reglas de los formatos (3.4-B), sin base de datos: las 6 plantillas base están bien armadas y dan el resultado, el puntaje y los hallazgos esperados en casos conocidos (por ejemplo LOTO con 10 √, 1 N/A y 1 X = 92 %). Informe en `pruebas/resultados/`. |
| `formatos.mjs` | Formatos y activos (3.4-B): sin sesión no se ve nada; nadie escribe directo en las 8 tablas nuevas; la base de CRC no la cambia ninguna empresa; copiar, editar, publicar y versiones (lo publicado no cambia); separación entre empresas; activos, ubicaciones, tipos y listas (código único, baja sin borrar, historial, responsable y sede de la misma empresa). Cada corrida deja unos pocos datos ficticios más. Informe en `pruebas/resultados/`. |
| `usuarios.mjs` | Usuarios y roles (3.3): un administrador no toca a nadie de otra empresa ni a otros administradores; regla del último administrador; gestor y usuario no crean cuentas ni dan contraseñas; contraseña nueva (una sola vez, obliga a cambiarla, cierra sesiones); registro de intentos solo para el dueño; áreas y puestos por empresa. Crea una sola vez las cuentas ficticias ADMIN_A2 y USUARIO_A3. Informe en `pruebas/resultados/`. |

`preparar-datos.mjs` crea las personas ficticias; `preparar-empresas.mjs` completa la ficha, sedes, contactos y logo ficticios de las empresas A y B; `primer-ingreso.mjs` se usó una sola vez para el primer cambio de contraseña del dueño ficticio: **no forma parte de «correr todo»** (desde el 23/10/2026 no hace nada si el dueño ya cambió su contraseña). `bloqueo.mjs` deja a USUARIO_B bloqueado 15 minutos: córrelo al final o espera antes de `usuarios` y `separacion`. Los Excel de prueba se crean con `python pruebas/excel/crear_excel_prueba.py`.

## Registro de empresas clientes (tarea 3.2)

Las empresas **no se registran solas**: el dueño de la plataforma (Integrax) las da de alta desde **Inicio → Empresas clientes**.

### Ficha de la empresa
- **RUC:** 11 dígitos, que empiece con 10, 15, 16, 17 o 20 y con dígito verificador correcto. Se revisa el formato; **no se consulta a SUNAT**.
- Razón social, nombre comercial (opcional) y domicilio legal (dirección, distrito, provincia y departamento, en texto libre).
- **Actividad económica:** código CIIU elegido del catálogo oficial, más un **texto libre** que es el que se imprime en los encabezados de registros y formatos; se puede cambiar sin cambiar el CIIU.
- **Logos** positivo (fondo claro) y negativo (fondo oscuro, opcional; si falta se usa el positivo). PNG, JPG o WebP de hasta 1 MB, en un almacén **privado**: cada empresa solo puede ver y cambiar los suyos.
- **Contactos:** representante legal, administrador de contacto y respaldo (opcional). Son datos personales: solo los ven Integrax y el administrador de esa empresa.
- **Estado** (activa o suspendida: si se suspende, nadie de esa empresa puede ingresar y se cierran sus sesiones) y **plan** (gratuito o de pago; solo se guarda, el control de planes es de la v1.1).
- **Sedes:** toda empresa tiene al menos una activa. Se agregan, editan y desactivan; no se borran.
- **Primer administrador:** lo crea el dueño desde la ficha; la contraseña inicial se muestra una sola vez.

### Quién puede qué (decisión del dueño, 22/10/2026)
| | Dueño (Integrax) | Administrador de la empresa | Gestor y usuario |
|---|---|---|---|
| Crear empresas y sedes; editar ficha legal; suspender | ✅ | ❌ | ❌ |
| Editar contactos y logos | ✅ | ✅ (solo su empresa) | ❌ |
| Ver ficha, sedes y logos | Todas | Su empresa | Su empresa |
| Ver contactos | Todas | Su empresa | ❌ |

### Catálogo CIIU
419 códigos de la **CIIU Rev. 4.0** de SUNAT (archivo `TablaOficialCIIURev4.xls` de las tablas anexas del RUC, descargado el 22/10/2026; último guardado del archivo: 28/02/2025). Se busca por código o por palabras, sin importar tildes. Los dos códigos que SUNAT marca "(NO USAR)" (9810 y 9820) se guardan pero no se pueden elegir. La migración `catalogo_ciiu_rev4_sunat` lleva la fuente y una huella de control.

### Datos de prueba
Las empresas de `crc-dev` son **ficticias** y están marcadas como de prueba: la base de datos obliga a que lleven "Ficticia" en la razón social. Sus datos se cargan fuera de las migraciones, para que **nunca viajen** al entorno limpio donde se cargará la empresa piloto real.

## Usuarios y roles por empresa (tarea 3.3)

### Roles y puestos
Se mantienen los 3 roles de acceso: **administrador**, **gestor** (equipo SSO) y **usuario** (trabajadores). El **puesto** (jefe de SSO, supervisor, médico ocupacional…) es solo un dato de la ficha: no cambia lo que la persona puede hacer. Si un cliente pide permisos distintos por puesto, se agregan como filas en las tablas de roles y permisos, sin reprogramar.

### Pantallas
- **Usuarios** (administrador: *Inicio → Usuarios de mi empresa*; dueño: dentro de cada empresa → *Personas*): lista con buscador y filtro activos/cesados; crear cuenta eligiendo puesto y área de las listas; **Gestionar** cada persona: corregir datos (nombre, puesto, área, fecha de ingreso, rol gestor/usuario), **contraseña nueva**, cesar con fecha y motivo, reactivar. Abajo, las últimas contraseñas nuevas dadas (quién, a quién y cuándo; nunca la contraseña).
- **Estructura y puestos** (desde la 3.6): la estructura de cada empresa en tres niveles (gerencia → área → subárea o línea, esta última opcional) y la lista de puestos. Se agregan, renombran y desactivan; solo se borran si nunca se usaron (y, en la estructura, si no tienen nada debajo).
- **Registro de intentos de ingreso** (solo el dueño, menú *Intentos*): filtros por fecha, resultado y documento; los 200 más recientes.
- **Restablecer en bloque** (solo el dueño, al final de *Usuarios* de cada empresa): contraseñas nuevas para todos los roles elegidos, que se muestran **una sola vez**.

### Reglas
- **Contraseña nueva:** 12 caracteres al azar, se muestra una sola vez, obliga a cambiarla al ingresar y cierra las sesiones abiertas de esa persona. Queda anotado quién la dio y cuándo en `contrasenas_dadas` (sin la contraseña). El administrador solo la da a gestores y usuarios de su empresa; a un administrador solo se la da el dueño. Sin recuperación por correo.
- **Administradores:** puede haber varios por empresa; solo el dueño los crea. Nadie se cesa a sí mismo, y **no se puede cesar ni quitar el rol al único administrador activo** de una empresa (tampoco el dueño): primero se crea otro.
- **Quién ve qué** sigue igual que en la 3.1: el administrador ve nombres y documento (también de los cesados); el gestor, nombres, puesto y área; el usuario, solo lo suyo.
- **Borrado a los 90 días:** la tarea programada `borrar-intentos-90-dias` (pg_cron, incluido en Supabase) corre todos los días a las 03:15 de Lima.

### Plan de rescate si se pierde `CRC_PIMIENTA`
1. En Supabase → *Edge Functions → Secrets*, crear un `CRC_PIMIENTA` nuevo (al menos 32 caracteres) y guardar su copia en el gestor de contraseñas.
2. Crear en la carpeta del proyecto el archivo **`.env.rescate.local`** (excluido de GitHub) con `SUPABASE_URL=` y `SUPABASE_CLAVE_SECRETA=` **solo ese día**.
3. Correr `node herramientas/rescate-dueno.mjs dni <número del dueño>`: muestra una vez la contraseña nueva **del dueño** (la función se niega con cualquier otra cuenta).
4. Ingresar a la app y, en cada empresa, usar **Restablecer en bloque** (por ejemplo, solo administradores; ellos luego dan contraseñas nuevas a su gente).
5. Al terminar: **borrar** `.env.rescate.local` y **cambiar la clave secreta** en Supabase → *Project Settings → API Keys*.

No se ensayó en `crc-dev`: se ensayará en el entorno limpio (decisión del dueño, 22/10/2026).

## Carga de personal desde Excel (tarea 3.6)

Para dar de alta (o actualizar) a muchas personas a la vez. La usan el administrador (*Usuarios → Cargar desde Excel*) y el dueño (dentro de cada empresa). Pasos en la pantalla:
1. **Descargar plantilla**: un Excel con las listas de puestos y de la estructura de esa empresa, con listas desplegables. Hasta **300 personas y 1 MB** por archivo.
2. **Elegir el Excel**: se lee **en el equipo** con un lector propio (sin librerías). El archivo **no se sube ni se guarda** (Ley 29733); al servidor solo van los datos de las filas, y la pantalla los olvida después de grabar.
3. **Vista previa**: el servidor revisa cada fila y dice qué pasará: *Nueva*, *Ya tenía cuenta en CRC*, *Ya existe · con cambios / sin cambios*, *Estaba cesada*, *Administrador · no se toca*, *Falta crear en las listas* o *Error* (con el motivo en simple). Lo que falta en las listas se puede crear ahí mismo.
4. **Lista completa** (opcional, para la carga mensual): quienes no aparecen en el Excel quedan **«por revisar»**.
5. **Confirmar y grabar**: **todo o nada**. El servidor vuelve a revisar todo, crea las cuentas nuevas y graba personas y vínculos en una sola transacción; si algo falla, no queda nada a medias.

### Reglas (decisiones del dueño, 23/10/2026)
- Las personas se reconocen por **tipo + número de documento** (no por el nombre). Si el mismo número existe con otro tipo, es error (posible error de tipeo).
- Quien ya existe en la empresa se **actualiza** (nombre, fecha de ingreso, puesto, unidad, rol gestor/usuario) y **conserva su contraseña**. Los **administradores nunca se tocan** ni pueden venir en el Excel.
- Quien estaba cesado en esa empresa solo se **reactiva si se marca** la casilla. Quien está activo en otra empresa es error (sin decir cuál).
- Las personas nuevas reciben una **contraseña inicial** de 12 caracteres que se muestra **una sola vez** en la **hoja de entrega**: al imprimir sale una lista de control para firmar (sin contraseñas) y una tarjeta recortable por persona.
- **«Por revisar»:** nadie se cesa solo. En *Usuarios* aparece un aviso y el filtro *Por revisar*; en cada persona, «Sí, sigue en la empresa» o «No, confirmar cese» (el cese de siempre, con la regla del último administrador). La marca se quita sola si la persona vuelve a aparecer en un Excel o si se cesa.
- Cada carga queda en `cargas_personal`: quién, cuándo y cuántas (nuevas, altas, actualizadas, reactivadas, sin cambios, por revisar). **Nunca** contraseñas, nombres ni el archivo.

### Piezas
- Base de datos: tabla `unidades` (estructura), `cargas_personal`, marca `por_revisar_desde` en `vinculos`, acciones `grabar_carga` (solo la usa el servidor) y `confirmar_sigue`.
- Función del servidor `carga-personal` (modos *revisar* y *grabar*). Permiso: lo decide la base de datos (`puedo_crear_cuenta`).
- Pantallas en `src/carga/`: lector (`xlsx.ts`, `lectura.ts`), plantilla (`plantilla.ts`), pantalla (`Carga.tsx`) y hoja de entrega (`HojaEntrega.tsx`).

## Formatos de inspección y activos (tarea 3.4-B)

Diseño aprobado por el dueño el 26/10/2026 (D-37; documentos en Drive, `05_Formatos_Inspeccion`). Lo usan el **administrador** y el **gestor** (*Inicio → Formatos de inspección* y *Activos y listas*) y el dueño de la plataforma (dentro de cada empresa → *Inspecciones*).

### Cómo funciona un formato
- Un formato no es una pantalla programada: es una **«receta»** guardada (secciones, puntos, firmas y reglas) que la app lee. La misma pantalla y el mismo **motor de reglas** (`src/formatos/motor.ts`) sirven para cualquier formato.
- **Plantillas base de CRC:** las 6 del anexo de Cowork (extintores, caseta de ataque rápido, bombas contra incendio, DACI, eficacia LOTO e IPF). Las ven todos y **no las cambia ninguna empresa**. Se cargan con la migración `formatos_base`, generada desde `src/formatos/base.ts` con `node herramientas/generar-formatos-base.mjs`.
- **Copiar a mi empresa:** crea un **borrador** propio. En el **constructor** se agregan, quitan y mueven secciones y puntos; se cambian textos y marcas (obligatorio, crítico, genera hallazgo, cantidad esperada, observación/foto/acción si no cumple, subtipos); se ponen código, versión, fecha de aprobación y logo (de la ficha: claro, oscuro o ninguno); y se eligen las reglas de una lista fija. *Probar el formato* muestra al instante el resultado, el puntaje y los hallazgos con respuestas inventadas (no guarda nada).
- **Publicar** (solo el administrador): la versión queda **congelada** con su huella (SHA-256) y pasa a ser la vigente; la anterior queda retirada sin cambios. Para cambiar algo se abre un borrador nuevo. Cada inspección (3.4-C) guardará la versión que usó.
- Cada punto tiene una **clave fija** (por ejemplo `EXT-07`) que no cambia entre versiones. La **severidad** existe pero queda vacía hasta la v1.1.
- **Reglas de la v1:** vencido (fecha o años de la ficha del activo), «no cumple» en todos / en los críticos / en una sección / en ciertos puntos, una respuesta dada, observación general, número fuera de rango y bloque repetible con filas. Puntaje = % de favorables (la empresa elige si N/A cuenta). El servidor volverá a calcular todo al recibir la inspección.
- **Plazos de los extintores (decisión del dueño):** solo se calcula el próximo mantenimiento (+12 meses, editable). Los plazos de prueba hidrostática y vida útil quedan **vacíos** hasta que cada empresa ponga los suyos (validar con la norma y su proveedor).

### Activos, ubicaciones y listas
- **Tipos de activo:** los 4 base (extintor, caseta, bomba con subtipos electrobomba/motobomba, dispositivo de alarma con panel/pulsador/detector/sirena) traen la ficha del anexo; la empresa puede crear **tipos propios** con la ficha básica (código, sede, área, ubicación, responsable y datos técnicos). La ficha no se edita en la v1 (decisión del dueño).
- **Activos:** número de ítem correlativo automático, código único por tipo, sede, área (de la estructura), ubicación, responsable (persona de la empresa) y dotación esperada propia (casetas). **No se borran:** se dan de baja con fecha y motivo y se pueden reactivar; cada cambio queda en `activos_historial`.
- **Ubicaciones:** dentro de cada sede (empresa → sede → área → ubicación), opcionalmente asociadas a un área de «Estructura y puestos».
- **Listas** (agentes extintores, unidades, tipos de soporte, tipos de bloqueo…): se copian solas de la base; cada empresa agrega, renombra y desactiva. Nada viene precargado con personas ni lugares.

### Piezas
- Base de datos: tablas `listas`, `listas_valores`, `tipos_activo`, `ubicaciones`, `activos`, `activos_historial`, `plantillas` y `plantillas_versiones` (todas con RLS; lo de empresa vacía es la base de CRC). Permisos nuevos como filas: `plantillas.editar` (administrador y gestor), `plantillas.publicar` (administrador) y `activos.editar` (administrador y gestor). Migraciones `formatos_constructor_activos`, `formatos_base` y `formatos_correccion_lista`.
- App: `src/formatos/` (receta, motor, base, datos, lista, constructor y prueba) y `src/activos/` (activos, tipos, ubicaciones y listas).

## Inspecciones en el celular (tarea 3.4-C)

Decisiones del dueño del 26 y 27/10/2026 (D-37 y respuestas a la 3.4-C; documentos en Drive, `05_Formatos_Inspeccion`). Las hacen el **administrador** y el **gestor** (*Inicio → Inspecciones*).

### Cómo funciona sin señal
- La app baja sola a la memoria del equipo (IndexedDB, base `crc-campo`) lo necesario para inspeccionar: formatos vigentes, activos, sedes, áreas, ubicaciones, listas, personas, logos y el Excel de cada formato. Se actualiza cada vez que hay señal (o con *Actualizar*).
- La inspección nace en el equipo con su propio identificador y **se guarda sola a cada cambio**. Los borradores **solo viven en el equipo** (decisión del dueño): no se ven en otro equipo y se pueden descartar.
- Al **cerrarla** pasa a la cola de envío. Con señal se suben primero las fotos y la firma y después la inspección, a la función `registrar-inspeccion`, que vuelve a calcular resultado, puntaje y hallazgos con el mismo motor de reglas y la graba **todo o nada**. Si llega dos veces responde «ya recibida»: **nunca se duplica**. Si falla, se reintenta sola (30 s, 1, 2, 5, 15 y 30 min); si el servidor no la acepta, queda en el equipo para revisarla y cerrarla de nuevo.
- La inspección cuenta como **hecha al cerrarla el inspector**, aunque falten firmas.
- Fotos: se achican en el equipo a 1600 px y **1 MB como máximo**. Espacio por empresa: **250 MB** (plan gratuito) y **5 GB** (plan de pago), en la tabla `limites_plan`. Si se llena, no se toman fotos nuevas.

### Firmas
- **Nivel 1, desde la cuenta de cada firmante:** quien registra designa a los firmantes de CRC; cada uno firma con el dedo desde su cuenta (*Mis firmas*). El inspector puede firmar en el momento, también sin señal.
- **Externos:** solo en papel, en la hoja impresa. De ellos se guardan **nombre y documento**, marcados como externos (la base de datos no acepta un externo sin documento).
- Si una inspección se corrige después de firmada, la firma queda marcada como «de una versión anterior».

### Ver, corregir y anular
- Ven todas las inspecciones el **administrador** y el **gestor**; cada firmante ve las suyas.
- **Corregir** (solo el administrador, con señal): con motivo; guarda cómo estaba en `inspecciones_ediciones`. **Anular** (administrador): con motivo; no se borra nada.

### Excel de cada organización
- En el constructor (*Excel de la organización*), cada empresa sube y cambia su propio formato **.xlsx sin macros, de hasta 1 MB**, con marcas `{{…}}` donde van los datos. El archivo se revisa y se llena **en el equipo del usuario** (lector propio, sin librerías); se guarda en el almacén privado `formatos-excel` para poder llenarlo después sin señal.
- Cada inspección se descarga **llena y sin firmas**, para firmarla a mano. Si el formato no tiene Excel, *Imprimir* saca una hoja simple de CRC.
- Marcas: `{{razon_social}}` `{{ruc}}` `{{domicilio}}` `{{actividad}}` · `{{nombre_formato}}` `{{codigo_formato}}` `{{version_formato}}` `{{fecha_aprobacion}}` · `{{numero_inspeccion}}` `{{fecha}}` `{{hora}}` `{{sede}}` `{{area}}` `{{ubicacion}}` `{{inspector}}` `{{resultado}}` `{{puntaje}}` `{{observacion}}` · `{{activo_codigo}}` `{{activo.<dato>}}` · `{{CLAVE}}` (respuesta), `{{CLAVE.si}}` `{{CLAVE.no}}` `{{CLAVE.na}}` (una «X» en la columna que toca), `{{CLAVE.obs}}` `{{CLAVE.accion}}` `{{CLAVE.responsable}}` `{{CLAVE.plazo}}` · `{{CLAVE#1}}`, `{{CLAVE#2}}`… (filas de un bloque repetible) · `{{firma.<rol>.nombre}}` `{{firma.<rol>.cargo}}` `{{firma.<rol>.fecha}}` (`{{firma.<rol>#2.nombre}}` para el segundo firmante).
- Las pruebas usan un Excel **ficticio** (`pruebas/excel/CRC_formato_extintores_FICTICIO_v01.xlsx`, diseño inventado). Los formatos del dueño no se suben al repositorio ni a carpetas compartidas.

### Piezas
- Base de datos: tablas `inspecciones`, `inspecciones_ediciones`, `archivos`, `firmas`, `plantillas_excel` y `limites_plan` (todas con RLS; la app solo lee). Almacenes privados `evidencias` y `formatos-excel`. Permisos nuevos como filas: `inspecciones.registrar` y `inspecciones.ver` (administrador y gestor), `inspecciones.editar_cerrada` e `inspecciones.anular` (administrador). Migraciones `inspecciones`, `inspecciones_aviso_correccion` y `firmas_externo_con_documento`.
- Servidor: función `registrar-inspeccion` (registrar y corregir). El motor de reglas y la receta viven en `supabase/functions/_compartido/formatos/` y la app los reusa (`src/formatos/motor.ts` y `receta.ts` solo los reexportan).
- App: `src/inspecciones/` (memoria del equipo, copia local y cola, fotos, firma, Excel, pantallas de inspecciones, llenar, detalle y mis firmas).
- Pruebas: `pruebas/inspecciones.mjs` (servidor) y `pruebas/excel-inspeccion.mjs` (Excel, sin base de datos). La prueba sin señal se hizo en el navegador (ver `pruebas/resultados/inspecciones-sin-senal.md`).

## Seguridad: reglas que no se rompen

- Las claves van **solo** en variables de entorno (`.env.local` en el equipo, Vercel en la nube). El archivo `.env.local` está excluido de GitHub por `.gitignore`.
- En la app solo va la **clave pública** de Supabase. La protección real de los datos la dan las reglas **RLS**, que deben activarse en **toda** tabla nueva.
- Solo **datos ficticios** mientras se construye: nada de DNI ni información real de empresas.
- La clave **secreta** de Supabase y `CRC_PIMIENTA` solo existen dentro de Supabase (funciones del servidor). Ninguna llega al navegador.
- Las tablas no se pueden escribir directamente desde la app: todo cambio pasa por funciones que revisan permisos.

## Estructura de carpetas

```
public/icon-*.png      Íconos de la app instalada (192, 512 y maskable 512), preparados desde el logo oficial (tarea 2.1b)
public/favicon-*.png   Ícono de la pestaña del navegador (32 y 48 px); apple-touch-icon-180.png para iPhone
public/logo.svg        Logo provisional anterior: ya no se usa (se puede borrar cuando el dueño lo indique)
src/marca/             Logo oficial de CRC (diseño del dueño, tarea 2.1a): animado para el ingreso y estático para la barra.
                       Los dos SVG se usan tal cual; Logo.tsx los inserta en la página y elige la versión clara u oscura
                       según el fondo (no según el modo oscuro del equipo). Cada uno se descarga aparte y solo cuando hace falta.
src/App.tsx            Elige la pantalla: ingreso, cambio de contraseña, inicio o gestión
src/ruta.ts            Navegación simple (#/empresas, #/mi-empresa…) sin librerías
src/empresas/          Registro de empresas: lista, ficha, CIIU, sedes, contactos, logos y administrador
src/usuarios/          Usuarios, estructura y puestos, contraseña nueva, «por revisar», restablecer en bloque y registro de intentos
src/carga/             Carga de personal desde Excel: lector propio de .xlsx, plantilla, vista previa y hoja de entrega (tarea 3.6)
src/formatos/          Formatos de inspección (3.4-B): receta, motor de reglas, las 6 plantillas base, constructor y prueba del formato
src/activos/           Activos, tipos de activo, ubicaciones y listas de los formatos (3.4-B)
src/inspecciones/      Inspecciones en el celular (3.4-C): memoria del equipo, cola de envío, fotos, firmas, Excel y pantallas
src/gestion.css        Diseño de las pantallas de gestión
src/Ingreso.tsx        Pantalla de ingreso (documento y contraseña)
src/CambioContrasena.tsx  Cambio obligatorio de contraseña
src/sesion.ts          Sesión: ingresar, salir, ficha de la persona, cierre si fue cesada
src/index.css          Colores, letra y diseño (marca: #0B3C5D y #1BA39C)
src/hooks.ts           Estado de conexión, base de datos e instalación
src/supabase.ts        Conexión con Supabase (solo clave pública)
supabase/migrations/   Cada cambio hecho a la base de datos (el nombre coincide con la versión en Supabase)
supabase/functions/    Funciones del servidor: ingresar, crear-cuenta, cambiar-contrasena, dar-contrasena, carga-personal, registrar-inspeccion
pruebas/               Pruebas automáticas con cuentas ficticias e informes; pruebas/excel/ tiene los Excel ficticios de prueba
herramientas/          Herramienta de rescate (solo si se pierde CRC_PIMIENTA; nunca va en la app) y generador de la migración de plantillas base
vite.config.ts         Configuración de la app instalable (PWA)
```

## Pendientes conocidos

- El logo oficial ya está en la app (2.1a) y en los íconos de instalación, el favicon y el manifest (2.1b). Al cambiar íconos, en Android hay que **desinstalar e instalar de nuevo** la app: el ícono instalado no siempre se actualiza solo.
- La tabla `prueba_conexion` es solo de prueba; se puede borrar cuando exista la primera tabla real.
- Supabase gratuito pausa el proyecto tras 1 semana sin uso y no tiene copias de seguridad automáticas.
- Antes de vender a clientes: pasar Vercel a plan Pro (el plan Hobby no permite uso comercial) y Supabase a un plan con copias de seguridad.
- **Al pasar Supabase a plan Pro:** activar la protección contra contraseñas filtradas (pedido del dueño, 22/10/2026). Ojo: con el candado de servidor, la de Supabase revisaría la contraseña transformada; esa revisión habrá que hacerla desde la función `ingresar` con el servicio gratuito HaveIBeenPwned (decidir entonces).
- Validar con el abogado (tareas 5.3 y 5.8) el plazo provisional de 90 días del registro de intentos (tiene direcciones de internet: dato personal).
- **3.3:** ensayar el plan de rescate de `CRC_PIMIENTA` en el entorno limpio, no en `crc-dev`.
- Lugares con muchos trabajadores en una misma conexión (por ejemplo, el wifi de una mina): Supabase deja pasar unos 30 ingresos por minuto por dirección; vigilarlo cuando haya clientes reales.
- Antes de tener clientes: sumar la verificación "no soy un robot" (Cloudflare Turnstile) al ingreso.
- Las funciones del servidor ya usan las claves nuevas de Supabase; las antiguas (`anon` / `service_role`) dejan de funcionar a fines de 2026. Cuando se desactiven en el panel, confirmar que todo sigue funcionando.
- **3.2:** cuando SUNAT publique una versión nueva de la tabla CIIU, cargarla con una migración nueva (sin borrar la anterior si ya hay empresas que la usan).
- **3.2:** la empresa piloto real se cargará en un entorno limpio, que se decidirá aparte; las empresas ficticias de `crc-dev` no se usan para el piloto.
- **3.6:** «Sí, sigue en la empresa» quita la marca pero no queda en el historial de la persona (el cese sí). Agregarlo si el dueño lo pide.
- **3.6:** con el plan gratuito, Supabase a veces responde lento o con un error pasajero (502): la pantalla avisa y se puede reintentar; lo ya creado en las listas no se repite.
- **3.6:** el lector de Excel se probó con archivos guardados por Excel y por la herramienta de prueba; falta probar un archivo exportado desde Google Sheets.
- **3.4-B:** la prueba `formatos.mjs` deja cada vez unas pocas plantillas, tipos y activos ficticios más en la empresa A de `crc-dev` (códigos con número al azar). Uno de ellos (`EXT-L…`, de la primera corrida) quedó con un agente inventado: es el caso que encontró el error corregido en `formatos_correccion_lista`.
- **3.4-B:** el dueño de la plataforma ve las plantillas base pero, en la v1, no las edita desde la app: un cambio en la base se hace con una migración nueva generada desde `src/formatos/base.ts`.
- **3.2:** la ficha no guarda historial de cambios (quién cambió qué y cuándo, más allá de la última modificación); evaluarlo si un cliente o la auditoría lo pide.
- **3.4-C:** la hoja Excel sale sin las imágenes de las firmas (v1). Quien solo firma (sin ser administrador ni gestor) ve los nombres de los demás como «Persona de la empresa» en el detalle.
