/**
 * Task action menu + metadata + page reader + delete flow.
 *
 * Tapping a task opens an action menu (Load metadata / Open page / Mark as
 * done / Delete task) instead of jumping straight to the mark-done confirm
 * dialog. The list-click indices below follow that order.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLL_COOLDOWN_MS } from '../glasses/constants';
import { onEvenHubEvent } from '../glasses/runtime';
import { setBridge, state } from '../state';
import {
  clickEvent,
  doubleTapEvent,
  flushPromises,
  listClickEvent,
  makeMockBridge,
  resetState,
  scrollDownEvent,
  scrollUpEvent,
} from './helpers';

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
  markTaskDone: vi.fn().mockResolvedValue(undefined),
  fetchPageMetadata: vi.fn().mockResolvedValue({ project: 'Website', due: '2026-07-04' }),
  deletePage: vi.fn().mockResolvedValue(undefined),
  fetchNext7DaysTasks: vi.fn().mockResolvedValue([]),
  fetchTomorrowTasks: vi.fn().mockResolvedValue([]),
  fetchInboxNotes: vi.fn().mockResolvedValue([]),
  fetchFavoriteNotes: vi.fn().mockResolvedValue([]),
  fetchByTagNotes: vi.fn().mockResolvedValue([]),
  fetchNotes: vi.fn().mockResolvedValue([]),
  fetchMeetingNotes: vi.fn().mockResolvedValue([]),
  fetchByProjectNotes: vi.fn().mockResolvedValue([]),
  fetchClipsNotes: vi.fn().mockResolvedValue([]),
  fetchVoiceNotes: vi.fn().mockResolvedValue([]),
  fetchJournalNotes: vi.fn().mockResolvedValue([]),
  fetchAllNotes: vi.fn().mockResolvedValue([]),
  fetchActiveProjects: vi.fn().mockResolvedValue([]),
  fetchPlannedProjects: vi.fn().mockResolvedValue([]),
  fetchBoardProjects: vi.fn().mockResolvedValue([]),
  fetchArchivedProjects: vi.fn().mockResolvedValue([]),
  fetchRecentTags: vi.fn().mockResolvedValue([]),
  fetchFavoriteTags: vi.fn().mockResolvedValue([]),
  fetchAToZTags: vi.fn().mockResolvedValue([]),
  fetchTypeTags: vi.fn().mockResolvedValue([]),
  fetchTasksForProject: vi.fn().mockResolvedValue([]),
  fetchNotesForProject: vi.fn().mockResolvedValue([]),
  fetchPageMarkdown: vi.fn().mockResolvedValue({ markdown: '', truncated: false }),
  fetchPage: vi.fn().mockResolvedValue({ properties: {} }),
}));

vi.mock('../cache', () => ({
  loadCachedList: vi.fn().mockResolvedValue(null),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
}));

import { deletePage, fetchPageMarkdown, fetchPageMetadata } from '../api';

let mockBridge: ReturnType<typeof makeMockBridge>;

beforeEach(() => {
  mockBridge = makeMockBridge();
  setBridge(mockBridge as unknown as EvenAppBridge);
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('tapping a task in the inbox list', () => {
  it('opens the task action menu instead of the mark-done confirm dialog', () => {
    state.screen = 'inbox';
    state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];

    onEvenHubEvent(listClickEvent(0));

    expect(state.screen).toBe('task-actions');
    expect(state.selectedTask).toEqual({ taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' });
  });

  it('double-tap from the action menu returns to the originating list', () => {
    state.screen = 'inbox';
    state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    onEvenHubEvent(listClickEvent(0));

    onEvenHubEvent(doubleTapEvent());

    expect(state.screen).toBe('inbox');
  });
});

describe('selecting "Load metadata" from the action menu', () => {
  it('fetches and displays project + friendly due date', async () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(fetchPageMetadata).toHaveBeenCalledWith('t1');
    expect(state.screen).toBe('task-metadata');
    expect(state.taskMetadata).toEqual({
      loading: false,
      project: 'Website',
      due: '2026-07-04',
      error: '',
    });
  });

  it('surfaces a fetch error instead of leaving it stuck loading', async () => {
    vi.mocked(fetchPageMetadata).mockRejectedValueOnce(new Error('Network error'));
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(state.taskMetadata?.error).toBe('Network error');
  });
});

describe('selecting "Open page" from the action menu', () => {
  it('reads the page and shows its content, paginated', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValueOnce({
      markdown: 'Hello\nWorld',
      truncated: false,
    });
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(1));
    await flushPromises();

    expect(fetchPageMarkdown).toHaveBeenCalledWith('t1');
    expect(state.screen).toBe('page-content');
    expect(state.pageContent).toEqual({
      loading: false,
      title: 'Buy milk',
      returnTo: 'task-actions',
      pages: [['Hello', 'World']],
      index: 0,
      error: '',
    });
  });

  it('surfaces a fetch error instead of leaving it stuck loading', async () => {
    vi.mocked(fetchPageMarkdown).mockRejectedValueOnce(new Error('Network error'));
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(1));
    await flushPromises();

    expect(state.pageContent?.error).toBe('Network error');
  });

  it('double-tap returns to the action menu', async () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };
    onEvenHubEvent(listClickEvent(1));
    await flushPromises();

    onEvenHubEvent(doubleTapEvent());

    expect(state.screen).toBe('task-actions');
  });
});

describe('paging through an open page', () => {
  const pages = [['one'], ['two'], ['three']];
  const reader = (overrides: Partial<NonNullable<typeof state.pageContent>> = {}) => ({
    loading: false,
    title: 'Buy milk',
    returnTo: 'task-actions' as const,
    pages,
    index: 0,
    error: '',
    ...overrides,
  });

  /**
   * Delivers a swipe, first clearing the runtime's scroll cooldown — back-to-
   * back scroll events are throttled on purpose (the G2 fires them in bursts),
   * so an unspaced pair would silently test the throttle instead of paging.
   */
  function swipe(event: ReturnType<typeof scrollDownEvent>): void {
    vi.advanceTimersByTime(SCROLL_COOLDOWN_MS + 1);
    onEvenHubEvent(event);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    state.screen = 'page-content';
    state.pageContent = reader();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances on a downward swipe and goes back on an upward one', () => {
    swipe(scrollDownEvent());
    expect(state.pageContent?.index).toBe(1);

    swipe(scrollUpEvent());
    expect(state.pageContent?.index).toBe(0);
  });

  it('advances on a tap — the swipe gesture is easy to miss', () => {
    onEvenHubEvent(clickEvent());

    expect(state.pageContent?.index).toBe(1);
  });

  it('stops at both ends rather than wrapping around', () => {
    swipe(scrollUpEvent());
    expect(state.pageContent?.index).toBe(0);

    state.pageContent = reader({ index: 2 });
    swipe(scrollDownEvent());
    expect(state.pageContent?.index).toBe(2);
  });

  it('ignores page turns while the content is still loading', () => {
    state.pageContent = reader({ loading: true, pages: [] });

    swipe(scrollDownEvent());

    expect(state.pageContent?.index).toBe(0);
  });
});

describe('selecting "Mark as done" from the action menu', () => {
  it('opens the mark-done confirm flow', () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(2));

    expect(state.screen).toBe('mark-done-confirm');
    expect(state.pendingAction).toEqual({
      kind: 'markDone',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
    });
  });
});

describe('selecting "Delete task" from the action menu', () => {
  it('opens the delete confirm dialog', () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(3));

    expect(state.screen).toBe('delete-confirm');
    expect(state.pendingAction).toEqual({
      kind: 'delete',
      itemId: 't1',
      itemName: 'Buy milk',
      returnTo: 'inbox',
    });
  });

  it('confirming delete calls the API, removes the task from its list, and shows a toast', async () => {
    state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    state.screen = 'delete-confirm';
    state.pendingAction = { kind: 'delete', itemId: 't1', itemName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(deletePage).toHaveBeenCalledWith('t1');
    expect(state.lists.inbox).toEqual([]);
    expect(state.screen).toBe('delete-toast');
    expect(state.actionToast?.itemName).toBe('Buy milk');
  });

  it('cancelling delete returns to the originating list without calling the API', () => {
    state.screen = 'delete-confirm';
    state.pendingAction = { kind: 'delete', itemId: 't1', itemName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(1));

    expect(deletePage).not.toHaveBeenCalled();
    expect(state.screen).toBe('inbox');
  });
});
