import type { AppState } from '../../../state'
import type { Screen as ScreenName } from '../../../state'
import type { Screen, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const tasksMenuDef: MenuDef = {
  title: 'TASKS',
  parent: 'menu',
  items: [
    { label: 'Add Task (Voice)', target: 'add-task' },
    { label: 'Today', target: 'today' },
    { label: 'Overdue', target: 'overdue' },
    { label: 'Inbox', target: 'inbox' },
    { label: 'Next 7 Days', target: 'tasks-next-7-days' },
    { label: 'Tomorrow', target: 'tasks-tomorrow' },
  ],
}

/**
 * Route a tasks-submenu target screen through the correct ctx entry point.
 * Add Task has no fetcher (VIEW_FETCHERS has no entry for it), so it needs a
 * plain navigate; every other target — including Today/Overdue/Inbox — goes
 * through the generic cache-then-fetch pipeline.
 */
function open(target: ScreenName, ctx: GlassCtx): void {
  if (target === 'add-task') ctx.navigate(target)
  else ctx.enterView(target)
}

export const tasksMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(
  tasksMenuDef,
  open,
)
