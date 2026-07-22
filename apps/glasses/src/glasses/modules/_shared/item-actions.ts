import { deletePage, markTaskDone } from '../../../api';
import { saveCachedList } from '../../../cache';
import type { ScreenName } from '../../../state';
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
// Item actions — confirm dialog + toast for mark-done and delete, unified
// flow. Shared by tasks ("Mark as done", "Delete task") and notes ("Delete
// note") — the state and API calls involved don't care which kind of page
// they're acting on, so this is generic over item id/name rather than
// task-specific.
// ---------------------------------------------------------------------------

interface ItemAction {
  kind: 'markDone' | 'delete';
  confirmScreenName: ScreenName;
  toastScreenName: ScreenName;
  apiCall: (itemId: string) => Promise<void>;
}

export const ITEM_ACTIONS: Record<'markDone' | 'delete', ItemAction> = {
  markDone: {
    kind: 'markDone',
    confirmScreenName: 'mark-done-confirm',
    toastScreenName: 'mark-done-toast',
    apiCall: markTaskDone,
  },
  delete: {
    kind: 'delete',
    confirmScreenName: 'delete-confirm',
    toastScreenName: 'delete-toast',
    apiCall: deletePage,
  },
};

let actionToastTimeout: ReturnType<typeof setTimeout> | null = null;

export function openConfirm(
  action: ItemAction,
  itemId: string,
  itemName: string,
  returnTo: ScreenName,
): void {
  state.pendingAction = { kind: action.kind, itemId, itemName, returnTo };
  state.errorMessage = '';
  navigate(action.confirmScreenName);
}

export function dismissConfirm(): void {
  const returnTo = state.pendingAction?.returnTo ?? 'tasks-menu';
  state.pendingAction = null;
  navigate(returnTo);
}

/**
 * Removes an item from whichever list actually owns it — Today and Overdue
 * are both filtered views over the same 'today' data key (see
 * DATA_KEY_OVERRIDES).
 */
function removeItemFromOwningList(itemId: string, returnTo: ScreenName): void {
  const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
  const list = (state.lists[dataKey] ?? []).filter((item) => item.id !== itemId);
  state.lists[dataKey] = list;
  void saveCachedList(cacheKeyForListView(dataKey), list);
}

export async function confirmAction(): Promise<void> {
  const pending = state.pendingAction;
  if (!pending) return;
  const { kind, itemId, returnTo } = pending;
  const action = ITEM_ACTIONS[kind];

  const spinner = startSpinner(() => void renderUpdate(action.confirmScreenName));

  try {
    await action.apiCall(itemId);
    removeItemFromOwningList(itemId, returnTo);

    state.pendingAction = null;
    state.actionToast = { kind, itemName: pending.itemName, returnTo, untilMs: Date.now() + 1500 };
    navigate(action.toastScreenName);

    if (actionToastTimeout !== null) clearTimeout(actionToastTimeout);
    actionToastTimeout = setTimeout(() => {
      actionToastTimeout = null;
      state.actionToast = null;
      navigate(returnTo);
    }, 1500);
  } catch (e) {
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error';
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
  state.actionToast = null;
  navigate(returnTo);
}
