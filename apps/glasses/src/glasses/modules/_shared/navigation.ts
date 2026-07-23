import {
  fetchAllNotes,
  fetchArchivedProjects,
  fetchAToZTags,
  fetchBoardProjects,
  fetchByProjectNotes,
  fetchByTagNotes,
  fetchClipsNotes,
  fetchDoingProjects,
  fetchDoneProjects,
  fetchFavoriteNotes,
  fetchFavoriteTags,
  fetchInboxNotes,
  fetchInboxTasks,
  fetchJournalNotes,
  fetchMeetingNotes,
  fetchNext7DaysTasks,
  fetchNotes,
  fetchNotesForProject,
  fetchOngoingProjects,
  fetchOnHoldProjects,
  fetchPlannedProjects,
  fetchProjectTasksDone,
  fetchProjectTasksTodo,
  fetchRecentTags,
  fetchTodayTasks,
  fetchTomorrowTasks,
  fetchTypeTags,
  fetchVoiceNotes,
  type PagedResult,
} from '../../../api';
import { cacheKeyForScreen, loadCachedList, saveCachedList } from '../../../cache';
import type { ListItem, ScreenName } from '../../../state';
import { getBridge, state } from '../../../state';
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS } from '../../constants';
import { renderFull, renderUpdate } from '../../render';
import { fetchAllPages } from './pagination';

const EMPTY_PAGE: PagedResult<never> = { items: [], hasMore: false, nextCursor: null };

// ---------------------------------------------------------------------------
// Generic list views — every Tasks/Notes/Projects/Tags screen, including
// Today/Overdue/Inbox. One fetcher per data key; the generic enterView()
// cache-then-fetch pipeline (below) is shared by all of them.
// ---------------------------------------------------------------------------

const VIEW_FETCHERS: Partial<
  Record<ScreenName, (cursor?: string) => Promise<PagedResult<ListItem>>>
> = {
  today: fetchTodayTasks,
  inbox: fetchInboxTasks,
  'tasks-next-7-days': fetchNext7DaysTasks,
  'tasks-tomorrow': fetchTomorrowTasks,
  'notes-inbox': fetchInboxNotes,
  'notes-favorites': fetchFavoriteNotes,
  'notes-by-tag': fetchByTagNotes,
  'notes-list': fetchNotes,
  'notes-meetings': fetchMeetingNotes,
  'notes-by-project': fetchByProjectNotes,
  'notes-clips': fetchClipsNotes,
  'notes-voice': fetchVoiceNotes,
  'notes-journal': fetchJournalNotes,
  'notes-all': fetchAllNotes,
  'projects-doing': fetchDoingProjects,
  'projects-ongoing': fetchOngoingProjects,
  'projects-planned': fetchPlannedProjects,
  'projects-on-hold': fetchOnHoldProjects,
  'projects-done': fetchDoneProjects,
  'projects-board': fetchBoardProjects,
  'projects-archived': fetchArchivedProjects,
  'tags-recent': fetchRecentTags,
  'tags-favorites': fetchFavoriteTags,
  'tags-a-z': fetchAToZTags,
  'tags-types': fetchTypeTags,
  'project-tasks-todo': (cursor) =>
    state.selectedProject
      ? fetchProjectTasksTodo(state.selectedProject.id, cursor)
      : Promise.resolve(EMPTY_PAGE),
  'project-tasks-done': (cursor) =>
    state.selectedProject
      ? fetchProjectTasksDone(state.selectedProject.id, cursor)
      : Promise.resolve(EMPTY_PAGE),
  'project-notes': (cursor) =>
    state.selectedProject
      ? fetchNotesForProject(state.selectedProject.id, cursor)
      : Promise.resolve(EMPTY_PAGE),
};

/**
 * Screens whose fetched data lives under a different state.lists/cache key.
 * Overdue is a filtered view over the same array Today fetches
 * (/api/tasks/today returns everything due today-or-before) — see
 * getOverdueFlatTasks/getTodayFlatTasks in tasks/helpers.ts. Exported for
 * item-actions.ts's removeItemFromOwningList, which needs the same mapping.
 */
export const DATA_KEY_OVERRIDES: Partial<Record<ScreenName, ScreenName>> = {
  overdue: 'today',
};

// ---------------------------------------------------------------------------
// Spinner — animates while a background fetch is in flight. Shared by every
// flow that runs a background fetch (list views, task/note metadata, the
// page reader) — there's only one spinner, tracked by owner so the flow that
// finishes first doesn't kill another flow's still-running spinner.
// ---------------------------------------------------------------------------

let spinnerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Which flow the running spinner belongs to. There's only one spinner, but
 * several flows can be in flight at once — a list screen rendered from cache
 * keeps refreshing in the background while the user taps through to something
 * else — and each stops the spinner in its own `finally`. Without an owner the
 * one that happens to finish first kills the spinner the other is still using.
 */
let spinnerOwner = 0;

export function startSpinner(onTick: () => void): number {
  stopSpinner(); // clear any previous interval first
  const owner = ++spinnerOwner;
  let i = 0;
  state.spinnerFrame = SPINNER_FRAMES[0] ?? '';
  spinnerInterval = setInterval(() => {
    i = (i + 1) % SPINNER_FRAMES.length;
    state.spinnerFrame = SPINNER_FRAMES[i] ?? '';
    onTick();
  }, SPINNER_INTERVAL_MS);
  return owner;
}

/** Stops the spinner, unless `owner` names a flow that no longer holds it. */
export function stopSpinner(owner?: number): void {
  if (owner !== undefined && owner !== spinnerOwner) return;
  if (spinnerInterval !== null) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  state.spinnerFrame = '';
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function navigate(screen: ScreenName): void {
  if (screen === 'add-task') {
    state.recording = 'idle';
    state.createdTaskName = '';
    state.pendingTranscript = '';
    state.errorMessage = '';
  }
  state.screen = screen;
  void renderFull();
}

export function shutdown(): void {
  // Root page: MUST call shutDownPageContainer(1)
  const b = getBridge();
  if (b) void b.shutDownPageContainer(1);
}

// ---------------------------------------------------------------------------
// List-view entry — cache-then-fresh-fetch with a spinner while in flight.
// Covers every Tasks/Notes/Projects/Tags screen, including Today/Overdue/
// Inbox (Overdue reads/writes the 'today' data key via DATA_KEY_OVERRIDES).
// ---------------------------------------------------------------------------

/**
 * Cache key for a generic list-view screen, scoped by selected project for
 * project-tasks/project-notes so switching projects doesn't flash the
 * previous project's cached list. Exported for item-actions.ts's
 * removeItemFromOwningList, which needs the same key to update the cache.
 */
export function cacheKeyForListView(screen: ScreenName): string {
  if (
    screen === 'project-tasks-todo' ||
    screen === 'project-tasks-done' ||
    screen === 'project-notes'
  ) {
    return `${cacheKeyForScreen(screen)}:${state.selectedProject?.id ?? 'none'}`;
  }
  return cacheKeyForScreen(screen);
}

/**
 * Generic cache-then-fetch entry point for every list-view screen — looks up
 * the underlying data key's fetcher in VIEW_FETCHERS (Overdue resolves to
 * Today's 'today' key via DATA_KEY_OVERRIDES), caches under a key derived
 * from that data key, and lands on `screen`. A no-op (stays on the current
 * screen) if the data key has no registered fetcher.
 */
export async function enterView(screen: ScreenName): Promise<void> {
  const dataKey = DATA_KEY_OVERRIDES[screen] ?? screen;
  const fetchFn = VIEW_FETCHERS[dataKey];
  if (!fetchFn) return;

  // A fresh entry into a list screen always starts on its first page.
  state.listPages[screen] = 0;

  // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
  const cacheKey = cacheKeyForListView(dataKey);
  const cached = await loadCachedList<ListItem>(cacheKey);
  if (cached !== null) {
    state.lists[dataKey] = cached;
    state.loading = false;
  } else {
    state.loading = true;
  }
  navigate(screen);

  // 2. Spin while the fresh data loads in the background — fetchAllPages
  // follows Notion's cursor across as many requests as it takes, so the
  // list here is never capped at a single page_size like it used to be.
  const spinner = startSpinner(() => {
    void renderUpdate(screen);
  });

  try {
    const fresh = await fetchAllPages(fetchFn);
    state.lists[dataKey] = fresh;
    state.loading = false;
    void saveCachedList(cacheKey, fresh);
  } catch {
    if (state.loading) state.lists[dataKey] = []; // no cache — show empty
    state.loading = false;
  } finally {
    stopSpinner(spinner);
    // The fetched list may differ from what's on screen — there's no
    // partial-list-update API, so refresh via a full rebuild rather than
    // the header-only renderUpdate.
    if (state.screen === screen) void renderFull();
  }
}

/**
 * Turns a list screen's display page by `delta`, clamped to
 * `[0, totalPages - 1]`. `totalPages` is supplied by the caller
 * (screen-factories.ts's makeListScreen, the only thing that knows the
 * item count) rather than recomputed here. A full rebuild is required —
 * unlike the page reader's turnPage, there's no cheaper header-only update
 * for a native list widget (see render/index.ts).
 */
export function turnListPage(screen: ScreenName, delta: number, totalPages: number): void {
  const current = state.listPages[screen] ?? 0;
  const next = Math.min(Math.max(current + delta, 0), Math.max(totalPages - 1, 0));
  if (next === current) return;
  state.listPages[screen] = next;
  void renderFull();
}
