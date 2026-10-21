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
      // Genera los íconos de instalación a partir del logo.
      pwaAssets: {
        image: 'public/logo.svg',
        preset: 'minimal-2023',
        overrideManifestIcons: true,
      },
      manifest: {
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
