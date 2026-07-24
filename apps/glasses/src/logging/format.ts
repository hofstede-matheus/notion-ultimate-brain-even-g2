import type { LogCategory, LogLevel } from './types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`;
}

const LEVEL_WIDTH = 5; // 'ERROR', the longest level name
const CAT_WIDTH = 6; // 'RENDER', the longest category name

function formatCtxValue(v: unknown): string {
  if (typeof v === 'string') return v.includes(' ') ? `"${v}"` : v;
  return String(v);
}

function formatCtx(ctx: Record<string, unknown> | undefined): string {
  if (!ctx) return '';
  const parts = Object.entries(ctx).map(([k, v]) => `${k}=${formatCtxValue(v)}`);
  return parts.length > 0 ? `  ${parts.join(' ')}` : '';
}

/**
 * One display line for a log record — computed once at append time (see
 * sink.ts) and reused for both the on-screen console and the exported copy,
 * so rendering 2000 lines never re-formats them.
 */
export function formatRecord(
  t: number,
  level: LogLevel,
  cat: LogCategory,
  msg: string,
  ctx?: Record<string, unknown>,
): string {
  const levelCol = level.toUpperCase().padEnd(LEVEL_WIDTH);
  const catCol = cat.padEnd(CAT_WIDTH);
  return `${formatTime(t)} ${levelCol} ${catCol} ${msg}${formatCtx(ctx)}`;
}

/** Formats a patched console.* call's raw arguments into one line of text. */
export function formatArgs(args: unknown[]): string {
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

/** Best-effort text preview of a fetch request body, capped at `maxBytes`. */
export async function previewBody(
  body: BodyInit | null | undefined,
  maxBytes: number,
): Promise<string | null> {
  if (body == null) return null;
  try {
    if (typeof body === 'string') return body.slice(0, maxBytes);
    if (body instanceof URLSearchParams) return body.toString().slice(0, maxBytes);
    if (body instanceof FormData) {
      const parts: string[] = [];
      for (const [k, v] of body.entries())
        parts.push(`${k}=${typeof v === 'string' ? v : '<file>'}`);
      return parts.join('&').slice(0, maxBytes);
    }
    if (body instanceof Blob) return `<blob:${body.type || 'unknown'}, ${body.size}b>`;
    if (body instanceof ArrayBuffer) return `<ArrayBuffer:${body.byteLength}b>`;
    return `<body:${typeof body}>`;
  } catch {
    return '<unreadable>';
  }
}
