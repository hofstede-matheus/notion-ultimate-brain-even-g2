/**
 * Offline queue for voice-created tasks.
 *
 * A dictated task is expensive to produce (the user spoke it, STT processed
 * it) and cheap to re-send, so a connectivity blip must never destroy the
 * transcript. When createTask fails for a reason that looks transient, the
 * transcript lands here instead of on an error screen, and is re-sent FIFO
 * once requests start succeeding again.
 *
 * Shape follows ./logging/persist.ts + ./logging/sink.ts: a module-level
 * buffer mirrored to bridge storage, rehydrated at boot, exposed as an
 * external store so the phone webview can render it with useSyncExternalStore.
 *
 * There is no `online` event on this platform (the SDK's onDeviceStatusChanged
 * is the phone<->glasses BLE link, not internet reachability), so the drain is
 * driven opportunistically — see startDraining() and notifyRequestSucceeded().
 */

import { storageGet, storageSet } from 'even-toolkit/storage';
import isNetworkError from 'is-network-error';
import { ApiError, createTask, onRequestSuccess } from './api';
import { tenantPrefix } from './cache';
import { trace } from './logging/trace';

export interface QueuedTask {
  id: string;
  /** The transcript, exactly as it would have been POSTed. */
  name: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
  /** Gave up after MAX_ATTEMPTS — kept visible so the phone can offer a discard. */
  failed?: boolean;
}

/** Attempts before an entry is parked as `failed` rather than retried forever. */
export const MAX_ATTEMPTS = 5;
/** Hard cap on stored entries; the oldest is dropped past this. */
export const MAX_QUEUE_SIZE = 100;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

/**
 * Tenant-scoped: a queue written against one Notion workspace must never be
 * POSTed into another one after the user reconfigures.
 */
export function queueStorageKey(): string {
  return `notionultimatebrain:${tenantPrefix()}:queue`;
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export type Failure = 'transient' | 'permanent';

/**
 * Decides whether a failed request is worth queueing and retrying.
 *
 * ApiError means the request reached the server and came back — 5xx and 429
 * are the server's own transient states, any other 4xx would fail identically
 * on every retry and belongs on the error screen instead.
 *
 * Otherwise it is a transport failure. `is-network-error` knows the per-engine
 * messages (notably WKWebView's bare "Load failed", which is the runtime this
 * app actually ships into); the extra bare-TypeError check widens that to
 * WebView-specific wording it does not know about, since the Even WebView's
 * failure strings are undocumented. ApiError is tested first and extends
 * Error, not TypeError, so the widening can never swallow an HTTP error.
 */
export function classifyFailure(err: unknown): Failure {
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 429 ? 'transient' : 'permanent';
  }
  return isNetworkError(err) || err instanceof TypeError ? 'transient' : 'permanent';
}

/** Delay before the next drain attempt for an entry that has failed `attempts` times. */
export function backoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS);
}

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

let entries: QueuedTask[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current snapshot. The array identity only changes when the queue itself
 * changes — useSyncExternalStore re-renders forever if a getSnapshot rebuilds
 * its result on every call.
 */
export function getQueue(): QueuedTask[] {
  return entries;
}

/** Replaces the buffer and mirrors it to storage. */
async function commit(next: QueuedTask[]): Promise<void> {
  entries = next;
  notify();
  await storageSet(queueStorageKey(), entries);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/**
 * Rehydrates the buffer from storage. Call once at boot, after the tenant
 * config is set (the storage key is tenant-scoped) and BEFORE startDraining()
 * — the same ordering ./logging/persist.ts documents for its own pair.
 */
export async function loadQueue(): Promise<void> {
  try {
    const stored = await storageGet<unknown>(queueStorageKey(), null);
    if (!Array.isArray(stored)) return;
    entries = stored.filter(
      (e): e is QueuedTask =>
        typeof e === 'object' && e !== null && typeof (e as QueuedTask).name === 'string',
    );
    if (entries.length > 0) {
      trace.info('QUEUE', `restored ${entries.length} pending task(s)`);
      notify();
    }
  } catch {
    // best-effort — a missing or corrupt queue must not block boot
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Appends a transcript to the queue and persists it. */
export async function enqueueTask(name: string): Promise<QueuedTask> {
  const entry: QueuedTask = { id: newId(), name, queuedAt: Date.now(), attempts: 0 };
  let next = [...entries, entry];
  if (next.length > MAX_QUEUE_SIZE) {
    // Dropping the oldest keeps the queue bounded without rejecting the
    // recording the user just made. 100 pending dictations means something is
    // very wrong, so this is a loud line, not a silent trim.
    const dropped = next.length - MAX_QUEUE_SIZE;
    trace.warn('QUEUE', `queue full — dropping ${dropped} oldest entr(ies)`);
    next = next.slice(dropped);
  }
  await commit(next);
  return entry;
}

/** Removes one entry — the phone's per-item discard. */
export async function discardQueued(id: string): Promise<void> {
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  trace.info('QUEUE', 'entry discarded');
  await commit(next);
}

/** Empties the queue — the phone's Clear button. */
export async function clearQueue(): Promise<void> {
  if (entries.length === 0) return;
  trace.info('QUEUE', `cleared ${entries.length} pending task(s)`);
  await commit([]);
}

// ---------------------------------------------------------------------------
// Draining
// ---------------------------------------------------------------------------

let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(attempts: number): void {
  if (retryTimer !== null) return;
  const delay = backoffMs(attempts);
  trace.info('QUEUE', `retrying in ${Math.round(delay / 1000)}s`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drainQueue('backoff');
  }, delay);
}

/**
 * Re-sends queued tasks oldest-first.
 *
 * A transient failure aborts the whole pass — if the first entry could not
 * reach the server, neither can the rest, and hammering them all just burns
 * their attempt counts. A permanent failure is specific to that one entry, so
 * the pass skips it and carries on.
 *
 * Single-flight: concurrent callers (boot, foreground-enter, a successful
 * request, the backoff timer, the phone's Sync now) collapse into one pass.
 */
export async function drainQueue(reason: string): Promise<void> {
  if (draining || entries.length === 0) return;
  draining = true;
  trace.info('QUEUE', `drain start (${reason})`, { pending: entries.length });

  try {
    const sent: string[] = [];
    let blockedAt: QueuedTask | null = null;

    for (const entry of entries) {
      if (entry.failed) continue;
      try {
        await createTask(entry.name);
        sent.push(entry.id);
      } catch (err) {
        entry.attempts += 1;
        entry.lastError = err instanceof Error ? err.message : String(err);
        if (classifyFailure(err) === 'transient') {
          blockedAt = entry;
          break;
        }
        if (entry.attempts >= MAX_ATTEMPTS) {
          entry.failed = true;
          trace.error('QUEUE', `giving up after ${entry.attempts} attempts`, {
            error: entry.lastError,
          });
        }
      }
    }

    const next = entries.filter((e) => !sent.includes(e.id));
    // Persist unconditionally: even a fully-blocked pass mutated attempts /
    // lastError / failed on the entries above, and those must survive a reload.
    await commit(next);

    if (sent.length > 0) trace.info('QUEUE', `synced ${sent.length} task(s)`);
    if (blockedAt) {
      trace.warn('QUEUE', 'drain blocked — still offline', { pending: next.length });
      scheduleRetry(blockedAt.attempts);
    }
  } finally {
    draining = false;
  }
}

/**
 * Called from api.ts on any 2xx. A successful response is the closest thing
 * this platform has to an `online` event, so it is the most reliable drain
 * trigger available. Cheap when idle: drainQueue returns immediately on an
 * empty queue, and the single-flight guard stops the drain's own successful
 * createTask calls from re-entering.
 */
export function notifyRequestSucceeded(): void {
  if (draining || entries.length === 0) return;
  void drainQueue('request succeeded');
}

let started = false;

/**
 * Wires the drain triggers this module owns. Call once at boot, after
 * loadQueue(). Idempotent — boot's retry button can call connect() again.
 */
export function startDraining(): void {
  if (started) return;
  started = true;
  // Registered from this side so api.ts never imports this module — the
  // dependency stays one-directional (offline-queue -> api).
  onRequestSuccess(notifyRequestSucceeded);
  void drainQueue('boot');
}

/** Test seam — resets module state between cases. */
export function __resetForTests(): void {
  entries = [];
  listeners.clear();
  draining = false;
  started = false;
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}
