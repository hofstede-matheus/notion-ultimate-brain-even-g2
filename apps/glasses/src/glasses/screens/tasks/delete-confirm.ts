import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx, Screen } from '../../types'
import { truncateToByteLimit } from '../shared'
import { MAX_ITEM_BYTES } from '../../constants'

export const deleteConfirmScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    const p = state.pendingDelete
    const name = p ? truncateToByteLimit(p.taskName, MAX_ITEM_BYTES) : ''
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('DELETE TASK?', state.spinnerFrame)

    return {
      mode: 'list',
      header,
      items: [`Confirm: ${name}`, 'Cancel'],
    }
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.dismissDeleteConfirm()
      return
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (action.itemIndex === 0) void ctx.confirmDelete()
      else ctx.dismissDeleteConfirm()
      return
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
}
