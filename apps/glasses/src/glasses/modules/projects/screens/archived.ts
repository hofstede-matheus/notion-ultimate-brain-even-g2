import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const archivedScreen: ScreenModule = makeListScreen({
  screen: 'projects-archived',
  parent: (state) => (state.projectPicker ? 'project-picker' : 'projects-menu'),
  title: 'ARCHIVED PROJECTS',
  emptyMessage: 'No archived projects.',
  onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project'),
});
