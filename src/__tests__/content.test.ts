/**
 * Tests 15–17: Content formatting
 *
 * These tests drive content through the public renderer functions so they
 * remain decoupled from private implementation details.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { showToday, showInbox } from '../renderer'
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
// Helper: extract the content string from the last rebuildPageContainer call
// ---------------------------------------------------------------------------
function lastRebuildContent(): string {
  const calls = mockBridge.rebuildPageContainer.mock.calls
  const arg = calls.at(-1)![0] as any
  return arg.textObject[0].content as string
}

// ---------------------------------------------------------------------------
// Test 15 — overdue and today sections
// ---------------------------------------------------------------------------

describe('today screen content', () => {
  it('shows overdue and today tasks in separate labelled sections', async () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]!
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]!

    state.todayTasks = [
      { id: '1', name: 'Write report', dueDate: yesterdayStr },
      { id: '2', name: 'Team standup', dueDate: todayStr },
    ]
    state.loading = false

    await showToday()
    const content = lastRebuildContent()

    expect(content).toContain('OVERDUE (1):')
    expect(content).toContain('Write report')
    expect(content).toContain('TODAY (1):')
    expect(content).toContain('Team standup')
  })
})

// ---------------------------------------------------------------------------
// Test 16 — tasks without a due date
// ---------------------------------------------------------------------------

describe('today screen with undated tasks', () => {
  it('does not display tasks that have no due date', async () => {
    state.todayTasks = [
      { id: '1', name: 'Undated task' },          // no dueDate
      { id: '2', name: 'Dated task', dueDate: new Date().toISOString().split('T')[0]! },
    ]
    state.loading = false

    await showToday()
    const content = lastRebuildContent()

    expect(content).not.toContain('Undated task')
    expect(content).toContain('Dated task')
  })
})

// ---------------------------------------------------------------------------
// Test 17 — inbox task count
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
    const content = lastRebuildContent()

    expect(content).toContain('INBOX (3)')
  })
})

// ---------------------------------------------------------------------------
// Cursor rendering — Today screen
// ---------------------------------------------------------------------------

describe('today screen cursor', () => {
  it('highlights the first task by default and shows no cursor on non-selected tasks', async () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]!
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]!

    state.todayTasks = [
      { id: '1', name: 'Write report', dueDate: yesterdayStr },
      { id: '2', name: 'Team standup', dueDate: todayStr },
    ]
    state.loading = false
    state.todaySelectedIndex = 0

    await showToday()
    const content = lastRebuildContent()

    expect(content).toContain('> Write report')
    expect(content).toContain('  Team standup')
  })

  it('moves the cursor to the selected overdue task', async () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]!
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]!

    state.todayTasks = [
      { id: '1', name: 'Overdue one', dueDate: yesterdayStr },
      { id: '2', name: 'Overdue two', dueDate: yesterdayStr },
      { id: '3', name: 'Today one', dueDate: todayStr },
    ]
    state.loading = false
    state.todaySelectedIndex = 1   // second overdue

    await showToday()
    const content = lastRebuildContent()

    expect(content).toContain('  Overdue one')
    expect(content).toContain('> Overdue two')
    expect(content).toContain('  Today one')
  })

  it('moves the cursor into the today section after overdue items', async () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]!
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]!

    state.todayTasks = [
      { id: '1', name: 'Overdue one', dueDate: yesterdayStr },
      { id: '2', name: 'Today one', dueDate: todayStr },
    ]
    state.loading = false
    state.todaySelectedIndex = 1   // flat index 1 = first today task

    await showToday()
    const content = lastRebuildContent()

    expect(content).toContain('  Overdue one')
    expect(content).toContain('> Today one')
  })

  it('shows no cursor when the task list is empty', async () => {
    state.todayTasks = []
    state.loading = false
    state.todaySelectedIndex = 0

    await showToday()
    const content = lastRebuildContent()

    expect(content).not.toMatch(/^>/m)
    expect(content).toContain('No tasks due!')
  })
})

// ---------------------------------------------------------------------------
// Cursor rendering — Inbox screen
// ---------------------------------------------------------------------------

describe('inbox screen cursor', () => {
  it('highlights the first task by default', async () => {
    state.inboxTasks = [
      { id: '1', name: 'Task A' },
      { id: '2', name: 'Task B' },
      { id: '3', name: 'Task C' },
    ]
    state.loading = false
    state.inboxSelectedIndex = 0

    await showInbox()
    const content = lastRebuildContent()

    expect(content).toContain('> Task A')
    expect(content).toContain('  Task B')
    expect(content).toContain('  Task C')
  })

  it('moves the cursor to the selected index', async () => {
    state.inboxTasks = [
      { id: '1', name: 'Task A' },
      { id: '2', name: 'Task B' },
      { id: '3', name: 'Task C' },
    ]
    state.loading = false
    state.inboxSelectedIndex = 2

    await showInbox()
    const content = lastRebuildContent()

    expect(content).toContain('  Task A')
    expect(content).toContain('  Task B')
    expect(content).toContain('> Task C')
  })

  it('shows no cursor when the inbox is empty', async () => {
    state.inboxTasks = []
    state.loading = false
    state.inboxSelectedIndex = 0

    await showInbox()
    const content = lastRebuildContent()

    expect(content).not.toMatch(/^>/m)
    expect(content).toContain('Your inbox is empty!')
  })
})
