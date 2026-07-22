import { buildHeaderLine } from 'even-toolkit/text-utils';
import { MAX_ITEM_BYTES } from '../../constants';
import type { ScreenModule } from '../../types';
import { truncatePrefixedToByteLimit, truncateToByteLimit } from './screen-factories';

// Shared by the task and note action menus — kept generic ("DELETE?" rather
// than "DELETE TASK?") since it doesn't know which kind of item it's showing.
export const deleteConfirmScreen: ScreenModule = {
  display(state) {
    const p = state.pendingAction;
    const name = p && p.kind === 'delete' ? p.itemName : '';
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('DELETE?', state.spinnerFrame);

    return {
      mode: 'list',
      header,
      items: [truncatePrefixedToByteLimit('Confirm: ', name), 'Cancel'],
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
