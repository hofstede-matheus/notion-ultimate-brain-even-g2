import type { AppState } from '../../../state'
import type { GlassCtx } from '../../types'
import type { Screen } from '../../types'

function addTaskContent(state: AppState): string {
  switch (state.recording) {
    case 'idle':
      return [
        'ADD TASK',
        '',
        'Tap to start recording.',
        '',
        'Speak your task — stops',
        'automatically on silence.',
        '',
        'Double-tap to go back.',
      ].join('\n')

    case 'recording':
      return [
        'ADD TASK',
        '',
        '>>> RECORDING <<<',
        '',
        'Speak your task now...',
        '',
        'Stops on silence.',
        'Tap to stop early.',
      ].join('\n')

    case 'processing':
      return [
        'ADD TASK',
        '',
        'Processing audio...',
        'Please wait.',
      ].join('\n')

    case 'confirm':
      return [
        'ADD TASK',
        '',
        'Confirm task:',
        `"${state.pendingTranscript}"`,
        '',
        'Tap to confirm.',
        'Double-tap to discard',
        '& re-record.',
      ].join('\n')

    case 'done':
      return [
        'ADD TASK',
        '',
        'Task created!',
        '',
        `"${state.createdTaskName}"`,
        '',
        'Tap to add another.',
        'Double-tap to go back.',
      ].join('\n')

    case 'error':
      return [
        'ADD TASK',
        '',
        'Error:',
        state.errorMessage || 'Something went wrong.',
        '',
        'Tap to try again.',
        'Double-tap to go back.',
      ].join('\n')
  }
}

export const addTaskScreen: Screen<AppState, GlassCtx> = {
  display(state) {
    return { mode: 'text', content: addTaskContent(state) }
  },

  action(action, nav, state, ctx) {
    if (action.type === 'GO_BACK') {
      if (state.recording === 'confirm') {
        ctx.discardAddTask()
      } else {
        // Stop any active recording before going back
        ctx.cancelRecordingAndGoBack()
      }
      return nav
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (state.recording === 'confirm') {
        void ctx.confirmAddTask()
      } else {
        ctx.startRecording()
      }
    }

    // HIGHLIGHT_MOVE: no scrollable content on this screen — intentionally no-op

    return nav
  },
}
