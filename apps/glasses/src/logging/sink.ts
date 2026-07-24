import { formatRecord } from './format';
import { redact } from './redact';
import type { LogCategory, LogLevel, LogRecord } from './types';
import { LOG_BUFFER_SIZE } from './types';

/**
 * Native console references, captured here at module load — before
 * ../web/utils/logger.ts ever patches console.*. trace() (see trace.ts)
 * mirrors through these, never through the patched methods, so a trace()
 * call is never re-captured and double-appended by the console patch.
 */
const nativeConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
} satisfies Record<LogLevel, (...args: unknown[]) => void>;

export function nativeLog(level: LogLevel, ...args: unknown[]): void {
  nativeConsole[level](...args);
}

let seqCounter = 0;
let entries: LogRecord[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current snapshot — new array reference on every append so useSyncExternalStore detects changes. */
export function getSnapshot(): LogRecord[] {
  return entries;
}

const MAX_CTX_STRING = 200;

function capCtxValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const r = redact(value);
    return r.length > MAX_CTX_STRING ? `${r.slice(0, MAX_CTX_STRING)}…` : r;
  }
  if (Array.isArray(value)) return `<array len=${value.length}>`;
  if (value && typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > MAX_CTX_STRING ? `<object len=${json.length}>` : redact(json);
    } catch {
      return '<unserialisable>';
    }
  }
  return value;
}

function capCtx(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) out[k] = capCtxValue(v);
  return out;
}

function pushEntry(record: LogRecord): void {
  const next =
    entries.length >= LOG_BUFFER_SIZE
      ? entries.slice(entries.length - LOG_BUFFER_SIZE + 1)
      : entries.slice();
  next.push(record);
  entries = next;
  notify();
}

/** Appends one record to the live buffer. Redaction and formatting both happen here, once. */
export function append(
  level: LogLevel,
  cat: LogCategory,
  msg: string,
  ctx?: Record<string, unknown>,
): LogRecord {
  const t = Date.now();
  const safeMsg = redact(msg);
  const safeCtx = capCtx(ctx);
  const record: LogRecord = {
    seq: ++seqCounter,
    t,
    level,
    cat,
    msg: safeMsg,
    ctx: safeCtx,
    line: formatRecord(t, level, cat, safeMsg, safeCtx),
  };
  pushEntry(record);
  return record;
}

/**
 * Prepends previously-persisted records (tagged `previousSession`) ahead of
 * whatever's live. Call once at boot, before ../persist.ts's live-write
 * subscription is wired — see loadPreviousSession()'s doc comment.
 */
export function seedPreviousSession(records: LogRecord[]): void {
  if (records.length === 0) return;
  const tagged = records.map((r) => ({ ...r, previousSession: true }));
  entries = [...tagged, ...entries];
  notify();
}

export function clear(): void {
  entries = [];
  notify();
}
