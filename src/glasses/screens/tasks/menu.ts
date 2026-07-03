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

/** Route a tasks-submenu target screen through the correct ctx entry point. */
function open(target: ScreenName, ctx: GlassCtx): void {
  switch (target) {
    case 'today':
      ctx.enterToday()
      break
    case 'inbox':
      ctx.enterInbox()
      break
    case 'overdue':
      ctx.enterOverdue()
      break
    case 'add-task':
      ctx.navigate(target)
      break
    default:
      ctx.enterView(target)
  }
}

export const tasksMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(
  tasksMenuDef,
  open,
)
