import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { ITEM_ACTIONS, openConfirm as openItemConfirm } from './item-actions';
import { enterView } from './navigation';

// ---------------------------------------------------------------------------
// Project picker — reached from the task and note action menus' "Change
// project" row. Lists every non-archived project (the Board view's fetcher,
// shared via DATA_KEY_OVERRIDES in navigation.ts) plus a sentinel row to
// clear the association, and hands the pick off to the generic confirm/toast
// flow in item-actions.ts.
// ---------------------------------------------------------------------------

/** Sentinel id for the picker's "clear the project" row — never a real Notion page id. */
export const NO_PROJECT_ID = '__no_project__';

export function openProjectPicker(
  itemId: string,
  itemName: string,
  returnTo: ScreenName,
  backTo: ScreenName,
): void {
  trace.info('NAV', `openProjectPicker "${itemName}"`, { id: itemId });
  state.projectPicker = { itemId, itemName, returnTo, backTo };
  void enterView('project-picker');
}

/** Handles a tap on a project-picker row, including the "no project" sentinel. */
export function pickProject(projectId: string, projectName: string): void {
  const picker = state.projectPicker;
  if (!picker) return;

  const id = projectId === NO_PROJECT_ID ? null : projectId;
  const name = projectId === NO_PROJECT_ID ? 'No project' : projectName;
  trace.info('ACT', `project picked "${name}"`, { itemId: picker.itemId, projectId: id });

  openItemConfirm(ITEM_ACTIONS.setProject, picker.itemId, picker.itemName, picker.returnTo, {
    project: { id, name },
  });
}
