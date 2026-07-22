import type { Task } from '@notion-ub/contracts';
import type { AppState } from '../../../../state';
import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const projectTasksScreen: ScreenModule = makeListScreen({
  screen: 'project-tasks',
  parent: 'project-detail',
  onSelect: 'task',
  title: (state: AppState) => `${state.selectedProject?.name ?? 'PROJECT'} — TASKS`,
  emptyMessage: 'No tasks in this project.',
  formatLabel: (item) => `${(item as Task).status === 'Done' ? '[v] ' : '[ ] '}${item.name}`,
});
