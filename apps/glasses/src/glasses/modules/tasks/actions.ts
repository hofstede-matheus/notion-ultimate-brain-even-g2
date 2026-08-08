import { fetchPageMetadata } from '../../../api';
import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Task action menu — reached by tapping a task in any Tasks list screen.
// Offers Task Details / Mark as done / Delete task.
// ---------------------------------------------------------------------------

export function openTaskActions(
  taskId: string,
  taskName: string,
  returnTo: ScreenName,
  dueDate?: string,
): void {
  trace.info('NAV', `openTaskActions "${taskName}"`, { id: taskId, dueDate });
  state.selectedTask = { taskId, taskName, returnTo, dueDate };
  navigate('task-actions');
}

export async function enterTaskDetails(): Promise<void> {
  const selected = state.selectedTask;
  if (!selected) return;

  state.taskDetails = { loading: true, project: null, due: null, error: '', page: 0 };
  navigate('task-details');

  const spinner = startSpinner(() => void renderUpdate('task-details'));

  try {
    const { project, due } = await fetchPageMetadata(selected.taskId);
    trace.info('API', 'task metadata loaded', { id: selected.taskId, project, due });
    state.taskDetails = { loading: false, project, due, error: '', page: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('API', `task metadata failed: ${msg}`, { id: selected.taskId });
    state.taskDetails = {
      loading: false,
      project: null,
      due: null,
      error: msg,
      page: 0,
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'task-details') void renderFull();
  }
}

export function turnTaskDetailsPage(delta: number, totalPages: number): void {
  const details = state.taskDetails;
  if (!details || details.loading || details.error || totalPages < 2) return;

  details.page = Math.max(0, Math.min(details.page + delta, totalPages - 1));
  void renderFull();
}
