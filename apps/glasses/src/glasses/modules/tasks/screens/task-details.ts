import { makeDetailsScreen } from '../../_shared/details-screen';
import { formatDueDate } from '../helpers';

/**
 * A task's details: its name in full (list rows are truncated to fit, this
 * screen is where the whole thing can be read), the project it is filed
 * under, and when it is due.
 */
export const taskDetailsScreen = makeDetailsScreen({
  title: 'TASK DETAILS',
  parent: 'task-actions',
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
