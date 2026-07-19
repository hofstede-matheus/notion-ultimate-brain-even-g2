import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const inboxScreen: ScreenModule = makeListScreen({
  screen: 'inbox',
  parent: 'tasks-menu',
  title: 'INBOX',
  emptyMessage: 'Your inbox is empty!',
  loadingMessage: 'Fetching tasks...',
  onSelect: 'task',
});
