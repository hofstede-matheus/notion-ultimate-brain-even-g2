import type { ScreenModule } from '../../../types';
import { getOverdueFlatTasks } from '../helpers';
import { makeListScreen } from '../../_shared/screen-factories';

export const overdueScreen: ScreenModule = makeListScreen({
  screen: 'overdue',
  parent: 'tasks-menu',
  title: 'OVERDUE',
  emptyMessage: "Nothing overdue! You're all caught up.",
  loadingMessage: 'Fetching tasks...',
  selectItems: getOverdueFlatTasks,
  onSelect: 'task',
});
