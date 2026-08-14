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

const DEFAULT_CALL_TIMEOUT_MS = 5000;

/**
 * Image sends (`updateImageRawData`) carry real payload over BLE — at the
 * low end of the ~10–30 KB/s range (see even-g2-context/docs/networking.md)
 * a 288×144 tile can take longer than the 5s default before the SDK's own
 * response even arrives. Callers that know they're sending image data pass
 * `kind: 'image'`.
 */
const IMAGE_CALL_TIMEOUT_MS = 15000;

/**
 * Once a call has missed its own timeout, this bounds how much longer the
 * chain will wait for it to actually settle before letting later calls
 * start anyway — see `enqueue`'s doc comment for why the chain has to wait
 * at all. A permanently hung promise (dead BLE link) must not wedge every
 * later render forever; this is a backstop, not something normal operation
 * should ever reach.
 */
const SETTLE_WAIT_CAP_MS = 25000;

const TIMED_OUT = Symbol('bridge-queue-timeout');

let chain: Promise<void> = Promise.resolve();

/**
 * Races `promise` (already-started) against `timeoutMs`, logging and
 * resolving `undefined` on either a timeout or a rejection — never throws.
 * This is what unblocks the *caller*; it does not by itself advance the
 * chain (see `enqueue`).
 */
async function raceWithTimeout<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    if (result === TIMED_OUT) {
      trace.error('RENDER', `bridge call timed out: ${label}`, { timeoutMs });
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
 * Resolves once `promise` settles (either way) or `SETTLE_WAIT_CAP_MS`
 * elapses, whichever comes first — never rejects. Used to advance `chain`
 * only once a call is actually done, not merely once its caller-facing
 * timeout has fired.
 */
async function waitForSettleCapped(promise: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SETTLE_WAIT_CAP_MS);
  });
  try {
    await Promise.race([
      promise.then(
        () => undefined,
        () => undefined,
      ),
      cap,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs `fn` after every previously-enqueued call has actually settled — not
 * merely after its timeout fired. Returns `undefined` (rather than
 * throwing) on timeout or rejection so callers can treat "no answer" the
 * same way they already treat a documented failure return (`false` / a
 * non-success result code) — check the result, don't assume it landed.
 *
 * The returned promise settles at the caller-facing timeout (`kind`
 * default 5s, `'image'` 15s) even if the underlying bridge call is still
 * pending — a caller should not be blocked longer than that just because
 * BLE is slow. But the *chain* itself only advances once that underlying
 * call truly settles (capped at `SETTLE_WAIT_CAP_MS`): letting the next
 * call start while a previous `updateImageRawData` might still be in
 * flight violates the SDK's documented "no concurrent image sends"
 * constraint, and can leave a tile's on-device state permanently
 * out of sync with what the per-tile hash cache believes it sent
 * (see render/index.ts's `sendCalendarTiles`).
 */
export function enqueue<T>(
  label: string,
  fn: () => Promise<T>,
  kind: 'default' | 'image' = 'default',
): Promise<T | undefined> {
  const timeoutMs = kind === 'image' ? IMAGE_CALL_TIMEOUT_MS : DEFAULT_CALL_TIMEOUT_MS;

  // Both `fn()` and its timeout clock start only once every earlier link
  // has settled — this call's actual turn — not at enqueue() time, which
  // can be arbitrarily earlier than that if calls are already queued up.
  // `started` and `result` share the same `turn` so `fn()` (registered
  // first) always runs before `raceWithTimeout` (registered second) sets
  // up its timer, per standard same-promise handler ordering.
  const turn = chain.catch(() => undefined);
  const started = turn.then(fn);
  const result = turn.then(() => raceWithTimeout(label, started, timeoutMs));

  chain = waitForSettleCapped(started);

  return result;
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
