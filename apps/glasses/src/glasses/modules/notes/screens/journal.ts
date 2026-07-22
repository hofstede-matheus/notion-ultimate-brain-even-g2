import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const journalScreen: ScreenModule = makeListScreen({
  screen: 'notes-journal',
  parent: 'notes-menu',
  title: 'JOURNAL',
  emptyMessage: 'No journal entries.',
});
