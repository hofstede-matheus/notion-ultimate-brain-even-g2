import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const doneScreen: ScreenModule = makeListScreen({
  screen: 'projects-done',
  parent: (state) => (state.projectPicker ? 'project-picker' : 'projects-menu'),
  title: 'DONE',
  emptyMessage: 'No done projects.',
  onSelect: (state) => (state.projectPicker ? 'project-pick' : 'project'),
});
