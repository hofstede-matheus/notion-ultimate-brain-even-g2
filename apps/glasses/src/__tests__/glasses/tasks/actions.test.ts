/**
 * Tapping a task on a list screen opens its Task Details — not the page
 * reader, which costs an extra markdown fetch. Details is where both the OS
 * contextual menu and the plain-hold shortcut live, since it is the only
 * place the target task is unambiguous (see glasses/context-menu.ts).
 * A hold on the list itself is inert.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageDetails, fetchPageMarkdown } from '../../../api';
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
  it('opens Task Details, with the task stashed for the contextual menu', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.selectedTask).toEqual({ taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('task-details');
  });

  it('does not open the page reader — reading costs an extra fetch and is a menu item away', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.screen).not.toBe('page-content');
    expect(h.state.pageContent).toBeNull();
    expect(fetchPageMarkdown).not.toHaveBeenCalled();
  });

  it('GO_BACK from details returns to the list the task was opened from', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(back());

    expect(h.state.screen).toBe('inbox');
  });
});

describe('a list screen declares no contextual menu', () => {
  // A menu anchored to a list cannot know which row is highlighted: LONG_PRESS_EVENT carries
  // no index, and moving a native list's highlight emits nothing at all to the app. It
  // guessed wrong on both the simulator and real hardware, so it moved to Task Details.
  it('renders no menu on the list itself', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    expect(h.render().menu).toBeUndefined();
  });

  it('a hold on a list row does nothing at all', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(longPress(0));

    expect(h.state.screen).toBe('inbox');
    expect(h.state.selectedTask).toBeNull();
    expect(h.state.pendingAction).toBeNull();
  });
});

describe('the Task Details contextual menu', () => {
  it('declares the five task actions, Open page first and Delete last', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    await h.settle();

    const display = h.render();
    expect(display.menu?.map((i) => i.label)).toEqual([
      'Open page',
      'Change due date',
      'Change project',
      'Mark as done',
      'Delete task',
    ]);
  });

  it('holding on Task Details opens the mark-done confirmation for that task', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    await h.settle();

    h.dispatch(longPress());

    expect(h.state.screen).toBe('mark-done-confirm');
    expect(h.state.pendingAction).toMatchObject({
      kind: 'markDone',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
    });
  });

  it('"Open page" opens the reader, returning to details rather than skipping to the list', async () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    await h.settle();

    h.menuClick(menuId('Open page'));
    await h.settle();

    expect(h.state.screen).toBe('page-content');
    expect(h.state.pageContent).toMatchObject({ title: 'Buy milk', returnTo: 'task-details' });
  });
});

describe('Task Details', () => {
  it('fetches and shows the task title, project, and due date', async () => {
    vi.mocked(fetchPageDetails).mockResolvedValue({ project: 'Groceries', due: '2026-07-25' });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(select(0));
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
    h.dispatch(select(0));
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

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.taskDetails).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from details returns to the list the task came from', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0)); // still loading — fine for this assertion

    h.dispatch(back());

    expect(h.state.screen).toBe('inbox');
  });
});
