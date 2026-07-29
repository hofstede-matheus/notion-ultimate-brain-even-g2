import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../types';

// Shared by the task and note action menus, mirroring due-date-toast.ts.
export const setProjectToastScreen: ScreenModule = {
  display(state) {
    const t = state.actionToast;
    const project = t && t.kind === 'setProject' ? t.project : undefined;
    return {
      mode: 'text',
      content: [
        buildHeaderLine('MOVED', ''),
        '',
        `✓ ${project?.name ?? ''}`,
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
