/**
 * Tapping a project opens its drill-down menu (Open page / Tasks / Notes),
 * which reads/writes state.selectedProject and drills into the
 * project-scoped task/note lists via the generic enterView() pipeline.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import {
  fetchNotesForProject,
  fetchPageMarkdown,
  fetchProjectTasksDone,
  fetchProjectTasksTodo,
} from '../../../api';
import { back, mount, select } from '../harness';

const PROJECT = { id: 'p1', name: 'Kitchen Remodel' };

describe('tapping a project on a list screen', () => {
  it('opens the project drill-down menu', () => {
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];

    h.dispatch(select(0));

    expect(h.state.selectedProject).toEqual({
      id: 'p1',
      name: 'Kitchen Remodel',
      returnTo: 'projects-doing',
    });
    expect(h.state.screen).toBe('project-detail');
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Open page', 'Tasks', 'Notes'] });
  });

  it('GO_BACK returns to the list the project was opened from', () => {
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0));

    h.dispatch(back());

    expect(h.state.screen).toBe('projects-doing');
  });
});

describe('drilling into a project', () => {
  it('Tasks opens the To Do / Done submenu without fetching', () => {
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0)); // -> project-detail, selectedProject set

    h.dispatch(select(1)); // Tasks

    expect(h.state.screen).toBe('project-tasks-menu');
    expect(fetchProjectTasksTodo).not.toHaveBeenCalled();
    expect(fetchProjectTasksDone).not.toHaveBeenCalled();
    expect(h.render()).toMatchObject({ mode: 'list', items: ['To Do', 'Done'] });
  });

  it('To Do fetches and shows the project-scoped to-do task list', async () => {
    vi.mocked(fetchProjectTasksTodo).mockResolvedValue({
      items: [{ id: 't1', name: 'Pick tile', status: 'To Do' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0)); // -> project-detail, selectedProject set
    h.dispatch(select(1)); // -> project-tasks-menu

    h.dispatch(select(0)); // To Do
    await h.settle();

    expect(fetchProjectTasksTodo).toHaveBeenCalledWith('p1', undefined);
    expect(h.state.screen).toBe('project-tasks-todo');
    expect(h.state.lists['project-tasks-todo']).toEqual([
      { id: 't1', name: 'Pick tile', status: 'To Do' },
    ]);
    const display = h.render();
    expect(display).toMatchObject({ mode: 'list', items: ['[ ] Pick tile'] });
  });

  it('Done fetches and shows the project-scoped done task list', async () => {
    vi.mocked(fetchProjectTasksDone).mockResolvedValue({
      items: [{ id: 't2', name: 'Buy tile', status: 'Done' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0));
    h.dispatch(select(1)); // -> project-tasks-menu

    h.dispatch(select(1)); // Done
    await h.settle();

    expect(fetchProjectTasksDone).toHaveBeenCalledWith('p1', undefined);
    expect(h.state.screen).toBe('project-tasks-done');
    expect(h.state.lists['project-tasks-done']).toEqual([
      { id: 't2', name: 'Buy tile', status: 'Done' },
    ]);
    const display = h.render();
    expect(display).toMatchObject({ mode: 'list', items: ['[v] Buy tile'] });
  });

  it('Notes fetches and shows the project-scoped note list', async () => {
    vi.mocked(fetchNotesForProject).mockResolvedValue({
      items: [{ id: 'n1', name: 'Design notes' }],
      hasMore: false,
      nextCursor: null,
    });
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0));

    h.dispatch(select(2)); // Notes
    await h.settle();

    expect(fetchNotesForProject).toHaveBeenCalledWith('p1', undefined);
    expect(h.state.screen).toBe('project-notes');
    expect(h.state.lists['project-notes']).toEqual([{ id: 'n1', name: 'Design notes' }]);
  });

  it('Open page reads the project itself', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({
      markdown: '# Kitchen Remodel',
      truncated: false,
    });
    const h = mount();
    h.state.screen = 'projects-doing';
    h.state.lists['projects-doing'] = [PROJECT];
    h.dispatch(select(0));

    h.dispatch(select(0)); // Open page
    await h.settle();

    expect(h.state.screen).toBe('page-content');
    expect(h.state.pageContent?.title).toBe('Kitchen Remodel');
    expect(h.state.pageContent?.returnTo).toBe('project-detail');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
