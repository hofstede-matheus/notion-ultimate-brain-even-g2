import { buildHeaderLine } from 'even-toolkit/text-utils';
import type { AppState } from '../../../state';
import { MAX_ITEM_BYTES } from '../../constants';
import type { GlassCtx, ScreenModule } from '../../types';
import { truncateToByteLimit } from '../shared';

type SelectedTask = NonNullable<AppState['selectedTask']>;

/**
 * The menu shown after tapping a task. Read actions first, destructive ones
 * last; `run` is keyed off position in this array, so the labels and their
 * effects can't drift apart as entries are added.
 */
const ACTIONS: Array<{ label: string; run: (task: SelectedTask, ctx: GlassCtx) => void }> = [
  { label: 'Load metadata', run: (_task, ctx) => ctx.enterTaskMetadata() },
  {
    label: 'Open page',
    run: (task, ctx) => ctx.openPage(task.taskId, task.taskName, 'task-actions'),
  },
  {
    label: 'Mark as done',
    run: (task, ctx) => ctx.openConfirm('markDone', task.taskId, task.taskName, task.returnTo),
  },
  {
    label: 'Delete task',
    run: (task, ctx) => ctx.openConfirm('delete', task.taskId, task.taskName, task.returnTo),
  },
];

export const taskActionsScreen: ScreenModule = {
  display(state) {
    const selected = state.selectedTask;
    const name = selected ? truncateToByteLimit(selected.taskName, MAX_ITEM_BYTES) : '';
    return {
      mode: 'list',
      header: buildHeaderLine(name, ''),
      items: ACTIONS.map((action) => action.label),
    };
  },

  action(action, state, ctx) {
    const selected = state.selectedTask;

    if (action.type === 'GO_BACK') {
      ctx.navigate(selected?.returnTo ?? 'tasks-menu');
      return;
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (typeof action.itemIndex === 'number' && selected) {
        ACTIONS[action.itemIndex]?.run(selected, ctx);
      }
      return;
    }

    // HIGHLIGHT_MOVE: the native list widget owns scroll/highlight — no-op
  },
};
