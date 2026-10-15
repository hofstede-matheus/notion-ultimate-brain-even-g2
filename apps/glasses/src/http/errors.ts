/** Notion error codes that are permanent for the session — never worth retrying. See
 *  retry.ts's NON_RETRYABLE_CODES and config-health.ts's looksConfigShaped, which reads
 *  this same `code` to trigger the self-heal flow. */

/** ky rejected with a plain (non-HTTP) error — offline, DNS, TLS, connection reset. */
export const CODE_NETWORK = 'network_error';
/** Our own per-attempt AbortController fired (ky's TimeoutError). */
export const CODE_TIMEOUT = 'timeout';

/**
 * A failed API request, carrying the HTTP status and — when the server sent one — Notion's
 * error code (`validation_error`, `object_not_found`, …; see apps/server/src/routes.ts's
 * invokeRoute). config-health.ts's reportApiFailure reads `status`/`code` to tell a
 * config-shaped failure apart from a transient one, without parsing the message text.
 *
 * A network failure or a client-side timeout also becomes an ApiError (status 0, code
 * CODE_NETWORK/CODE_TIMEOUT) — client.ts's beforeError hook maps ky's HTTPError/TimeoutError/
 * plain errors here, so every caller sees one error shape regardless of what went wrong.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
