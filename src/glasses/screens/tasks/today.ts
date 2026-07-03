import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx } from '../../types'
import type { Screen, ScreenDisplay } from '../../types'
import { MAX_LIST_ITEMS, getTodayFlatTasks, truncateToByteLimit } from '../shared'

function todayDisplay(state: AppState): ScreenDisplay {
  // First load — no cache available yet
  if (state.loading) {
    return {
      mode: 'text',
      content: [
        buildHeaderLine('TODAY\'S TASKS', state.spinnerFrame),
        '',
        'Fetching tasks...',
      ].join('\n'),
    }
  }

  const tasks = getTodayFlatTasks(state)
  if (tasks.length === 0) {
    return {
      mode: 'text',
      content: [
        buildHeaderLine('TODAY\'S TASKS', state.spinnerFrame),
        '',
        'No tasks due today! You\'re all clear.',
        '',
        'Double-tap to go back.',
      ].join('\n'),
    }
  }

  const header = buildHeaderLine('TODAY\'S TASKS', state.spinnerFrame)
  const items = tasks.slice(0, MAX_LIST_ITEMS).map((t) => truncateToByteLimit(t.name))

  return { mode: 'list', header, items }
}

export const todayScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    return todayDisplay(state)
  },

  action(action, nav, state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner()
      state.todaySelectedIndex = 0
      ctx.navigate('tasks-menu')
      return nav
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (typeof action.itemIndex === 'number') {
        state.todaySelectedIndex = action.itemIndex
        const task = getTodayFlatTasks(state)[action.itemIndex]
        if (task) ctx.openMarkDoneConfirm(task.id, task.name, 'today')
      }
      return nav
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    return nav
  },
}
