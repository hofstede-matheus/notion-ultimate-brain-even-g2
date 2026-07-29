import { buildHeaderLine } from 'even-toolkit/text-utils';
import { MAX_ITEM_BYTES } from '../../../constants';
import type { ScreenModule } from '../../../types';
import { truncateToByteLimit } from '../../_shared/screen-factories';
import { formatDueDate } from '../helpers';

export const dueDateConfirmScreen: ScreenModule = {
  display(state) {
    const p = state.pendingAction;
    const date = p && p.kind === 'setDue' ? (p.date ?? null) : null;
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('RESCHEDULE?', state.spinnerFrame);

    return {
      mode: 'list',
      header,
      items: [`To ${formatDueDate(date)}`, 'Cancel'],
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
