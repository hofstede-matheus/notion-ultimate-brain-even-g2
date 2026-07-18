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
import { fetchInboxNotes } from '../api'

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
  fetchNext7DaysTasks: vi.fn().mockResolvedValue([]),
  fetchTomorrowTasks: vi.fn().mockResolvedValue([]),
  fetchInboxNotes: vi.fn().mockResolvedValue([]),
  fetchFavoriteNotes: vi.fn().mockResolvedValue([]),
  fetchByTagNotes: vi.fn().mockResolvedValue([]),
  fetchNotes: vi.fn().mockResolvedValue([]),
  fetchMeetingNotes: vi.fn().mockResolvedValue([]),
  fetchByProjectNotes: vi.fn().mockResolvedValue([]),
  fetchClipsNotes: vi.fn().mockResolvedValue([]),
  fetchVoiceNotes: vi.fn().mockResolvedValue([]),
  fetchJournalNotes: vi.fn().mockResolvedValue([]),
  fetchAllNotes: vi.fn().mockResolvedValue([]),
  fetchActiveProjects: vi.fn().mockResolvedValue([]),
  fetchPlannedProjects: vi.fn().mockResolvedValue([]),
  fetchBoardProjects: vi.fn().mockResolvedValue([]),
  fetchArchivedProjects: vi.fn().mockResolvedValue([]),
  fetchRecentTags: vi.fn().mockResolvedValue([]),
  fetchFavoriteTags: vi.fn().mockResolvedValue([]),
  fetchAToZTags: vi.fn().mockResolvedValue([]),
  fetchTypeTags: vi.fn().mockResolvedValue([]),
  fetchTasksForProject: vi.fn().mockResolvedValue([]),
  fetchNotesForProject: vi.fn().mockResolvedValue([]),
}))

vi.mock('../cache', () => ({
  loadCachedList: vi.fn().mockResolvedValue(null),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
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
    state.screen = 'menu'

    onEvenHubEvent(scrollUpEvent())

    expect(mockBridge.textContainerUpgrade).not.toHaveBeenCalled()
    expect(mockBridge.rebuildPageContainer).not.toHaveBeenCalled()
  })

  it('scroll down never triggers a render — the native list owns scrolling', () => {
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


// ---------------------------------------------------------------------------
// Index reset when entering the today / inbox / overdue screens from the
// tasks submenu
// ---------------------------------------------------------------------------

describe('entering the overdue screen from the tasks submenu', () => {
  it('navigates to overdue', async () => {
    state.screen = 'tasks-menu'

    // Index 2 = "Overdue"
    onEvenHubEvent(listClickEvent(2))
    await flushPromises()

    expect(state.screen).toBe('overdue')
  })

  // Regression test: the firmware bridge omits currentSelectItemIndex from
  // the click payload entirely when it's 0 (proto3 JSON drops zero-valued
  // fields — the same quirk already handled for CLICK_EVENT's own eventType
  // of 0). Tapping "Add Task (Voice)" (the first tasks-submenu item) must
  // still open the add-task screen even though itemIndex never actually
  // arrives as 0.
  it('opens Add Task when the firmware omits currentSelectItemIndex for the first item', async () => {
    state.screen = 'tasks-menu'

    onEvenHubEvent(listClickEventFirstItemOmittedIndex())
    await flushPromises()

    expect(state.screen).toBe('add-task')
  })
})

describe('entering the today screen from the tasks submenu', () => {
  it('navigates to today', async () => {
    state.screen = 'tasks-menu'

    // Index 1 = "Today"
    onEvenHubEvent(listClickEvent(1))
    await flushPromises()

    expect(state.screen).toBe('today')
  })
})

describe('entering the inbox screen from the tasks submenu', () => {
  it('navigates to inbox', async () => {
    state.screen = 'tasks-menu'

    // Index 3 = "Inbox"
    onEvenHubEvent(listClickEvent(3))
    await flushPromises()

    expect(state.screen).toBe('inbox')
  })
})

describe('entering the add-task screen from the tasks submenu', () => {
  it('opens add-task when the first item is tapped', () => {
    state.screen = 'tasks-menu'

    // Index 0 = "Add Task (Voice)"
    onEvenHubEvent(listClickEvent(0))

    expect(state.screen).toBe('add-task')
  })
})

// ---------------------------------------------------------------------------
// Generic list-view wiring (ctx.enterView) — covers every Tasks/Notes/
// Projects/Tags screen beyond Today/Inbox/Overdue, which share one fetch/
// cache pipeline keyed off VIEW_FETCHERS in context.ts.
// ---------------------------------------------------------------------------

describe('entering a generic notes view (Inbox) from the notes submenu', () => {
  it('navigates to the notes-inbox screen and loads via the registered fetcher', async () => {
    vi.mocked(fetchInboxNotes).mockResolvedValueOnce([{ id: 'n1', name: 'Note one' }])
    state.screen = 'notes-menu'

    // Index 0 = "Inbox"
    onEvenHubEvent(listClickEvent(0))
    await flushPromises()

    expect(state.screen).toBe('notes-inbox')
    expect(fetchInboxNotes).toHaveBeenCalled()
    expect(state.lists['notes-inbox']).toEqual([{ id: 'n1', name: 'Note one' }])
  })
})
