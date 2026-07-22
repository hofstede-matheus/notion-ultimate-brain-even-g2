import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const notesListScreen: ScreenModule = makeListScreen({
  screen: 'notes-list',
  parent: 'notes-menu',
  title: 'NOTES',
  emptyMessage: 'No notes.',
});
