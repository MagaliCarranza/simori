import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      // Mosaicos de OpenStreetMap: se guardan solo los que se ven (sin descarga
      // previa, por la política de uso de OSM) y con límite, para el mapa offline.
      workbox: {
        // Patrón por omisión de Workbox más los dos JSON que el mapa pide en
        // cada visita (marco del índice y grupos k-means). Los demás JSON de
        // public/data se guardan en IndexedDB al arrancar (src/db/seed.js), y
        // los casos_*.json pesan ~0.7 MB cada uno, así que no se precargan.
        globPatterns: ['**/*.{js,css,html}', 'data/localidades_marco.json', 'data/grupos_localidades.json'],
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
        // Símbolo del logo (sin el texto). PNG de 192 y 512 para instalar; el
        // maskable va aparte, con el símbolo dentro del 80 % central para que
        // Android pueda recortarlo.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
