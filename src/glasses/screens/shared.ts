import type { AppState, Task } from '../../state'

/** G2 native list widget item cap. */
export const MAX_LIST_ITEMS = 20

/**
 * Returns today's local date as YYYY-MM-DD, matching the format tasks'
 * dueDate strings are compared against.
 */
function todayDateStr(): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString().split('T')[0]!
}

/**
 * Returns tasks whose due date is before today, oldest first (source order
 * preserved). Shown on the Overdue screen.
 */
export function getOverdueFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr()
  return state.todayTasks.filter((t) => t.dueDate && t.dueDate < todayStr)
}

/**
 * Returns tasks due today (not overdue). Shown on the Today screen.
 */
export function getTodayFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr()
  return state.todayTasks.filter((t) => t.dueDate === todayStr)
}

/**
 * Returns the flat list of inbox tasks (preserves state order).
 */
export function getInboxFlatTasks(state: AppState): Task[] {
  return state.inboxTasks
}
