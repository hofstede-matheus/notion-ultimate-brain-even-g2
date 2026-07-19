import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const tagsTypesScreen: ScreenModule = makeListScreen({
  screen: 'tags-types',
  parent: 'tags-menu',
  title: 'TAG TYPES',
  emptyMessage: 'No tag types.',
});
