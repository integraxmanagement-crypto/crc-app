# CRC · Centinel Risk Control

Sistema de gestión de seguridad y salud en el trabajo (SST / SGSST) para empresas y profesionales.

> **Estado actual (v0.1, 21/10/2026):** base técnica. La app abre, se instala en el celular, funciona sin señal (pantalla básica) y se conecta a la base de datos. **Todavía no tiene funciones de negocio.**

- **App publicada (pruebas internas):** https://crc-app-phi.vercel.app
- **Repositorio:** https://github.com/integraxmanagement-crypto/crc-app

---

## Qué es cada pieza (en simple)

| Pieza | Qué hace | Plan |
|---|---|---|
| **GitHub** (`crc-app`) | Guarda el código y su historial. | Repositorio privado |
| **React + Vite** | El "kit" con el que está construida la app. | Gratis (código abierto) |
| **PWA** | Permite instalar la app en el celular y abrirla sin señal. | Incluido |
| **Supabase** (`crc-dev`) | Base de datos y archivos. Cada empresa verá solo sus datos gracias a las reglas de seguridad por fila (RLS). | Gratuito, solo para construir |
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

## Seguridad: reglas que no se rompen

- Las claves van **solo** en variables de entorno (`.env.local` en el equipo, Vercel en la nube). El archivo `.env.local` está excluido de GitHub por `.gitignore`.
- En la app solo va la **clave pública** de Supabase. La protección real de los datos la dan las reglas **RLS**, que deben activarse en **toda** tabla nueva.
- Solo **datos ficticios** mientras se construye: nada de DNI ni información real de empresas.

## Estructura de carpetas

```
public/logo.svg        Logo provisional (de él salen los íconos de instalación)
src/App.tsx            Pantalla de inicio
src/index.css          Colores, letra y diseño (marca: #0B3C5D y #1BA39C)
src/hooks.ts           Estado de conexión, base de datos e instalación
src/supabase.ts        Conexión con Supabase
supabase/migrations/   Registro de cada cambio hecho a la base de datos
vite.config.ts         Configuración de la app instalable (PWA)
```

## Pendientes conocidos

- Reemplazar el logo provisional por el oficial.
- La tabla `prueba_conexion` es solo de prueba; se puede borrar cuando exista la primera tabla real.
- Supabase gratuito pausa el proyecto tras 1 semana sin uso y no tiene copias de seguridad automáticas.
- Antes de vender a clientes: pasar Vercel a plan Pro (el plan Hobby no permite uso comercial) y Supabase a un plan con copias de seguridad.
