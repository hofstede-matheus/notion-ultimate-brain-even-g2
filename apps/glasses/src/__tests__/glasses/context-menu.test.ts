/**
 * The OS contextual menu (glasses/context-menu.ts) — the five task actions
 * and three note actions that replaced the app-drawn task-actions/note-actions
 * screens, and the flat handler table a menuItemClickEvent dispatches through.
 *
 * The menu is declared on the Task/Note Details screens, not on the lists: a
 * list-anchored menu has no way to learn which row is highlighted, and acted
 * on the wrong item on both the simulator and real hardware. Tapping a row
 * opens details, which is what sets the target these handlers read.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api', async () => (await import('./fakes')).apiMock());
vi.mock('../../cache', async () => (await import('./fakes')).cacheMock());
vi.mock('../../stt', async () => (await import('./fakes')).sttMock());

import { NOTE_CONTEXT_MENU, TASK_CONTEXT_MENU } from '../../glasses/context-menu';
import { menuItemId, mount, select } from './harness';

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

  it('neither menu duplicates the screen it is raised from — no Task/Note Details item', () => {
    expect(TASK_CONTEXT_MENU.some((i) => i.label === 'Task Details')).toBe(false);
    expect(NOTE_CONTEXT_MENU.some((i) => i.label === 'Note Details')).toBe(false);
  });

  it('both menus offer Open page — a tap opens details now, so reading needs its own way in', () => {
    expect(TASK_CONTEXT_MENU.some((i) => i.label === 'Open page')).toBe(true);
    expect(NOTE_CONTEXT_MENU.some((i) => i.label === 'Open page')).toBe(true);
  });

  it('the task menu is read-first, destructive-last: Open page then Delete task', () => {
    expect(TASK_CONTEXT_MENU[0]?.label).toBe('Open page');
    expect(TASK_CONTEXT_MENU.at(-1)?.label).toBe('Delete task');
  });

  it('no retired id is reused — 1 and 11 were Task/Note Details', () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(11);
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
    h.ctx.selectTask('t1', 'Buy milk', 'inbox');

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

  it('Mark as done opens the confirm dialog for the task whose details are open', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    h.dispatch(select(0));
    await h.settle();

    h.menuClick(menuItemId(TASK_CONTEXT_MENU, 'Mark as done'));

    expect(h.state.screen).toBe('mark-done-confirm');
    expect(h.state.pendingAction).toMatchObject({ kind: 'markDone', itemId: 't1' });
  });

  it('Delete note opens the confirm dialog for the note whose details are open', async () => {
    const h = mount();
    h.state.screen = 'notes-inbox';
    h.state.lists['notes-inbox'] = [{ id: 'n1', name: 'Meeting recap' }];
    h.dispatch(select(0));
    await h.settle();

    h.menuClick(menuItemId(NOTE_CONTEXT_MENU, 'Delete note'));

    expect(h.state.screen).toBe('delete-confirm');
    expect(h.state.pendingAction).toMatchObject({ kind: 'delete', itemId: 'n1' });
  });

  it('the target is the row that was tapped, not the first row of the list', async () => {
    // The defect that moved the menu off the lists: with a list-anchored menu the app had to
    // guess the highlighted row and fell back to row 0, so acting on the second task marked
    // the first one done. Reached through details, the target is exact.
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [
      { id: 't1', name: 'Ver email suporte' },
      { id: 't2', name: 'teste1' },
    ];
    h.dispatch(select(1));
    await h.settle();

    h.menuClick(menuItemId(TASK_CONTEXT_MENU, 'Mark as done'));

    expect(h.state.pendingAction).toMatchObject({ itemId: 't2', itemName: 'teste1' });
  });

  it('Change project seeds backTo with the list screen the menu was raised from', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.ctx.selectTask('t1', 'Buy milk', 'inbox');

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
