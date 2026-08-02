import pino from 'pino';
import type { RouteResult } from '../routes';

// The default pino() destination (no `transport` option) writes via
// sonic-boom without a worker thread, so it survives esbuild's single-file
// bundle into dist-lambda/index.js. `transport` (pino-pretty, multi-target)
// spawns a worker that loads a separate script by path — that file never
// makes it into the Lambda zip, so don't add one here.
export const logger = pino({ level: process.env.DEBUG === 'true' ? 'debug' : 'info' });

// pino's default write is buffered/non-blocking, which is what makes it fast
// — but AWS freezes the execution environment right after the handler
// returns, before a buffered write is guaranteed to reach CloudWatch. Await
// this immediately before returning from the handler so nothing is lost.
export function flushLogger(): Promise<void> {
  return new Promise((resolve) => logger.flush(() => resolve()));
}

/**
 * What gets logged for one request. Deliberately takes no request headers —
 * X-Notion-Config / X-Notion-Token carry the tenant's Notion token, and a
 * function that never receives them can't accidentally log them.
 *
 * Every call gets a summary. The full response body is added on top when the
 * call failed (status >= 400) or DEBUG=true forces it on for every call.
 */
export function summarizeResult(
  method: string,
  path: string,
  result: RouteResult,
  durationMs: number,
): Record<string, unknown> {
  const bodyJson = JSON.stringify(result.body);
  const base = {
    method,
    path,
    status: result.status,
    durationMs,
    bodyBytes: Buffer.byteLength(bodyJson, 'utf-8'),
  };
  const includeBody = result.status >= 400 || process.env.DEBUG === 'true';
  return includeBody ? { ...base, body: result.body } : base;
}
