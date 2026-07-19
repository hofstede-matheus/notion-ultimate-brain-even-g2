/**
 * Task action menu + metadata + delete flow.
 *
 * Tapping a task now opens an action menu (Load metadata / Mark as done /
 * Delete task) instead of jumping straight to the mark-done confirm dialog.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onEvenHubEvent } from '../glasses/runtime';
import { setBridge, state } from '../state';
import {
  doubleTapEvent,
  flushPromises,
  listClickEvent,
  makeMockBridge,
  resetState,
} from './helpers';

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
  markTaskDone: vi.fn().mockResolvedValue(undefined),
  fetchTaskMetadata: vi.fn().mockResolvedValue({ project: 'Website', due: '2026-07-04' }),
  deleteTask: vi.fn().mockResolvedValue(undefined),
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
}));

vi.mock('../cache', () => ({
  loadCachedList: vi.fn().mockResolvedValue(null),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
}));

import { deleteTask, fetchTaskMetadata } from '../api';

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

    expect(fetchTaskMetadata).toHaveBeenCalledWith('t1');
    expect(state.screen).toBe('task-metadata');
    expect(state.taskMetadata).toEqual({
      loading: false,
      project: 'Website',
      due: '2026-07-04',
      error: '',
    });
  });

  it('surfaces a fetch error instead of leaving it stuck loading', async () => {
    vi.mocked(fetchTaskMetadata).mockRejectedValueOnce(new Error('Network error'));
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(state.taskMetadata?.error).toBe('Network error');
  });
});

describe('selecting "Mark as done" from the action menu', () => {
  it('opens the mark-done confirm flow', () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(1));

    expect(state.screen).toBe('mark-done-confirm');
    expect(state.pendingAction).toEqual({
      kind: 'markDone',
      taskId: 't1',
      taskName: 'Buy milk',
      returnTo: 'inbox',
    });
  });
});

describe('selecting "Delete task" from the action menu', () => {
  it('opens the delete confirm dialog', () => {
    state.screen = 'task-actions';
    state.selectedTask = { taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(2));

    expect(state.screen).toBe('delete-confirm');
    expect(state.pendingAction).toEqual({
      kind: 'delete',
      taskId: 't1',
      taskName: 'Buy milk',
      returnTo: 'inbox',
    });
  });

  it('confirming delete calls the API, removes the task from its list, and shows a toast', async () => {
    state.lists.inbox = [{ id: 't1', name: 'Buy milk' }];
    state.screen = 'delete-confirm';
    state.pendingAction = { kind: 'delete', taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(deleteTask).toHaveBeenCalledWith('t1');
    expect(state.lists.inbox).toEqual([]);
    expect(state.screen).toBe('delete-toast');
    expect(state.actionToast?.taskName).toBe('Buy milk');
  });

  it('cancelling delete returns to the originating list without calling the API', () => {
    state.screen = 'delete-confirm';
    state.pendingAction = { kind: 'delete', taskId: 't1', taskName: 'Buy milk', returnTo: 'inbox' };

    onEvenHubEvent(listClickEvent(1));

    expect(deleteTask).not.toHaveBeenCalled();
    expect(state.screen).toBe('inbox');
  });
});
