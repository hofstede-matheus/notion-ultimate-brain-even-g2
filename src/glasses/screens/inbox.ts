import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../state'
import type { GlassCtx } from '../context'
import type { Screen, ScreenDisplay } from '../types'
import { MAX_LIST_ITEMS, getInboxFlatTasks, truncateToByteLimit } from './shared'

function inboxDisplay(state: AppState): ScreenDisplay {
  // First load — no cache available yet
  if (state.loading) {
    return {
      mode: 'text',
      content: [buildHeaderLine('INBOX', state.spinnerFrame), '', 'Fetching tasks...'].join('\n'),
    }
  }

  const tasks = getInboxFlatTasks(state)
  if (tasks.length === 0) {
    return {
      mode: 'text',
      content: [
        buildHeaderLine('INBOX', state.spinnerFrame),
        '',
        'Your inbox is empty!',
        '',
        'Double-tap to go back.',
      ].join('\n'),
    }
  }

  const header = buildHeaderLine(`INBOX (${tasks.length})`, state.spinnerFrame)
  const items = tasks.slice(0, MAX_LIST_ITEMS).map((t) => truncateToByteLimit(t.name))

  return { mode: 'list', header, items }
}

export const inboxScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    return inboxDisplay(state)
  },

  action(action, nav, state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner()
      state.inboxSelectedIndex = 0
      ctx.navigate('tasks-menu')
      return nav
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      // No task-detail screen exists yet — record the selection for later use.
      if (typeof action.itemIndex === 'number') {
        state.inboxSelectedIndex = action.itemIndex
      }
      return nav
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    return nav
  },
}
