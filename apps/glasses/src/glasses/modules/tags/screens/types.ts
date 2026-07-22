import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsTypesScreen: ScreenModule = makeListScreen({
  screen: 'tags-types',
  parent: 'tags-menu',
  title: 'TAG TYPES',
  emptyMessage: 'No tag types.',
});
