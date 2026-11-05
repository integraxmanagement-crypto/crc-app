# Nivel 2 · Diseños (sin aplicar): caducidad de contraseña de administradores y copia de los archivos de Storage

Fecha: 04/11/2026 · Nada de esto está aplicado. Espera el ok del dueño.

## 3. Caducidad de la contraseña de los administradores (cada 90 días)

**Qué ya existe y se aprovecha.** Cuando `personas.debe_cambiar_contrasena = true`, la persona entra con su clave actual pero la app la obliga a cambiarla antes de hacer cualquier otra cosa (es lo que pasa en el primer ingreso y cuando un administrador da una clave nueva). Además, `cambiar-contrasena` ya llama a `marcar_contrasena_cambiada(persona)` cuando se cambia la clave. No existe hoy ninguna fecha de «último cambio».

**Propuesta (pequeña y sin tocar la pantalla de ingreso).**
1. Tabla **nueva** `contrasenas_vigencia` (`persona_id` PK → personas, `cambiada_en`). Nadie la escribe directo (solo funciones).
2. Se amplía la función `marcar_contrasena_cambiada` (ya la usa `cambiar-contrasena`) para que además anote `cambiada_en = now()`. No hace falta volver a publicar la función del servidor `cambiar-contrasena`. `dar-contrasena` y `crear-cuenta` ya dejan `debe_cambiar_contrasena = true`, así que la fecha se anota al primer cambio.
3. Una función diaria (`app.vencer_contrasenas_admin`, tarea `pg_cron` como la de borrar intentos, sale a las 08:30 UTC) que marca `debe_cambiar_contrasena = true` a toda persona con un vínculo **activo** de rol `admin_empresa` o `admin_sede` cuya `cambiada_en` tenga más de 90 días. En su siguiente ingreso la app ya la obliga a cambiarla.
4. Opcional (media hora más): aviso en la app desde el día 80 («Tu contraseña vence en X días»).

**Qué tablas y funciones toca**
- Nueva: `contrasenas_vigencia`.
- **Compartidas (aviso obligatorio antes de aplicar):** la tarea actualiza `personas.debe_cambiar_contrasena` (dato, no estructura) y lee `vinculos` (rol y estado). No cambia columnas de `personas` ni de `vinculos`, ni `roles` ni `permisos`.
- Funciones: `marcar_contrasena_cambiada` (se amplía), `vencer_contrasenas_admin` (nueva), tarea `pg_cron` (nueva), y una consulta de lectura para el aviso del día 80.

**Qué pasa con las cuentas existentes.** Hoy no hay fecha guardada. Al activarlo se anota `cambiada_en = fecha de activación` para todos los administradores: nadie queda bloqueado ese día y el primer vencimiento sería 90 días después. (Si se usara la fecha de creación de la cuenta, la mayoría de las cuentas de prueba vencería de inmediato.) En crc-dev hay 11 administradores activos, todos de empresas ficticias.

**Riesgos y detalles a decidir**
- Las pruebas automáticas ingresan con administradores ficticios: si se marca el cambio obligatorio a una de esas cuentas, la prueba no podrá usarla hasta que cambie su clave. Propuesta: la tarea diaria ignora empresas con `es_prueba = true` mientras se está en desarrollo (se quita esa excepción en el entorno limpio del piloto).
- ¿Incluir al dueño de la plataforma? Recomendado sí (misma regla), pero decide el dueño.
- El cambio exige la clave actual y `cambiar-contrasena` ya impide repetir la misma; no se puede comprobar contra las claves anteriores porque no se guardan.
- Si pasa el vencimiento y la persona no entra, no se bloquea nada: simplemente se le pide cambiarla al ingresar.

**Pruebas que se escribirían primero:** (a) un administrador con `cambiada_en` de hace 91 días queda marcado; (b) uno de hace 89 no; (c) un usuario o gestor nunca; (d) un administrador cesado no; (e) al cambiar la clave se renueva la fecha y se limpia la marca; (f) nadie lee ni escribe `contrasenas_vigencia` directo; (g) anon no ejecuta nada. Para fingir fechas viejas se haría con SQL en crc-dev (Cowork o yo), no con una función de prueba en la base.

**Trabajo estimado:** medio día a un día: 1 migración, 1 función, 1 tarea programada, ~15 comprobaciones, aviso opcional en pantalla, nota para Cowork y bitácora. Sin cambios de costo.

## 4. Copia de los archivos de Storage (fotos, firmas, PDF)

**Estado de hoy (crc-dev):** 4 depósitos privados: `evidencias` (657 archivos, ~1,1 MB), `formatos-excel` (62, ~3,9 MB), `logos` (5, 20 kB), `passt-pdf` (16). En total unos 740 archivos y ~5 MB. En el piloto serán más (fotos y firmas de cada inspección), pero cada archivo tiene tope de 1 MB (10 MB en PDF del PASST).

**Idea más simple: una copia periódica a una carpeta de Google Drive del dueño, hecha desde su computadora con `rclone`** (programa gratuito, de código abierto).
- **Costo:** S/ 0. Google Drive de Integrax tiene 15 GB gratis y hoy se necesitan ~5 MB. Si algún día pasa de 15 GB, Google One cuesta desde unos US$ 2 al mes (no se contrata nada ahora).
- **Pasos (una sola vez, los hace el dueño):**
  1. En Supabase: Configuración del proyecto → Storage → «S3 connection» → crear una llave de acceso S3. Se guarda **solo en el administrador de contraseñas del dueño** (no en el código, no en Drive).
  2. Instalar `rclone` en la computadora (Windows) y ejecutar `rclone config` dos veces: un destino «supabase» (tipo S3, con el endpoint y la llave del paso 1) y un destino «drive» (cuenta de Google de Integrax, se autoriza en el navegador).
  3. Probar a mano: `rclone sync supabase:evidencias drive:CRC_respaldos/storage/evidencias --dry-run` (muestra qué copiaría sin copiar), luego sin `--dry-run`. Repetir para `formatos-excel`, `logos` y `passt-pdf`.
  4. Programar con el Programador de tareas de Windows: una vez por semana (domingo 22:00) con un archivo `.bat` que haga los cuatro `sync` (con `--backup-dir` para conservar lo borrado o cambiado por 30 días).
  5. Una vez al mes revisar que la carpeta tenga archivos nuevos y probar restaurar uno.
- **Alternativa automática (cuando haya piloto):** una tarea semanal en GitHub Actions con la llave S3 como secreto del repositorio y destino en un almacenamiento barato (Cloudflare R2 o Backblaze B2, ambos con 10 GB gratis). Obliga a crear una cuenta nueva en ese servicio: **no se hace sin autorización del dueño**.
- **Nota:** Supabase no incluye los archivos en sus copias de la base de datos en ningún plan.

**Qué ocurre al restaurar la base si los archivos no se restauran.**
- La base guarda, por cada archivo, solo su «ficha» (nombre, depósito, tamaño); los archivos en sí viven aparte. Al restaurar la base:
  - Los registros de inspecciones, firmas y fotos vuelven a existir, pero **los archivos que se subieron después de la copia no están** (las inspecciones mostrarán la foto o la firma como no encontrada) o, al revés, aparecen fichas de archivos que ya no existen.
  - Si una persona borró un archivo, esa pérdida no se recupera con la base.
  - Los registros de texto (respuestas, hallazgos, planes) quedan completos; lo que falta son las imágenes y PDF de ese período.
- Por eso conviene hacer ambas copias con el mismo ritmo (la base ya tiene copias diarias de Supabase según el plan) y probar una restauración completa en el entorno limpio antes del piloto (tarea 1.8).

**Lo que no se hace sin pedirlo:** crear cuentas, comprar espacio, guardar llaves en el código o en Drive, ni ejecutar nada de esto.

---
## Actualización del 04/11/2026 (respuestas del dueño)

### 3b. Caducidad de contraseña: diseño corregido (sigue SIN aplicar; falta el ok final)
Reglas del dueño: solo administradores de empresa y de sede; **no** el dueño de la plataforma; las cuentas existentes cuentan desde el día de activación; **se activa o desactiva por empresa**; solo en crc-dev; sin tocar las carpetas 14 y 15.
- **Interruptor por empresa** (reemplaza la idea de excluir empresas de prueba): tabla nueva `contrasenas_politica` (`empresa_id` PK, `caduca_admin` verdadero/falso, `actualizado_en`); sin fila = activado. Solo el dueño de la plataforma lo cambia (función `fijar_caducidad_admin(empresa, activo)`), con una casilla en la ficha de la empresa, junto a «Conoce al equipo de SST». En crc-dev se dejaría **desactivado** en las empresas ficticias que usan las pruebas automáticas (para no bloquear sus cuentas) y se podría activar en una sola para ver el efecto.
- **El dueño queda fuera por construcción:** la función solo mira a quien tiene un vínculo activo de rol `admin_empresa` o `admin_sede`; el dueño de la plataforma no tiene vínculo. Una prueba lo comprueba.
- **Piezas:** tabla `contrasenas_vigencia` (`persona_id`, `cambiada_en`); `marcar_contrasena_cambiada` anota la fecha (ya la usa `cambiar-contrasena`); función diaria `app.vencer_contrasenas_admin()` y tarea `pg_cron` (08:30 UTC) que, **solo en empresas con el interruptor activo**, marca `personas.debe_cambiar_contrasena = true` a los administradores con más de 90 días; al activar, `cambiada_en = hoy` para todos los administradores.
- **Qué toca de las tablas compartidas:** actualiza **datos** de `personas.debe_cambiar_contrasena` y lee `vinculos` (rol, estado) y `empresas` (estado). No cambia columnas, ni `roles`, ni `permisos`.
- **Pruebas primero:** (a) 91 días → marcado, 89 → no; (b) usuario, gestor y usuario gestor nunca; (c) administrador cesado no; (d) empresa con interruptor apagado no; (e) el dueño de la plataforma no; (f) cambiar la clave renueva la fecha y quita la marca; (g) nadie lee ni escribe las tablas nuevas directo; (h) solo el dueño cambia el interruptor. Las fechas viejas se simulan con SQL dentro de una transacción que se deshace (nada queda).
- **Trabajo:** medio día a un día.

### 2b. Propuesta (sin ejecutar) para reducir los vínculos acumulados en la Empresa D
Estado: la empresa D tiene 73 vínculos. De ellos, **22 son cuentas de personal de prueba ya cesadas** creadas por corridas viejas de `facultades.mjs` (11 usuarios y 11 usuarios gestores, nombre «PRUEBA PERSONAL …»), incluidas las 2 cuentas fijas nuevas (DNI 43000091 y 43000092), que **no** se tocarían. Los otros 51 son activos y vienen de las demás pruebas (administradores, gestores y usuarios fijos): no son parte de esta propuesta.
- **Qué se borraría:** solo los **20** vínculos cesados con nombre «PRUEBA PERSONAL …» y documento distinto de 43000091 y 43000092, de la empresa D (RUC 20000000052).
- **Cómo (en una sola transacción, por SQL, no por la app):** para esas personas, en este orden: `vinculos_historial`, `contrasenas_dadas`, `vinculos` (sus `vinculos_sedes` caen solos), `personas` y su usuario de acceso en `auth.users`. Antes se comprueba que ninguna de esas personas aparezca en `firmas`, `inspecciones`, `hallazgos`, `activos`, `passt_nodos` ni en otra tabla que las proteja; si alguna aparece, se deja fuera.
- **Verificación:** al terminar, la empresa D debe quedar con 53 vínculos (73 − 20) y las demás empresas con exactamente los mismos conteos que antes.
- **Toca tablas compartidas** (`personas`, `vinculos`) → **no se ejecuta sin tu ok**, solo en crc-dev.
