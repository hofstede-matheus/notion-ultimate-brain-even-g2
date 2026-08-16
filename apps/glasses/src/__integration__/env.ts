/**
 * Ports and URLs shared by global-setup.ts, vite.e2e.config.ts, and the
 * driver — all plain Node modules, none of them run under Vite/Vitest's own
 * env handling, so this is just `process.env` with defaults.
 *
 * Dedicated, non-default ports so this suite never collides with a
 * developer's ordinary `pnpm dev` (5173/3210) or a manual simulator-debug
 * session (9898) running alongside it. Deliberately NOT 5174 — Vite's own
 * auto-increment-on-busy-port fallback lands there constantly, so it's one
 * of the least safe "unused" ports to pick (confirmed colliding with an
 * unrelated project's dev server in practice while building this suite).
 */

export const FIXTURE_PORT = Number(process.env.UB_E2E_FIXTURE_PORT ?? 34211);
export const VITE_PORT = Number(process.env.UB_E2E_VITE_PORT ?? 34212);
export const SIM_PORT = Number(process.env.UB_E2E_SIM_PORT ?? 34213);

export const FIXTURE_URL = `http://127.0.0.1:${FIXTURE_PORT}`;
export const VITE_URL = `http://localhost:${VITE_PORT}`;
export const SIM_URL = `http://127.0.0.1:${SIM_PORT}`;
