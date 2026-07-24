import { storageGet, storageRemove, storageSet } from 'even-toolkit/storage';
import { getSnapshot, seedPreviousSession, subscribe } from './sink';
import type { LogRecord } from './types';
import { LOG_PERSIST_SIZE } from './types';

const STORAGE_KEY = 'notionultimatebrain:log';
const FLUSH_INTERVAL_MS = 2000;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function flush(): Promise<void> {
  try {
    const live = getSnapshot().filter((r) => !r.previousSession);
    await storageSet(STORAGE_KEY, live.slice(-LOG_PERSIST_SIZE));
  } catch {
    // best-effort — persistence must never break the app
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Loads the previous session's persisted lines (if any) and seeds the live
 * buffer with them, tagged `previousSession`. Call once at boot, BEFORE
 * startPersisting() — seeding after the live-write subscription is wired
 * would otherwise trigger an immediate flush that overwrites the just-loaded
 * data with an empty live buffer.
 */
export async function loadPreviousSession(): Promise<void> {
  try {
    const stored = await storageGet<LogRecord[]>(STORAGE_KEY, []);
    if (Array.isArray(stored) && stored.length > 0) seedPreviousSession(stored);
  } catch {
    // best-effort — a missing/corrupt previous session must not block boot
  }
}

/**
 * Wires the throttled mirror-to-storage (every ~2s), plus an immediate flush
 * on any error-level record and on pagehide — a crash must not lose the line
 * that explains it. Call once at boot, after loadPreviousSession().
 */
export function startPersisting(): void {
  if (started) return;
  started = true;

  subscribe(() => {
    const entries = getSnapshot();
    const last = entries[entries.length - 1];
    if (last && !last.previousSession && last.level === 'error') {
      void flush();
      return;
    }
    scheduleFlush();
  });

  // Guarded: this module is unit-tested under vitest's node environment,
  // which has no `window`.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      void flush();
    });
  }
}

/** Wipes the persisted copy — paired with sink.clear() by the console's Clear button. */
export async function clearPersisted(): Promise<void> {
  try {
    await storageRemove(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
