import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // Mosaicos de OpenStreetMap: se guardan solo los que se ven (sin descarga
      // previa, por la política de uso de OSM) y con límite, para el mapa offline.
      workbox: {
        // Además de lo predeterminado (js, css, html), las fuentes woff2 para
        // que la tipografía se vea sin internet.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mosaicos-osm',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'SIMORI',
        short_name: 'SIMORI',
        description: 'SIMORI: registro de seguimiento de tamizaje renal en Poncitlán, Jalisco.',
        lang: 'es-MX',
        theme_color: '#0b3c7a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
