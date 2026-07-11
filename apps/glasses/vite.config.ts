import { defineConfig } from 'vite'

export default defineConfig({
  // index.html lives in src/web/ (the browser-only shell) rather than the
  // project root — outDir/publicDir are pointed back at the project root so
  // `dist/` and the Vosk model under `public/` land where the rest of the
  // build tooling (evenhub pack, scripts/fetch-vosk-model.cjs) expects them.
  root: 'src/web',
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
})
