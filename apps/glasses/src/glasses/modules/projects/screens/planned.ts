import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const plannedScreen: ScreenModule = makeListScreen({
  screen: 'projects-planned',
  parent: (state) => (state.projectPicker ? 'project-picker' : 'projects-menu'),
  title: 'PLANNED PROJECTS',
  emptyMessage: 'No planned projects.',
  onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project'),
});
