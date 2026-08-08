import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState, ScreenName } from '../../../../state';
import type { GlassCtx, ScreenModule } from '../../../types';
import { NO_PROJECT_ID } from '../../_shared/project-picker';
import { truncateListLabel } from '../../_shared/screen-factories';

const PROJECT_FILTERS: { label: string; target: ScreenName }[] = [
  { label: 'All', target: 'projects-all' },
  { label: 'Doing', target: 'projects-doing' },
  { label: 'Ongoing', target: 'projects-ongoing' },
  { label: 'Planned', target: 'projects-planned' },
  { label: 'On Hold', target: 'projects-on-hold' },
  { label: 'Done', target: 'projects-done' },
  { label: 'Archived', target: 'projects-archived' },
];

function goBack(state: AppState, ctx: GlassCtx): void {
  ctx.navigate(state.projectPicker?.backTo ?? 'task-actions');
}

/**
 * The first row clears the relation; the remaining rows choose the project
 * status to browse before selecting an individual project.
 */
export const projectPickerScreen: ScreenModule = {
  display() {
    return {
      mode: 'list',
      header: buildHeaderLine('MOVE TO', ''),
      items: ['— No project —', ...PROJECT_FILTERS.map((filter) => truncateListLabel(filter.label))],
    };
  },

  action(action, state, ctx) {
    if (action.type === 'GO_BACK') {
      goBack(state, ctx);
      return;
    }
    if (action.type !== 'SELECT_HIGHLIGHTED' || typeof action.itemIndex !== 'number') return;

    if (action.itemIndex === 0) {
      ctx.pickProject(NO_PROJECT_ID, 'No project');
      return;
    }
    const filter = PROJECT_FILTERS[action.itemIndex - 1];
    if (filter) ctx.enterView(filter.target);
  },
};
