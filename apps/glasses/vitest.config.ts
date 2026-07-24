import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors vite.config.ts's define so code referencing __APP_VERSION__
  // (see logging/export.ts) doesn't ReferenceError under vitest.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
