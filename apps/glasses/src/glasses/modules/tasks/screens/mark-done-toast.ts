import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { truncateToByteLimit } from '../../_shared/screen-factories';

export const markDoneToastScreen: ScreenModule = {
  display(state) {
    const t = state.actionToast;
    const name = t && t.kind === 'markDone' ? truncateToByteLimit(t.itemName) : '';
    return {
      mode: 'text',
      content: [
        buildHeaderLine('DONE', ''),
        '',
        name ? `✓ ${name}` : '✓ Marked done',
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
