import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsTypesResourceScreen: ScreenModule = makeListScreen({
  screen: 'tags-types-resource',
  parent: 'tag-types-menu',
  title: 'RESOURCE TAGS',
  emptyMessage: 'No resource tags.',
});
