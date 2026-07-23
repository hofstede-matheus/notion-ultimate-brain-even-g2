import type { AppState } from '../../../../state';
import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const projectTasksDoneScreen: ScreenModule = makeListScreen({
  screen: 'project-tasks-done',
  parent: 'project-tasks-menu',
  onSelect: 'task',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — DONE`,
  emptyMessage: 'No done tasks in this project.',
  formatLabel: (item) => `[v] ${item.name}`,
});
