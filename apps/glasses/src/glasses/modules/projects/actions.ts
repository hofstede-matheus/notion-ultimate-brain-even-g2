import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { navigate } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Project drill-down — reached by tapping a project in any Projects list
// screen. Stashes the project and opens the Tasks/Notes menu.
// ---------------------------------------------------------------------------

export function openProjectDetail(
  projectId: string,
  projectName: string,
  returnTo: ScreenName,
): void {
  state.selectedProject = { id: projectId, name: projectName, returnTo };
  navigate('project-detail');
}
