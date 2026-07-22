/**
 * cache.ts unit tests — the array-shape guard on read and delegation on
 * write. The only mock here is even-toolkit/storage, the one true I/O leaf
 * cache.ts itself sits on; loadCachedList/saveCachedList run for real.
 *
 * (The cache-consuming UI flow — cold/warm open, failed fetch, etc. — lives
 * in _shared/navigation.test.ts, driven through the injected fake cache.)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCachedList, saveCachedList } from '../../cache';

const { storageGet, storageSet } = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('even-toolkit/storage', () => ({ storageGet, storageSet }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadCachedList', () => {
  it('returns null when storageGet resolves its fallback', async () => {
    storageGet.mockResolvedValue(null);

    const result = await loadCachedList('nonexistent-key');

    expect(result).toBeNull();
    expect(storageGet).toHaveBeenCalledWith('nonexistent-key', null);
  });

  it('returns null instead of a malformed (non-array) entry', async () => {
    storageGet.mockResolvedValue({ not: 'a list' });

    await expect(loadCachedList('key')).resolves.toBeNull();
  });

  it('returns the array as-is when the entry is a valid list', async () => {
    storageGet.mockResolvedValue([{ id: '1', name: 'Buy milk' }]);

    await expect(loadCachedList('key')).resolves.toEqual([{ id: '1', name: 'Buy milk' }]);
  });
});

describe('saveCachedList', () => {
  it('delegates to storageSet with the given key and items', async () => {
    await expect(saveCachedList('key', [1, 2, 3])).resolves.toBeUndefined();
    expect(storageSet).toHaveBeenCalledWith('key', [1, 2, 3]);
  });
});
