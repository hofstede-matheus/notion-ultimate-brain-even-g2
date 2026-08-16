import { defineConfig } from 'vitest/config';

/**
 * The end-to-end suite that drives the real evenhub-simulator — see
 * src/__integration__/README.md. Deliberately separate from vitest.config.ts
 * (whose `include` glob does not reach src/__integration__): `pnpm test`
 * must never pick these up, since they spawn a GUI app and bind real ports.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__integration__/specs/**/*.test.ts'],
    globalSetup: ['./src/__integration__/global-setup.ts'],
    // One simulator, one app session — specs run against shared, live state.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
