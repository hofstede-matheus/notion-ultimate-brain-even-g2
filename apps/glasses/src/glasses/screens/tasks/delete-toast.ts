import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../types';
import { truncateToByteLimit } from '../shared';

// Shared by the task and note action menus.
export const deleteToastScreen: ScreenModule = {
  display(state) {
    const t = state.actionToast;
    const name = t && t.kind === 'delete' ? truncateToByteLimit(t.itemName) : '';
    return {
      mode: 'text',
      content: [
        buildHeaderLine('DELETED', ''),
        '',
        name ? `✓ ${name}` : '✓ Deleted',
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
