import type { ScreenModule } from '../../../types';
import { getTodayFlatTasks } from '../helpers';
import { makeListScreen } from '../../_shared/screen-factories';

export const todayScreen: ScreenModule = makeListScreen({
  screen: 'today',
  parent: 'tasks-menu',
  title: "TODAY'S TASKS",
  emptyMessage: "No tasks due today! You're all clear.",
  loadingMessage: 'Fetching tasks...',
  countInHeader: false,
  selectItems: getTodayFlatTasks,
  onSelect: 'task',
});
