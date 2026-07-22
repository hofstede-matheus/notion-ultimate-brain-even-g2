import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const archivedScreen: ScreenModule = makeListScreen({
  screen: 'projects-archived',
  parent: 'projects-menu',
  title: 'ARCHIVED PROJECTS',
  emptyMessage: 'No archived projects.',
});
