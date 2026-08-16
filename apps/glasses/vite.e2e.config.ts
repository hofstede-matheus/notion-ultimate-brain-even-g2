import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { FIXTURE_PORT, VITE_PORT } from './src/__integration__/env';

/**
 * The dev server the integration suite drives — see global-setup.ts. A
 * standalone config, not a merge over vite.config.ts, so `envDir` and
 * `server.proxy` are never one accidental edit away from silently pointing
 * at a developer's real Notion credentials or the real backend.
 */

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src/web', import.meta.url)),
    },
  },
  root: 'src/web',
  // Resolved relative to `root` (src/web), same as vite.config.ts's own
  // envDir. Points at a directory global-setup.ts generates fresh on every
  // run (gitignored) — NEVER the package root, so this can't fall back to
  // apps/glasses/.env.local and load real Notion credentials into an e2e run.
  envDir: '../__integration__/.runtime/env',
  publicDir: false,
  server: {
    host: true,
    port: VITE_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${FIXTURE_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
