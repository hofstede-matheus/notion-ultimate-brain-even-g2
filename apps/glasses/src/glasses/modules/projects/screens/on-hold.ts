import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const onHoldScreen: ScreenModule = makeListScreen({
  screen: 'projects-on-hold',
  parent: 'projects-menu',
  title: 'ON HOLD',
  emptyMessage: 'No on-hold projects.',
});
