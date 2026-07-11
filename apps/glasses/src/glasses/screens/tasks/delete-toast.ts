import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx, Screen } from '../../types'
import { truncateToByteLimit } from '../shared'

export const deleteToastScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    const t = state.deleteToast
    const name = t ? truncateToByteLimit(t.taskName) : ''
    return {
      mode: 'text',
      content: [
        buildHeaderLine('DELETED', ''),
        '',
        name ? `✓ ${name}` : '✓ Deleted',
        '',
        'Returning...',
      ].join('\n'),
    }
  },

  action(action, nav, _state, ctx) {
    // Allow immediate exit even before the 1.5s timer fires
    if (action.type === 'GO_BACK') ctx.dismissDeleteToastAndReturn()
    return nav
  },
}
