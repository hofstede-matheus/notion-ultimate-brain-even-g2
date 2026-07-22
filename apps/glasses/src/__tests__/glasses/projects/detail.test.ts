/**
 * Tapping a project opens its drill-down menu (Open page / Tasks / Notes),
 * which reads/writes state.selectedProject and drills into the
 * project-scoped task/note lists via the generic enterView() pipeline.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchNotesForProject, fetchPageMarkdown, fetchTasksForProject } from '../../../api';
import { back, mount, select } from '../harness';

const PROJECT = { id: 'p1', name: 'Kitchen Remodel' };

describe('tapping a project on a list screen', () => {
  it('opens the project drill-down menu', () => {
    const h = mount();
    h.state.screen = 'projects-active';
    h.state.lists['projects-active'] = [PROJECT];

    h.dispatch(select(0));

    expect(h.state.selectedProject).toEqual({
      id: 'p1',
      name: 'Kitchen Remodel',
      returnTo: 'projects-active',
    });
    expect(h.state.screen).toBe('project-detail');
    expect(h.render()).toMatchObject({ mode: 'list', items: ['Open page', 'Tasks', 'Notes'] });
  });

  it('GO_BACK returns to the list the project was opened from', () => {
    const h = mount();
    h.state.screen = 'projects-active';
    h.state.lists['projects-active'] = [PROJECT];
    h.dispatch(select(0));

    h.dispatch(back());

    expect(h.state.screen).toBe('projects-active');
  });
});

describe('drilling into a project', () => {
  it('Tasks fetches and shows the project-scoped task list', async () => {
    vi.mocked(fetchTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Pick tile', status: 'Todo' },
    ]);
    const h = mount();
    h.state.screen = 'projects-active';
    h.state.lists['projects-active'] = [PROJECT];
    h.dispatch(select(0)); // -> project-detail, selectedProject set

    h.dispatch(select(1)); // Tasks
    await h.settle();

    expect(fetchTasksForProject).toHaveBeenCalledWith('p1');
    expect(h.state.screen).toBe('project-tasks');
    expect(h.state.lists['project-tasks']).toEqual([{ id: 't1', name: 'Pick tile', status: 'Todo' }]);
    const display = h.render();
    expect(display).toMatchObject({ mode: 'list', items: ['[ ] Pick tile'] });
  });

  it('Notes fetches and shows the project-scoped note list', async () => {
    vi.mocked(fetchNotesForProject).mockResolvedValue([{ id: 'n1', name: 'Design notes' }]);
    const h = mount();
    h.state.screen = 'projects-active';
    h.state.lists['projects-active'] = [PROJECT];
    h.dispatch(select(0));

    h.dispatch(select(2)); // Notes
    await h.settle();

    expect(fetchNotesForProject).toHaveBeenCalledWith('p1');
    expect(h.state.screen).toBe('project-notes');
    expect(h.state.lists['project-notes']).toEqual([{ id: 'n1', name: 'Design notes' }]);
  });

  it('Open page reads the project itself', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValue({ markdown: '# Kitchen Remodel', truncated: false });
    const h = mount();
    h.state.screen = 'projects-active';
    h.state.lists['projects-active'] = [PROJECT];
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
