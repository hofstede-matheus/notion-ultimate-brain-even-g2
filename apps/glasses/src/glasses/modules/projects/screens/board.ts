import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const boardScreen: ScreenModule = makeListScreen({
  screen: 'projects-board',
  parent: 'projects-menu',
  title: 'PROJECT BOARD',
  emptyMessage: 'No projects.',
});
