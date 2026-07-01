/**
 * Tests 1–5: Menu navigation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { onEvenHubEvent } from '../events'
import { MENU_ITEMS } from '../renderer'
import {
  makeMockBridge,
  resetState,
  flushPromises,
  clickEvent,
  scrollUpEvent,
  scrollDownEvent,
  doubleTapEvent,
} from './helpers'

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
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

let mockBridge: ReturnType<typeof makeMockBridge>

beforeEach(() => {
  mockBridge = makeMockBridge()
  setBridge(mockBridge as any)
  resetState()
  // Advance fake time to clear the 300 ms scroll throttle from any prior test
  vi.useFakeTimers()
  vi.advanceTimersByTime(1000)
  vi.useRealTimers()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Test 1
// ---------------------------------------------------------------------------

describe('returning to the menu', () => {
  it('keeps the previously selected item highlighted', async () => {
    // User had "Add Task (Voice)" (index 2) selected and navigated into it
    state.menuSelectedIndex = 2
    state.screen = 'add-task'

    onEvenHubEvent(doubleTapEvent())
    await flushPromises()

    // showMenu() should have been called and rebuilt the page
    expect(mockBridge.rebuildPageContainer).toHaveBeenCalled()
    const arg = mockBridge.rebuildPageContainer.mock.calls[0]![0] as any
    const content: string = arg.textObject[0].content

    expect(content).toContain('> Add Task (Voice)')
    expect(content).not.toMatch(/^> Today/m)
    expect(content).not.toMatch(/^> Inbox/m)
  })
})

// ---------------------------------------------------------------------------
// Test 2
// ---------------------------------------------------------------------------

describe('scrolling up at the first item', () => {
  it('does nothing — cursor stays at index 0', () => {
    state.menuSelectedIndex = 0
    state.screen = 'menu'

    onEvenHubEvent(scrollUpEvent())

    expect(state.menuSelectedIndex).toBe(0)
    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 3
// ---------------------------------------------------------------------------

describe('scrolling down at the last item', () => {
  it('does nothing — cursor stays at the final index', () => {
    state.menuSelectedIndex = MENU_ITEMS.length - 1
    state.screen = 'menu'

    onEvenHubEvent(scrollDownEvent())

    expect(state.menuSelectedIndex).toBe(MENU_ITEMS.length - 1)
    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 4
// ---------------------------------------------------------------------------

describe('clicking on the menu', () => {
  it('opens the item the cursor points at, not a hardcoded index', () => {
    // Place cursor on "Add Task (Voice)" (index 2) — not the first item
    state.menuSelectedIndex = 2
    state.screen = 'menu'

    onEvenHubEvent(clickEvent())

    // showAddTask sets screen synchronously before its first await
    expect(state.screen).toBe('add-task')
  })
})

// ---------------------------------------------------------------------------
// Test 5
// ---------------------------------------------------------------------------

describe('double-clicking on the menu', () => {
  it('exits the app by calling shutDownPageContainer', () => {
    state.screen = 'menu'

    onEvenHubEvent(doubleTapEvent())

    expect(mockBridge.shutDownPageContainer).toHaveBeenCalledWith(1)
  })
})

// ---------------------------------------------------------------------------
// Index reset when entering the today / inbox screens
// ---------------------------------------------------------------------------

describe('entering the today screen from the menu', () => {
  it('resets the today cursor to 0 even if it was non-zero before', async () => {
    state.menuSelectedIndex = 0
    state.screen = 'menu'
    state.todaySelectedIndex = 7

    onEvenHubEvent(clickEvent())
    await flushPromises()

    expect(state.todaySelectedIndex).toBe(0)
  })
})

describe('entering the inbox screen from the menu', () => {
  it('resets the inbox cursor to 0 even if it was non-zero before', async () => {
    state.menuSelectedIndex = 1
    state.screen = 'menu'
    state.inboxSelectedIndex = 4

    onEvenHubEvent(clickEvent())
    await flushPromises()

    expect(state.inboxSelectedIndex).toBe(0)
  })
})
