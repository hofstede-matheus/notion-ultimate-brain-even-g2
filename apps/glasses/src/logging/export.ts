import { getSnapshot } from './sink';

/** Builds the full clipboard payload: a header block + every buffered line. */
export function buildLogText(): string {
  const entries = getSnapshot();
  const previousCount = entries.filter((r) => r.previousSession).length;

  const header = [
    `GlassTask log — ${new Date().toISOString()}`,
    `app ${__APP_VERSION__} · api ${import.meta.env.VITE_API_BASE || '(same-origin)'}`,
    `ua: ${navigator.userAgent}`,
    `${entries.length} lines${previousCount > 0 ? ` (${previousCount} from previous session)` : ''}`,
    '─'.repeat(40),
  ].join('\n');

  const lines: string[] = [];
  let dividerInserted = previousCount === 0;
  for (const entry of entries) {
    if (!dividerInserted && !entry.previousSession) {
      lines.push('── previous session ──');
      dividerInserted = true;
    }
    lines.push(entry.line);
  }

  return `${header}\n${lines.join('\n')}`;
}

/**
 * Copies `text` to the clipboard, preferring the async Clipboard API and
 * falling back to a hidden-textarea + execCommand('copy') — the Even Hub
 * webview may not expose navigator.clipboard on a non-secure origin.
 * Returns whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy fallback
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
