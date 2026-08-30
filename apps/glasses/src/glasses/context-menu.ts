import { trace } from '../logging/trace';
import type { AppState } from '../state';
import type { ContextMenuItem, GlassCtx } from './types';

/**
 * The OS contextual menu declared on task and note list screens (see
 * modules/_shared/screen-factories.ts's makeListScreen) — raised by
 * tap-then-long-press (SDK 0.0.14+ / simulator 0.9.1+). Replaces the old
 * app-drawn task-actions/note-actions screens: a tap on a row now opens its
 * page directly (ctx.openPage), and everything else that used to live in
 * those screens is reached from here instead.
 *
 * "Open page" has no entry here on purpose — a tap already does that, and
 * Even's own design guidance is not to duplicate a page's own controls in
 * its contextual menu (see docs/contextual-menu.md in even-g2-context).
 *
 * IDs are stable, non-zero uint32s, unique across BOTH menus even though
 * only one is ever declared at a time — that keeps the flat handler table
 * below unambiguous and makes a trace line legible on its own. Never reuse a
 * retired id: a stale client could still have it queued.
 */
const TASK_MENU_ID = {
  DETAILS: 1,
  DUE: 2,
  PROJECT: 3,
  DONE: 4,
  DELETE: 5,
} as const;

const NOTE_MENU_ID = {
  DETAILS: 11,
  PROJECT: 12,
  DELETE: 13,
} as const;

/** Declared on a Tasks list screen. Read actions first, destructive last — same ordering
 * principle the old task-actions screen used. */
export const TASK_CONTEXT_MENU: ContextMenuItem[] = [
  { id: TASK_MENU_ID.DETAILS, label: 'Task Details' },
  { id: TASK_MENU_ID.DUE, label: 'Change due date' },
  { id: TASK_MENU_ID.PROJECT, label: 'Change project' },
  { id: TASK_MENU_ID.DONE, label: 'Mark as done' },
  { id: TASK_MENU_ID.DELETE, label: 'Delete task' },
];

/** Declared on a Notes list screen — the task menu minus the two things a note has no
 * concept of: it is never "done", and it has no due date to change. */
export const NOTE_CONTEXT_MENU: ContextMenuItem[] = [
  { id: NOTE_MENU_ID.DETAILS, label: 'Note Details' },
  { id: NOTE_MENU_ID.PROJECT, label: 'Change project' },
  { id: NOTE_MENU_ID.DELETE, label: 'Delete note' },
];

type MenuHandler = (state: AppState, ctx: GlassCtx) => void;

/**
 * Flat id -> handler table for every item across both menus. Each handler
 * reads its target off `state.selectedTask`/`selectedNote` — set by
 * ctx.selectTask()/selectNote() when the long-press resolved which row was
 * highlighted (screen-factories.ts's makeListScreen) — rather than carrying
 * it itself, since the click event only ever gives back an itemID.
 *
 * `backTo` for the project picker is `state.screen` at the moment the
 * handler runs: since selecting a menu item doesn't navigate away first,
 * that's still the list the menu was raised from — the picker's own GO_BACK
 * lands back there (see modules/projects/screens/picker.ts).
 */
const MENU_HANDLERS: Record<number, MenuHandler> = {
  [TASK_MENU_ID.DETAILS]: (state, ctx) => {
    if (!state.selectedTask) return;
    ctx.enterTaskDetails();
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

  [NOTE_MENU_ID.DETAILS]: (state, ctx) => {
    if (!state.selectedNote) return;
    ctx.enterNoteDetails();
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
 * Dispatches a `menuItemClickEvent`'s itemID. A missing target (the
 * long-press landed on a `◂ Prev`/`▸ More` row — see makeListScreen — or the
 * click otherwise arrived with nothing selected) is a silent no-op rather
 * than a throw: the OS menu is fire-and-forget with no acknowledgement path
 * back, so there is nothing to show for a rejected action anyway.
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
