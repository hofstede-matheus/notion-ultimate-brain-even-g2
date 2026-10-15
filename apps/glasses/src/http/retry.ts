/**
 * Pure retry policy — no ky, no fetch, no timers, no globals. client.ts wires these into a
 * ky instance's `retry`/`hooks` options; kept separate so the policy (which statuses/codes/
 * methods are safe to retry, how backoff grows, whether a deadline still has room for one
 * more wait) is unit-testable without touching the network.
 */

/** ky's own default is [408, 413, 429, 500, 502, 503, 504]. 413 is dropped — the largest
 *  body this app ever sends is a dictated task name, and a 413 can never succeed on retry.
 *  425 is added — cheap, and covers TLS early-data replay on a flaky mobile link. */
export const RETRYABLE_STATUSES: readonly number[] = [408, 425, 429, 500, 502, 503, 504];

/**
 * Notion error codes that mean "this config is permanently broken", not "try again" — see
 * config-health.ts's looksConfigShaped, which triggers the self-heal flow on the same codes.
 *
 * Not redundant with RETRYABLE_STATUSES: apps/server/src/routes.ts's invokeRoute clamps a
 * status-less Notion error to 500, and 500 IS in RETRYABLE_STATUSES. Without this deny-list a
 * validation_error arriving on a 500 would be retried twice before config-health's self-heal
 * ever fires, delaying it and burning two requests on a config that cannot self-heal.
 */
export const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'validation_error',
  'object_not_found',
]);

/** GET/HEAD are always safe. PATCH/DELETE are safe here because every mutation that uses
 *  them is an absolute-set operation (see apps/server/src/routes.ts): markTaskDone sets a
 *  constant status, setTaskDueDate/setPageProject replace rather than append, deletePage
 *  sets a flag. POST is deliberately excluded — pages.create has no idempotency key, so a
 *  retried POST /api/tasks can create a duplicate task. */
export const RETRY_SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'PATCH', 'DELETE']);

/** 2 retries + 1 initial attempt = 3 total. */
export const MAX_RETRIES = 2;
export const BASE_DELAY_MS = 400;
export const FACTOR = 3;

/** Nominal (non-jittered) backoff before retry attempt `n` (1-based, ky's retryCount).
 *  Used both to seed ky's jittered delay and, on its own, as a conservative (upper-bound)
 *  estimate of the next wait when checking a shared deadline — equal jitter (see `jitter`
 *  below) never waits longer than this. */
export function backoffMs(attempt: number): number {
  return BASE_DELAY_MS * FACTOR ** (attempt - 1);
}

/** Equal jitter: returns a value in [d/2, d]. `rand` injected for tests; defaults to
 *  Math.random. Passed as ky's `retry.jitter` function, applied on top of `backoffMs`. */
export function jitter(delayMs: number, rand: () => number = Math.random): number {
  return delayMs / 2 + (delayMs / 2) * rand();
}

/** Best-effort extraction of Notion's error `code` from ky's pre-parsed HTTPError#data
 *  (see client.ts) — undefined for a non-object body, a parse failure, or a body with no
 *  `code` field. */
export function errorCode(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Whether there's still enough of a shared budget left to schedule one more retry attempt.
 * Uses the nominal (non-jittered) backoff as a conservative upper bound on the actual wait,
 * so this never under-counts the time a real retry will take. `retryCount` is ky's — the
 * attempt about to be scheduled, 1-based.
 */
export function withinBudget(now: number, retryCount: number, deadline: number): boolean {
  return now + backoffMs(retryCount) < deadline;
}
