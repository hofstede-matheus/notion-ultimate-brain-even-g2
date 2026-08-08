import { deletePage, markTaskDone, setPageProject, setTaskDueDate } from '../../../api';
import { saveCachedList } from '../../../cache';
import { trace } from '../../../logging/trace';
import type { ListItem, ScreenName } from '../../../state';
import { state } from '../../../state';
import { renderUpdate } from '../../render';
import {
  cacheKeyForListView,
  DATA_KEY_OVERRIDES,
  enterView,
  navigate,
  startSpinner,
  stopSpinner,
} from './navigation';

// ---------------------------------------------------------------------------
// Item actions — confirm dialog + toast for mark-done, delete, setDue, and
// setProject, unified flow. Shared by tasks ("Mark as done", "Change due
// date", "Change project", "Delete task") and notes ("Change project",
// "Delete note") — the state involved doesn't care which kind of page it's
// acting on, so this is generic over item id/name rather than task-specific.
// `date`/`project` only carry a payload for setDue/setProject respectively.
// ---------------------------------------------------------------------------

type ItemActionKind = 'markDone' | 'delete' | 'setDue' | 'setProject';

type PendingAction = NonNullable<typeof state.pendingAction>;

interface ItemAction {
  kind: ItemActionKind;
  confirmScreenName: ScreenName;
  toastScreenName: ScreenName;
  apiCall: (pending: PendingAction) => Promise<void>;
  /**
   * How to reflect a successful call in local list state. markDone/delete
   * drop the item from whichever list owns it; setDue instead patches its
   * dueDate in place so Today/Overdue (filtered views over the same fetched
   * array — see tasks/helpers.ts) reclassify it without a refetch; setProject
   * drops the item only when the new project no longer matches the list it's
   * being viewed from (see applyProjectToOwningList below).
   */
  applyToOwningList: (pending: PendingAction) => void;
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

/**
 * Removes the item from whichever list it's being viewed from, but only when
 * the new project actually takes it out of that view: the Inbox screens are
 * defined by "no project", so assigning any project removes it from there;
 * a project's own Tasks/Notes screens are defined by "this project", so only
 * changing away from `state.selectedProject` removes it (including clearing
 * it — a `null` new id is compared the same as any other project id would
 * be). Any other list (e.g. Today) isn't project-scoped, so setting a
 * project on an item there must not make it vanish from that list.
 */
function applyProjectToOwningList(pending: PendingAction): void {
  const { itemId, returnTo, project } = pending;
  const newProjectId = project?.id ?? null;

  const removesFromInbox =
    (returnTo === 'inbox' || returnTo === 'notes-inbox') && newProjectId !== null;
  const removesFromProjectList =
    (returnTo === 'project-tasks-todo' ||
      returnTo === 'project-tasks-done' ||
      returnTo === 'project-notes') &&
    newProjectId !== (state.selectedProject?.id ?? null);

  if (removesFromInbox || removesFromProjectList) {
    removeItemFromOwningList(itemId, returnTo);
  }
}

export const ITEM_ACTIONS: Record<ItemActionKind, ItemAction> = {
  markDone: {
    kind: 'markDone',
    confirmScreenName: 'mark-done-confirm',
    toastScreenName: 'mark-done-toast',
    apiCall: (p) => markTaskDone(p.itemId),
    applyToOwningList: (p) => removeItemFromOwningList(p.itemId, p.returnTo),
  },
  delete: {
    kind: 'delete',
    confirmScreenName: 'delete-confirm',
    toastScreenName: 'delete-toast',
    apiCall: (p) => deletePage(p.itemId),
    applyToOwningList: (p) => removeItemFromOwningList(p.itemId, p.returnTo),
  },
  setDue: {
    kind: 'setDue',
    confirmScreenName: 'due-date-confirm',
    toastScreenName: 'due-date-toast',
    apiCall: (p) => setTaskDueDate(p.itemId, p.date),
    applyToOwningList: (p) => patchDueDateInOwningList(p.itemId, p.returnTo, p.date),
  },
  setProject: {
    kind: 'setProject',
    confirmScreenName: 'set-project-confirm',
    toastScreenName: 'set-project-toast',
    apiCall: (p) => setPageProject(p.itemId, p.project?.id ?? null),
    applyToOwningList: applyProjectToOwningList,
  },
};

let actionToastTimeout: ReturnType<typeof setTimeout> | null = null;

export function openConfirm(
  action: ItemAction,
  itemId: string,
  itemName: string,
  returnTo: ScreenName,
  extra?: { date?: string | null; project?: { id: string | null; name: string } },
): void {
  trace.info('ACT', `confirm open kind=${action.kind}`, { id: itemId, name: itemName, ...extra });
  state.pendingAction = { kind: action.kind, itemId, itemName, returnTo, ...extra };
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
  const { kind, returnTo, date, project } = pending;
  const action = ITEM_ACTIONS[kind];

  const spinner = startSpinner(() => void renderUpdate(action.confirmScreenName));
  trace.info('ACT', `calling ${kind} api`, { id: pending.itemId, date, project });

  try {
    await action.apiCall(pending);
    action.applyToOwningList(pending);
    const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
    trace.info('ACT', `ok, applied to ${dataKey}`, { left: (state.lists[dataKey] ?? []).length });

    state.pendingAction = null;
    state.actionToast = {
      kind,
      itemName: pending.itemName,
      returnTo,
      untilMs: Date.now() + 1500,
      date,
      project,
    };
    navigate(action.toastScreenName);

    if (actionToastTimeout !== null) clearTimeout(actionToastTimeout);
    actionToastTimeout = setTimeout(() => {
      actionToastTimeout = null;
      state.actionToast = null;
      void enterView(returnTo);
    }, 1500);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('ACT', `${kind} failed: ${msg}`, { id: pending.itemId });
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
  void enterView(returnTo);
}
