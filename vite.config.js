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
        // Patrón por omisión de Workbox más los JSON que la app necesita
        // cuando no hay red: el marco del índice y los grupos k-means (los
        // pide el mapa en cada visita) y los tres datasets de escenarios
        // de pérdida (M10, selector de encabezado). Cada casos_*.json pesa
        // ~0.7 MB; es un costo aceptable porque, sin precache, el cambio de
        // escenario no funcionaría sin conexión.
        globPatterns: [
          '**/*.{js,css,html}',
          'data/localidades_marco.json',
          'data/grupos_localidades.json',
          'data/casos_11.json',
          'data/casos_30.json',
          'data/casos_50.json',
        ],
        // 0.7 MB * 3 escenarios > 2 MB por defecto; el límite hay que subirlo.
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
