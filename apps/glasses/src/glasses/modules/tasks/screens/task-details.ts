import { holdToMarkDone, TASK_CONTEXT_MENU } from '../../../context-menu';
import { makeDetailsScreen } from '../../_shared/details-screen';
import { formatDueDate } from '../helpers';

/**
 * A task's details: its name in full (list rows are truncated to fit, this
 * screen is where the whole thing can be read), the project it is filed
 * under, and when it is due.
 *
 * This is what a tap on a task row opens — not the page reader, which costs
 * a markdown fetch on top of this screen's single details call. Reading the
 * page is one item down on the contextual menu below, for when it is wanted.
 */
export const taskDetailsScreen = makeDetailsScreen({
  title: 'TASK DETAILS',
  parent: (state) => state.selectedTask?.returnTo ?? 'tasks-menu',
  menu: TASK_CONTEXT_MENU,
  onHold: holdToMarkDone,
  read(state) {
    const details = state.taskDetails;
    if (!details) return null;
    return {
      loading: details.loading,
      error: details.error,
      fields: [
        { label: 'Task:', value: state.selectedTask?.taskName ?? '(unknown task)' },
        { label: 'Project:', value: details.project ?? '(none)' },
        { label: 'Due:', value: formatDueDate(details.due) },
      ],
    };
  },
});
