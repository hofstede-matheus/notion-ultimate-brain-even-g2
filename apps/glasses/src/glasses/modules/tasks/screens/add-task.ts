import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState } from '../../../../state';
import type { ScreenModule } from '../../../types';

/**
 * Copy for when there is no usable speech backend yet. Every fix lives on the
 * phone, so each line points there rather than inviting a tap that can't work.
 * Returns null once voice is ready, handing over to the recording states.
 */
function unavailableContent(state: AppState): string | null {
  switch (state.voice) {
    case 'ready':
      return null;

    case 'preparing':
      return ['ADD TASK', '', 'Voice model loading...', '', 'Double-tap to go back.'].join('\n');

    case 'needs-download':
      return [
        'ADD TASK',
        '',
        'Voice input needs a',
        'one-time download.',
        '',
        'Open Settings on your',
        'phone to download it.',
        '',
        'Double-tap to go back.',
      ].join('\n');

    case 'needs-key':
      return [
        'ADD TASK',
        '',
        'Cloud voice input needs',
        'a Soniox API key.',
        '',
        'Add it in Settings on',
        'your phone.',
        '',
        'Double-tap to go back.',
      ].join('\n');

    default:
      // 'off' and 'unknown' — nothing chosen yet, or boot hasn't resolved it.
      return [
        'ADD TASK',
        '',
        'Voice input is off.',
        '',
        'Choose a voice mode in',
        'Settings on your phone.',
        '',
        'Double-tap to go back.',
      ].join('\n');
  }
}

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
      ].join('\n');

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
      ].join('\n');

    case 'processing':
      return ['ADD TASK', '', 'Processing audio...', 'Please wait.'].join('\n');

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
      ].join('\n');

    case 'confirming':
      return [
        buildHeaderLine('ADD TASK', state.spinnerFrame),
        '',
        'Saving task...',
        'Please wait.',
      ].join('\n');

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
      ].join('\n');

    case 'error':
      return [
        'ADD TASK',
        '',
        'Error:',
        state.errorMessage || 'Something went wrong.',
        '',
        'Tap to try again.',
        'Double-tap to go back.',
      ].join('\n');
  }
}

export const addTaskScreen: ScreenModule = {
  display(state) {
    return { mode: 'text', content: unavailableContent(state) ?? addTaskContent(state) };
  },

  action(action, state, ctx) {
    if (action.type === 'GO_BACK') {
      if (state.recording === 'confirm') {
        ctx.discardAddTask();
      } else {
        // Stop any active recording before going back
        ctx.cancelRecordingAndGoBack();
      }
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      // Nothing to start without a backend — the screen already says what to
      // do about it, and it can only be done on the phone.
      if (state.voice !== 'ready') return;
      if (state.recording === 'confirm') {
        void ctx.confirmAddTask();
      } else {
        ctx.startRecording();
      }
    }

    // HIGHLIGHT_MOVE: no scrollable content on this screen — intentionally no-op
  },
};
