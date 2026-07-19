import type { ScreenModule } from '../../types';
import { makeListScreen } from '../shared';

export const recentTagsScreen: ScreenModule = makeListScreen({
  screen: 'tags-recent',
  parent: 'tags-menu',
  title: 'RECENT TAGS',
  emptyMessage: 'No recent tags.',
});
