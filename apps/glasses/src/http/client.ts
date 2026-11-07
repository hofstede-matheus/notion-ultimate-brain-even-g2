/**
 * The one place this app builds a ky instance. A fresh ky.extend() per logical call — cheap,
 * pure option merging, no I/O — closing over `deadline`/`rand`/`label`/`previewBytes` so they
 * don't need threading through ky's global state.
 *
 * Two invariants the rest of the app depends on:
 *  - This module never calls config-health.ts's reportApiFailure. Callers (api.ts's
 *    request(), web/services/databases.ts's fetchDatabases) do that themselves on the single
 *    error fetchWithRetry ultimately throws — since ky's beforeError hook runs exactly once
 *    per logical call, that still happens exactly once after retries are exhausted.
 *  - At most one trace.error is emitted per logical request (from beforeError, on final
 *    failure only). A retried-then-succeeded request never logs at 'error' — only 'warn',
 *    from beforeRetry — which is what keeps the integration suite's assertNoErrors green
 *    (see __integration__/driver/app.ts's assertNoErrors, which fails on 'warn' too, but the
 *    fixture server always returns 200 so beforeRetry never fires there).
 */

import ky, { HTTPError, TimeoutError } from 'ky';
import { trace } from '../logging/trace';
import { ApiError, CODE_NETWORK, CODE_TIMEOUT } from './errors';
import {
  backoffMs,
  errorCode,
  jitter,
  MAX_RETRIES,
  NON_RETRYABLE_CODES,
  RETRY_SAFE_METHODS,
  RETRYABLE_STATUSES,
  withinBudget,
} from './retry';

/** Below the Lambda's own 10s timeout (terraform/main.tf) with headroom for a healthy
 *  request, so a wedged server gets cut at 6s instead of waiting ~10s for a 502. */
const ATTEMPT_TIMEOUT_MS = 6000;
/** POST is never retried, so it can safely wait past the Lambda's own ceiling — the only
 *  POSTs this aborts are ones the server was already going to fail. If terraform/main.tf's
 *  Lambda timeout ever changes from 10s, this must move with it. */
const UNSAFE_METHOD_TIMEOUT_MS = 11000;
/** Default shared budget for a single logical call. fetchAllPages (pagination.ts) passes
 *  its own larger deadline, shared across every round of a list load. */
const DEFAULT_BUDGET_MS = 12000;

export interface RequestOptions {
  /** Absolute epoch-ms cutoff for scheduling further retries. Defaults to
   *  Date.now() + DEFAULT_BUDGET_MS. */
  deadline?: number;
  /** Test seam only — defaults to Math.random. */
  rand?: () => number;
}

function previewBody(data: unknown, maxBytes: number): string {
  if (data === undefined) return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.slice(0, maxBytes);
}

/**
 * fetch() via ky, with retry, per-attempt timeout, and method/status/code-aware policy from
 * retry.ts. Resolves the parsed JSON body; rejects with ApiError for every failure — non-2xx,
 * timeout, or network — so callers only ever handle one error shape.
 */
export async function fetchWithRetry<T>(
  url: string,
  init: RequestInit,
  opts: RequestOptions & { label: string; previewBytes: number },
): Promise<T> {
  const { label, previewBytes, rand } = opts;
  const method = (init.method ?? 'GET').toUpperCase();
  const isSafe = RETRY_SAFE_METHODS.has(method);
  const deadline = opts.deadline ?? Date.now() + DEFAULT_BUDGET_MS;

  let successAttempts = 1;

  const instance = ky.extend({
    // ky constructs a native Request internally before calling fetch. In dev, API_BASE is ''
    // and callers pass a path like '/api/tasks' — a real browser/webview resolves that against
    // the page origin automatically, but that's implicit engine leniency, not guaranteed by
    // spec (Node's Request has no notion of a page origin and throws on it). Resolving against
    // location.origin explicitly makes this robust rather than accidental; a no-op when `url`
    // is already absolute (prod's baked-in Lambda URL).
    baseUrl: typeof location === 'undefined' ? undefined : location.origin,
    retry: {
      limit: isSafe ? MAX_RETRIES : 0,
      // ky's default methods list excludes PATCH (and POST) — PATCH is 3 of this app's 4
      // mutations (markTaskDone, setTaskDueDate, setPageProject). Left in the config even
      // for the unsafe (POST) path since `limit: 0` already gates retries first regardless.
      methods: ['get', 'head', 'patch', 'delete'],
      statusCodes: [...RETRYABLE_STATUSES],
      // ky's default is false — without this, our own AbortController timeout would never
      // be retried even though it's the most common real transient failure on a BLE-tethered
      // connection.
      retryOnTimeout: true,
      delay: (attemptCount) => backoffMs(attemptCount),
      jitter: (delayMs) => jitter(delayMs, rand),
      shouldRetry: ({ error, retryCount }) => {
        if (!withinBudget(Date.now(), retryCount, deadline)) return false;
        if (error instanceof HTTPError) {
          const code = errorCode(error.data);
          if (code && NON_RETRYABLE_CODES.has(code)) return false;
        }
        return undefined; // fall through to ky's default status/network/timeout checks
      },
    },
    timeout: isSafe ? ATTEMPT_TIMEOUT_MS : UNSAFE_METHOD_TIMEOUT_MS,
    hooks: {
      // Only fires when a retry is actually about to happen — shouldRetry already vetoed
      // exhausted/permanent/over-budget failures before this runs.
      beforeRetry: [
        ({ error, retryCount }) => {
          const status = error instanceof HTTPError ? error.response.status : undefined;
          const code = error instanceof HTTPError ? errorCode(error.data) : undefined;
          trace.warn('API', `${label} attempt ${retryCount} — retrying`, {
            status,
            code,
            nominalDelayMs: Math.round(backoffMs(retryCount)),
          });
        },
      ],
      afterResponse: [
        ({ retryCount }) => {
          successAttempts = retryCount + 1;
        },
      ],
      beforeError: [
        ({ error, retryCount }) => {
          const attempts = retryCount + 1;
          if (error instanceof HTTPError) {
            const code = errorCode(error.data);
            const body = previewBody(error.data, previewBytes);
            trace.error('API', `${label} ${error.response.status} ${error.response.statusText}`, {
              body,
              attempts,
            });
            return new ApiError(
              `Request failed with status ${error.response.status}`,
              error.response.status,
              code,
            );
          }
          if (error instanceof TimeoutError) {
            trace.error('API', `${label} timed out`, { attempts });
            return new ApiError('Request timed out', 0, CODE_TIMEOUT);
          }
          trace.error('API', `${label} network error`, { message: error.message, attempts });
          return new ApiError('Network unavailable', 0, CODE_NETWORK);
        },
      ],
    },
  });

  const res = await instance(url, init);
  trace.info(
    'API',
    `${label} ${res.status} ${res.statusText}`,
    successAttempts > 1 ? { attempts: successAttempts } : undefined,
  );
  return res.json() as Promise<T>;
}
