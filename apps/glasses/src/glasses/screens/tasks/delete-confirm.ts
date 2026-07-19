import { buildHeaderLine } from 'even-toolkit/text-utils';
import { MAX_ITEM_BYTES } from '../../constants';
import type { ScreenModule } from '../../types';
import { truncateToByteLimit } from '../shared';

export const deleteConfirmScreen: ScreenModule = {
  display(state) {
    const p = state.pendingAction;
    const name = p && p.kind === 'delete' ? truncateToByteLimit(p.taskName, MAX_ITEM_BYTES) : '';
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('DELETE TASK?', state.spinnerFrame);

    return {
      mode: 'list',
      header,
      items: [`Confirm: ${name}`, 'Cancel'],
    };
  },

  action(action, _state, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.dismissConfirm();
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (action.itemIndex === 0) void ctx.confirmAction();
      else ctx.dismissConfirm();
      return;
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
};
