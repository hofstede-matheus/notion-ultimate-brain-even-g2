import { buildHeaderLine } from 'even-toolkit/text-utils'
import type { AppState } from '../../../state'
import type { GlassCtx, Screen } from '../../types'
import { formatDueDate } from '../shared'

export const taskMetadataScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    const header = buildHeaderLine('TASK DETAILS', state.spinnerFrame)
    const meta = state.taskMetadata

    const lines: string[] = [header, '']
    if (!meta || meta.loading) {
      lines.push('Loading…')
    } else if (meta.error) {
      lines.push(meta.error)
    } else {
      lines.push(`Project: ${meta.project ?? '(none)'}`)
      lines.push(`Due: ${formatDueDate(meta.due)}`)
    }
    lines.push('', 'Double-tap to go back.')

    return { mode: 'text', content: lines.join('\n') }
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner()
      ctx.navigate('task-actions')
      return
    }

    // SELECT_HIGHLIGHTED / HIGHLIGHT_MOVE: nothing to select on a text screen
  },
}
