import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { truncateToByteLimit } from '../../_shared/screen-factories';

const ITEMS = ['Tasks', 'Notes'];

export const projectDetailScreen: ScreenModule = {
  display(state) {
    const name = state.selectedProject ? truncateToByteLimit(state.selectedProject.name) : '';
    return {
      mode: 'list',
      header: buildHeaderLine(name, ''),
      items: ITEMS,
    };
  },

  action(action, state, ctx) {
    const selected = state.selectedProject;

    if (action.type === 'GO_BACK') {
      ctx.navigate(selected?.returnTo ?? 'projects-menu');
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (action.itemIndex === 0) ctx.navigate('project-tasks-menu');
      else if (action.itemIndex === 1) ctx.enterView('project-notes');
      return;
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
};
