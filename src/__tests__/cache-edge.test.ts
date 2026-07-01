/**
 * Tests 18–20: Cache module edge cases
 *
 * This file imports the REAL cache module (no vi.mock('../cache')) so that
 * the actual loadCachedTasks / saveCachedTasks logic is exercised directly.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { setBridge } from '../state'
import { loadCachedTasks, saveCachedTasks } from '../cache'
import { makeMockBridge } from './helpers'

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Test 18 — missing or empty stored value
// ---------------------------------------------------------------------------

describe('loadCachedTasks — missing or empty key', () => {
  it('returns null when the bridge returns an empty string', async () => {
    const bridge = makeMockBridge()
    bridge.getLocalStorage.mockResolvedValue('')
    setBridge(bridge as any)

    const result = await loadCachedTasks('nonexistent-key')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 19 — corrupted JSON in storage
// ---------------------------------------------------------------------------

describe('loadCachedTasks — corrupted entry', () => {
  it('silently returns null instead of throwing on malformed JSON', async () => {
    const bridge = makeMockBridge()
    bridge.getLocalStorage.mockResolvedValue('{not: valid json{{{{')
    setBridge(bridge as any)

    await expect(loadCachedTasks('key')).resolves.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 20 — bridge write failure
// ---------------------------------------------------------------------------

describe('saveCachedTasks — write failure', () => {
  it('does not surface the error to the caller', async () => {
    const bridge = makeMockBridge()
    bridge.setLocalStorage.mockRejectedValue(new Error('disk full'))
    setBridge(bridge as any)

    await expect(saveCachedTasks('key', [])).resolves.toBeUndefined()
  })
})
