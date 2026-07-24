import { append, nativeLog } from './sink';
import type { LogCategory, LogLevel } from './types';

type TraceFn = (cat: LogCategory, msg: string, ctx?: Record<string, unknown>) => void;

function log(level: LogLevel, cat: LogCategory, msg: string, ctx?: Record<string, unknown>): void {
  const record = append(level, cat, msg, ctx);
  nativeLog(level, record.line);
}

/**
 * The app-wide logging entry point — used by both `src/glasses/**` (the
 * on-glasses runtime) and `src/web/**` (the phone webview). Appends to the
 * trace buffer and mirrors to DevTools via the pristine (unpatched) console.
 *
 *   trace.info('NAV', `${from} -> ${to}`);
 *   trace.warn('EVT', 'scroll throttled', { sinceMs });
 *   trace.error('API', `${path} failed`, { status });
 */
export const trace: Record<LogLevel, TraceFn> = {
  debug: (cat, msg, ctx) => log('debug', cat, msg, ctx),
  info: (cat, msg, ctx) => log('info', cat, msg, ctx),
  warn: (cat, msg, ctx) => log('warn', cat, msg, ctx),
  error: (cat, msg, ctx) => log('error', cat, msg, ctx),
};
