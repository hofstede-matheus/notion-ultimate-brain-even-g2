/**
 * The "Change project" flow: task-actions -> project picker -> confirm ->
 * toast, reached from the task action menu. Notes exercise the same shared
 * screens from note-actions — see notes/set-project.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchDoingProjects, fetchInboxTasks, setPageProject } from '../../../api';
import type { ScreenName } from '../../../state';
import { back, mount, select } from '../harness';

const TASK = { id: 't1', name: 'Buy milk' };
const PROJECTS = [
  { id: 'p1', name: 'Groceries' },
  { id: 'p2', name: 'Errands' },
];

async function openPicker(h: ReturnType<typeof mount>, returnScreen: ScreenName = 'inbox') {
  h.state.screen = returnScreen;
  h.state.lists[returnScreen] = [TASK];
  h.dispatch(select(0)); // -> task-actions
  h.dispatch(select(3)); // Change project -> project-picker
  await h.settle();
  h.dispatch(select(2)); // Doing
  await h.settle();
}

beforeEach(() => {
  vi.mocked(fetchDoingProjects).mockResolvedValue({
    items: PROJECTS,
    hasMore: false,
    nextCursor: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('opening the project picker', () => {
  it('lists "— No project —" first, then project status filters', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    h.dispatch(select(3));
    await h.settle();
    expect(h.render()).toMatchObject({
      mode: 'list',
      items: [
        '— No project —',
        'All',
        'Doing',
        'Ongoing',
        'Planned',
        'On Hold',
        'Done',
        'Archived',
      ],
    });
  });

  it('opens the selected status list and returns to the picker', async () => {
    const h = mount();
    await openPicker(h);

    expect(fetchDoingProjects).toHaveBeenCalled();
    expect(h.state.screen).toBe('projects-doing');
    h.dispatch(back());

    expect(h.state.screen).toBe('project-picker');
  });
});

describe('picking a project', () => {
  it('tapping a project opens the confirm dialog', async () => {
    const h = mount();
    await openPicker(h);

    h.dispatch(select(1)); // Groceries

    expect(h.state.screen).toBe('set-project-confirm');
    expect(h.state.pendingAction).toMatchObject({
      kind: 'setProject',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
      project: { id: 'p1', name: 'Groceries' },
    });
    expect(h.render()).toMatchObject({ mode: 'list', items: ['To Groceries', 'Cancel'] });
  });

  it('tapping "— No project —" opens the confirm dialog with a null project', async () => {
    const h = mount();
    await openPicker(h);

    h.dispatch(back());
    h.dispatch(select(0)); // the sentinel row

    expect(h.state.pendingAction).toMatchObject({
      kind: 'setProject',
      project: { id: null, name: 'No project' },
    });
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Clear project', 'Cancel'] });
  });

  it('Cancel dismisses back to the list the task was opened from', async () => {
    const h = mount();
    await openPicker(h);
    h.dispatch(select(1));

    h.dispatch(select(1)); // Cancel

    expect(h.state.pendingAction).toBeNull();
    expect(h.state.screen).toBe('inbox');
  });
});

describe('confirming a project change', () => {
  it('calls setPageProject, removes a now-assigned task from the Inbox, and shows the toast', async () => {
    vi.mocked(setPageProject).mockResolvedValue(undefined);
    const h = mount();
    await openPicker(h);
    h.dispatch(select(1)); // Groceries

    h.dispatch(select(0)); // Confirm
    await h.settle();

    expect(setPageProject).toHaveBeenCalledWith('t1', 'p1');
    expect(h.state.lists.inbox).toEqual([]);
    expect(h.state.pendingAction).toBeNull();
    expect(h.state.actionToast).toMatchObject({
      kind: 'setProject',
      project: { id: 'p1', name: 'Groceries' },
    });
    expect(h.state.screen).toBe('set-project-toast');
    expect(h.render()).toMatchObject({ mode: 'text' });
  });

  it('does not remove the task from Today, which is not project-scoped', async () => {
    vi.mocked(setPageProject).mockResolvedValue(undefined);
    const h = mount();
    await openPicker(h, 'today');
    h.dispatch(select(1)); // Groceries

    h.dispatch(select(0)); // Confirm
    await h.settle();

    expect(h.state.lists.today).toEqual([TASK]);
  });

  it('clearing a project removes the task from the project list it was scoped to', async () => {
    vi.mocked(setPageProject).mockResolvedValue(undefined);
    const h = mount();
    h.state.screen = 'project-tasks-todo';
    h.state.selectedProject = { id: 'p1', name: 'Groceries', returnTo: 'projects-doing' };
    h.state.lists['project-tasks-todo'] = [TASK];
    h.dispatch(select(0)); // -> task-actions
    h.dispatch(select(3)); // Change project -> project-picker
    await h.settle();

    h.dispatch(select(0)); // the sentinel row -> confirm
    h.dispatch(select(0)); // Confirm
    await h.settle();

    expect(setPageProject).toHaveBeenCalledWith('t1', null);
    expect(h.state.lists['project-tasks-todo']).toEqual([]);
  });

  it('refreshes the originating list 1.5s after the toast', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(setPageProject).mockResolvedValue(undefined);
      const h = mount();
      await openPicker(h);
      h.dispatch(select(1));
      h.dispatch(select(0));
      await h.settle();
      expect(h.state.screen).toBe('set-project-toast');

      vi.advanceTimersByTime(1500);
      await h.settle();

      expect(h.state.actionToast).toBeNull();
      expect(h.state.screen).toBe('inbox');
      expect(fetchInboxTasks).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('on API failure, shows the error and stays on the confirm screen', async () => {
    vi.mocked(setPageProject).mockRejectedValue(new Error('offline'));
    const h = mount();
    await openPicker(h);
    h.dispatch(select(1));

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.errorMessage).toBe('offline');
    expect(h.state.screen).toBe('set-project-confirm');
    const display = h.render();
    expect(display.mode).toBe('list');
    if (display.mode === 'list') expect(display.header).toContain('FAILED: offline');
  });
});
