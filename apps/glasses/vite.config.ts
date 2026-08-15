import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Baked in at build time so the exported log (see logging/export.ts)
    // always names the app version that produced it — stays in step with
    // package.json for free, which release-please keeps authoritative.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src/web', import.meta.url)),
    },
  },
  // index.html lives in src/web/ (the browser-only shell) rather than the
  // project root — outDir is pointed back at the project root so `dist/` lands
  // where `evenhub pack` expects it.
  root: 'src/web',
  // .env* files live at the package root (apps/glasses/), not under root
  // (src/web/) — without this, Vite's default envDir (= root) would never
  // find them and import.meta.env.VITE_* would always be undefined.
  envDir: '../..',
  // Nothing to copy: the only static asset was the 39 MB voice model, which is
  // now downloaded at runtime (see src/voice-model.ts).
  publicDir: false,
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
