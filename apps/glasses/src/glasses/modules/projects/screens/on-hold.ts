import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const onHoldScreen: ScreenModule = makeListScreen({
  screen: 'projects-on-hold',
  parent: (state) => (state.projectPicker ? 'project-picker' : 'projects-menu'),
  title: 'ON HOLD',
  emptyMessage: 'No on-hold projects.',
  onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project'),
});
