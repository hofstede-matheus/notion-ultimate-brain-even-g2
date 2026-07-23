import type { AppState } from '../../../../state';
import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const projectTasksTodoScreen: ScreenModule = makeListScreen({
  screen: 'project-tasks-todo',
  parent: 'project-tasks-menu',
  onSelect: 'task',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — TO DO`,
  emptyMessage: 'No to-do tasks in this project.',
  formatLabel: (item) => `[ ] ${item.name}`,
});
