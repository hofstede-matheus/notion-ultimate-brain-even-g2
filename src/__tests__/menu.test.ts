/**
 * Tests 1–5: Menu navigation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { onEvenHubEvent } from '../glasses/runtime'
import { ROOT_MENU_ITEMS } from '../glasses/screens/menu'
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
// item was last selected. This test instead confirms the root list still
// renders all four category items, in order, regardless of what was
// selected before leaving.
// ---------------------------------------------------------------------------

describe('returning to the root menu', () => {
  it('renders the native list with all four category items, in order', async () => {
    state.menuSelectedIndex = 2
    state.screen = 'notes-menu'

    onEvenHubEvent(doubleTapEvent())
    await flushPromises()

    expect(mockBridge.rebuildPageContainer).toHaveBeenCalled()
    const arg = mockBridge.rebuildPageContainer.mock.calls[0]![0] as any
    const items: string[] = arg.listObject[0].itemContainer.itemName

    expect(items).toEqual(ROOT_MENU_ITEMS)
  })
})

// ---------------------------------------------------------------------------
// Test 2 / 3
//
// Scroll events are no-ops for the menu now — the native list widget owns
// scrolling/highlight entirely, so our code never re-renders in response to
// SCROLL_TOP/SCROLL_BOTTOM regardless of position.
// ---------------------------------------------------------------------------

describe('scrolling on the root menu', () => {
  it('scroll up never triggers a render — the native list owns scrolling', () => {
    state.menuSelectedIndex = 0
    state.screen = 'menu'

    onEvenHubEvent(scrollUpEvent())

    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
    expect(mockBridge.rebuildPageContainer).not.toHaveBeenCalled()
  })

  it('scroll down never triggers a render — the native list owns scrolling', () => {
    state.menuSelectedIndex = ROOT_MENU_ITEMS.length - 1
    state.screen = 'menu'

    onEvenHubEvent(scrollDownEvent())

    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
    expect(mockBridge.rebuildPageContainer).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 4
// ---------------------------------------------------------------------------

describe('clicking on the root menu', () => {
  it('opens the submenu indicated by the native list selection, not a hardcoded index', () => {
    state.screen = 'menu'

    // Firmware reports index 0 ("Tasks") was tapped
    onEvenHubEvent(listClickEvent(0))

    expect(state.screen).toBe('tasks-menu')
  })
})

// ---------------------------------------------------------------------------
// Test 5
// ---------------------------------------------------------------------------

describe('double-clicking on the root menu', () => {
  it('exits the app by calling shutDownPageContainer', () => {
    state.screen = 'menu'

    onEvenHubEvent(doubleTapEvent())

    expect(mockBridge.shutDownPageContainer).toHaveBeenCalledWith(1)
  })
})

// ---------------------------------------------------------------------------
// Tasks submenu
// ---------------------------------------------------------------------------

describe('double-clicking on the tasks submenu', () => {
  it('goes back to the root menu, not shutdown', () => {
    state.screen = 'tasks-menu'

    onEvenHubEvent(doubleTapEvent())

    expect(state.screen).toBe('menu')
    expect(mockBridge.shutDownPageContainer).not.toHaveBeenCalled()
  })
})

describe('clicking an unbuilt tasks submenu item', () => {
  it('is a no-op — stays on the tasks submenu', () => {
    state.screen = 'tasks-menu'

    // Index 3 = "Next 7 Days" — no screen exists yet
    onEvenHubEvent(listClickEvent(3))

    expect(state.screen).toBe('tasks-menu')
  })
})

// ---------------------------------------------------------------------------
// Index reset when entering the today / inbox / overdue screens from the
// tasks submenu
// ---------------------------------------------------------------------------

describe('entering the overdue screen from the tasks submenu', () => {
  it('resets the overdue cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'tasks-menu'
    state.overdueSelectedIndex = 5

    // Index 1 = "Overdue"
    onEvenHubEvent(listClickEvent(1))
    await flushPromises()

    expect(state.overdueSelectedIndex).toBe(0)
    expect(state.screen).toBe('overdue')
  })

  // Regression test: the firmware bridge omits currentSelectItemIndex from
  // the click payload entirely when it's 0 (proto3 JSON drops zero-valued
  // fields — the same quirk already handled for CLICK_EVENT's own eventType
  // of 0). Tapping "Today" (the first tasks-submenu item) must still open
  // the today screen even though itemIndex never actually arrives as 0.
  it('opens Today when the firmware omits currentSelectItemIndex for the first item', async () => {
    state.screen = 'tasks-menu'

    onEvenHubEvent(listClickEventFirstItemOmittedIndex())
    await flushPromises()

    expect(state.screen).toBe('today')
  })
})

describe('entering the today screen from the tasks submenu', () => {
  it('resets the today cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'tasks-menu'
    state.todaySelectedIndex = 7

    // Index 0 = "Today"
    onEvenHubEvent(listClickEvent(0))
    await flushPromises()

    expect(state.todaySelectedIndex).toBe(0)
  })
})

describe('entering the inbox screen from the tasks submenu', () => {
  it('resets the inbox cursor to 0 even if it was non-zero before', async () => {
    state.screen = 'tasks-menu'
    state.inboxSelectedIndex = 4

    // Index 2 = "Inbox"
    onEvenHubEvent(listClickEvent(2))
    await flushPromises()

    expect(state.inboxSelectedIndex).toBe(0)
  })
})

describe('entering the add-task screen from the tasks submenu', () => {
  it('opens add-task when the last item is tapped', () => {
    state.screen = 'tasks-menu'

    // Index 10 = "Add Task (Voice)"
    onEvenHubEvent(listClickEvent(10))

    expect(state.screen).toBe('add-task')
  })
})
