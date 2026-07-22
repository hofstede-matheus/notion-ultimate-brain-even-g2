import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tomorrowScreen: ScreenModule = makeListScreen({
  screen: 'tasks-tomorrow',
  parent: 'tasks-menu',
  onSelect: 'task',
  title: 'TOMORROW',
  emptyMessage: 'No tasks due tomorrow.',
});
