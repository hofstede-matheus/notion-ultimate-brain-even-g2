import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const allProjectsScreen: ScreenModule = makeListScreen({
  screen: 'projects-all',
  parent: (state) => (state.projectPicker ? 'project-picker' : 'projects-menu'),
  title: 'ALL PROJECTS',
  emptyMessage: 'No projects.',
  onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project'),
});
