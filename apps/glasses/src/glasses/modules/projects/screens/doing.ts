import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const doingScreen: ScreenModule = makeListScreen({
  screen: 'projects-doing',
  parent: 'projects-menu',
  title: 'DOING',
  emptyMessage: 'No projects in progress.',
});
