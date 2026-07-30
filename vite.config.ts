import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'app gira interamente da browser, offline, su un solo dispositivo.
// (Il service worker / PWA verranno aggiunti in un passo successivo.)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
