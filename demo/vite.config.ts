import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/vibe-coding-stats/',
  build: {
    outDir: 'dist',
  },
});
