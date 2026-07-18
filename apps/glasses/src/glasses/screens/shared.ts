import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState, Task, ListItem, ScreenName } from '../../state'
import type { ScreenModule, GlassCtx, MenuDef } from '../types'
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
 *
 * Built from local calendar components on purpose — `toISOString()` would
 * serialize as UTC and roll back to the previous day for users ahead of UTC,
 * misclassifying yesterday's tasks as today (and dropping them from Overdue).
 */
function todayDateStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Today and Overdue are both filtered views over the one array fetched from
 * /api/tasks/today (due today or before) — stored under the 'today' key
 * (see context.ts's DATA_KEY_OVERRIDES).
 */
function todayFetchedTasks(state: AppState): Task[] {
  return (state.lists['today'] ?? []) as Task[]
}

/**
 * Returns tasks whose due date is before today, oldest first (source order
 * preserved). Shown on the Overdue screen.
 */
export function getOverdueFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr()
  return todayFetchedTasks(state).filter((t) => t.dueDate && t.dueDate < todayStr)
}

/**
 * Returns tasks due today (not overdue). Shown on the Today screen.
 */
export function getTodayFlatTasks(state: AppState): Task[] {
  const todayStr = todayDateStr()
  return todayFetchedTasks(state).filter((t) => t.dueDate === todayStr)
}

/**
 * Formats a task's due date (YYYY-MM-DD) as friendly text, e.g. "Jul 4, 2026".
 * Missing/empty dates render as "(none)".
 */
export function formatDueDate(iso: string | null): string {
  if (!iso) return '(none)'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
): ScreenModule {
  const route = clickRouter ?? ((target, ctx) => ctx.navigate(target))
  return {
    display(_state) {
      return {
        mode: 'list',
        header: buildHeaderLine(def.title, ''),
        items: def.items.map((i) => i.label),
      }
    },

    action(action, _state, ctx) {
      if (action.type === 'GO_BACK') {
        if (def.parent) ctx.navigate(def.parent)
        else ctx.shutdown()
        return
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        const idx = action.itemIndex
        if (typeof idx === 'number') {
          const item = def.items[idx]
          if (item?.target) route(item.target, ctx)
        }
        return
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    },
  }
}

/**
 * Placeholder screen for menu items not yet implemented. Renders a simple
 * "Coming soon" message; GO_BACK returns to `parent` (the owning group's
 * submenu). Not wired into the router until its item gets a real `target`.
 */
export function makeStubScreen(label: string, parent: ScreenName): ScreenModule {
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

    action(action, _state, ctx) {
      if (action.type === 'GO_BACK') ctx.navigate(parent)
    },
  }
}

/** Returns the flat list of items cached for a generic list-view screen. */
export function getListItems(state: AppState, screen: ScreenName): ListItem[] {
  return state.lists[screen] ?? []
}

/**
 * Screens whose list items are Project records. Used to route
 * SELECT_HIGHLIGHTED to openProjectDetail() — can't duck-type this off an
 * item field since Task now also carries an optional `status` (for the
 * project-tasks `[ ]`/`[v]` prefix), so a due-date-less Task and a Project
 * would otherwise be indistinguishable by shape alone.
 */
const PROJECT_LIST_SCREENS: ScreenName[] = ['projects-active', 'projects-planned', 'projects-board', 'projects-archived']

export interface ListScreenConfig {
  /** This screen's own name — used to key state.lists (unless `selectItems` is given). */
  screen: ScreenName
  /** Screen to return to on GO_BACK (the owning domain's submenu). */
  parent: ScreenName
  /** Header title, e.g. "NEXT 7 DAYS". Can depend on state (e.g. the selected project's name). */
  title: string | ((state: AppState) => string)
  /** Shown (alongside "Double-tap to go back.") when the list is empty. */
  emptyMessage?: string
  /** Shown while state.loading. Defaults to 'Fetching…'. */
  loadingMessage?: string
  /** Whether the list-mode header appends "(count)". Defaults to true. */
  countInHeader?: boolean
  /** Formats a single item's label. Defaults to `item.name`. */
  formatLabel?: (item: ListItem) => string
  /**
   * Overrides the item source for both display and selection — used by
   * Today/Overdue, which are filtered views over the array fetched under a
   * different screen key (see context.ts's DATA_KEY_OVERRIDES). Defaults to
   * `state.lists[config.screen]`.
   */
  selectItems?: (state: AppState) => ListItem[]
  /**
   * Explicit item kind for SELECT_HIGHLIGHTED dispatch, bypassing the
   * dueDate/PROJECT_LIST_SCREENS heuristics below — used by Today/Overdue/
   * Inbox, whose items are always Tasks by construction.
   */
  onSelect?: 'task' | 'project'
}

/**
 * Generic factory for a fetched-list screen (every Tasks/Notes/Projects/Tags
 * view, including Today/Overdue/Inbox). Renders a loading placeholder while
 * state.loading, an empty-state message when the list is empty, otherwise a
 * header + native list of item names. Reads from `config.selectItems(state)`
 * if given, else `state.lists[config.screen]` — both populated by
 * ctx.enterView() in context.ts. SELECT_HIGHLIGHTED just records the
 * cursor — there's no detail screen yet (except the task-actions/
 * project-detail dispatch below).
 */
export function makeListScreen(config: ListScreenConfig): ScreenModule {
  const emptyMessage = config.emptyMessage ?? 'No items.'
  const loadingMessage = config.loadingMessage ?? 'Fetching…'
  const countInHeader = config.countInHeader ?? true
  const formatLabel = config.formatLabel ?? ((item: ListItem) => item.name)
  const selectItems = config.selectItems ?? ((state: AppState) => getListItems(state, config.screen))

  return {
    display(state) {
      const title = typeof config.title === 'function' ? config.title(state) : config.title

      if (state.loading) {
        return {
          mode: 'text',
          content: [buildHeaderLine(title, state.spinnerFrame), '', loadingMessage].join('\n'),
        }
      }

      const items = selectItems(state)
      if (items.length === 0) {
        return {
          mode: 'text',
          content: [
            buildHeaderLine(title, state.spinnerFrame),
            '',
            emptyMessage,
            '',
            'Double-tap to go back.',
          ].join('\n'),
        }
      }

      const headerTitle = countInHeader ? `${title} (${items.length})` : title
      const header = buildHeaderLine(headerTitle, state.spinnerFrame)
      const listItems = items.slice(0, MAX_LIST_ITEMS).map((i) => truncateToByteLimit(formatLabel(i)))
      return { mode: 'list', header, items: listItems }
    },

    action(action, state, ctx) {
      if (action.type === 'GO_BACK') {
        ctx.stopSpinner()
        ctx.navigate(config.parent)
        return
      }

      if (action.type === 'SELECT_HIGHLIGHTED') {
        if (typeof action.itemIndex === 'number') {
          const item = selectItems(state)[action.itemIndex]
          if (item) {
            // Only Task records carry a dueDate — guards against triggering
            // the action menu on the Notes/Projects/Tags screens sharing this factory.
            const kind =
              config.onSelect ??
              ('dueDate' in item ? 'task' : PROJECT_LIST_SCREENS.includes(config.screen) ? 'project' : undefined)
            if (kind === 'task') ctx.openTaskActions(item.id, item.name, config.screen)
            else if (kind === 'project') ctx.openProjectDetail(item.id, item.name, config.screen)
          }
        }
        return
      }

      // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    },
  }
}
