import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const meetingsScreen: ScreenModule = makeListScreen({
  screen: 'notes-meetings',
  parent: 'notes-menu',
  title: 'MEETINGS',
  emptyMessage: 'No meeting notes.',
});
