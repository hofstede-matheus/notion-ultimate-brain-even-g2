import type { Level } from '../constants';

/**
 * Best-effort forward a log line to the dev server so it appears in the same
 * terminal as `npm run dev:all`. Failures are swallowed — losing a log line
 * should never break the app.
 */
export function forwardToTerminal(level: Level, line: string): void {
  try {
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ level, line }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
