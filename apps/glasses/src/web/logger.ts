import { BODY_PREVIEW_BYTES, LOG_LEVELS, MAX_LOG_LINES } from './constants';
import type { Level, LogEntry } from './types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function timestamp(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`;
}

/**
 * Raw PCM audio frames arrive continuously during voice recording, and the
 * host bridge logs every one (`… EvenHub event: {jsonData:{audioPcm:[…]}}`),
 * flooding the console/terminal with number arrays. Drop those lines entirely
 * — they carry no diagnostic value. Cheap property checks only; never
 * stringifies large payloads.
 */
function isAudioFrameLog(args: unknown[]): boolean {
  for (const a of args) {
    if (typeof a === 'string') {
      if (a.includes('audioPcm')) return true;
    } else if (a && typeof a === 'object') {
      const o = a as Record<string, unknown>;
      const jsonData = o.jsonData as Record<string, unknown> | undefined;
      if (o.audioPcm != null || jsonData?.audioPcm != null) return true;
    }
  }
  return false;
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ''}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

let installed = false;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

/** Subscribe to log updates (React's `useSyncExternalStore`). */
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current log snapshot. A new array reference is produced on every append
 * (see appendLine) so `useSyncExternalStore` reliably detects changes —
 * mutating one shared array in place would leave the reference unchanged
 * and React would never re-render.
 */
export function getLogEntries(): LogEntry[] {
  return entries;
}

/**
 * Best-effort forward a log line to the dev server so it appears in the same
 * terminal as `npm run dev:all`. Failures are swallowed — losing a log line
 * should never break the app.
 */
function forwardToTerminal(level: Level, line: string): void {
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

async function previewBody(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null;
  try {
    if (typeof body === 'string') return body.slice(0, BODY_PREVIEW_BYTES);
    if (body instanceof URLSearchParams) return body.toString().slice(0, BODY_PREVIEW_BYTES);
    if (body instanceof FormData) {
      const parts: string[] = [];
      for (const [k, v] of body.entries())
        parts.push(`${k}=${typeof v === 'string' ? v : '<file>'}`);
      return parts.join('&').slice(0, BODY_PREVIEW_BYTES);
    }
    if (body instanceof Blob) return `<blob:${body.type || 'unknown'}, ${body.size}b>`;
    if (body instanceof ArrayBuffer) return `<ArrayBuffer:${body.byteLength}b>`;
    return `<body:${typeof body}>`;
  } catch {
    return '<unreadable>';
  }
}

function appendLine(level: Level, line: string, api = false): void {
  const next =
    entries.length >= MAX_LOG_LINES
      ? entries.slice(entries.length - MAX_LOG_LINES + 1)
      : entries.slice();
  next.push({ level, line, api });
  entries = next;
  for (const listener of listeners) listener();

  forwardToTerminal(level, line);
}

/**
 * Patches console.log/info/warn/error/debug so every call is mirrored into the
 * on-screen log container (in addition to the browser's normal DevTools output).
 *
 * Idempotent — safe to call more than once.
 */
export function installLogger(): void {
  if (installed) return;
  installed = true;

  for (const level of LOG_LEVELS) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (isAudioFrameLog(args)) return; // suppress per-frame PCM spam
      original(...args);
      const line = `[${timestamp()}] [${level.toUpperCase()}] ${formatArgs(args)}`;
      appendLine(level, line);
    };
  }

  // surface uncaught errors too
  window.addEventListener('error', (e) => {
    appendLine('error', `[${timestamp()}] [UNCAUGHT] ${e.message}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason =
      e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason);
    appendLine('error', `[${timestamp()}] [UNHANDLED] ${reason}`);
  });

  installFetchLogger();
}

/**
 * Patches window.fetch so every API request is logged with method, URL, status
 * and elapsed time. Non-/api/* calls are skipped to keep the log focused on
 * backend traffic, and the original Response is returned untouched.
 */
function installFetchLogger(): void {
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Exclude /api/logs itself: forwardToTerminal() posts every appended line
    // there, and appendLine() forwards every line it renders (including
    // these API-traffic lines) — without this exclusion, logging a /api/logs
    // request creates an infinite self-amplifying loop.
    const isApi = url.includes('/api/') && !url.includes('/api/logs');
    const started = performance.now();
    const reqBody = init?.body ? await previewBody(init.body as BodyInit) : null;

    if (isApi) {
      const reqLine = reqBody
        ? `[${timestamp()}] [API →] ${method} ${url}  body=${reqBody}`
        : `[${timestamp()}] [API →] ${method} ${url}`;
      appendLine('info', reqLine, true);
    }

    try {
      const res = await original(input, init);
      const ms = Math.round(performance.now() - started);
      if (isApi) {
        const level: Level = res.ok ? 'info' : 'warn';
        appendLine(
          level,
          `[${timestamp()}] [API ←] ${method} ${url}  ${res.status} ${res.statusText}  ${ms}ms`,
          true,
        );
      }
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (isApi) {
        appendLine(
          'error',
          `[${timestamp()}] [API ✗] ${method} ${url}  failed after ${ms}ms — ${msg}`,
          true,
        );
      }
      throw err;
    }
  };
}
