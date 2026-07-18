import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx, Screen } from '../../types'
import { truncateToByteLimit } from '../shared'

export const markDoneToastScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    const t = state.markDoneToast
    const name = t ? truncateToByteLimit(t.taskName) : ''
    return {
      mode: 'text',
      content: [
        buildHeaderLine('DONE', ''),
        '',
        name ? `✓ ${name}` : '✓ Marked done',
        '',
        'Returning...',
      ].join('\n'),
    }
  },

  action(action, _state, ctx) {
    // Allow immediate exit even before the 1.5s timer fires
    if (action.type === 'GO_BACK') ctx.dismissToastAndReturn()
  },
}
