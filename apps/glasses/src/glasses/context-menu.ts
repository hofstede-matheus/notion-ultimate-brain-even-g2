import { trace } from '../logging/trace';
import type { AppState } from '../state';
import type { ContextMenuItem, GlassCtx } from './types';

/**
 * The OS contextual menu declared on the task and note **details** screens
 * (see modules/_shared/details-screen.ts) — raised by tap-then-long-press
 * (SDK 0.0.14+ / simulator 0.9.1+).
 *
 * It deliberately does NOT live on the list screens, even though that is
 * where it would be fastest to reach. A contextual menu is page-scoped, not
 * row-scoped, so a menu declared on a list has to work out for itself which
 * row was highlighted when the press started — and the platform gives it no
 * way to:
 *
 * - `LONG_PRESS_EVENT` arrives as a bare `sysEvent`, and `Sys_ItemEvent`
 *   carries only `eventType`/`eventSource`/`imuData` — there is no row index
 *   in that message at all. Only `List_ItemEvent` has
 *   `currentSelectItemIndex`, and only a CLICK populates it.
 * - Moving the highlight on a native list container emits nothing whatsoever
 *   to the app: the firmware owns list scrolling, and SCROLL_TOP/BOTTOM are
 *   boundary events, not per-swipe ones.
 * - `EvenAppBridge` exposes no way to query the current selection, and
 *   `ListContainerProperty` has no field to read or set it.
 *
 * Confirmed on both the desktop simulator (0.9.3) and real G2 hardware: a
 * menu on a list acts on a guessed row, which is usually the wrong task.
 * Anchoring the menu to the details screen removes the guess entirely —
 * `state.selectedTask`/`selectedNote` was set by the tap that opened the
 * screen, so the target is known exactly.
 *
 * IDs are stable, non-zero uint32s, unique across BOTH menus even though
 * only one is ever declared at a time — that keeps the flat handler table
 * below unambiguous and makes a trace line legible on its own. Never reuse a
 * retired id: 1 ("Task Details") and 11 ("Note Details") are retired, since
 * the menu is now raised from those screens rather than opening them.
 */
const TASK_MENU_ID = {
  OPEN: 6,
  DUE: 2,
  PROJECT: 3,
  DONE: 4,
  DELETE: 5,
} as const;

const NOTE_MENU_ID = {
  OPEN: 16,
  PROJECT: 12,
  DELETE: 13,
} as const;

/** Declared on the Task Details screen. Read actions first, destructive last — same ordering
 * principle the old task-actions screen used. */
export const TASK_CONTEXT_MENU: ContextMenuItem[] = [
  { id: TASK_MENU_ID.OPEN, label: 'Open page' },
  { id: TASK_MENU_ID.DUE, label: 'Change due date' },
  { id: TASK_MENU_ID.PROJECT, label: 'Change project' },
  { id: TASK_MENU_ID.DONE, label: 'Mark as done' },
  { id: TASK_MENU_ID.DELETE, label: 'Delete task' },
];

/** Declared on the Note Details screen — the task menu minus the two things a note has no
 * concept of: it is never "done", and it has no due date to change. */
export const NOTE_CONTEXT_MENU: ContextMenuItem[] = [
  { id: NOTE_MENU_ID.OPEN, label: 'Open page' },
  { id: NOTE_MENU_ID.PROJECT, label: 'Change project' },
  { id: NOTE_MENU_ID.DELETE, label: 'Delete note' },
];

type MenuHandler = (state: AppState, ctx: GlassCtx) => void;

/**
 * Flat id -> handler table for every item across both menus. Each handler
 * reads its target off `state.selectedTask`/`selectedNote` — set by
 * ctx.selectTask()/selectNote() when the row was tapped
 * (screen-factories.ts's makeListScreen) — rather than carrying it itself,
 * since the click event only ever gives back an itemID.
 *
 * "Open page" hands the reader `'task-details'`/`'note-details'` as its
 * returnTo, so a double-tap out of the reader lands back on the screen the
 * menu was raised from rather than skipping a level to the list.
 *
 * The mutating actions instead use the item's own `returnTo` (the list it
 * came from): once a task is done or deleted its details screen has nothing
 * left to show, so the confirm/toast round trip goes back to the list.
 */
const MENU_HANDLERS: Record<number, MenuHandler> = {
  [TASK_MENU_ID.OPEN]: (state, ctx) => {
    const task = state.selectedTask;
    if (!task) return;
    ctx.openPage(task.taskId, task.taskName, 'task-details');
  },
  [TASK_MENU_ID.DUE]: (state, ctx) => {
    if (!state.selectedTask) return;
    ctx.openDueDatePicker();
  },
  [TASK_MENU_ID.PROJECT]: (state, ctx) => {
    const task = state.selectedTask;
    if (!task) return;
    ctx.openProjectPicker(task.taskId, task.taskName, task.returnTo, state.screen);
  },
  [TASK_MENU_ID.DONE]: (state, ctx) => {
    const task = state.selectedTask;
    if (!task) return;
    ctx.openConfirm('markDone', task.taskId, task.taskName, task.returnTo);
  },
  [TASK_MENU_ID.DELETE]: (state, ctx) => {
    const task = state.selectedTask;
    if (!task) return;
    ctx.openConfirm('delete', task.taskId, task.taskName, task.returnTo);
  },

  [NOTE_MENU_ID.OPEN]: (state, ctx) => {
    const note = state.selectedNote;
    if (!note) return;
    ctx.openPage(note.noteId, note.noteName, 'note-details');
  },
  [NOTE_MENU_ID.PROJECT]: (state, ctx) => {
    const note = state.selectedNote;
    if (!note) return;
    ctx.openProjectPicker(note.noteId, note.noteName, note.returnTo, state.screen);
  },
  [NOTE_MENU_ID.DELETE]: (state, ctx) => {
    const note = state.selectedNote;
    if (!note) return;
    ctx.openConfirm('delete', note.noteId, note.noteName, note.returnTo);
  },
};

/**
 * Marks the task whose details are on screen as done, through the same
 * confirmation the menu's own "Mark as done" opens — never straight to the
 * API. This is what a plain **hold** (LONG_PRESS_EVENT, distinct from the
 * tap-then-hold that raises the menu) does on the Task Details screen, so
 * the most common action on a task costs one gesture instead of four.
 *
 * A note has no equivalent: it is never "done", so note-details declares no
 * hold action at all.
 */
export function holdToMarkDone(state: AppState, ctx: GlassCtx): void {
  const task = state.selectedTask;
  if (!task) return;
  trace.info('MENU', 'hold -> mark as done', { id: task.taskId });
  ctx.openConfirm('markDone', task.taskId, task.taskName, task.returnTo);
}

/**
 * Dispatches a `menuItemClickEvent`'s itemID. A missing target is a silent
 * no-op rather than a throw: the OS menu is fire-and-forget with no
 * acknowledgement path back, so there is nothing to show for a rejected
 * action anyway.
 */
export function handleMenuItemClick(itemID: number, state: AppState, ctx: GlassCtx): void {
  const handler = MENU_HANDLERS[itemID];
  if (!handler) {
    trace.warn('MENU', `unknown menu item id=${itemID}`);
    return;
  }
  trace.info('MENU', `item ${itemID} selected`, { screen: state.screen });
  handler(state, ctx);
}
