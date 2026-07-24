/**
 * persist.ts wires module-level singletons (the flush timer, the `started`
 * guard), so each test gets a clean module graph via vi.resetModules() + a
 * dynamic import — the same reason logging/sink.ts's state needs a fresh
 * start per test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageGet, storageSet, storageRemove } = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn().mockResolvedValue(undefined),
  storageRemove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('even-toolkit/storage', () => ({ storageGet, storageSet, storageRemove }));

const STORAGE_KEY = 'notionultimatebrain:log';

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.useRealTimers();
  storageGet.mockResolvedValue([]);
});

describe('loadPreviousSession', () => {
  it('seeds the sink with stored records tagged previousSession', async () => {
    storageGet.mockResolvedValue([
      { seq: 1, t: 1, level: 'info', cat: 'NAV', msg: 'old', line: 'old' },
    ]);
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    await persist.loadPreviousSession();

    const entries = sink.getSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.previousSession).toBe(true);
    expect(storageGet).toHaveBeenCalledWith(STORAGE_KEY, []);
  });

  it('is a no-op when nothing was stored', async () => {
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    await persist.loadPreviousSession();

    expect(sink.getSnapshot()).toEqual([]);
  });

  it('swallows a storage failure rather than throwing', async () => {
    storageGet.mockRejectedValue(new Error('bridge unavailable'));
    const persist = await import('../../logging/persist');

    await expect(persist.loadPreviousSession()).resolves.toBeUndefined();
  });
});

describe('startPersisting', () => {
  it('flushes the live buffer to storage after the throttle interval', async () => {
    vi.useFakeTimers();
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    persist.startPersisting();
    sink.append('info', 'NAV', 'menu -> today');
    expect(storageSet).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);

    expect(storageSet).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.arrayContaining([expect.objectContaining({ msg: 'menu -> today' })]),
    );
  });

  it('flushes immediately for an error-level record, bypassing the throttle', async () => {
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    persist.startPersisting();
    sink.append('error', 'API', 'request failed');

    expect(storageSet).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.arrayContaining([expect.objectContaining({ msg: 'request failed' })]),
    );
  });

  it('excludes previous-session records from what gets persisted', async () => {
    vi.useFakeTimers();
    storageGet.mockResolvedValue([
      { seq: 1, t: 1, level: 'info', cat: 'NAV', msg: 'old', line: 'old' },
    ]);
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    await persist.loadPreviousSession();
    persist.startPersisting();
    sink.append('info', 'NAV', 'live');

    await vi.advanceTimersByTimeAsync(2000);

    const lastCall = storageSet.mock.calls.at(-1);
    const persisted = lastCall?.[1] as Array<{ msg: string }>;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.msg).toBe('live');
  });

  it('is idempotent — calling it twice only wires one subscription', async () => {
    vi.useFakeTimers();
    const persist = await import('../../logging/persist');
    const sink = await import('../../logging/sink');

    persist.startPersisting();
    persist.startPersisting();
    sink.append('info', 'NAV', 'once');

    await vi.advanceTimersByTimeAsync(2000);

    expect(storageSet).toHaveBeenCalledTimes(1);
  });
});

describe('clearPersisted', () => {
  it('removes the persisted key', async () => {
    const persist = await import('../../logging/persist');

    await persist.clearPersisted();

    expect(storageRemove).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('swallows a storage failure rather than throwing', async () => {
    storageRemove.mockRejectedValueOnce(new Error('bridge unavailable'));
    const persist = await import('../../logging/persist');

    await expect(persist.clearPersisted()).resolves.toBeUndefined();
  });
});
