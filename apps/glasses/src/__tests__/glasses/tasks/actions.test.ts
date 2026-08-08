/**
 * Tapping a task on a list screen — opens the task action menu, and Task
 * Details fetches the task's project/due date.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchPageMetadata } from '../../../api';
import { back, mount, select } from '../harness';

afterEach(() => {
  vi.clearAllMocks();
});

const TASK = { id: 't1', name: 'Buy milk' };

describe('tapping a task on a list screen', () => {
  it('opens the task action menu with the tapped task selected', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];

    h.dispatch(select(0));

    expect(h.state.selectedTask).toEqual({ taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' });
    expect(h.state.screen).toBe('task-actions');

    const display = h.render();
    expect(display).toMatchObject({
      mode: 'list',
      items: [
        'Task Details',
        'Open page',
        'Change due date',
        'Change project',
        'Mark as done',
        'Delete task',
      ],
    });
  });

  it('GO_BACK returns to the list the task was opened from', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));

    h.dispatch(back());

    expect(h.state.screen).toBe('inbox');
  });
});

describe('Task Details', () => {
  it('fetches and shows the task title, project, and due date', async () => {
    vi.mocked(fetchPageMetadata).mockResolvedValue({ project: 'Groceries', due: '2026-07-25' });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0)); // -> task-actions

    h.dispatch(select(0)); // Task Details
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
      expect(display.content).toContain('Task:\nBuy milk');
      expect(display.content).toContain('Project:\nGroceries');
      expect(display.content).toContain('Due:\nJul 25, 2026');
    }
  });

  it('keeps long task and project names in the scrollable text container', async () => {
    const taskName = 'A detailed task title that is intentionally long enough to overflow '.repeat(
      3,
    );
    const project = 'A project name that is intentionally long enough to overflow '.repeat(3);
    vi.mocked(fetchPageMetadata).mockResolvedValue({ project, due: '2026-07-25' });
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [{ id: 't1', name: taskName }];
    h.dispatch(select(0));
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
    vi.mocked(fetchPageMetadata).mockRejectedValue(new Error('offline'));
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));

    h.dispatch(select(0));
    await h.settle();

    expect(h.state.taskDetails).toMatchObject({ loading: false, error: 'offline' });
  });

  it('GO_BACK from metadata returns to the task action menu', () => {
    const h = mount();
    h.state.screen = 'inbox';
    h.state.lists.inbox = [TASK];
    h.dispatch(select(0));
    h.dispatch(select(0)); // Task Details (still loading — fine for this assertion)

    h.dispatch(back());

    expect(h.state.screen).toBe('task-actions');
  });
});
