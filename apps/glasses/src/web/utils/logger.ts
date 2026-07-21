import { LOG_LEVELS } from '../constants';
import { appendLine } from '../providers/LogProvider';
import { isAudioFrameLog } from './audioFilter';
import { formatArgs, previewBody, timestamp } from './format';

let installed = false;

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
        const level = res.ok ? 'info' : 'warn';
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
