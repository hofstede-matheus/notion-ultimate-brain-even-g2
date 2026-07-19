import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const notesListScreen: ScreenModule = makeListScreen({
  screen: 'notes-list',
  parent: 'notes-menu',
  title: 'NOTES',
  emptyMessage: 'No notes.',
});
