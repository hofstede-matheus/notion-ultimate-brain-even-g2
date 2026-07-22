import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagsAzScreen: ScreenModule = makeListScreen({
  screen: 'tags-a-z',
  parent: 'tags-menu',
  title: 'TAGS A-Z',
  emptyMessage: 'No tags.',
});
