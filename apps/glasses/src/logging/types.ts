/**
 * Shared types for the trace-logging system. Lives at `src/` (not `src/web/`)
 * so both the glasses runtime (`src/glasses/**`) and the web shell can log
 * without either pulling in the other's dependencies.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'BOOT'
  | 'EVT'
  | 'NAV'
  | 'SEL'
  | 'API'
  | 'CACHE'
  | 'ACT'
  | 'VOICE'
  | 'RENDER'
  | 'CON';

export interface LogRecord {
  /** Monotonic within a process lifetime — does not persist across reloads. */
  seq: number;
  /** Date.now() at append time. */
  t: number;
  level: LogLevel;
  cat: LogCategory;
  msg: string;
  /** Extra structured fields, serialised and capped at append time. */
  ctx?: Record<string, unknown>;
  /** True for a record reloaded from a previous session's persisted buffer. */
  previousSession?: boolean;
  /** Pre-rendered display line — computed once at append time, see format.ts. */
  line: string;
}

/** In-memory ring buffer capacity. */
export const LOG_BUFFER_SIZE = 2000;

/** How many of the newest lines get mirrored to persistent storage. */
export const LOG_PERSIST_SIZE = 1000;
