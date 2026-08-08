import pino from 'pino';
import type { RouteResult } from '../routes';

// The default pino() destination (no `transport` option) writes via
// sonic-boom without a worker thread, so it survives esbuild's single-file
// bundle into dist-lambda/index.js. `transport` (pino-pretty, multi-target)
// spawns a worker that loads a separate script by path — that file never
// makes it into the Lambda zip, so don't add one here.
//
// The level is fixed, and no env var may change it or widen what is logged.
// summarizeFailure below states a guarantee the landing page makes publicly;
// a guarantee that a deploy-time variable can switch off is not one.
export const logger = pino({ level: 'info' });

// pino's default write is buffered/non-blocking, which is what makes it fast
// — but AWS freezes the execution environment right after the handler
// returns, before a buffered write is guaranteed to reach CloudWatch. Await
// this immediately before returning from the handler so nothing is lost.
export function flushLogger(): Promise<void> {
  return new Promise((resolve) => logger.flush(() => resolve()));
}

/**
 * What gets logged for one request — and, much more importantly, what doesn't.
 *
 * **Nothing is logged for a successful request.** A 2xx produces no log line
 * at all. Failures produce exactly four fields, none of which is user data:
 *
 * - `method`   — the HTTP verb.
 * - `route`    — the route *pattern* (`/api/pages/:id/markdown`), never the
 *                concrete path. The concrete path carries Notion page IDs,
 *                which identify real pages in someone's workspace, so it must
 *                not reach the log. This is the whole reason the caller passes
 *                a pattern instead of `event.rawPath`.
 * - `status`   — the HTTP status.
 * - `errorCode`— a Notion API error *code* (`object_not_found`,
 *                `rate_limited`, …) when there is one. A category, not a
 *                message; Notion's error messages quote IDs and titles.
 *
 * Deliberately absent, and each for a reason:
 *
 * - Request headers. The function doesn't take them, so `X-Notion-Config` /
 *   `X-Notion-Token` cannot be logged by accident. Keep it that way.
 * - Response bodies, in every case including 5xx. Bodies are task titles, note
 *   titles, project names and page markdown — the most sensitive thing that
 *   passes through this server. A failing body is not worth keeping a copy of
 *   someone's notes to diagnose.
 * - Error messages. Only the code.
 * - Body size. `bodyBytes` on a single-item response leaks roughly how long a
 *   title is; it bought very little and it isn't worth the argument.
 *
 * Returns `undefined` when there is nothing to log, so the caller skips the
 * write entirely rather than emitting an empty line.
 *
 * If you are about to add a field here, the test in `__tests__/logger.test.ts`
 * asserts the exact key set — that failure is the intended speed bump, not an
 * obstacle to route around.
 */
export function summarizeFailure(
  method: string,
  route: string,
  result: RouteResult,
): Record<string, unknown> | undefined {
  if (result.status < 400) return undefined;

  const entry: Record<string, unknown> = { method, route, status: result.status };
  if (result.errorCode) entry.errorCode = result.errorCode;
  return entry;
}
