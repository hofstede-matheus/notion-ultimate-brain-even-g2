import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsTypesAreaScreen: ScreenModule = makeListScreen({
  screen: 'tags-types-area',
  parent: 'tag-types-menu',
  title: 'AREA TAGS',
  emptyMessage: 'No area tags.',
});
