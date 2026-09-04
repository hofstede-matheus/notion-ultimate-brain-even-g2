/**
 * The "Change project" flow from the note's OS contextual menu — the same
 * shared picker/confirm/toast screens tasks/set-project.test.ts exercises
 * from the task side.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../../api', async () => (await import('../fakes')).apiMock());
vi.mock('../../../cache', async () => (await import('../fakes')).cacheMock());
vi.mock('../../../stt', async () => (await import('../fakes')).sttMock());

import { fetchDoingProjects, fetchInboxNotes, setPageProject } from '../../../api';
import { NOTE_CONTEXT_MENU } from '../../../glasses/context-menu';
import { back, menuItemId, mount, select } from '../harness';

const NOTE = { id: 'n1', name: 'Meeting recap' };
const PROJECTS = [{ id: 'p1', name: 'Q3 Planning' }];

const CHANGE_PROJECT_ID = menuItemId(NOTE_CONTEXT_MENU, 'Change project');

async function openPicker(h: ReturnType<typeof mount>) {
  h.state.screen = 'notes-inbox';
  h.state.lists['notes-inbox'] = [NOTE];
  h.dispatch(select(0));
  h.menuClick(CHANGE_PROJECT_ID);
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

it('opens the picker and GO_BACK from a status filter returns to the picker', async () => {
  const h = mount();
  await openPicker(h);

  expect(h.state.screen).toBe('projects-doing');
  expect(h.render()).toMatchObject({
    mode: 'list',
    items: ['Q3 Planning'],
  });

  h.dispatch(back());
  expect(h.state.screen).toBe('project-picker');
});

it('picking a project confirms, patches the note out of the Inbox, and shows the toast', async () => {
  vi.mocked(setPageProject).mockResolvedValue(undefined);
  const h = mount();
  await openPicker(h);

  h.dispatch(select(0)); // Q3 Planning
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

it('refreshes the originating list 1.5s after the toast', async () => {
  vi.useFakeTimers();
  try {
    const h = mount();
    await openPicker(h);

    h.dispatch(select(0)); // Q3 Planning -> confirm
    h.dispatch(select(0)); // Confirm -> toast
    await h.settle();

    expect(h.state.screen).toBe('set-project-toast');

    vi.mocked(fetchInboxNotes).mockClear();
    vi.advanceTimersByTime(1500);
    await h.settle();

    expect(h.state.actionToast).toBeNull();
    expect(h.state.screen).toBe('notes-inbox');
    expect(fetchInboxNotes).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
