/**
 * The OS contextual menu (glasses/context-menu.ts) — the five task actions
 * and three note actions that replaced the app-drawn task-actions/note-actions
 * screens, and the flat handler table a menuItemClickEvent dispatches through.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api', async () => (await import('./fakes')).apiMock());
vi.mock('../../cache', async () => (await import('./fakes')).cacheMock());
vi.mock('../../stt', async () => (await import('./fakes')).sttMock());

import { NOTE_CONTEXT_MENU, TASK_CONTEXT_MENU } from '../../glasses/context-menu';
import { back, longPress, menuItemId, mount, select } from './harness';

const ALL_ITEMS = [...TASK_CONTEXT_MENU, ...NOTE_CONTEXT_MENU];

describe('menu item shape', () => {
  it('every label fits the 32-byte UTF-8 cap the firmware rejects the whole rebuild over', () => {
    const encoder = new TextEncoder();
    for (const item of ALL_ITEMS) {
      expect(encoder.encode(item.label).length).toBeLessThanOrEqual(32);
    }
  });

  it('every id is a non-zero positive integer, unique across both menus', () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('neither menu offers Open page or a duplicate of the row itself — a tap already does that', () => {
    expect(TASK_CONTEXT_MENU.some((i) => i.label === 'Open page')).toBe(false);
    expect(NOTE_CONTEXT_MENU.some((i) => i.label === 'Open page')).toBe(false);
  });

  it('the task menu is read-first, destructive-last: Task Details then Delete task', () => {
    expect(TASK_CONTEXT_MENU[0]?.label).toBe('Task Details');
    expect(TASK_CONTEXT_MENU.at(-1)?.label).toBe('Delete task');
  });

  it('the note menu has no Mark as done or Change due date — notes have neither concept', () => {
    const labels = NOTE_CONTEXT_MENU.map((i) => i.label);
    expect(labels).not.toContain('Mark as done');
    expect(labels).not.toContain('Change due date');
  });
});

describe('handleMenuItemClick dispatch', () => {
  it('an unknown item id is a silent no-op', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(longPress(0));

    expect(() => h.menuClick(999_999)).not.toThrow();
    expect(h.state.screen).toBe('inbox');
    expect(h.state.pendingAction).toBeNull();
  });

  it('a handler with no selected task no-ops instead of throwing', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.selectedTask = null;

    expect(() => h.menuClick(menuItemId(TASK_CONTEXT_MENU, 'Delete task'))).not.toThrow();
    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });

  it('a handler with no selected note no-ops instead of throwing', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.selectedNote = null;

    expect(() => h.menuClick(menuItemId(NOTE_CONTEXT_MENU, 'Delete note'))).not.toThrow();
    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('notes-inbox');
  });

  it('Mark as done opens the confirm dialog for the task the long-press selected', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(longPress(0));

    h.menuClick(menuItemId(TASK_CONTEXT_MENU, 'Mark as done'));

    expect(h.state.screen).toBe('mark-done-confirm');
    expect(h.state.pendingAction).toMatchObject({ kind: 'markDone', itemId: 't1' });
  });

  it('Delete note opens the confirm dialog for the note the long-press selected', () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [{ id: 'n1', name: 'Meeting recap' }];
    h.dispatch(longPress(0));

    h.menuClick(menuItemId(NOTE_CONTEXT_MENU, 'Delete note'));

    expect(h.state.screen).toBe('delete-confirm');
    expect(h.state.pendingAction).toMatchObject({ kind: 'delete', itemId: 'n1' });
  });

  it('Change project seeds backTo with the list screen the menu was raised from', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(longPress(0));

    h.menuClick(menuItemId(TASK_CONTEXT_MENU, 'Change project'));
    await h.settle();

    expect(h.state.screen).toBe('project-picker');
    expect(h.state.projectPicker).toMatchObject({
      itemId: 't1',
      returnTo: 'inbox',
      backTo: 'inbox',
    });
  });
});

describe('long-press with no row index (LONG_PRESS_EVENT carrying none)', () => {
  // Real hardware is documented to deliver the OS's own currentSelectItemIndex
  // on LONG_PRESS_EVENT (SDK 0.0.14+), but the desktop simulator sends a bare
  // sysEvent with no index at all (confirmed against 0.9.3) — this is the
  // fallback path state.lastHighlightedIndex exists for.

  it('falls back to the row a previous tap resolved on the same screen', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [
      { id: 't1', name: 'Buy milk' },
      { id: 't2', name: 'Buy eggs' },
    ];
    h.dispatch(select(1)); // tap row 1 — opens the page and remembers the index
    await h.settle();
    h.dispatch(back()); // back to the list; the memory survives

    h.dispatch(longPress()); // no itemIndex at all — the simulator's shape

    expect(h.state.selectedTask).toMatchObject({ taskId: 't2', taskName: 'Buy eggs' });
  });

  it('falls back to the row a previous long-press (with its own index) resolved', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [
      { id: 't1', name: 'Buy milk' },
      { id: 't2', name: 'Buy eggs' },
    ];
    h.dispatch(longPress(1));
    expect(h.state.selectedTask).toMatchObject({ taskId: 't2' });

    h.dispatch(longPress()); // a second gesture, again with no index

    expect(h.state.selectedTask).toMatchObject({ taskId: 't2', taskName: 'Buy eggs' });
  });

  it('with nothing to fall back on either, defaults to row 0 — a freshly entered list highlights its first row', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [
      { id: 't1', name: 'Buy milk' },
      { id: 't2', name: 'Buy eggs' },
    ];

    h.dispatch(longPress()); // never tapped or long-pressed anything on this screen before

    expect(h.state.selectedTask).toMatchObject({ taskId: 't1', taskName: 'Buy milk' });
  });

  it('an empty list still clears any stale target rather than acting on it', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [];
    h.state.selectedTask = { taskId: 'stale', taskName: 'Stale task', returnTo: 'inbox' };

    h.dispatch(longPress());

    expect(h.state.selectedTask).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });
});
