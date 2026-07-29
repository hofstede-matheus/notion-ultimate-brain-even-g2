import type { Project } from '@notion-ub/contracts';
import type { ListItem } from '../../../../state';
import type { ScreenModule } from '../../../types';
import { NO_PROJECT_ID } from '../../_shared/project-picker';
import { makeListScreen } from '../../_shared/screen-factories';

const NO_PROJECT_ROW: Project = { id: NO_PROJECT_ID, name: '— No project —' };

function sortedByName(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export const projectPickerScreen: ScreenModule = makeListScreen({
  screen: 'project-picker',
  parent: (state) => state.projectPicker?.backTo ?? 'task-actions',
  title: 'MOVE TO',
  countInHeader: false,
  emptyMessage: 'No projects found.',
  loadingMessage: 'Fetching projects...',
  selectItems: (state) => [NO_PROJECT_ROW, ...sortedByName(state.lists['projects-board'] ?? [])],
  onSelect: 'project-pick',
});
