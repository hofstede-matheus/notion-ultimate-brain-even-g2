import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const meetingsScreen: ScreenModule = makeListScreen({
  screen: 'notes-meetings',
  parent: 'notes-menu',
  title: 'MEETINGS',
  emptyMessage: 'No meeting notes.',
});
