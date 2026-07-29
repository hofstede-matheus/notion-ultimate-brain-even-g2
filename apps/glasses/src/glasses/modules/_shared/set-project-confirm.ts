import { buildHeaderLine } from 'even-toolkit/text-utils';
import { MAX_ITEM_BYTES } from '../../constants';
import type { ScreenModule } from '../../types';
import { truncatePrefixedToByteLimit, truncateToByteLimit } from './screen-factories';

// Shared by the task and note action menus, mirroring due-date-confirm.ts.
export const setProjectConfirmScreen: ScreenModule = {
  display(state) {
    const p = state.pendingAction;
    const project = p && p.kind === 'setProject' ? p.project : undefined;
    const header = state.errorMessage
      ? buildHeaderLine(`FAILED: ${truncateToByteLimit(state.errorMessage, MAX_ITEM_BYTES)}`, '')
      : buildHeaderLine('MOVE TO?', state.spinnerFrame);

    const moveLabel =
      project?.id === null
        ? 'Clear project'
        : truncatePrefixedToByteLimit('To ', project?.name ?? '');

    return {
      mode: 'list',
      header,
      items: [moveLabel, 'Cancel'],
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
