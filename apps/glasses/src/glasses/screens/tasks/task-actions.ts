import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { ScreenModule } from '../../types'
import { truncateToByteLimit } from '../shared'
import { MAX_ITEM_BYTES } from '../../constants'

const ACTIONS = ['Load metadata', 'Mark as done', 'Delete task']

export const taskActionsScreen: ScreenModule = {
  display(state) {
    const selected = state.selectedTask
    const name = selected ? truncateToByteLimit(selected.taskName, MAX_ITEM_BYTES) : ''
    return {
      mode: 'list',
      header: buildHeaderLine(name, ''),
      items: ACTIONS,
    }
  },

  action(action, state, ctx) {
    const selected = state.selectedTask

    if (action.type === 'GO_BACK') {
      ctx.navigate(selected?.returnTo ?? 'tasks-menu')
      return
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (typeof action.itemIndex === 'number' && selected) {
        if (action.itemIndex === 0) ctx.enterTaskMetadata()
        else if (action.itemIndex === 1) ctx.openConfirm('markDone', selected.taskId, selected.taskName, selected.returnTo)
        else if (action.itemIndex === 2) ctx.openConfirm('delete', selected.taskId, selected.taskName, selected.returnTo)
      }
      return
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
}
