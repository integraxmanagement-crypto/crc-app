# CRC · Centinel Risk Control

Sistema de gestión de seguridad y salud en el trabajo (SST / SGSST) para empresas y profesionales.

> **Estado actual (v0.4, 22/10/2026):** ingreso y seguridad (tarea 3.1), registro de empresas clientes (tarea 3.2) y **usuarios y roles por empresa (tarea 3.3)**. Se ingresa con documento y contraseña; cada empresa ve solo sus datos; Integrax da de alta a cada empresa y a sus administradores; cada administrador maneja a su gente (crear, corregir, cesar, reactivar y dar contraseñas nuevas) y sus listas de áreas y puestos. **Todavía no hay** inspecciones ni las demás funciones de negocio.

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
| `usuarios.mjs` | Usuarios y roles (3.3): un administrador no toca a nadie de otra empresa ni a otros administradores; regla del último administrador; gestor y usuario no crean cuentas ni dan contraseñas; contraseña nueva (una sola vez, obliga a cambiarla, cierra sesiones); registro de intentos solo para el dueño; áreas y puestos por empresa. Crea una sola vez las cuentas ficticias ADMIN_A2 y USUARIO_A3. Informe en `pruebas/resultados/`. |

`preparar-datos.mjs` crea las personas ficticias; `preparar-empresas.mjs` completa la ficha, sedes, contactos y logo ficticios de las empresas A y B; `primer-ingreso.mjs` se usó una sola vez para el primer cambio de contraseña del dueño ficticio.

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
- **Áreas y puestos**: listas propias de cada empresa. Se agregan, renombran y desactivan; solo se borran si nunca se usaron.
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

## Seguridad: reglas que no se rompen

- Las claves van **solo** en variables de entorno (`.env.local` en el equipo, Vercel en la nube). El archivo `.env.local` está excluido de GitHub por `.gitignore`.
- En la app solo va la **clave pública** de Supabase. La protección real de los datos la dan las reglas **RLS**, que deben activarse en **toda** tabla nueva.
- Solo **datos ficticios** mientras se construye: nada de DNI ni información real de empresas.
- La clave **secreta** de Supabase y `CRC_PIMIENTA` solo existen dentro de Supabase (funciones del servidor). Ninguna llega al navegador.
- Las tablas no se pueden escribir directamente desde la app: todo cambio pasa por funciones que revisan permisos.

## Estructura de carpetas

```
public/logo.svg        Logo provisional de los íconos de instalación (PWA); aún no se cambia
src/marca/             Logo oficial de CRC (diseño del dueño, tarea 2.1a): animado para el ingreso y estático para la barra.
                       Los dos SVG se usan tal cual; Logo.tsx los inserta en la página y elige la versión clara u oscura
                       según el fondo (no según el modo oscuro del equipo). Cada uno se descarga aparte y solo cuando hace falta.
src/App.tsx            Elige la pantalla: ingreso, cambio de contraseña, inicio o gestión
src/ruta.ts            Navegación simple (#/empresas, #/mi-empresa…) sin librerías
src/empresas/          Registro de empresas: lista, ficha, CIIU, sedes, contactos, logos y administrador
src/usuarios/          Usuarios, áreas y puestos, contraseña nueva, restablecer en bloque y registro de intentos
src/gestion.css        Diseño de las pantallas de gestión
src/Ingreso.tsx        Pantalla de ingreso (documento y contraseña)
src/CambioContrasena.tsx  Cambio obligatorio de contraseña
src/sesion.ts          Sesión: ingresar, salir, ficha de la persona, cierre si fue cesada
src/index.css          Colores, letra y diseño (marca: #0B3C5D y #1BA39C)
src/hooks.ts           Estado de conexión, base de datos e instalación
src/supabase.ts        Conexión con Supabase (solo clave pública)
supabase/migrations/   Cada cambio hecho a la base de datos (el nombre coincide con la versión en Supabase)
supabase/functions/    Funciones del servidor: ingresar, crear-cuenta, cambiar-contrasena, dar-contrasena
pruebas/               Pruebas automáticas con cuentas ficticias e informes
herramientas/          Herramienta de rescate (solo si se pierde CRC_PIMIENTA; nunca va en la app)
vite.config.ts         Configuración de la app instalable (PWA)
```

## Pendientes conocidos

- El logo oficial ya está en la app (2.1a); faltan los **íconos de instalación**, el favicon y el manifest (decisión aparte del dueño).
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
- **3.2:** la ficha no guarda historial de cambios (quién cambió qué y cuándo, más allá de la última modificación); evaluarlo si un cliente o la auditoría lo pide.
