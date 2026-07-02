import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState, Task, Screen as ScreenName } from '../../state'
import type { Screen, GlassCtx, MenuDef } from '../types'
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

/**
 * Generic factory for any list-style menu screen — header + native list
 * widget, click dispatches to `item.target` (no-op when undefined). Pass
 * `clickRouter` to override the default `ctx.navigate(target)` for screens
 * whose targets need bespoke entry points (e.g. resetting a selected-index
 * before navigating).
 */
export function makeMenuScreen(
  def: MenuDef,
  clickRouter?: (target: ScreenName, ctx: GlassCtx) => void,
): Screen<AppState, GlassCtx> {
  const route = clickRouter ?? ((target, ctx) => ctx.navigate(target))
  return {
    display(_state) {
      return {
        mode: 'list',
        header: buildHeaderLine(def.title, ''),
        items: def.items.map((i) => i.label),
      }
    },

    action(action, nav, _state, ctx) {
      if (action.type === 'GO_BACK') {
        if (def.parent) ctx.navigate(def.parent)
        else ctx.shutdown()
        return nav
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        const idx = action.itemIndex
        if (typeof idx === 'number') {
          const item = def.items[idx]
          if (item?.target) route(item.target, ctx)
        }
        return nav
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
      return nav
    },
  }
}

/**
 * Placeholder screen for menu items not yet implemented. Renders a simple
 * "Coming soon" message; GO_BACK returns to `parent` (the owning group's
 * submenu). Not wired into the router until its item gets a real `target`.
 */
export function makeStubScreen(label: string, parent: ScreenName): Screen<AppState, GlassCtx> {
  return {
    display() {
      return {
        mode: 'text',
        content: [
          label.toUpperCase(),
          '',
          'Coming soon.',
          '',
          'Double-tap to go back.',
        ].join('\n'),
      }
    },

    action(action, nav, _state, ctx) {
      if (action.type === 'GO_BACK') ctx.navigate(parent)
      return nav
    },
  }
}
