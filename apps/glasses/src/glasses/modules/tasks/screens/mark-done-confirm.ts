import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { truncatePrefixedListLabel } from '../../_shared/screen-factories';

export const markDoneConfirmScreen: ScreenModule = {
  display(state) {
    const p = state.pendingAction;
    const name = p && p.kind === 'markDone' ? p.itemName : '';
    const header = state.errorMessage
      ? buildHeaderLine(truncatePrefixedListLabel('FAILED: ', state.errorMessage), '')
      : buildHeaderLine('MARK AS DONE?', state.spinnerFrame);

    return {
      mode: 'list',
      header,
      items: [truncatePrefixedListLabel('Confirm: ', name), 'Cancel'],
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
