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
        // Por defecto workbox precachea js/css/html/ico/png/svg/webp. La app
        // también necesita los JSON de public/data/* (catálogos, marco de
        // prioridad, grupos k-means, escenarios) para funcionar offline; sin
        // esto el panel caería a "Prioridad no disponible sin conexión".
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
        // El JSON del escenario de 50 % casos pesa ~1.3 MiB; subimos el tope
        // para que entre al precache.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
        theme_color: '#0f766e',
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
