import { BODY_PREVIEW_BYTES } from '../constants';

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function timestamp(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`;
}

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

export async function previewBody(body: BodyInit | null | undefined): Promise<string | null> {
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
