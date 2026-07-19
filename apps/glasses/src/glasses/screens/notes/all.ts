import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const allNotesScreen: ScreenModule = makeListScreen({
  screen: 'notes-all',
  parent: 'notes-menu',
  title: 'ALL NOTES',
  emptyMessage: 'No notes.',
});
