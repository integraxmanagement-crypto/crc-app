import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
