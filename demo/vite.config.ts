import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/vibe-coding-stats/',
  resolve: {
    // Build the demo against the library source so it never depends on a
    // stale or missing packages/core/dist build.
    alias: {
      'vibe-coding-stats': fileURLToPath(new URL('../packages/core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
});
