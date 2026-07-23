import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';
import { getOverdueFlatTasks } from '../helpers';

export const overdueScreen: ScreenModule = makeListScreen({
  screen: 'overdue',
  parent: 'tasks-menu',
  title: 'OVERDUE',
  emptyMessage: "Nothing overdue! You're all caught up.",
  loadingMessage: 'Fetching tasks...',
  selectItems: getOverdueFlatTasks,
  onSelect: 'task',
});
