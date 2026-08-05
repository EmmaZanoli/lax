import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// L'app gira interamente da browser, su un solo dispositivo, e deve funzionare
// offline durante la giornata di ritiro: PWA con service worker (Workbox) che
// precache tutti gli asset del build (JS/CSS/font self-hosted/catalog.json).
export default defineConfig({
  base: '/lax/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'lax — ritiro prodotti svedesi',
        short_name: 'lax',
        description: 'Gestione della giornata di ritiro dei prodotti alimentari svedesi.',
        lang: 'it',
        start_url: '/lax/',
        scope: '/lax/',
        display: 'standalone',
        background_color: '#2a2b27',
        theme_color: '#2a2b27',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,json,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/lax/index.html',
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
