# Copia de seguridad de los archivos de CRC (fotos, firmas, PDF y Excel) hacia tu Google Drive

Para: el dueño (no hace falta saber programar) · Fecha: 04/11/2026 · **Nada de esto se ha ejecutado.** Claude no usa ni guarda ninguna llave.

## En una frase
Cada domingo en la noche, tu computadora copia sola los archivos de CRC a una carpeta de tu Google Drive (`CRC_respaldos`). Si algo se pierde, se recuperan de ahí. Usa un programa gratuito llamado **rclone**.

## Cuánto toma y cuánto cuesta
| | Tiempo | Costo |
|---|---|---|
| Preparación (una sola vez) | 45 a 90 minutos | S/ 0 |
| La copia semanal | automática, unos minutos | S/ 0 |
| Revisión mensual | 5 minutos | S/ 0 |
| Prueba de recuperación (cada 3 meses) | 10 minutos | S/ 0 |

Hoy los archivos pesan unos 5 MB (datos de prueba). Google Drive da 15 GB gratis. Si algún día se llena, se decide entonces; no se contrata nada ahora.

## Lo que necesitas antes de empezar
- Una computadora con Windows que esté **prendida los domingos a las 10 p. m.** (si no, la copia se hace cuando la prendas).
- Tu cuenta de Google de Integrax.
- Tu administrador de contraseñas abierto.
- Entrar a Supabase con tu cuenta.

## Regla sobre las llaves (importante)
- Una «llave» es un par de textos (un código y una clave secreta) que da permiso para copiar los archivos. **La clave secreta solo se muestra una vez.**
- Guárdala en tu **administrador de contraseñas**, en una entrada llamada «CRC – rclone Supabase». **Nunca** en Drive, en GitHub, en un correo ni en el chat con Claude.
- Aviso honesto: rclone necesita guardar la llave dentro de tu computadora para funcionar solo (en un archivo llamado `rclone.conf`). Es normal y es lo único que queda fuera del administrador. Protege tu cuenta de Windows con contraseña y no copies ese archivo a ninguna parte.
- Si sospechas que alguien la vio, entra al mismo lugar de Supabase, borra la llave y crea otra.

## Paso 1 · Crear la llave en Supabase (10 minutos)
1. Entra a supabase.com → tu proyecto de CRC.
2. Ve a **Project Settings** (Configuración del proyecto) → **Storage**.
3. Busca la sección **S3 Connection**. Ahí aparecen dos datos que necesitas: **Endpoint** y **Region**. Anótalos (no son secretos).
4. Pulsa **New access key**, ponle el nombre `respaldo-rclone` y créala.
5. Aparecen **Access key ID** y **Secret access key**. Cópialos **ahora** a tu administrador de contraseñas.

## Paso 2 · Instalar rclone (5 minutos)
1. Abre **PowerShell** (botón Inicio → escribe PowerShell → Enter).
2. Escribe y pulsa Enter:
   ```
   winget install Rclone.Rclone
   ```
3. Cierra PowerShell y ábrelo otra vez. Escribe `rclone version`; debe mostrar un número de versión.
   - Si `winget` no existe: baja rclone de rclone.org/downloads (Windows), descomprime en `C:\rclone` y úsalo desde ahí.

## Paso 3 · Conectar rclone con Supabase (10 minutos)
1. En PowerShell escribe `rclone config` y Enter.
2. Escribe `n` (nuevo). Nombre: `supabase`.
3. Tipo de almacenamiento: escribe `s3`.
4. Proveedor: elige **Other** (otro compatible con S3).
5. Cuando pregunte cómo dar las credenciales, elige **escribirlas** (la opción «false»).
6. **access_key_id**: pega el *Access key ID*. **secret_access_key**: pega la *Secret access key*.
7. **region**: escribe la región del paso 1. **endpoint**: pega el *Endpoint* del paso 1.
8. Las demás preguntas: Enter (dejar vacío). Si ofrece «advanced config», elige `y` y activa `force_path_style = true` (estilo de ruta); si no la ofrece, sigue.
9. Confirma con `y` y sal con `q`.

> Los textos exactos pueden variar un poco según la versión de rclone. Si algo no coincide, copia lo que ves en pantalla (sin las claves) y Claude lo ajusta contigo.

## Paso 4 · Conectar rclone con tu Google Drive (10 minutos)
1. `rclone config` → `n` → nombre `drive`.
2. Tipo: escribe `drive` (Google Drive).
3. Deja vacíos **client_id** y **client_secret** (Enter, Enter).
4. En **scope** elige la opción **3 – «Access to files created by rclone only»**. Así rclone **solo** ve lo que él mismo crea; no puede abrir tus otros archivos de Drive.
5. Lo demás, Enter. En «Use auto config» escribe `y`: se abre el navegador; entra con la cuenta de Google de Integrax y pulsa **Permitir**.
6. Confirma con `y` y sal con `q`.

## Paso 5 · Probar (10 minutos)
1. `rclone lsd supabase:` → debe mostrar las carpetas (depósitos): `evidencias`, `formatos-excel`, `logos`, `passt-pdf`.
2. Prueba **sin copiar nada** (`--dry-run` = ensayo):
   ```
   rclone sync supabase:logos drive:CRC_respaldos/storage/logos --dry-run
   ```
   Debe decir qué copiaría.
3. Ahora de verdad (es la carpeta más chica): el mismo comando sin `--dry-run`. Revisa en tu Drive que aparezca `CRC_respaldos/storage/logos`.

## Paso 6 · Dejarlo automático (15 minutos)
1. Crea la carpeta `C:\CRC` y dentro un archivo de texto llamado `respaldo-storage.ps1` con este contenido (no lleva ninguna llave):
   ```
   $fecha = Get-Date -Format "yyyy-MM-dd"
   $destino = "drive:CRC_respaldos/storage"
   foreach ($b in "evidencias","formatos-excel","logos","passt-pdf") {
     rclone sync "supabase:$b" "$destino/$b" --backup-dir "$destino/_cambiados/$fecha/$b" --log-file "$env:USERPROFILE\respaldo-storage.log" --log-level INFO
   }
   rclone delete "$destino/_cambiados" --min-age 30d
   rclone rmdirs "$destino/_cambiados" --leave-root
   ```
   (Copia todo; lo que se cambie o se borre en CRC se guarda 30 días en `_cambiados` antes de eliminarse.)
2. Abre el **Programador de tareas** de Windows → **Crear tarea básica**:
   - Nombre: `Respaldo CRC Storage`. Frecuencia: **Semanal**, domingo, 10:00 p. m.
   - Acción: **Iniciar un programa**. Programa: `powershell.exe`. Argumentos: `-NoProfile -ExecutionPolicy Bypass -File "C:\CRC\respaldo-storage.ps1"`.
3. En las propiedades de la tarea marca «Ejecutar la tarea lo antes posible si se omitió un inicio programado».
4. Pruébala con clic derecho → **Ejecutar**; revisa el archivo `respaldo-storage.log` (en tu carpeta de usuario) y tu Drive.

## Cada mes (5 minutos)
- Abre `CRC_respaldos/storage` en Drive y mira que haya archivos con fecha de la última semana.
- Abre `respaldo-storage.log`: no debe haber líneas con «ERROR».

## Cada 3 meses: prueba de recuperación (10 minutos)
- Copia un depósito a una carpeta de prueba de tu computadora: `rclone copy drive:CRC_respaldos/storage/logos C:\temp\prueba-recuperacion` y abre un archivo. Una copia que nunca se probó no es una copia.

## Si hay que recuperar de verdad
- Primero se restaura la base de datos (Supabase) y luego se devuelven los archivos con `rclone copy` desde Drive hacia Supabase. Esto lo hacemos juntos con Claude; no lo hagas solo con prisa.
- Si se restaura la base **sin** los archivos: los textos y registros vuelven, pero las fotos, firmas y PDF más nuevos que la copia aparecen como «no encontrados».

## Para el piloto
- El entorno limpio del piloto será **otro proyecto** de Supabase: repite los pasos 1 y 3 con sus llaves y crea una segunda conexión `supabase-piloto` y una carpeta `CRC_respaldos/piloto`. No mezcles las llaves.

## Lo que Claude NO hace
Crear cuentas, comprar espacio, ver o guardar tus llaves, ni ejecutar nada de esto. Los pasos los haces tú; Claude te acompaña si algo no coincide.
