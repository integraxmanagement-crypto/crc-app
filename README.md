# CRC · Centinel Risk Control

Sistema de gestión de seguridad y salud en el trabajo (SST / SGSST) para empresas y profesionales.

> **Estado actual (v0.2, 22/10/2026):** ingreso y seguridad (tarea 3.1). Se ingresa con documento y contraseña, cada empresa ve solo sus datos, las cuentas se pueden cesar y reactivar, y los intentos de adivinar contraseñas se registran y bloquean. **Todavía no hay pantallas de negocio** (registro de empresas, usuarios, inspecciones…).

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
| Dueño de la plataforma (Integrax) | Todas las empresas y personas; el registro de intentos de ingreso | Crear administradores de empresa |
| Administrador de empresa | Su empresa: fichas, vínculos e historial | Crear, cesar y reactivar gestores y usuarios de **su** empresa |
| Gestor | Su ficha y la **lista de personas activas** de su empresa (solo nombres, puesto y área; sin documento) | — (no crea cuentas) |
| Usuario | Solo su ficha y su empresa | — |

Los roles y permisos están en tablas (`roles`, `permisos`, `roles_permisos`, `roles_asignables`), no en el código: para agregar un rol basta con agregar filas.

### Cese y cambio de empresa
- Cesar una cuenta exige **fecha y motivo**; no se borra nada y queda en `vinculos_historial`. Al cesar se cierran todas sus sesiones; si estaba sin señal, queda fuera en cuanto vuelve a conectarse.
- Un **"portero"** (Custom Access Token Hook `portero_ingreso`) impide ingresar a quien no tiene un vínculo activo: ve "Tu cuenta está inhabilitada".
- Una persona solo puede estar activa en **una** empresa. Si cambia de empresa, se cesa en la primera y se da de alta en la segunda con la misma cuenta; cada empresa conserva su historial y no ve el de la otra.

### Protección contra intentos de adivinar contraseñas
- Todo ingreso pasa por la función del servidor `ingresar`, que **anota cada intento** en `intentos_ingreso` (documento, resultado, dirección de internet y hora; solo lo ve el dueño, en Supabase → *Table Editor*).
- **5 fallos** con el mismo documento en 15 min → ese documento se bloquea **15 min** (también si el documento no existe). **30 fallos** desde la misma dirección de internet → esa dirección se bloquea 15 min.
- **Candado de servidor:** Supabase no guarda la contraseña que escribe la persona sino una versión transformada con un secreto (`CRC_PIMIENTA`) que solo conocen las funciones. Así nadie puede saltarse el bloqueo probando contraseñas directo contra Supabase.

> ⚠️ **El secreto `CRC_PIMIENTA` es vital.** Está en Supabase → *Edge Functions → Secrets* y en el gestor de contraseñas del dueño. Si se pierde o se cambia, **nadie podrá ingresar** hasta que se den contraseñas nuevas. Nunca va en el código ni en GitHub.

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

`preparar-datos.mjs` crea las personas ficticias; `primer-ingreso.mjs` se usó una sola vez para el primer cambio de contraseña del dueño ficticio.

## Seguridad: reglas que no se rompen

- Las claves van **solo** en variables de entorno (`.env.local` en el equipo, Vercel en la nube). El archivo `.env.local` está excluido de GitHub por `.gitignore`.
- En la app solo va la **clave pública** de Supabase. La protección real de los datos la dan las reglas **RLS**, que deben activarse en **toda** tabla nueva.
- Solo **datos ficticios** mientras se construye: nada de DNI ni información real de empresas.
- La clave **secreta** de Supabase y `CRC_PIMIENTA` solo existen dentro de Supabase (funciones del servidor). Ninguna llega al navegador.
- Las tablas no se pueden escribir directamente desde la app: todo cambio pasa por funciones que revisan permisos.

## Estructura de carpetas

```
public/logo.svg        Logo provisional (de él salen los íconos de instalación)
src/App.tsx            Elige la pantalla: ingreso, cambio de contraseña o inicio
src/Ingreso.tsx        Pantalla de ingreso (documento y contraseña)
src/CambioContrasena.tsx  Cambio obligatorio de contraseña
src/sesion.ts          Sesión: ingresar, salir, ficha de la persona, cierre si fue cesada
src/index.css          Colores, letra y diseño (marca: #0B3C5D y #1BA39C)
src/hooks.ts           Estado de conexión, base de datos e instalación
src/supabase.ts        Conexión con Supabase (solo clave pública)
supabase/migrations/   Cada cambio hecho a la base de datos (el nombre coincide con la versión en Supabase)
supabase/functions/    Funciones del servidor: ingresar, crear-cuenta, cambiar-contrasena
pruebas/               Pruebas automáticas con cuentas ficticias e informes
vite.config.ts         Configuración de la app instalable (PWA)
```

## Pendientes conocidos

- Reemplazar el logo provisional por el oficial.
- La tabla `prueba_conexion` es solo de prueba; se puede borrar cuando exista la primera tabla real.
- Supabase gratuito pausa el proyecto tras 1 semana sin uso y no tiene copias de seguridad automáticas.
- Antes de vender a clientes: pasar Vercel a plan Pro (el plan Hobby no permite uso comercial) y Supabase a un plan con copias de seguridad.
- **Al pasar Supabase a plan Pro:** activar la protección contra contraseñas filtradas (pedido del dueño, 22/10/2026). Ojo: con el candado de servidor, la de Supabase revisaría la contraseña transformada; esa revisión habrá que hacerla desde la función `ingresar` con el servicio gratuito HaveIBeenPwned (decidir entonces).
- **Tarea 3.3:** pantalla para que el administrador dé una contraseña nueva a una persona (también es el plan de recuperación si se perdiera `CRC_PIMIENTA`), pantalla de usuarios y ceses, y pantalla para que el dueño revise el registro de intentos.
- Definir cuánto tiempo se guarda el registro de intentos de ingreso (tiene direcciones de internet: dato personal).
- Lugares con muchos trabajadores en una misma conexión (por ejemplo, el wifi de una mina): Supabase deja pasar unos 30 ingresos por minuto por dirección; vigilarlo cuando haya clientes reales.
- Antes de tener clientes: sumar la verificación "no soy un robot" (Cloudflare Turnstile) al ingreso.
- Las funciones del servidor ya usan las claves nuevas de Supabase; las antiguas (`anon` / `service_role`) dejan de funcionar a fines de 2026. Cuando se desactiven en el panel, confirmar que todo sigue funcionando.
- La cuenta ficticia cesada (DNI 20000003) pasará al candado recién cuando se la reactive e ingrese.
