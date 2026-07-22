import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const next7DaysScreen: ScreenModule = makeListScreen({
  screen: 'tasks-next-7-days',
  parent: 'tasks-menu',
  onSelect: 'task',
  title: 'NEXT 7 DAYS',
  emptyMessage: 'No tasks in the next 7 days.',
});
