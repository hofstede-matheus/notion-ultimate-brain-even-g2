import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../state'
import type { GlassCtx } from '../context'
import type { Screen } from '../types'

export const MENU_ITEMS = [
  'Overdue',
  'Today\'s Tasks',
  'Inbox',
  'Add Task (Voice)',
]

export const menuScreen: Screen<AppState, GlassCtx> = {
  display(_state) {
    return {
      mode: 'list',
      header: buildHeaderLine('MENU', ''),
      items: MENU_ITEMS,
    }
  },

  action(action, nav, state, ctx) {
    if (action.type === 'GO_BACK') {
      // Root page: MUST call shutDownPageContainer(1)
      ctx.shutdown()
      return nav
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      const idx = action.itemIndex
      if (typeof idx === 'number') state.menuSelectedIndex = idx
      if (idx === 0) ctx.enterOverdue()
      else if (idx === 1) ctx.enterToday()
      else if (idx === 2) ctx.enterInbox()
      else if (idx === 3) ctx.navigate('add-task')
      return nav
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    return nav
  },
}
