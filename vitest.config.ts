import { defineConfig } from 'vitest/config';

// I selettori e il parser d'import sono TypeScript puro (niente DOM), quindi il
// test gira in ambiente node senza plugin React né PWA. Il test dell'import usa
// il foglio risposte reale (ordine.xlsx nel root) come sorgente ufficiale.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
