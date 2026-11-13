import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Cabeceras de seguridad de la app publicada (vercel.json). La vista previa local (npm run preview) usa las mismas,
// para probar aquí lo que el navegador permitirá o bloqueará en Vercel.
const cabeceras: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { headers: { key: string; value: string }[] }[] })
    .headers[0].headers.map((c) => [c.key, c.value]),
)

// https://vite.dev/config/
export default defineConfig({
  preview: { headers: cabeceras },
  plugins: [
    react(),
    VitePWA({
      // La app se actualiza sola cuando se publica una versión nueva.
      registerType: 'autoUpdate',
      // Íconos de instalación (tarea 2.1b): PNG preparados desde el logo oficial, en public/, sin modificarlos.
      manifest: {
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        name: 'CRC · Centinel Risk Control',
        short_name: 'CRC',
        description: 'Sistema de gestión de seguridad y salud en el trabajo.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B3C5D',
        background_color: '#0B3C5D',
      },
      workbox: {
        // Guarda en el equipo todo lo necesario para abrir sin señal.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
