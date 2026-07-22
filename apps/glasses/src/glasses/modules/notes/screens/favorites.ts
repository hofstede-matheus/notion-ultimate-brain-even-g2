import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const notesFavoritesScreen: ScreenModule = makeListScreen({
  screen: 'notes-favorites',
  parent: 'notes-menu',
  title: 'FAVORITE NOTES',
  emptyMessage: 'No favorite notes.',
});
