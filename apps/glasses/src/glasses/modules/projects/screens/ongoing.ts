import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const ongoingScreen: ScreenModule = makeListScreen({
  screen: 'projects-ongoing',
  parent: 'projects-menu',
  title: 'ONGOING',
  emptyMessage: 'No ongoing projects.',
});
