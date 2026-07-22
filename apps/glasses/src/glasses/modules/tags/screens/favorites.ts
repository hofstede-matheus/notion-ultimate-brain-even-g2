import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsFavoritesScreen: ScreenModule = makeListScreen({
  screen: 'tags-favorites',
  parent: 'tags-menu',
  title: 'FAVORITE TAGS',
  emptyMessage: 'No favorite tags.',
});
