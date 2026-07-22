import { AudioInputSource } from '@evenrealities/even_hub_sdk';
import {
  createTask,
  deletePage,
  fetchActiveProjects,
  fetchAllNotes,
  fetchArchivedProjects,
  fetchAToZTags,
  fetchBoardProjects,
  fetchByProjectNotes,
  fetchByTagNotes,
  fetchClipsNotes,
  fetchFavoriteNotes,
  fetchFavoriteTags,
  fetchInboxNotes,
  fetchInboxTasks,
  fetchJournalNotes,
  fetchMeetingNotes,
  fetchNext7DaysTasks,
  fetchNotes,
  fetchNotesForProject,
  fetchPageMetadata,
  fetchPlannedProjects,
  fetchRecentTags,
  fetchTasksForProject,
  fetchTodayTasks,
  fetchTomorrowTasks,
  fetchTypeTags,
  fetchVoiceNotes,
  markTaskDone,
} from '../api';
import { cacheKeyForScreen, loadCachedList, saveCachedList } from '../cache';
import { loadPageContent } from '../page-loader';
import type { ListItem, ScreenName } from '../state';
import { getBridge, state } from '../state';
import * as stt from '../stt';
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS, VOSK_MODEL_URL } from './constants';
import { markdownToPages } from './markdown-to-pages';
import { renderFull, renderUpdate } from './render';
import type { GlassCtx } from './types';

// ---------------------------------------------------------------------------
// Generic list views — every Tasks/Notes/Projects/Tags screen, including
// Today/Overdue/Inbox. One fetcher per data key; the generic enterView()
// cache-then-fetch pipeline (below) is shared by all of them.
// ---------------------------------------------------------------------------

const VIEW_FETCHERS: Partial<Record<ScreenName, () => Promise<ListItem[]>>> = {
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
  'projects-active': fetchActiveProjects,
  'projects-planned': fetchPlannedProjects,
  'projects-board': fetchBoardProjects,
  'projects-archived': fetchArchivedProjects,
  'tags-recent': fetchRecentTags,
  'tags-favorites': fetchFavoriteTags,
  'tags-a-z': fetchAToZTags,
  'tags-types': fetchTypeTags,
  'project-tasks': () =>
    state.selectedProject ? fetchTasksForProject(state.selectedProject.id) : Promise.resolve([]),
  'project-notes': () =>
    state.selectedProject ? fetchNotesForProject(state.selectedProject.id) : Promise.resolve([]),
};

/**
 * Screens whose fetched data lives under a different state.lists/cache key.
 * Overdue is a filtered view over the same array Today fetches
 * (/api/tasks/today returns everything due today-or-before) — see
 * getOverdueFlatTasks/getTodayFlatTasks in screens/shared.ts.
 */
const DATA_KEY_OVERRIDES: Partial<Record<ScreenName, ScreenName>> = {
  overdue: 'today',
};

// ---------------------------------------------------------------------------
// Spinner — animates while a background fetch is in flight
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

function startSpinner(onTick: () => void): number {
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
function stopSpinner(owner?: number): void {
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

function navigate(screen: ScreenName): void {
  if (screen === 'add-task') {
    state.recording = 'idle';
    state.createdTaskName = '';
    state.pendingTranscript = '';
    state.errorMessage = '';
  }
  state.screen = screen;
  void renderFull();
}

function shutdown(): void {
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
 * previous project's cached list.
 */
function cacheKeyForListView(screen: ScreenName): string {
  if (screen === 'project-tasks' || screen === 'project-notes') {
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
async function enterView(screen: ScreenName): Promise<void> {
  const dataKey = DATA_KEY_OVERRIDES[screen] ?? screen;
  const fetchFn = VIEW_FETCHERS[dataKey];
  if (!fetchFn) return;

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

  // 2. Spin while the fresh data loads in the background
  const spinner = startSpinner(() => {
    void renderUpdate(screen);
  });

  try {
    const fresh = await fetchFn();
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

// ---------------------------------------------------------------------------
// Item actions — confirm dialog + toast for mark-done and delete, unified
// flow. Shared by tasks ("Mark as done", "Delete task") and notes ("Delete
// note") — the state and API calls involved don't care which kind of page
// they're acting on, so this is generic over item id/name rather than
// task-specific.
// ---------------------------------------------------------------------------

interface ItemAction {
  kind: 'markDone' | 'delete';
  confirmScreenName: ScreenName;
  toastScreenName: ScreenName;
  apiCall: (itemId: string) => Promise<void>;
}

const ITEM_ACTIONS: Record<'markDone' | 'delete', ItemAction> = {
  markDone: {
    kind: 'markDone',
    confirmScreenName: 'mark-done-confirm',
    toastScreenName: 'mark-done-toast',
    apiCall: markTaskDone,
  },
  delete: {
    kind: 'delete',
    confirmScreenName: 'delete-confirm',
    toastScreenName: 'delete-toast',
    apiCall: deletePage,
  },
};

let actionToastTimeout: ReturnType<typeof setTimeout> | null = null;

function openConfirm(
  action: ItemAction,
  itemId: string,
  itemName: string,
  returnTo: ScreenName,
): void {
  state.pendingAction = { kind: action.kind, itemId, itemName, returnTo };
  state.errorMessage = '';
  navigate(action.confirmScreenName);
}

function dismissConfirm(): void {
  const returnTo = state.pendingAction?.returnTo ?? 'tasks-menu';
  state.pendingAction = null;
  navigate(returnTo);
}

/**
 * Removes an item from whichever list actually owns it — Today and Overdue
 * are both filtered views over the same 'today' data key (see
 * DATA_KEY_OVERRIDES).
 */
function removeItemFromOwningList(itemId: string, returnTo: ScreenName): void {
  const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo;
  const list = (state.lists[dataKey] ?? []).filter((item) => item.id !== itemId);
  state.lists[dataKey] = list;
  void saveCachedList(cacheKeyForListView(dataKey), list);
}

async function confirmAction(): Promise<void> {
  const pending = state.pendingAction;
  if (!pending) return;
  const { kind, itemId, returnTo } = pending;
  const action = ITEM_ACTIONS[kind];

  try {
    await action.apiCall(itemId);
    removeItemFromOwningList(itemId, returnTo);

    state.pendingAction = null;
    state.actionToast = { kind, itemName: pending.itemName, returnTo, untilMs: Date.now() + 1500 };
    navigate(action.toastScreenName);

    if (actionToastTimeout !== null) clearTimeout(actionToastTimeout);
    actionToastTimeout = setTimeout(() => {
      actionToastTimeout = null;
      state.actionToast = null;
      navigate(returnTo);
    }, 1500);
  } catch (e) {
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error';
    void renderUpdate(action.confirmScreenName);
  }
}

function dismissActionToast(): void {
  if (actionToastTimeout !== null) {
    clearTimeout(actionToastTimeout);
    actionToastTimeout = null;
  }
  const returnTo = state.actionToast?.returnTo ?? 'tasks-menu';
  state.actionToast = null;
  navigate(returnTo);
}

// ---------------------------------------------------------------------------
// Task action menu — reached by tapping a task in any Tasks list screen.
// Offers Load metadata / Mark as done / Delete task.
// ---------------------------------------------------------------------------

function openTaskActions(taskId: string, taskName: string, returnTo: ScreenName): void {
  state.selectedTask = { taskId, taskName, returnTo };
  navigate('task-actions');
}

async function enterTaskMetadata(): Promise<void> {
  const selected = state.selectedTask;
  if (!selected) return;

  state.taskMetadata = { loading: true, project: null, due: null, error: '' };
  navigate('task-metadata');

  const spinner = startSpinner(() => void renderUpdate('task-metadata'));

  try {
    const { project, due } = await fetchPageMetadata(selected.taskId);
    state.taskMetadata = { loading: false, project, due, error: '' };
  } catch (e) {
    state.taskMetadata = {
      loading: false,
      project: null,
      due: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'task-metadata') void renderFull();
  }
}

// ---------------------------------------------------------------------------
// Note action menu — reached by tapping a note in any Notes list screen.
// Offers Open page / Load metadata / Delete note. A note's metadata is just
// its Project — Notes have no Due property, so note-metadata.ts (unlike
// task-metadata.ts) never asks for one.
// ---------------------------------------------------------------------------

function openNoteActions(noteId: string, noteName: string, returnTo: ScreenName): void {
  state.selectedNote = { noteId, noteName, returnTo };
  navigate('note-actions');
}

async function enterNoteMetadata(): Promise<void> {
  const selected = state.selectedNote;
  if (!selected) return;

  state.noteMetadata = { loading: true, project: null, error: '' };
  navigate('note-metadata');

  const spinner = startSpinner(() => void renderUpdate('note-metadata'));

  try {
    const { project } = await fetchPageMetadata(selected.noteId);
    state.noteMetadata = { loading: false, project, error: '' };
  } catch (e) {
    state.noteMetadata = {
      loading: false,
      project: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  } finally {
    stopSpinner(spinner);
    if (state.screen === 'note-metadata') void renderFull();
  }
}

// ---------------------------------------------------------------------------
// Page reader — reads any Notion page (see page-loader.ts) and parses its
// markdown into screenfuls of text up front, since the firmware can't be
// handed a whole document at once (see glasses/markdown-to-pages.ts). Reached from a
// task's action menu and a note's action menu.
// ---------------------------------------------------------------------------

/** Shown as the reader's final page when Notion's own export cut the body short. */
const TRUNCATED_NOTICE = ['Page truncated by Notion.'];

/**
 * Invalidates a read the user has moved on from. A big page's markdown fetch
 * can still take a moment, so backing out and opening something else easily
 * leaves the first one in flight — and every reader shares the one
 * 'page-content' screen, so without this the abandoned read's result would
 * land on top of whatever the user is actually looking at.
 */
let pageSession = 0;

async function openPage(pageId: string, title: string, returnTo: ScreenName): Promise<void> {
  const mySession = ++pageSession;
  const base = { title, returnTo, pages: [] as string[][], index: 0, error: '' };

  state.pageContent = { ...base, loading: true };
  navigate('page-content');

  const spinner = startSpinner(() => void renderUpdate('page-content'));

  try {
    const { markdown, truncated } = await loadPageContent(pageId);
    if (mySession !== pageSession) return;
    const pages = markdownToPages(markdown);
    if (truncated) pages.push(TRUNCATED_NOTICE);
    state.pageContent = { ...base, loading: false, pages };
  } catch (e) {
    if (mySession !== pageSession) return;
    state.pageContent = {
      ...base,
      loading: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  } finally {
    // Still runs for the early returns above, hence the second check: a stale
    // read must not stop the live one's spinner or repaint its screen.
    if (mySession === pageSession) {
      stopSpinner(spinner);
      if (state.screen === 'page-content') void renderFull();
    }
  }
}

function turnPage(delta: number): void {
  const content = state.pageContent;
  if (!content || content.loading || content.error) return;

  const next = content.index + delta;
  if (next < 0 || next >= content.pages.length) return;

  content.index = next;
  // The layout is identical page to page, so an in-place content upgrade is
  // enough — and avoids the full-rebuild flicker on every page turn.
  void renderUpdate('page-content');
}

// ---------------------------------------------------------------------------
// Project drill-down — reached by tapping a project in any Projects list
// screen. Stashes the project and opens the Tasks/Notes menu.
// ---------------------------------------------------------------------------

function openProjectDetail(projectId: string, projectName: string, returnTo: ScreenName): void {
  state.selectedProject = { id: projectId, name: projectName, returnTo };
  navigate('project-detail');
}

// ---------------------------------------------------------------------------
// Add Task (Voice) — start/stop recording, transcribe, create the task
// ---------------------------------------------------------------------------

let startingRecognizer = false;

// Invalidates stale onFinal/onStop callbacks from a session the user has
// already cancelled — without this, an in-flight Vosk transcription that
// finishes after the user backs out (e.g. double-tap to tasks-menu while
// 'recording'/'processing') would still mutate state in the background.
let recordingSession = 0;

async function startRecording(): Promise<void> {
  const b = getBridge();
  if (!b) return;

  if (state.recording === 'idle' || state.recording === 'done' || state.recording === 'error') {
    // state.recording doesn't flip to 'recording' until after the await
    // below resolves, so a second tap landing in that window would
    // otherwise re-enter this branch and double-issue audioControl/startListening.
    if (startingRecognizer) return;
    startingRecognizer = true;
    // Ensure the Vosk recognizer is ready before starting
    const ready = await stt.ensureRecognizer(VOSK_MODEL_URL);
    startingRecognizer = false;
    if (!ready) {
      state.recording = 'error';
      state.errorMessage = 'Voice model loading. Please try again in a moment.';
      void renderUpdate('add-task');
      return;
    }

    const mySession = ++recordingSession;

    // Start recording
    state.recording = 'recording';
    state.createdTaskName = '';
    state.errorMessage = '';
    void renderUpdate('add-task');

    await b.audioControl(true, AudioInputSource.Glasses);

    stt.startListening(
      // onFinal: Vosk returned its transcription (called async, after mic closed)
      async (text) => {
        if (mySession !== recordingSession) return; // stale — user already left/restarted
        if (!text || text.trim().length === 0) {
          state.recording = 'error';
          state.errorMessage = "Couldn't hear anything. Tap to try again.";
          void renderUpdate('add-task');
          return;
        }
        state.pendingTranscript = text.trim();
        state.recording = 'confirm';
        void renderUpdate('add-task');
      },
      // onStop: VAD detected silence OR user tapped to stop early.
      // Called synchronously — close the mic and show "processing".
      () => {
        if (mySession !== recordingSession) return;
        void b.audioControl(false);
        state.recording = 'processing';
        void renderUpdate('add-task');
      },
    );
    return;
  }

  if (state.recording === 'recording') {
    // User tapped while recording — manual stop (same path as VAD auto-stop)
    stt.stopListening();
  }
}

let confirmingAddTask = false;

async function confirmAddTask(): Promise<void> {
  if (confirmingAddTask) return;
  const transcript = state.pendingTranscript;
  if (!transcript) return;
  confirmingAddTask = true;
  try {
    const result = await createTask(transcript);
    state.createdTaskName = result.name;
    state.pendingTranscript = '';
    state.recording = 'done';
  } catch (e) {
    state.pendingTranscript = '';
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error';
    state.recording = 'error';
  } finally {
    confirmingAddTask = false;
  }
  void renderUpdate('add-task');
}

function discardAddTask(): void {
  state.pendingTranscript = '';
  state.recording = 'idle';
  void renderUpdate('add-task');
}

function cancelRecordingAndGoBack(): void {
  if (stt.isListening()) {
    stt.stopListening(); // fires onStop synchronously under the CURRENT session — must run first
  }
  recordingSession++; // invalidate — only affects the later async onFinal
  navigate('tasks-menu');
}

// ---------------------------------------------------------------------------
// Public context — side-effect surface handed to screen action() handlers
// ---------------------------------------------------------------------------

export function createGlassCtx(): GlassCtx {
  return {
    navigate,
    shutdown,
    stopSpinner,
    enterView: (screen) => void enterView(screen),
    startRecording: () => void startRecording(),
    cancelRecordingAndGoBack,
    confirmAddTask,
    discardAddTask,
    openConfirm: (kind, itemId, itemName, returnTo) => {
      const action = ITEM_ACTIONS[kind];
      openConfirm(action, itemId, itemName, returnTo);
    },
    confirmAction,
    dismissConfirm,
    dismissActionToast,
    openTaskActions,
    enterTaskMetadata: () => void enterTaskMetadata(),
    openNoteActions,
    enterNoteMetadata: () => void enterNoteMetadata(),
    openPage: (pageId, title, returnTo) => void openPage(pageId, title, returnTo),
    turnPage,
    openProjectDetail,
  };
}
