import { formatArgs, previewBody } from '../../logging/format';
import { trace } from '../../logging/trace';
import { BODY_PREVIEW_BYTES, type Level, LOG_LEVELS } from '../constants';
import { isAudioFrameLog } from './audioFilter';
import { isSimulatorNoiseLog } from './consoleNoise';

let installed = false;

/** Maps a patched console method name to the trace system's 4-level scale. */
const LEVEL_MAP: Record<Level, 'debug' | 'info' | 'warn' | 'error'> = {
  log: 'info',
  info: 'info',
  warn: 'warn',
  error: 'error',
  debug: 'debug',
};

/**
 * Patches console.log/info/warn/error/debug so every call is mirrored into
 * the trace buffer (in addition to the browser's normal DevTools output, via
 * ../../logging/trace's own console mirror).
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
      if (isSimulatorNoiseLog(args)) return; // suppress the simulator's ~2s heartbeat
      original(...args);
      trace[LEVEL_MAP[level]]('CON', formatArgs(args));
    };
  }

  // surface uncaught errors too
  window.addEventListener('error', (e) => {
    trace.error('CON', `[UNCAUGHT] ${e.message}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason =
      e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason);
    trace.error('CON', `[UNHANDLED] ${reason}`);
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

    const isApi = url.includes('/api/');
    const started = performance.now();
    const reqBody = init?.body
      ? await previewBody(init.body as BodyInit, BODY_PREVIEW_BYTES)
      : null;

    if (isApi) {
      trace.info('API', `→ ${method} ${url}`, reqBody ? { body: reqBody } : undefined);
    }

    try {
      const res = await original(input, init);
      const ms = Math.round(performance.now() - started);
      if (isApi) {
        const level = res.ok ? 'info' : 'warn';
        trace[level]('API', `← ${method} ${url} ${res.status} ${res.statusText}`, { ms });
      }
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (isApi) {
        trace.error('API', `✗ ${method} ${url} failed after ${ms}ms`, { error: msg });
      }
      throw err;
    }
  };
}
