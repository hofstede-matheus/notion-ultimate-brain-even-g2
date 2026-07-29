/**
 * The "Change project" flow from the note action menu — the same shared
 * picker/confirm/toast screens tasks/set-project.test.ts exercises from the
 * task side.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchBoardProjects, setPageProject } from '../../../api';
import { back, mount, select } from '../harness';

const NOTE = { id: 'n1', name: 'Meeting recap' };
const PROJECTS = [{ id: 'p1', name: 'Q3 Planning' }];

function openPicker(h: ReturnType<typeof mount>) {
  h.state.screen = 'notes-inbox';
  h.state.lists['notes-inbox'] = [NOTE];
  h.dispatch(select(0)); // -> note-actions
  h.dispatch(select(2)); // Change project -> project-picker
}

beforeEach(() => {
  vi.mocked(fetchBoardProjects).mockResolvedValue({
    items: PROJECTS,
    hasMore: false,
    nextCursor: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

it('opens the picker and GO_BACK returns to note-actions', async () => {
  const h = mount();
  openPicker(h);
  await h.settle();

  expect(h.state.screen).toBe('project-picker');
  expect(h.render()).toMatchObject({
    mode: 'list',
    items: ['— No project —', 'Q3 Planning'],
  });

  h.dispatch(back());
  expect(h.state.screen).toBe('note-actions');
});

it('picking a project confirms, patches the note out of the Inbox, and shows the toast', async () => {
  vi.mocked(setPageProject).mockResolvedValue(undefined);
  const h = mount();
  openPicker(h);
  await h.settle();

  h.dispatch(select(1)); // Q3 Planning
  expect(h.state.pendingAction).toMatchObject({
    kind: 'setProject',
    itemId: 'n1',
    project: { id: 'p1', name: 'Q3 Planning' },
  });

  h.dispatch(select(0)); // Confirm
  await h.settle();

  expect(setPageProject).toHaveBeenCalledWith('n1', 'p1');
  expect(h.state.lists['notes-inbox']).toEqual([]);
  expect(h.state.screen).toBe('set-project-toast');
});
