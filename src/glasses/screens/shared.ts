import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState, Task, ListItem, Screen as ScreenName } from '../../state'
import type { Screen, GlassCtx, MenuDef } from '../types'
import { MAX_ITEM_BYTES, MAX_LIST_ITEMS } from '../constants'

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

/** Returns the flat list of items cached for a generic list-view screen. */
export function getListItems(state: AppState, screen: ScreenName): ListItem[] {
  return state.lists[screen] ?? []
}

export interface ListScreenConfig {
  /** This screen's own name — used to key state.lists / state.selectedIndex. */
  screen: ScreenName
  /** Screen to return to on GO_BACK (the owning domain's submenu). */
  parent: ScreenName
  /** Header title, e.g. "NEXT 7 DAYS". */
  title: string
  /** Shown (alongside "Double-tap to go back.") when the list is empty. */
  emptyMessage?: string
}

/**
 * Generic factory for a fetched-list screen (Tasks/Notes/Projects/Tags views
 * beyond Today/Inbox/Overdue, which have bespoke display copy). Renders a
 * "Fetching…" placeholder while state.loading, an empty-state message when
 * the list is empty, otherwise a header + native list of item names. Reads
 * from state.lists[config.screen], populated by ctx.enterView() in
 * context.ts. SELECT_HIGHLIGHTED just records the cursor — there's no
 * detail screen yet.
 */
export function makeListScreen(config: ListScreenConfig): Screen<AppState, GlassCtx> {
  const emptyMessage = config.emptyMessage ?? 'No items.'

  return {
    display(state) {
      if (state.loading) {
        return {
          mode: 'text',
          content: [buildHeaderLine(config.title, state.spinnerFrame), '', 'Fetching…'].join('\n'),
        }
      }

      const items = getListItems(state, config.screen)
      if (items.length === 0) {
        return {
          mode: 'text',
          content: [
            buildHeaderLine(config.title, state.spinnerFrame),
            '',
            emptyMessage,
            '',
            'Double-tap to go back.',
          ].join('\n'),
        }
      }

      const header = buildHeaderLine(`${config.title} (${items.length})`, state.spinnerFrame)
      const listItems = items.slice(0, MAX_LIST_ITEMS).map((i) => truncateToByteLimit(i.name))
      return { mode: 'list', header, items: listItems }
    },

    action(action, nav, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner()
        state.selectedIndex[config.screen] = 0
        ctx.navigate(config.parent)
        return nav
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        // No detail screen exists yet — record the selection for later use.
        if (typeof action.itemIndex === 'number') {
          state.selectedIndex[config.screen] = action.itemIndex
        }
        return nav
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
      return nav
    },
  }
}
