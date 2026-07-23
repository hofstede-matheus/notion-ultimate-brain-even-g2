import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsTypesEntityScreen: ScreenModule = makeListScreen({
  screen: 'tags-types-entity',
  parent: 'tag-types-menu',
  title: 'ENTITY TAGS',
  emptyMessage: 'No entity tags.',
});
