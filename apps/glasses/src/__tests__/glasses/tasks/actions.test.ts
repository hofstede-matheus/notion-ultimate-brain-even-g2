/**
 * Tapping a task on a list screen opens the page reader directly; a
 * long-press stashes the task for the OS contextual menu without
 * navigating. Task Details is one of that menu's items.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageDetails } from '../../../api';
import { TASK_CONTEXT_MENU } from '../../../glasses/context-menu';
import { back, longPress, menuItemId, mount, select } from '../harness';

afterEach(() => {
  vi.clearAllMocks();
});

const TASK = { id: 't1', name: 'Buy milk' };

function menuId(label: string): number {
  return menuItemId(TASK_CONTEXT_MENU, label);
}

describe('tapping a task on a list screen', () => {
  it('opens the page reader directly, with the task stashed for the contextual menu', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.selectedTask).toEqual({ taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('page-content');
    expect(h.state.pageContent).toMatchObject({ title: 'Buy milk', returnTo: 'inbox' });
  });

  it('GO_BACK from the reader returns to the list the task was opened from', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.screen).toBe('inbox');
  });
});

describe('long-pressing a task on a list screen', () => {
  it('stashes the tapped task without navigating', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(longPress(0));

    expect(h.state.selectedTask).toEqual({ taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('inbox');
  });

  it('declares the five task actions as the OS contextual menu', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    const display = h.render();
    expect(display.menu?.map((i) => i.label)).toEqual([
      'Task Details',
      'Change due date',
      'Change project',
      'Mark as done',
      'Delete task',
    ]);
  });
});

describe('Task Details', () => {
  it('fetches and shows the task title, project, and due date', async () => {
    vi.mocked(fetchPageDetails).mockResolvedValue({ project: 'Groceries', due: '2026-07-25' });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(longPress(0));

    h.menuClick(menuId('Task Details'));
    await h.settle();

    expect(h.state.taskDetails).toEqual({
      loading: false,
      project: 'Groceries',
      due: '2026-07-25',
      error: '',
    });
    expect(h.state.screen).toBe('task-details');
    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('TASK DETAILS');
      expect(display.content).toContain('Task:\nBuy milk');
      expect(display.content).toContain('Project:\nGroceries');
      expect(display.content).toContain('Due:\nJul 25, 2026');
      expect(display.content).toContain('Double-tap to go back.');
    }
  });

  it('shows the back hint while the details are still loading', () => {
    const h = mount();
    h.state.screen = 'task-details';
    h.state.taskDetails = { loading: true, project: null, due: null, error: '' };

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('Loading…');
      expect(display.content).toContain('Double-tap to go back.');
    }
  });

  it('falls back to a placeholder title when no task is selected', () => {
    const h = mount();
    h.state.screen = 'task-details';
    h.state.taskDetails = { loading: false, project: null, due: null, error: '' };
    h.state.selectedTask = null;

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain('Task:\n(unknown task)');
      expect(display.content).toContain('Project:\n(none)');
      expect(display.content).toContain('Due:\n(none)');
    }
  });

  it('keeps long task and project names in the scrollable text container', async () => {
    const taskName = 'A detailed task title that is intentionally long enough to overflow '.repeat(
      3,
    );
    const project = 'A project name that is intentionally long enough to overflow '.repeat(3);
    vi.mocked(fetchPageDetails).mockResolvedValue({ project, due: '2026-07-25' });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: taskName }];
    h.dispatch(longPress(0));
    h.menuClick(menuId('Task Details'));
    await h.settle();

    const display = h.render();
    expect(display.mode).toBe('text');
    if (display.mode === 'text') {
      expect(display.content).toContain(taskName);
      expect(display.content).toContain(project);
      expect(display.content).not.toContain('1/2');
    }
  });

  it('shows the error message when the fetch fails', async () => {
    vi.mocked(fetchPageDetails).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(longPress(0));

    h.menuClick(menuId('Task Details'));
    await h.settle();

    expect(h.state.taskDetails).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from details returns to the list the task came from', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(longPress(0));
    h.menuClick(menuId('Task Details')); // still loading — fine for this assertion

    h.dispatch(back());

    expect(h.state.screen).toBe('inbox');
  });
});
