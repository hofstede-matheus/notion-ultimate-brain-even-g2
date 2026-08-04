/**
 * Single promise chain serializing glasses-bound bridge calls (render +
 * hardware control), modelled on even-toolkit/storage's writeChain — the
 * proven shape already in this dependency tree. `glasses-ui` warns that
 * concurrent render + storage calls can crash the BLE connection and that a
 * flaky hop can hang ~30s; this chain fixes the first and a per-call timeout
 * covers the second.
 *
 * IMPORTANT: `enqueue` wraps individual leaf bridge calls only — never a
 * function that itself calls `enqueue`. Nesting deadlocks the chain (the
 * inner call awaits a link that can't resolve until the outer one, which is
 * that same link, finishes).
 *
 * Deliberately NOT used for `even-toolkit/storage` writes (log persistence,
 * list cache) — that module has its own independent chain. Merging them
 * would let a large log flush delay a render frame, which is a worse
 * regression than the render/hardware overlap this module fixes.
 */
import { trace } from '../logging/trace';

const BRIDGE_CALL_TIMEOUT_MS = 5000;

const TIMED_OUT = Symbol('bridge-queue-timeout');

let chain: Promise<void> = Promise.resolve();

async function runOne<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), BRIDGE_CALL_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([fn(), timeout]);
    if (result === TIMED_OUT) {
      trace.error('RENDER', `bridge call timed out: ${label}`, {
        timeoutMs: BRIDGE_CALL_TIMEOUT_MS,
      });
      return undefined;
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    trace.error('RENDER', `bridge call threw: ${label}`, { error: msg });
    return undefined;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs `fn` after every previously-enqueued call has settled. Returns
 * `undefined` (rather than throwing) on timeout or rejection so callers can
 * treat "no answer" the same way they already treat a documented failure
 * return (`false` / a non-success result code) — check the result, don't
 * assume it landed.
 */
export function enqueue<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const run = chain.catch(() => undefined).then(() => runOne(label, fn));
  chain = run.then(() => undefined);
  return run;
}

/** Test-only: resets the chain so a failure/timeout in one test doesn't bleed into the next. */
export function resetBridgeQueue(): void {
  chain = Promise.resolve();
}

/**
 * Test-only: resolves once every currently- AND subsequently-enqueued call
 * has settled. A single `await chain` snapshot isn't enough — a call's own
 * continuation (e.g. `sendCalendarTiles`'s per-tile loop only enqueues its
 * next tile *after* the previous one resolves) chains further work onto
 * `chain` a few microtask hops after the call it reacts to settles, which
 * can land after this function has already re-sampled `chain` once. Re-check
 * a few extra ticks later and repeat until two consecutive samples agree —
 * generous tick counts because this is test-only scaffolding, not a
 * correctness-critical production path.
 */
export async function whenIdle(): Promise<void> {
  let prev: Promise<void> | null = null;
  for (let round = 0; round < 25; round++) {
    const current = chain;
    if (current === prev) return;
    prev = current;
    await current;
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }
}
