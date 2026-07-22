/**
 * The note action menu — reached by tapping a note in any Notes list screen.
 * Offers Open page / Load metadata / Delete note. Mirrors the task action
 * menu's structure (see task-actions.test.ts) but with its own screen names
 * and no "Mark as done" (notes have no such state).
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREENS } from '../../glasses/router';
import { onEvenHubEvent } from '../../glasses/events';
import type { ScreenName } from '../../state';
import { setBridge, state } from '../../state';
import {
  doubleTapEvent,
  flushPromises,
  listClickEvent,
  makeMockBridge,
  resetState,
} from './helpers';

vi.mock('../../api', () => ({
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
  fetchNotesForProject: vi.fn().mockResolvedValue([]),
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  fetchNext7DaysTasks: vi.fn().mockResolvedValue([]),
  fetchTomorrowTasks: vi.fn().mockResolvedValue([]),
  fetchTasksForProject: vi.fn().mockResolvedValue([]),
  fetchActiveProjects: vi.fn().mockResolvedValue([]),
  fetchPlannedProjects: vi.fn().mockResolvedValue([]),
  fetchBoardProjects: vi.fn().mockResolvedValue([]),
  fetchArchivedProjects: vi.fn().mockResolvedValue([]),
  fetchRecentTags: vi.fn().mockResolvedValue([]),
  fetchFavoriteTags: vi.fn().mockResolvedValue([]),
  fetchAToZTags: vi.fn().mockResolvedValue([]),
  fetchTypeTags: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  markTaskDone: vi.fn(),
  deletePage: vi.fn().mockResolvedValue(undefined),
  fetchPageMetadata: vi.fn().mockResolvedValue({ project: 'Personal', due: null }),
  fetchPageMarkdown: vi.fn().mockResolvedValue({ markdown: '', truncated: false }),
  fetchPage: vi.fn().mockResolvedValue({ properties: {} }),
}));

vi.mock('../../cache', () => ({
  loadCachedList: vi.fn().mockResolvedValue(null),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
}));

import { deletePage, fetchPageMarkdown, fetchPageMetadata } from '../../api';

/**
 * Every screen that lists notes, derived from the router rather than listed
 * by hand: a new notes screen joins this set automatically and fails the
 * coverage test below until it's added to shared.ts's NOTE_LIST_SCREENS.
 * Without that it would just have silently dead rows.
 */
const NOTE_SCREENS = [
  ...Object.keys(SCREENS).filter((name) => name.startsWith('notes-') && name !== 'notes-menu'),
  'project-notes', // a notes list too, but named for the project drill-down
] as ScreenName[];

let mockBridge: ReturnType<typeof makeMockBridge>;

beforeEach(() => {
  mockBridge = makeMockBridge();
  setBridge(mockBridge as unknown as EvenAppBridge);
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('tapping a note', () => {
  it('opens the note action menu, not the task one', () => {
    state.screen = 'notes-all';
    state.lists['notes-all'] = [{ id: 'n1', name: 'Meeting notes' }];

    onEvenHubEvent(listClickEvent(0));

    expect(state.screen).toBe('note-actions');
    expect(state.selectedNote).toEqual({
      noteId: 'n1',
      noteName: 'Meeting notes',
      returnTo: 'notes-all',
    });
  });

  it('double-tap from the action menu returns to the originating list', () => {
    state.screen = 'notes-journal';
    state.lists['notes-journal'] = [{ id: 'n1', name: 'Monday' }];
    onEvenHubEvent(listClickEvent(0));

    onEvenHubEvent(doubleTapEvent());

    expect(state.screen).toBe('notes-journal');
  });

  it('opens from every screen that lists notes', () => {
    // Guards the derivation itself: if the router ever stops registering the
    // notes screens, an empty set would make the loop below vacuously pass.
    expect(NOTE_SCREENS.length).toBe(11);

    for (const screen of NOTE_SCREENS) {
      resetState();
      state.screen = screen;
      state.lists[screen] = [{ id: `${screen}-n1`, name: 'A note' }];

      onEvenHubEvent(listClickEvent(0));

      expect(state.screen, `${screen} should open the note menu`).toBe('note-actions');
      expect(state.selectedNote?.returnTo, `${screen} should come back to itself`).toBe(screen);
    }
  });
});

describe('selecting "Open page" from the note action menu', () => {
  it('reads the page and shows its content, paginated', async () => {
    vi.mocked(fetchPageMarkdown).mockResolvedValueOnce({
      markdown: 'First line\nSecond line',
      truncated: false,
    });
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'Meeting notes', returnTo: 'notes-inbox' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(fetchPageMarkdown).toHaveBeenCalledWith('n1');
    expect(state.screen).toBe('page-content');
    expect(state.pageContent).toEqual({
      loading: false,
      title: 'Meeting notes',
      returnTo: 'note-actions',
      pages: [['First line', 'Second line']],
      index: 0,
      error: '',
    });
  });

  it('surfaces a read error instead of leaving it stuck loading', async () => {
    vi.mocked(fetchPageMarkdown).mockRejectedValueOnce(new Error('Network error'));
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(state.pageContent?.error).toBe('Network error');
  });

  it('double-tap from the reader returns to the note action menu, not the list', async () => {
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };
    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    onEvenHubEvent(doubleTapEvent());

    expect(state.screen).toBe('note-actions');
  });
});

describe('selecting "Load metadata" from the note action menu', () => {
  it("fetches and displays the note's project — notes have no due date to show", async () => {
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };

    onEvenHubEvent(listClickEvent(1));
    await flushPromises();

    expect(fetchPageMetadata).toHaveBeenCalledWith('n1');
    expect(state.screen).toBe('note-metadata');
    expect(state.noteMetadata).toEqual({ loading: false, project: 'Personal', error: '' });
  });

  it('surfaces a fetch error instead of leaving it stuck loading', async () => {
    vi.mocked(fetchPageMetadata).mockRejectedValueOnce(new Error('Network error'));
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };

    onEvenHubEvent(listClickEvent(1));
    await flushPromises();

    expect(state.noteMetadata?.error).toBe('Network error');
  });

  it('double-tap returns to the note action menu', () => {
    state.screen = 'note-metadata';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };

    onEvenHubEvent(doubleTapEvent());

    expect(state.screen).toBe('note-actions');
  });
});

describe('selecting "Delete note" from the note action menu', () => {
  it('opens the (shared) delete confirm dialog', () => {
    state.screen = 'note-actions';
    state.selectedNote = { noteId: 'n1', noteName: 'A note', returnTo: 'notes-list' };

    onEvenHubEvent(listClickEvent(2));

    expect(state.screen).toBe('delete-confirm');
    expect(state.pendingAction).toEqual({
      kind: 'delete',
      itemId: 'n1',
      itemName: 'A note',
      returnTo: 'notes-list',
    });
  });

  it('confirming delete calls the API, removes the note from its list, and shows a toast', async () => {
    state.lists['notes-list'] = [{ id: 'n1', name: 'A note' }];
    state.screen = 'delete-confirm';
    state.pendingAction = {
      kind: 'delete',
      itemId: 'n1',
      itemName: 'A note',
      returnTo: 'notes-list',
    };

    onEvenHubEvent(listClickEvent(0));
    await flushPromises();

    expect(deletePage).toHaveBeenCalledWith('n1');
    expect(state.lists['notes-list']).toEqual([]);
    expect(state.screen).toBe('delete-toast');
    expect(state.actionToast?.itemName).toBe('A note');
  });
});
