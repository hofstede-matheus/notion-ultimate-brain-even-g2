/**
 * Tests 11–14: Spinner behaviour
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { onEvenHubEvent } from '../glasses/runtime'
import { makeMockBridge, resetState, doubleTapEvent, listClickEvent } from './helpers'

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn(),
  fetchInboxTasks: vi.fn(),
  createTask: vi.fn(),
}))

vi.mock('../cache', () => ({
  loadCachedTasks: vi.fn().mockResolvedValue(null),
  saveCachedTasks: vi.fn().mockResolvedValue(undefined),
  CACHE_KEY_TODAY: 'notionultimatebrain:today',
  CACHE_KEY_INBOX: 'notionultimatebrain:inbox',
}))

vi.mock('../stt', () => ({
  isListening: vi.fn().mockReturnValue(false),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  ensureRecognizer: vi.fn().mockResolvedValue(true),
  feedAudio: vi.fn(),
  preloadVoskModel: vi.fn(),
}))

import { fetchInboxTasks } from '../api'

let mockBridge: ReturnType<typeof makeMockBridge>

// ---------------------------------------------------------------------------
// Shared setup: fake timers + fresh state before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  mockBridge = makeMockBridge()
  setBridge(mockBridge as any)
  resetState()
  vi.mocked(fetchInboxTasks).mockReturnValue(new Promise(() => {})) // never resolves by default
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helper: open inbox and settle the async pipeline up to (but not past) the
// pending network request, so the spinner is running but no data has arrived.
// ---------------------------------------------------------------------------
async function openInboxAndAwaitSpinner() {
  state.screen = 'tasks-menu'
  onEvenHubEvent(listClickEvent(1))
  // Flush loadCachedTasks → showInbox (sets screen) → startSpinner
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// ---------------------------------------------------------------------------
// Test 11 — spinner visible in header while fetching
// ---------------------------------------------------------------------------

describe('spinner while fetching', () => {
  it('is visible in the screen header while a fetch is in progress', async () => {
    await openInboxAndAwaitSpinner()

    // spinnerFrame is set synchronously by startSpinner
    expect(state.spinnerFrame).toBe('|')

    // Advance one interval tick so the spinner callback fires
    vi.advanceTimersByTime(250)
    await Promise.resolve()
    await Promise.resolve()

    // updateInboxContent should have been called — its content includes the frame
    // (during cold-open loading, the page is in fallback text mode, so the
    // header text contains the fetching copy + the spinner frame character).
    expect(mockBridge.textContainerUpgrade).toHaveBeenCalled()
    const upgrade = mockBridge.textContainerUpgrade.mock.calls.at(-1)![0] as any
    expect(upgrade.containerID).toBe(1)
    expect(upgrade.content).toContain('Fetching tasks...')
    expect(upgrade.content).toMatch(/[|/\-\\]/)
  })
})

// ---------------------------------------------------------------------------
// Test 12 — spinner disappears after fetch completes (success and failure)
// ---------------------------------------------------------------------------

describe('spinner after fetch completes', () => {
  it('disappears when the fetch succeeds', async () => {
    let resolveFetch!: (v: any[]) => void
    vi.mocked(fetchInboxTasks).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    await openInboxAndAwaitSpinner()
    expect(state.spinnerFrame).toBe('|')

    resolveFetch([])
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(state.spinnerFrame).toBe('')
  })

  it('disappears when the fetch fails', async () => {
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('Network error'))

    // A rejected mock settles on the very next microtask tick, so stopSpinner
    // may already have run by the time openInboxAndAwaitSpinner returns.
    // We only assert the final state.
    state.screen = 'tasks-menu'
    onEvenHubEvent(listClickEvent(1))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(state.spinnerFrame).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Test 13 — spinner stops when user navigates away
// ---------------------------------------------------------------------------

describe('navigating away mid-fetch', () => {
  it('stops the spinner immediately on double-tap back', async () => {
    await openInboxAndAwaitSpinner()

    expect(state.screen).toBe('inbox')
    expect(state.spinnerFrame).toBe('|')

    onEvenHubEvent(doubleTapEvent())

    // stopSpinner is called synchronously inside the double-tap handler
    expect(state.spinnerFrame).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Test 14 — no duplicate spinners
// ---------------------------------------------------------------------------

describe('opening the same screen twice', () => {
  it('never produces two simultaneous spinners', async () => {
    // First open
    await openInboxAndAwaitSpinner()

    // Simulate user going back (without going through double-tap handler,
    // so the first spinner interval is still alive) then opening again.
    state.screen = 'menu'
    await openInboxAndAwaitSpinner()

    // startSpinner calls stopSpinner first, so only one interval should exist.
    // Advancing time: if two intervals ran, textContainerUpgrade would be
    // called twice per tick; with one, exactly once.
    mockBridge.textContainerUpgrade.mockClear()
    vi.advanceTimersByTime(250)
    await Promise.resolve()
    await Promise.resolve()

    expect(mockBridge.textContainerUpgrade).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Bonus: spinner cycles through all four frames in order
// ---------------------------------------------------------------------------

describe('spinner animation', () => {
  it('cycles through all four frames', async () => {
    await openInboxAndAwaitSpinner()

    const frames = new Set<string>()
    frames.add(state.spinnerFrame) // initial '|'

    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(250)
      frames.add(state.spinnerFrame)
    }

    expect(frames).toEqual(new Set(['|', '/', '-', '\\']))
  })
})
