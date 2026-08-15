/**
 * Streaming download of the offline voice model (src/voice-model.ts).
 *
 * The storage side needs a real IndexedDB, which the node test environment
 * doesn't have; these cover the part that matters most and is testable
 * without one — reading the body incrementally so the Settings bar can show
 * genuine progress across a 41 MB transfer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logging/trace', () => ({
  trace: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** A response whose body yields `chunks` one read at a time. */
function streamingResponse(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => headers[k] ?? null },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { done: false, value: chunks[i++] }
            : { done: true, value: undefined },
      }),
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  // `open` is deliberately absent: these tests cover the streaming half, and
  // persisting the blob is what runs on device. Downloads therefore reject
  // once the bytes are in hand, after every progress callback has fired.
  vi.stubGlobal('indexedDB', {
    deleteDatabase: () => {
      const req: Record<string, unknown> = {};
      queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.());
      return req;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadModel', () => {
  it('reports progress as chunks arrive, against the declared length', async () => {
    const chunks = [new Uint8Array(300), new Uint8Array(700)];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamingResponse(chunks, { 'Content-Length': '1000' })),
    );
    const { downloadModel } = await import('../voice-model');

    const seen: Array<[number, number]> = [];
    await downloadModel((got, total) => seen.push([got, total])).catch(() => {
      // Storage isn't available in this environment; progress is what's asserted.
    });

    expect(seen).toEqual([
      [300, 1000],
      [1000, 1000],
    ]);
  });

  it('reports a zero total when the server declares no length', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamingResponse([new Uint8Array(500)])),
    );
    const { downloadModel } = await import('../voice-model');

    const seen: Array<[number, number]> = [];
    await downloadModel((got, total) => seen.push([got, total])).catch(() => {});

    // 0 signals "unknown" so the UI falls back to an indeterminate bar rather
    // than dividing by it.
    expect(seen).toEqual([[500, 0]]);
  });

  it('ignores a nonsense Content-Length instead of showing a broken bar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamingResponse([new Uint8Array(10)], { 'Content-Length': 'banana' })),
    );
    const { downloadModel } = await import('../voice-model');

    const seen: Array<[number, number]> = [];
    await downloadModel((got, total) => seen.push([got, total])).catch(() => {});

    expect(seen).toEqual([[10, 0]]);
  });

  it('throws with the status when the download is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        headers: { get: () => null },
        body: null,
      })),
    );
    const { downloadModel } = await import('../voice-model');

    await expect(downloadModel(vi.fn())).rejects.toThrow('404');
  });

  it('propagates an abort so a cancelled download does not look like a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }),
    );
    const { downloadModel } = await import('../voice-model');

    const controller = new AbortController();
    controller.abort();
    await expect(downloadModel(vi.fn(), controller.signal)).rejects.toThrow();
  });
});

describe('clearVoskScratch', () => {
  it('deletes the database vosk-browser mounts its IDBFS cache at', async () => {
    const deleteDatabase = vi.fn(() => {
      const req: Record<string, unknown> = {};
      queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.());
      return req;
    });
    vi.stubGlobal('indexedDB', { deleteDatabase });
    const { clearVoskScratch } = await import('../voice-model');

    await clearVoskScratch();

    // The name is the IDBFS mount point, verified against vosk-browser's
    // bundled worker — not a guess.
    expect(deleteDatabase).toHaveBeenCalledWith('/vosk');
  });

  it('resolves rather than hanging when another context holds the database open', async () => {
    vi.stubGlobal('indexedDB', {
      deleteDatabase: () => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => (req.onblocked as (() => void) | undefined)?.());
        return req;
      },
    });
    const { clearVoskScratch } = await import('../voice-model');

    await expect(clearVoskScratch()).resolves.toBeUndefined();
  });
});
