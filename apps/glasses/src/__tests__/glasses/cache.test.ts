/**
 * Tests 6–10, 18–20: Cache behaviour (cold open, warm open, edge cases)
 */

import type { EvenAppBridge, RebuildPageContainer } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCachedList, saveCachedList } from '../../cache';
import { onEvenHubEvent } from '../../glasses/events';
import { setBridge, state } from '../../state';
import { flushPromises, listClickEvent, makeMockBridge, resetState } from './helpers';

// ---------------------------------------------------------------------------
// Module mocks — api and stt are controlled; cache is mocked so we can
// decide what the "stored" data looks like per test.
// ---------------------------------------------------------------------------

vi.mock('../../api', () => ({
  fetchTodayTasks: vi.fn(),
  fetchInboxTasks: vi.fn(),
  createTask: vi.fn(),
  markTaskDone: vi.fn(),
  deletePage: vi.fn(),
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

vi.mock('../../cache', () => ({
  loadCachedList: vi.fn(),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
}));

vi.mock('../../stt', () => ({
  isListening: vi.fn().mockReturnValue(false),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  ensureRecognizer: vi.fn().mockResolvedValue(true),
  feedAudio: vi.fn(),
  preloadVoskModel: vi.fn(),
}));

import { fetchInboxTasks } from '../../api';

let mockBridge: ReturnType<typeof makeMockBridge>;

const CACHED_INBOX = [{ id: 'c1', name: 'Cached task' }];
const FRESH_INBOX = [{ id: 'f1', name: 'Fresh task' }];

beforeEach(() => {
  mockBridge = makeMockBridge();
  setBridge(mockBridge as unknown as EvenAppBridge);
  resetState();

  // Default: instant successful network response
  vi.mocked(fetchInboxTasks).mockResolvedValue(FRESH_INBOX);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: open the inbox screen and wait for the full async pipeline
// ---------------------------------------------------------------------------
async function openInbox() {
  state.screen = 'tasks-menu';
  onEvenHubEvent(listClickEvent(3));
  await flushPromises(10);
}

// ---------------------------------------------------------------------------
// Test 6 — cold open
// ---------------------------------------------------------------------------

describe('cold open (no prior cache)', () => {
  it('shows a loading placeholder immediately before the network responds', async () => {
    vi.mocked(loadCachedList).mockResolvedValue(null);
    // Stall the network so we can inspect the intermediate state
    vi.mocked(fetchInboxTasks).mockReturnValue(new Promise(() => {}));

    state.screen = 'tasks-menu';
    onEvenHubEvent(listClickEvent(3));

    // One flush gets past loadCachedList; navigate('inbox') fires synchronously after that
    await flushPromises(2);

    expect(mockBridge.rebuildPageContainer).toHaveBeenCalled();
    const arg = mockBridge.rebuildPageContainer.mock.calls[0]?.[0] as RebuildPageContainer;
    expect(arg.textObject?.[0]?.content).toContain('Fetching tasks...');
  });
});

// ---------------------------------------------------------------------------
// Test 7 — warm open
// ---------------------------------------------------------------------------

describe('warm open (cache hit)', () => {
  it('shows cached tasks immediately before the network responds', async () => {
    vi.mocked(loadCachedList).mockResolvedValue(CACHED_INBOX);
    vi.mocked(fetchInboxTasks).mockReturnValue(new Promise(() => {})); // stall network

    state.screen = 'tasks-menu';
    onEvenHubEvent(listClickEvent(3));
    await flushPromises(2);

    expect(mockBridge.rebuildPageContainer).toHaveBeenCalled();
    const arg = mockBridge.rebuildPageContainer.mock.calls[0]?.[0] as RebuildPageContainer;
    // Warm open → header+list mode. The cached task name lives in the list
    // items, not in the header text container.
    expect(arg.listObject?.[0]?.itemContainer?.itemName).toContain('Cached task');
  });
});

// ---------------------------------------------------------------------------
// Test 8 — failed fetch, cold open
// ---------------------------------------------------------------------------

describe('failed fetch on cold open', () => {
  it('shows an empty state instead of crashing or staying on "Fetching…"', async () => {
    vi.mocked(loadCachedList).mockResolvedValue(null);
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('Network error'));

    await openInbox();

    // After the fetch fails with no cache, tasks are empty and loading is false
    expect(state.loading).toBe(false);
    expect(state.lists.inbox).toEqual([]);

    // The last render is the empty-state full rebuild (single text container,
    // no list — there's no partial-list-update API, so the settled state
    // always arrives via a full rebuild). It should not show the loading
    // placeholder.
    const lastRebuild = mockBridge.rebuildPageContainer.mock.calls.at(
      -1,
    )?.[0] as RebuildPageContainer;
    expect(lastRebuild.textObject?.[0]?.content).toContain('Your inbox is empty!');
    expect(lastRebuild.textObject?.[0]?.content).not.toContain('Fetching tasks...');
  });
});

// ---------------------------------------------------------------------------
// Test 9 — failed fetch, warm open
// ---------------------------------------------------------------------------

describe('failed fetch on warm open', () => {
  it('keeps the cached tasks visible instead of blanking the screen', async () => {
    vi.mocked(loadCachedList).mockResolvedValue(CACHED_INBOX);
    vi.mocked(fetchInboxTasks).mockRejectedValue(new Error('Network error'));

    await openInbox();

    // Cached data must survive the fetch failure
    expect(state.lists.inbox).toEqual(CACHED_INBOX);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — successful fetch persists fresh data
// ---------------------------------------------------------------------------

describe('successful background fetch', () => {
  it('saves the fresh data so the next open gets it instantly', async () => {
    vi.mocked(loadCachedList).mockResolvedValue(CACHED_INBOX);
    vi.mocked(fetchInboxTasks).mockResolvedValue(FRESH_INBOX);

    await openInbox();

    expect(vi.mocked(saveCachedList)).toHaveBeenCalledWith(
      'notionultimatebrain:inbox',
      FRESH_INBOX,
    );
    expect(state.lists.inbox).toEqual(FRESH_INBOX);
  });
});
