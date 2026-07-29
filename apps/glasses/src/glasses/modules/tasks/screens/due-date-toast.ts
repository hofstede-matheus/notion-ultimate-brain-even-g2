import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { formatDueDate } from '../helpers';

export const dueDateToastScreen: ScreenModule = {
  display(state) {
    const t = state.actionToast;
    const date = t && t.kind === 'setDue' ? (t.date ?? null) : null;
    return {
      mode: 'text',
      content: [
        buildHeaderLine('MOVED', ''),
        '',
        `✓ ${formatDueDate(date)}`,
        '',
        'Returning...',
      ].join('\n'),
    };
  },

  action(action, _state, ctx) {
    // Allow immediate exit even before the 1.5s timer fires
    if (action.type === 'GO_BACK') ctx.dismissActionToast();
  },
};
