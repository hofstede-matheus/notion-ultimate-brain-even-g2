import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const notesByProjectScreen: ScreenModule = makeListScreen({
  screen: 'notes-by-project',
  parent: 'notes-menu',
  title: 'NOTES BY PROJECT',
  emptyMessage: 'No notes linked to a project.',
});
