/**
 * Tests 1–5: Menu navigation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { onEvenHubEvent } from '../glasses/runtime'
import { MENU_ITEMS } from '../glasses/screens/menu'
import {
  makeMockBridge,
  resetState,
  flushPromises,
  listClickEvent,
  listClickEventFirstItemOmittedIndex,
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
//
// The native list widget owns its own highlight and always starts at item 0
// on render — there is no way to tell the firmware "start on item 2", so
// (unlike the old manual-cursor design) the menu no longer remembers which
// item was last selected. This test instead confirms the list still renders
// all three items, in order, regardless of what was selected before leaving.
// ---------------------------------------------------------------------------

describe('returning to the menu', () => {
  it('renders the native list with all three items, in order', async () => {
    state.menuSelectedIndex = 2
    state.screen = 'add-task'

    onEvenHubEvent(doubleTapEvent())
    await flushPromises()

    expect(mockBridge.rebuildPageContainer).toHaveBeenCalled()
    const arg = mockBridge.rebuildPageContainer.mock.calls[0]![0] as any
    const items: string[] = arg.listObject[0].itemContainer.itemName

    expect(items).toEqual(MENU_ITEMS)
  })
})

// ---------------------------------------------------------------------------
// Test 2 / 3
//
// Scroll events are no-ops for the menu now — the native list widget owns
// scrolling/highlight entirely, so our code never re-renders in response to
// SCROLL_TOP/SCROLL_BOTTOM regardless of position.
// ---------------------------------------------------------------------------

describe('scrolling on the menu', () => {
  it('scroll up never triggers a render — the native list owns scrolling', () => {
    state.menuSelectedIndex = 0
    state.screen = 'menu'

    onEvenHubEvent(scrollUpEvent())

    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
    expect(mockBridge.rebuildPageContainer).not.toHaveBeenCalled()
  })

  it('scroll down never triggers a render — the native list owns scrolling', () => {
    state.menuSelectedIndex = MENU_ITEMS.length - 1
    state.screen = 'menu'

    onEvenHubEvent(scrollDownEvent())

    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
    expect(mockBridge.rebuildPageContainer).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 4
// ---------------------------------------------------------------------------

describe('clicking on the menu', () => {
  it('opens the item indicated by the native list selection, not a hardcoded index', () => {
    state.screen = 'menu'

    // Firmware reports index 3 ("Add Task (Voice)") was tapped
    onEvenHubEvent(listClickEvent(3))

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

describe('entering the overdue screen from the menu', () => {
  it('resets the overdue cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'menu'
    state.overdueSelectedIndex = 5

    onEvenHubEvent(listClickEvent(0))
    await flushPromises()

    expect(state.overdueSelectedIndex).toBe(0)
  })

  // Regression test: the firmware bridge omits currentSelectItemIndex from
  // the click payload entirely when it's 0 (proto3 JSON drops zero-valued
  // fields — the same quirk already handled for CLICK_EVENT's own eventType
  // of 0). Tapping "Overdue" (the first menu item) must still open the
  // overdue screen even though itemIndex never actually arrives as 0.
  it('opens Overdue when the firmware omits currentSelectItemIndex for the first item', async () => {
    state.screen = 'menu'

    onEvenHubEvent(listClickEventFirstItemOmittedIndex())
    await flushPromises()

    expect(state.screen).toBe('overdue')
  })
})

describe('entering the today screen from the menu', () => {
  it('resets the today cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'menu'
    state.todaySelectedIndex = 7

    onEvenHubEvent(listClickEvent(1))
    await flushPromises()

    expect(state.todaySelectedIndex).toBe(0)
  })
})

describe('entering the inbox screen from the menu', () => {
  it('resets the inbox cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'menu'
    state.inboxSelectedIndex = 4

    onEvenHubEvent(listClickEvent(2))
    await flushPromises()

    expect(state.inboxSelectedIndex).toBe(0)
  })
})
