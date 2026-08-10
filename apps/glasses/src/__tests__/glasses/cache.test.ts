/**
 * cache.ts unit tests — the array-shape guard on read and delegation on
 * write. The only mock here is even-toolkit/storage, the one true I/O leaf
 * cache.ts itself sits on; loadCachedList/saveCachedList run for real.
 *
 * (The cache-consuming UI flow — cold/warm open, failed fetch, etc. — lives
 * in _shared/navigation.test.ts, driven through the injected fake cache.)
 */

import type { TenantConfig } from '@notion-ub/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheKeyForScreen, loadCachedList, saveCachedList } from '../../cache';

const { storageGet, storageSet } = vi.hoisted(() => ({
  storageGet: vi.fn(),
  storageSet: vi.fn().mockResolvedValue(undefined),
}));

const { getTenantConfig } = vi.hoisted(() => ({
  getTenantConfig: vi.fn<() => TenantConfig | null>(),
}));

vi.mock('even-toolkit/storage', () => ({ storageGet, storageSet }));
vi.mock('../../tenant-config', () => ({ getTenantConfig }));

const tenantConfig = (tasksDb: string): TenantConfig => ({
  token: 'token',
  tasksDb,
  notesDb: 'notes',
  projectsDb: 'projects',
  tagsDb: 'tags',
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('cacheKeyForScreen', () => {
  it('namespaces the key by the first 8 characters of the tenant tasks database id', () => {
    getTenantConfig.mockReturnValue(tenantConfig('abcdefgh12345'));

    expect(cacheKeyForScreen('today')).toBe('notionultimatebrain:abcdefgh:today');
  });

  it('falls back to "unconfigured" when there is no tenant config', () => {
    getTenantConfig.mockReturnValue(null);

    expect(cacheKeyForScreen('today')).toBe('notionultimatebrain:unconfigured:today');
  });

  it('produces different keys for different tenants, so switching workspaces does not reuse cached lists', () => {
    getTenantConfig.mockReturnValue(tenantConfig('aaa-workspace-db'));
    const keyA = cacheKeyForScreen('today');

    getTenantConfig.mockReturnValue(tenantConfig('bbb-workspace-db'));
    const keyB = cacheKeyForScreen('today');

    expect(keyA).not.toBe(keyB);
  });
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
