import { fetchPageMetadata } from '../../../api';
import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Task action menu — reached by tapping a task in any Tasks list screen.
// Offers Load metadata / Mark as done / Delete task.
// ---------------------------------------------------------------------------

export function openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void {
  trace.info('NAV', `openTaskActions "${taskName}"`, { id: taskId });
  state.selectedTask = { taskId, taskName, returnTo };
  navigate('task-actions');
}

export async function enterTaskMetadata(): Promise<void> {
  const selected = state.selectedTask;
  if (!selected) return;

  state.taskMetadata = { loading: true, project: null, due: null, error: '' };
  navigate('task-metadata');

  const spinner = startSpinner(() => void renderUpdate('task-metadata'));

  try {
    const { project, due } = await fetchPageMetadata(selected.taskId);
    trace.info('API', 'task metadata loaded', { id: selected.taskId, project, due });
    state.taskMetadata = { loading: false, project, due, error: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('API', `task metadata failed: ${msg}`, { id: selected.taskId });
    state.taskMetadata = {
      loading: false,
      project: null,
      due: null,
      error: msg,
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'task-metadata') void renderFull();
  }
}
