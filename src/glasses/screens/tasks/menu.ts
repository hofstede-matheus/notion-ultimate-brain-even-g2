import type { AppState } from '../../../state'
import type { Screen as ScreenName } from '../../../state'
import type { Screen, GlassCtx, MenuDef } from '../../types'
import { makeMenuScreen } from '../shared'

const tasksMenuDef: MenuDef = {
  title: 'TASKS',
  parent: 'menu',
  items: [
    { label: 'Today', target: 'today' },
    { label: 'Inbox', target: 'inbox' },
    { label: 'Next 7 Days' },
    { label: 'Tomorrow' },
    { label: 'No Due' },
    { label: 'Recurring' },
    { label: 'Active Projects' },
    { label: 'All' },
    { label: 'Done' },
    { label: 'Overdue', target: 'overdue' },
    { label: 'Add Task (Voice)', target: 'add-task' },
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
    default:
      ctx.navigate(target)
  }
}

export const tasksMenuScreen: Screen<AppState, GlassCtx> = makeMenuScreen(
  tasksMenuDef,
  open,
)
