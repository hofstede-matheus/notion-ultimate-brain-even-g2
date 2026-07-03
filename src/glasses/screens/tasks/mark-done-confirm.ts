import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx, Screen } from '../../types'
import { truncateToByteLimit } from '../shared'
import { MAX_ITEM_BYTES } from '../../constants'

export const markDoneConfirmScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    const p = state.pendingMarkDone
    const name = p ? truncateToByteLimit(p.taskName, MAX_ITEM_BYTES) : ''
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('MARK AS DONE?', state.spinnerFrame)

    return {
      mode: 'list',
      header,
      items: [`Confirm: ${name}`, 'Cancel'],
    }
  },

  action(action, nav, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.dismissMarkDoneConfirm()
      return nav
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (action.itemIndex === 0) void ctx.confirmMarkDone()
      else ctx.dismissMarkDoneConfirm()
      return nav
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
    return nav
  },
}
