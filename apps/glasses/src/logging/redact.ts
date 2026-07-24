/**
 * Secret scrubbing for the trace log — runs at append time (see sink.ts) so
 * the on-screen console is safe to read/screenshot, not just the exported
 * copy.
 */

const REDACTED = '***REDACTED***';

/** Notion integration tokens: legacy `secret_...` and current `ntn_...`. */
const TOKEN_PATTERN = /\b(ntn_|secret_)[A-Za-z0-9]{10,}\b/g;

/** Catches large opaque blobs (e.g. a stray base64 payload) before they bloat a line. */
const BASE64_BLOB_PATTERN = /[A-Za-z0-9+/]{200,}={0,2}/g;

/**
 * Exact-match secrets registered by call sites that hold the raw value (the
 * live tenant token, the encoded X-Notion-Config header) — see
 * ../tenant-config.ts. Catches values that don't happen to match
 * TOKEN_PATTERN (e.g. a dev-env token with an unexpected shape).
 */
const knownSecrets = new Set<string>();

export function registerSecret(value: string | null | undefined): void {
  if (!value || value.length < 6) return;
  knownSecrets.add(value);
}

export function redact(text: string): string {
  let out = text;
  for (const secret of knownSecrets) {
    if (out.includes(secret)) out = out.split(secret).join(REDACTED);
  }
  out = out.replace(TOKEN_PATTERN, `$1${REDACTED}`);
  out = out.replace(BASE64_BLOB_PATTERN, (match) => `<base64 len=${match.length}>`);
  return out;
}

/** Test-only: resets registered secrets between test files. */
export function _clearRegisteredSecretsForTests(): void {
  knownSecrets.clear();
}
