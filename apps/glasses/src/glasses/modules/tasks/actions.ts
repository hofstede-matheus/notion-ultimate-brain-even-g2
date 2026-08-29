import { fetchPageDetails } from '../../../api';
import { trace } from '../../../logging/trace';
import type { ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderFull, renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Task selection — stashes the task the contextual menu / details /
// due-date / project-picker flows operate on. A tap on a list row follows
// this with ctx.openPage(); a long-press leaves it here for whichever
// contextual-menu item (see glasses/context-menu.ts) the wearer picks next.
// Does not navigate — unlike the old task-actions screen this replaced,
// selecting a task is no longer itself a screen transition.
// ---------------------------------------------------------------------------

export function selectTask(
  taskId: string,
  taskName: string,
  returnTo: ScreenName,
  dueDate?: string,
): void {
  trace.info('SEL', `selectTask "${taskName}"`, { id: taskId, dueDate });
  state.selectedTask = { taskId, taskName, returnTo, dueDate };
}

export async function enterTaskDetails(): Promise<void> {
  const selected = state.selectedTask;
  if (!selected) return;

  state.taskDetails = { loading: true, project: null, due: null, error: '' };
  navigate('task-details');

  const spinner = startSpinner(() => void renderUpdate('task-details'));

  try {
    const { project, due } = await fetchPageDetails(selected.taskId);
    trace.info('API', 'task details loaded', { id: selected.taskId, project, due });
    state.taskDetails = { loading: false, project, due, error: '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('API', `task details failed: ${msg}`, { id: selected.taskId });
    state.taskDetails = {
      loading: false,
      project: null,
      due: null,
      error: msg,
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'task-details') void renderFull();
  }
}
