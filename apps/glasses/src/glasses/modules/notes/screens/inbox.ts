import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const notesInboxScreen: ScreenModule = makeListScreen({
  screen: 'notes-inbox',
  parent: 'notes-menu',
  title: 'NOTES INBOX',
  emptyMessage: 'Your notes inbox is empty.',
});
