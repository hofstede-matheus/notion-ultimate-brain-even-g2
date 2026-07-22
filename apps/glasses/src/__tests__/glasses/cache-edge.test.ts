/**
 * Tests 18–20: Cache module edge cases
 *
 * This file imports the REAL cache module (no vi.mock('../../cache')) so that
 * the actual loadCachedList / saveCachedList logic is exercised directly.
 * Bridge-wait, JSON round-tripping, and write-failure swallowing now live in
 * even-toolkit's storage helpers (see cache.ts) — those are mocked here so
 * these tests target what cache.ts itself still owns: the array-shape guard
 * on read and delegation on write.
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

// ---------------------------------------------------------------------------
// Test 18 — no entry (storageGet already fell back to null: missing key,
// empty string, or a bridge failure — all indistinguishable at this layer)
// ---------------------------------------------------------------------------

describe('loadCachedList — no entry', () => {
  it('returns null when storageGet resolves its fallback', async () => {
    storageGet.mockResolvedValue(null);

    const result = await loadCachedList('nonexistent-key');
    expect(result).toBeNull();
    expect(storageGet).toHaveBeenCalledWith('nonexistent-key', null);
  });
});

// ---------------------------------------------------------------------------
// Test 19 — entry exists but isn't a list (valid JSON, wrong shape)
// ---------------------------------------------------------------------------

describe('loadCachedList — non-array entry', () => {
  it('returns null instead of the malformed value', async () => {
    storageGet.mockResolvedValue({ not: 'a list' });

    await expect(loadCachedList('key')).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 20 — write delegates to storageSet, whose own bridge-failure handling
// is the toolkit's responsibility
// ---------------------------------------------------------------------------

describe('saveCachedList', () => {
  it('delegates to storageSet with the given key and items', async () => {
    await expect(saveCachedList('key', [1, 2, 3])).resolves.toBeUndefined();
    expect(storageSet).toHaveBeenCalledWith('key', [1, 2, 3]);
  });
});
