import { pxTruncate } from 'even-toolkit/pretext';
import { buildHeaderLine } from 'even-toolkit/text-utils';
import { CONTAINER_PADDING, SCREEN_W } from '../../../constants';
import type { ScreenModule } from '../../../types';
import { formatDueDate } from '../helpers';

const TEXT_INNER_W = SCREEN_W - 2 * CONTAINER_PADDING;

export const taskDetailsScreen: ScreenModule = {
  display(state) {
    const details = state.taskDetails;

    if (!details || details.loading) {
      return {
        mode: 'text',
        content: [buildHeaderLine('TASK DETAILS', state.spinnerFrame), '', 'Loading…'].join('\n'),
      };
    }

    if (details.error) {
      // An overflowing error re-arms firmware scroll and swallows the back gesture.
      return {
        mode: 'text',
        content: [
          buildHeaderLine('TASK DETAILS', ''),
          '',
          pxTruncate(details.error, TEXT_INNER_W),
          '',
          'Double-tap to go back.',
        ].join('\n'),
      };
    }

    return {
      mode: 'text',
      content: [
        buildHeaderLine('TASK DETAILS', ''),
        '',
        'Task:',
        state.selectedTask?.taskName ?? '(unknown task)',
        '',
        'Project:',
        details.project ?? '(none)',
        '',
        'Due:',
        formatDueDate(details.due),
      ].join('\n'),
    };
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.stopSpinner();
      ctx.navigate('task-actions');
      return;
    }

    // SELECT_HIGHLIGHTED / HIGHLIGHT_MOVE: the text container scrolls overflow.
  },
};
