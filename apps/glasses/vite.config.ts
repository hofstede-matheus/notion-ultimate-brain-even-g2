import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // index.html lives in src/web/ (the browser-only shell) rather than the
  // project root — outDir/publicDir are pointed back at the project root so
  // `dist/` and the Vosk model under `public/` land where the rest of the
  // build tooling (evenhub pack, scripts/fetch-vosk-model.cjs) expects them.
  root: 'src/web',
  // .env* files live at the package root (apps/glasses/), not under root
  // (src/web/) — without this, Vite's default envDir (= root) would never
  // find them and import.meta.env.VITE_* would always be undefined.
  envDir: '../..',
  publicDir: '../../public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      },
    },
  },
});
