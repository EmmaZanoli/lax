import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/lax/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt': il nuovo SW resta in waiting; UpdateBanner lo segnala e
      // chiede conferma prima di ricaricare — senza perdere dati in IndexedDB.
      registerType: 'prompt',
      includeAssets: [
        'icon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
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
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache solo file dell'app: JS, CSS, HTML, font, icone.
        // I dati (catalogo, buyer) vivono in IndexedDB — non toccati dal SW.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,ico,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // SPA fallback: qualsiasi navigate offline torna all'app shell.
        navigateFallback: '/lax/index.html',
        navigateFallbackAllowlist: [/^\/lax\//],
        navigateFallbackDenylist: [/^\/lax\/sw\.js$/, /^\/lax\/workbox-/],
      },
    }),
  ],
  optimizeDeps: {
    include: ['exceljs'],
  },
  server: {
    port: 5173,
    open: true,
  },
});
