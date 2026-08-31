import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors vite.config.ts's define so code referencing __APP_VERSION__
  // (see logging/export.ts) doesn't ReferenceError under vitest.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  resolve: {
    alias: {
      '@web': fileURLToPath(new URL('./src/web', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // even-toolkit's built ESM uses extensionless relative imports (fine for
    // Vite's dev/build resolution, which adds the extension). Left
    // externalized, Vitest's SSR module runner instead hands them to
    // plain Node import(), which requires an explicit extension and throws
    // "Cannot find module" for any file that renders even-toolkit/web/*
    // components (see statusScreen.test.tsx) — inlining routes it through
    // Vite's transform/resolution instead.
    server: { deps: { inline: ['even-toolkit'] } },
    // .tsx is for the handful of component-level tests that render real React
    // trees (e.g. statusScreen.test.tsx) — those opt into jsdom individually
    // via a `// @vitest-environment jsdom` docblock rather than paying jsdom's
    // startup cost for every plain-logic .ts test under the default 'node'
    // environment above.
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
  },
});
