import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const activeScreen: ScreenModule = makeListScreen({
  screen: 'projects-active',
  parent: 'projects-menu',
  title: 'ACTIVE PROJECTS',
  emptyMessage: 'No active projects.',
});
