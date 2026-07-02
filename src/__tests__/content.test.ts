/**
 * Tests 15–17: Content formatting
 *
 * These tests drive content through the public renderer functions so they
 * remain decoupled from private implementation details.
 *
 * Overdue / Today / Inbox render two containers once they have >=1 task: a
 * header text container (containerID: 1) and a native list container
 * (containerID: 2) with firmware-owned selection/scroll. Loading and empty
 * states fall back to a single text container (lists need >=1 item). Tests
 * assert on header text + list item names.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { showOverdue, showToday, showInbox } from '../glasses/render'
import { makeMockBridge, resetState } from './helpers'

let mockBridge: ReturnType<typeof makeMockBridge>

beforeEach(() => {
  mockBridge = makeMockBridge()
  setBridge(mockBridge as any)
  resetState()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers: extract container contents from the last rebuildPageContainer call
// ---------------------------------------------------------------------------

interface RebuildConfig {
  containerTotalNum?: number
  textObject?: Array<{ containerID: number; content?: string }>
  listObject?: Array<{
    itemContainer?: { itemName?: string[]; itemCount?: number }
  }>
}

function lastRebuildConfig(): RebuildConfig {
  const calls = mockBridge.rebuildPageContainer.mock.calls
  return calls.at(-1)![0] as unknown as RebuildConfig
}

function headerText(): string {
  return lastRebuildConfig().textObject?.[0]?.content ?? ''
}

function listItemNames(): string[] {
  return lastRebuildConfig().listObject?.[0]?.itemContainer?.itemName ?? []
}

/**
 * "Today" as the app computes it (local-midnight, then UTC date string via
 * toISOString) — NOT a plain `new Date().toISOString()`, which drifts by a
 * day whenever the test runs while local time and UTC are on different
 * calendar dates. Fixture dates must be generated the same way the app
 * classifies them, or the overdue/today split becomes wall-clock-dependent.
 */
function localDateStr(d: Date): string {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().split('T')[0]!
}

// ---------------------------------------------------------------------------
// Test 15 — overdue screen shows only overdue tasks, with a count in the header
// ---------------------------------------------------------------------------

describe('overdue screen content', () => {
  it('shows only overdue tasks, with the overdue count in the header', async () => {
    const todayStr = localDateStr(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = localDateStr(yesterday)

    state.todayTasks = [
      { id: '1', name: 'Write report', dueDate: yesterdayStr },
      { id: '2', name: 'Team standup', dueDate: todayStr },
    ]
    state.loading = false

    await showOverdue()

    const items = listItemNames()
    expect(items).toEqual(['Write report'])

    const header = headerText()
    expect(header).toContain('OVERDUE (1)')
  })

  it('renders the empty state as a single text container (no list) when nothing is overdue', async () => {
    const todayStr = localDateStr(new Date())
    state.todayTasks = [{ id: '1', name: 'Team standup', dueDate: todayStr }]
    state.loading = false
    state.overdueSelectedIndex = 0

    await showOverdue()

    const cfg = lastRebuildConfig()
    expect(cfg.listObject ?? []).toEqual([])
    expect(headerText()).toContain('Nothing overdue!')
  })
})

// ---------------------------------------------------------------------------
// Test 16 — tasks without a due date
// ---------------------------------------------------------------------------

describe('today screen with undated tasks', () => {
  it('does not display tasks that have no due date', async () => {
    state.todayTasks = [
      { id: '1', name: 'Undated task' },          // no dueDate
      { id: '2', name: 'Dated task', dueDate: localDateStr(new Date()) },
    ]
    state.loading = false

    await showToday()

    const items = listItemNames()
    expect(items).not.toContain('Undated task')
    expect(items).toContain('Dated task')
  })
})

// ---------------------------------------------------------------------------
// Test 17 — inbox task count (in header)
// ---------------------------------------------------------------------------

describe('inbox screen content', () => {
  it('reflects the correct number of tasks in the header', async () => {
    state.inboxTasks = [
      { id: '1', name: 'Task A' },
      { id: '2', name: 'Task B' },
      { id: '3', name: 'Task C' },
    ]
    state.loading = false

    await showInbox()

    expect(headerText()).toContain('INBOX (3)')
  })
})

// ---------------------------------------------------------------------------
// Selection — Today screen
//
// The native list widget owns its own highlight (isItemSelectBorderEn=1).
// These tests confirm list items appear in the correct order; the firmware
// is responsible for moving the highlight.
// ---------------------------------------------------------------------------

describe('today screen list', () => {
  it('lists only tasks due today (overdue tasks belong on the Overdue screen)', async () => {
    const todayStr = localDateStr(new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = localDateStr(yesterday)

    state.todayTasks = [
      { id: '1', name: 'Write report', dueDate: yesterdayStr },
      { id: '2', name: 'Team standup', dueDate: todayStr },
    ]
    state.loading = false

    await showToday()

    const items = listItemNames()
    expect(items).toEqual(['Team standup'])
  })

  it('renders the empty state as a single text container (no list) when there are no tasks due today', async () => {
    state.todayTasks = []
    state.loading = false
    state.todaySelectedIndex = 0

    await showToday()

    const cfg = lastRebuildConfig()
    expect(cfg.listObject ?? []).toEqual([])
    expect(headerText()).toContain('No tasks due today!')
  })
})

// ---------------------------------------------------------------------------
// Selection — Overdue screen
// ---------------------------------------------------------------------------

describe('overdue screen list', () => {
  it('lists multiple overdue items in order, as plain names', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = localDateStr(yesterday)

    state.todayTasks = [
      { id: '1', name: 'Overdue one', dueDate: yesterdayStr },
      { id: '2', name: 'Overdue two', dueDate: yesterdayStr },
    ]
    state.loading = false

    await showOverdue()

    expect(listItemNames()).toEqual(['Overdue one', 'Overdue two'])
  })
})

// ---------------------------------------------------------------------------
// Selection — Inbox screen
// ---------------------------------------------------------------------------

describe('inbox screen list', () => {
  it('lists all tasks as plain names (no overdue markers)', async () => {
    state.inboxTasks = [
      { id: '1', name: 'Task A' },
      { id: '2', name: 'Task B' },
      { id: '3', name: 'Task C' },
    ]
    state.loading = false

    await showInbox()

    expect(listItemNames()).toEqual(['Task A', 'Task B', 'Task C'])
  })

  it('renders the empty state as a single text container (no list) when inbox is empty', async () => {
    state.inboxTasks = []
    state.loading = false
    state.inboxSelectedIndex = 0

    await showInbox()

    const cfg = lastRebuildConfig()
    expect(cfg.listObject ?? []).toEqual([])
    expect(headerText()).toContain('Your inbox is empty!')
  })
})
