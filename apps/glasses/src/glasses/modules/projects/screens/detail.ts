import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { ScreenModule } from '../../../types';
import { truncateToByteLimit } from '../../_shared/screen-factories';

const ITEMS = ['Open page', 'Tasks', 'Notes'];

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
      if (action.itemIndex === 0) {
        if (selected) ctx.openPage(selected.id, selected.name, 'project-detail');
      } else if (action.itemIndex === 1) ctx.enterView('project-tasks');
      else if (action.itemIndex === 2) ctx.enterView('project-notes');
      return;
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
};
