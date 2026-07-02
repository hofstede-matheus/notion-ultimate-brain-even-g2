import type { AppState, Task } from '../../state'
import { MAX_ITEM_BYTES } from '../constants'

export { MAX_LIST_ITEMS } from '../constants'

const byteEncoder = new TextEncoder()

/** Truncates `text` to fit within `maxBytes` UTF-8 bytes, appending an ellipsis if cut. */
export function truncateToByteLimit(text: string, maxBytes: number = MAX_ITEM_BYTES): string {
  if (byteEncoder.encode(text).length <= maxBytes) return text

  const ellipsis = '…'
  const budget = maxBytes - byteEncoder.encode(ellipsis).length
  let result = ''
  let bytes = 0
  for (const ch of text) {
    const chBytes = byteEncoder.encode(ch).length
    if (bytes + chBytes > budget) break
    result += ch
    bytes += chBytes
  }
  return result + ellipsis
}

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
