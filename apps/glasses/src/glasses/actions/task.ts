import { fetchPageMetadata } from '../../api';
import type { ScreenName } from '../../state';
import { state } from '../../state';
import { renderFull, renderUpdate } from '../render';
import { navigate, startSpinner, stopSpinner } from './navigation';

// ---------------------------------------------------------------------------
// Task action menu — reached by tapping a task in any Tasks list screen.
// Offers Load metadata / Mark as done / Delete task.
// ---------------------------------------------------------------------------

export function openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void {
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
    state.taskMetadata = { loading: false, project, due, error: '' };
  } catch (e) {
    state.taskMetadata = {
      loading: false,
      project: null,
      due: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'task-metadata') void renderFull();
  }
}
