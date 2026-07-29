import { deletePage, markTaskDone, setTaskDueDate } from '../../../api';
import { saveCachedList } from '../../../cache';
import { trace } from '../../../logging/trace';
import type { ListItem, ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderUpdate } from '../../render';
import {
  cacheKeyForListView,
  DATA_KEY_OVERRIDES,
  navigate,
  startSpinner,
  stopSpinner,
} from './navigation';

// ---------------------------------------------------------------------------
// Item actions — confirm dialog + toast for mark-done, delete, and setDue,
// unified flow. Shared by tasks ("Mark as done", "Change due date", "Delete
// task") and notes ("Delete note") — the state involved doesn't care which
// kind of page it's acting on, so this is generic over item id/name rather
// than task-specific. `date` only carries a payload for setDue.
// ---------------------------------------------------------------------------

type ItemActionKind = 'markDone' | 'delete' | 'setDue';

interface ItemAction {
  kind: ItemActionKind;
  confirmScreenName: ScreenName;
  toastScreenName: ScreenName;
  apiCall: (itemId: string, date?: string | null) => Promise<void>;
  /**
   * How to reflect a successful call in local list state. markDone/delete
   * drop the item from whichever list owns it; setDue instead patches its
   * dueDate in place so Today/Overdue (filtered views over the same fetched
   * array — see tasks/helpers.ts) reclassify it without a refetch.
   */
  applyToOwningList: (itemId: string, returnTo: ScreenName, date?: string | null) => void;
}

function removeItemFromOwningList(itemId: string, returnTo: ScreenName): void {
  const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
  const list = (state.lists[dataKey] ?? []).filter((item) => item.id !== itemId);
  state.lists[dataKey] = list;
  void saveCachedList(cacheKeyForListView(dataKey), list);
}

/**
 * setDue only ever targets a task (the due-date picker is only reachable
 * from the task action menu), so the matched item is patched unconditionally
 * — an `'dueDate' in item` guard would wrongly skip a task that has never
 * had a due date before, since the key wouldn't exist on it yet at all.
 */
function patchDueDateInOwningList(
  itemId: string,
  returnTo: ScreenName,
  date?: string | null,
): void {
  const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
  const list = (state.lists[dataKey] ?? []).map(
    (item): ListItem => (item.id === itemId ? { ...item, dueDate: date ?? undefined } : item),
  );
  state.lists[dataKey] = list;
  void saveCachedList(cacheKeyForListView(dataKey), list);
}

export const ITEM_ACTIONS: Record<ItemActionKind, ItemAction> = {
  markDone: {
    kind: 'markDone',
    confirmScreenName: 'mark-done-confirm',
    toastScreenName: 'mark-done-toast',
    apiCall: markTaskDone,
    applyToOwningList: removeItemFromOwningList,
  },
  delete: {
    kind: 'delete',
    confirmScreenName: 'delete-confirm',
    toastScreenName: 'delete-toast',
    apiCall: deletePage,
    applyToOwningList: removeItemFromOwningList,
  },
  setDue: {
    kind: 'setDue',
    confirmScreenName: 'due-date-confirm',
    toastScreenName: 'due-date-toast',
    apiCall: setTaskDueDate,
    applyToOwningList: patchDueDateInOwningList,
  },
};

let actionToastTimeout: ReturnType<typeof setTimeout> | null = null;

export function openConfirm(
  action: ItemAction,
  itemId: string,
  itemName: string,
  returnTo: ScreenName,
  date?: string | null,
): void {
  trace.info('ACT', `confirm open kind=${action.kind}`, { id: itemId, name: itemName, date });
  state.pendingAction = { kind: action.kind, itemId, itemName, returnTo, date };
  state.errorMessage = '';
  navigate(action.confirmScreenName);
}

export function dismissConfirm(): void {
  const returnTo = state.pendingAction?.returnTo ?? 'tasks-menu';
  trace.info('ACT', `confirm dismissed -> ${returnTo}`);
  state.pendingAction = null;
  navigate(returnTo);
}

export async function confirmAction(): Promise<void> {
  const pending = state.pendingAction;
  if (!pending) return;
  const { kind, itemId, returnTo, date } = pending;
  const action = ITEM_ACTIONS[kind];

  const spinner = startSpinner(() => void renderUpdate(action.confirmScreenName));
  trace.info('ACT', `calling ${kind} api`, { id: itemId, date });

  try {
    await action.apiCall(itemId, date);
    action.applyToOwningList(itemId, returnTo, date);
    const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
    trace.info('ACT', `ok, applied to ${dataKey}`, { left: (state.lists[dataKey] ?? []).length });

    state.pendingAction = null;
    state.actionToast = {
      kind,
      itemName: pending.itemName,
      returnTo,
      untilMs: Date.now() + 1500,
      date,
    };
    navigate(action.toastScreenName);

    if (actionToastTimeout !== null) clearTimeout(actionToastTimeout);
    actionToastTimeout = setTimeout(() => {
      actionToastTimeout = null;
      state.actionToast = null;
      navigate(returnTo);
    }, 1500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('ACT', `${kind} failed: ${msg}`, { id: itemId });
    state.errorMessage = msg;
    void renderUpdate(action.confirmScreenName);
  } finally {
    stopSpinner(spinner);
  }
}

export function dismissActionToast(): void {
  if (actionToastTimeout !== null) {
    clearTimeout(actionToastTimeout);
    actionToastTimeout = null;
  }
  const returnTo = state.actionToast?.returnTo ?? 'tasks-menu';
  trace.info('ACT', `toast dismissed -> ${returnTo}`);
  state.actionToast = null;
  navigate(returnTo);
}
