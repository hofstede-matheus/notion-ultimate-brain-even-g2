import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const notesByTagScreen: ScreenModule = makeListScreen({
  screen: 'notes-by-tag',
  parent: 'notes-menu',
  title: 'NOTES BY TAG',
  emptyMessage: 'No tagged notes.',
});
