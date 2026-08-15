/**
 * Storage and download of the offline Vosk speech model.
 *
 * The model used to ship inside the .ehpk (39 MB of a 45 MB bundle, against a
 * ~10 MB practical cap), served from the relative path /vosk/model.tar.gz. It
 * is now downloaded on demand from Settings and kept here.
 *
 * ## Why we own the storage instead of letting vosk-browser cache it
 *
 * vosk-browser already caches: its worker mounts Emscripten IDBFS at `/vosk`
 * and keeps the *extracted* model under `/vosk/<modelUrl with \W -> _>/`,
 * guarded by an `extracted.ok` sentinel, so loading the same URL twice skips
 * the download. But it emits no progress events, and a 41 MB download with no
 * feedback is not something to put in front of a user.
 *
 * So we download it ourselves (streamed, with progress) and hand vosk a
 * `blob:` URL. That has a catch: the cache key is derived from the URL, and a
 * blob URL is fresh every session, so vosk would re-extract on each launch AND
 * write another ~50 MB copy into its IDBFS under a new key, forever. Hence
 * clearVoskScratch() — vosk's IDBFS becomes disposable scratch (one copy per
 * session) and this module holds the only durable copy.
 *
 * The re-extraction cost is paid inside vosk's worker, off the critical path,
 * at the same point in boot where the old preload already ran.
 */

import { trace } from './logging/trace';

/** IndexedDB holding the downloaded archive. Ours, not vosk's. */
const DB_NAME = 'notion-ub-voice';
const DB_VERSION = 1;
const STORE = 'models';

/**
 * Only English is published today. The key is per-language so switching later
 * doesn't need a migration — see scripts/fetch-vosk-model.cjs's catalog.
 */
const MODEL_KEY = 'en';

/**
 * Emscripten IDBFS names its IndexedDB database after the mount point, and
 * vosk-browser mounts at `/vosk` (verified in the worker bundled in
 * vosk-browser/dist/vosk.js: `IDBFS.getDB(mount.mountpoint, ...)`).
 */
const VOSK_SCRATCH_DB = '/vosk';

/** Approximate download size, for the Settings copy only — never validated against. */
export const MODEL_SIZE_MB = 41;

/**
 * Where the model is published. Overridable so a dev build can point at a
 * local file server, mirroring how api.ts treats VITE_API_BASE.
 */
export const VOICE_MODEL_URL =
  import.meta.env.VITE_VOICE_MODEL_URL ?? 'https://notion-ub-assets.web.app/vosk/model.tar.gz';

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}

/** Wraps one request in a promise and always closes the db afterwards. */
function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => {
          db.close();
          resolve(req.result);
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('IndexedDB request failed'));
        };
      }),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether the model has been downloaded. Deliberately `getKey` rather than
 * `get`: this runs during boot, and materialising 41 MB just to answer a
 * yes/no would be absurd.
 */
export async function hasModel(): Promise<boolean> {
  try {
    const key = await withStore('readonly', (s) => s.getKey(MODEL_KEY));
    return key !== undefined;
  } catch (e) {
    trace.warn('VOICE', `model lookup failed: ${describe(e)}`);
    return false;
  }
}

/**
 * An object URL for the stored archive, for handing to vosk-browser's
 * createModel(). Null when nothing has been downloaded.
 *
 * The caller owns the URL and should revokeObjectURL once the model is loaded.
 */
export async function openModelUrl(): Promise<string | null> {
  try {
    const blob = await withStore<Blob | undefined>('readonly', (s) => s.get(MODEL_KEY));
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch (e) {
    trace.warn('VOICE', `model read failed: ${describe(e)}`);
    return null;
  }
}

/**
 * Download the model archive and store it, reporting progress as it streams.
 *
 * `totalBytes` is 0 when the server sends no usable Content-Length — callers
 * should fall back to an indeterminate indicator rather than dividing by zero.
 */
export async function downloadModel(
  onProgress: (receivedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  trace.info('VOICE', `model download start (${VOICE_MODEL_URL})`);

  const res = await fetch(VOICE_MODEL_URL, { signal });
  if (!res.ok) {
    trace.error('VOICE', `model download failed: HTTP ${res.status}`);
    throw new Error(`Download failed with status ${res.status}`);
  }
  if (!res.body) throw new Error('Download failed: response has no body');

  const declared = Number(res.headers.get('Content-Length'));
  const total = Number.isFinite(declared) && declared > 0 ? declared : 0;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received, total);
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: 'application/gzip' });
  await withStore('readwrite', (s) => s.put(blob, MODEL_KEY));

  // A stale scratch copy keyed off a previous session's blob URL is dead
  // weight the moment a new archive lands.
  await clearVoskScratch();

  trace.info('VOICE', 'model download done', { bytes: received });
}

/** Forget the downloaded model, freeing both our copy and vosk's scratch. */
export async function deleteModel(): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(MODEL_KEY));
  } catch (e) {
    trace.warn('VOICE', `model delete failed: ${describe(e)}`);
  }
  await clearVoskScratch();
  trace.info('VOICE', 'model removed');
}

/**
 * Drop vosk-browser's IDBFS cache.
 *
 * Called before every load: because we hand vosk a fresh blob URL each session
 * it would otherwise accumulate one ~50 MB extracted copy per launch, under a
 * new key each time, until the origin's quota gives out.
 */
export function clearVoskScratch(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const req = indexedDB.deleteDatabase(VOSK_SCRATCH_DB);
      req.onsuccess = finish;
      req.onerror = finish;
      // Fires when another tab/worker still holds the database open. Nothing
      // to do about it here and it is not worth blocking a load over, so
      // treat it as done — the stale copy just survives one more session.
      req.onblocked = finish;
    } catch {
      finish();
    }
  });
}

function describe(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
