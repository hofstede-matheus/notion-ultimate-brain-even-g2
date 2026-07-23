import type { AppState } from '../../../../state';
import type { ScreenModule } from '../../../types';
import { makeListScreen } from '../../_shared/screen-factories';

export const tagNotesScreen: ScreenModule = makeListScreen({
  screen: 'tag-notes',
  parent: (state: AppState) => state.selectedTag?.returnTo ?? 'tags-menu',
  title: (state: AppState) => `TAG: ${state.selectedTag?.name ?? ''}`,
  emptyMessage: 'No notes with this tag.',
  onSelect: 'note',
});
