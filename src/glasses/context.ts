import { AudioInputSource } from '@evenrealities/even_hub_sdk'
import { state, getBridge } from '../state'
import type { Screen, ListItem } from '../state'
import {
  fetchTodayTasks,
  fetchInboxTasks,
  createTask,
  markTaskDone,
  fetchNext7DaysTasks,
  fetchTomorrowTasks,
  fetchInboxNotes,
  fetchFavoriteNotes,
  fetchByTagNotes,
  fetchNotes,
  fetchMeetingNotes,
  fetchByProjectNotes,
  fetchClipsNotes,
  fetchVoiceNotes,
  fetchJournalNotes,
  fetchAllNotes,
  fetchActiveProjects,
  fetchPlannedProjects,
  fetchBoardProjects,
  fetchArchivedProjects,
  fetchRecentTags,
  fetchFavoriteTags,
  fetchAToZTags,
  fetchTypeTags,
} from '../api'
import { loadCachedTasks, saveCachedTasks, CACHE_KEY_TODAY, CACHE_KEY_INBOX, loadCachedList, saveCachedList, cacheKeyForScreen } from '../cache'
import * as stt from '../stt'
import { renderFull, renderUpdate, showOverdue, showToday, showInbox } from './render'
import { VOSK_MODEL_URL, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from './constants'
import type { GlassCtx } from './types'

// ---------------------------------------------------------------------------
// Generic list views — every Tasks/Notes/Projects/Tags screen beyond
// Today/Inbox/Overdue (which have their own dedicated pipeline below,
// sharing state.todayTasks/inboxTasks). One fetcher per screen name; the
// generic enterView() cache-then-fetch pipeline is shared by all of them.
// ---------------------------------------------------------------------------

const VIEW_FETCHERS: Partial<Record<Screen, () => Promise<ListItem[]>>> = {
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
}

// ---------------------------------------------------------------------------
// Spinner — animates while a background fetch is in flight
// ---------------------------------------------------------------------------

let spinnerInterval: ReturnType<typeof setInterval> | null = null

function startSpinner(onTick: () => void): void {
  stopSpinner() // clear any previous interval first
  let i = 0
  state.spinnerFrame = SPINNER_FRAMES[0]!
  spinnerInterval = setInterval(() => {
    i = (i + 1) % SPINNER_FRAMES.length
    state.spinnerFrame = SPINNER_FRAMES[i]!
    onTick()
  }, SPINNER_INTERVAL_MS)
}

function stopSpinner(): void {
  if (spinnerInterval !== null) {
    clearInterval(spinnerInterval)
    spinnerInterval = null
  }
  state.spinnerFrame = ''
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function navigate(screen: Screen): void {
  if (screen === 'add-task') {
    state.recording = 'idle'
    state.createdTaskName = ''
    state.pendingTranscript = ''
    state.errorMessage = ''
  }
  state.screen = screen
  void renderFull(screen)
}

function shutdown(): void {
  // Root page: MUST call shutDownPageContainer(1)
  const b = getBridge()
  if (b) void b.shutDownPageContainer(1)
}

// ---------------------------------------------------------------------------
// Overdue / Today / Inbox entry — cache-then-fresh-fetch with a spinner
// while in flight
// ---------------------------------------------------------------------------

/**
 * Overdue and Today are both views over the same underlying task list
 * (state.todayTasks), just filtered differently (see shared.ts) — so they
 * share one fetch/cache pipeline, diverging only in which cursor to reset
 * and which screen to land on.
 */
async function enterOverdueOrToday(screen: 'overdue' | 'today'): Promise<void> {
  // 0. Reset cursor on screen entry
  if (screen === 'overdue') state.overdueSelectedIndex = 0
  else state.todaySelectedIndex = 0

  // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
  const cached = await loadCachedTasks(CACHE_KEY_TODAY)
  if (cached !== null) {
    state.todayTasks = cached
    state.loading = false
  } else {
    state.loading = true
  }
  navigate(screen)

  // 2. Spin while the fresh data loads in the background
  startSpinner(() => {
    void renderUpdate(screen)
  })

  try {
    const fresh = await fetchTodayTasks()
    state.todayTasks = fresh
    state.loading = false
    void saveCachedTasks(CACHE_KEY_TODAY, fresh)
  } catch (e) {
    if (state.loading) state.todayTasks = [] // no cache — show empty
    state.loading = false
  } finally {
    stopSpinner()
    // The fetched list may differ from what's on screen (item count, order,
    // overdue/today split) — there's no partial-list-update API, so refresh
    // via a full rebuild rather than the header-only renderUpdate.
    if (state.screen === screen) void (screen === 'overdue' ? showOverdue() : showToday())
  }
}

function enterOverdue(): Promise<void> {
  return enterOverdueOrToday('overdue')
}

function enterToday(): Promise<void> {
  return enterOverdueOrToday('today')
}

async function enterInbox(): Promise<void> {
  // 0. Reset cursor on screen entry
  state.inboxSelectedIndex = 0

  // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
  const cached = await loadCachedTasks(CACHE_KEY_INBOX)
  if (cached !== null) {
    state.inboxTasks = cached
    state.loading = false
  } else {
    state.loading = true
  }
  navigate('inbox')

  // 2. Spin while the fresh data loads in the background
  startSpinner(() => {
    void renderUpdate('inbox')
  })

  try {
    const fresh = await fetchInboxTasks()
    state.inboxTasks = fresh
    state.loading = false
    void saveCachedTasks(CACHE_KEY_INBOX, fresh)
  } catch (e) {
    if (state.loading) state.inboxTasks = [] // no cache — show empty
    state.loading = false
  } finally {
    stopSpinner()
    // The fetched list may differ from what's on screen — there's no
    // partial-list-update API, so refresh via a full rebuild rather than
    // the header-only renderUpdate.
    if (state.screen === 'inbox') void showInbox()
  }
}

/**
 * Generic cache-then-fetch entry point for every list-view screen besides
 * Today/Inbox/Overdue — looks up the screen's fetcher in VIEW_FETCHERS,
 * caches under a key derived from the screen name, and mirrors the
 * enterOverdueOrToday/enterInbox pipeline above. A no-op (stays on the
 * current screen) if the screen has no registered fetcher.
 */
async function enterView(screen: Screen): Promise<void> {
  const fetchFn = VIEW_FETCHERS[screen]
  if (!fetchFn) return

  // 0. Reset cursor on screen entry
  state.selectedIndex[screen] = 0

  // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
  const cacheKey = cacheKeyForScreen(screen)
  const cached = await loadCachedList<ListItem>(cacheKey)
  if (cached !== null) {
    state.lists[screen] = cached
    state.loading = false
  } else {
    state.loading = true
  }
  navigate(screen)

  // 2. Spin while the fresh data loads in the background
  startSpinner(() => {
    void renderUpdate(screen)
  })

  try {
    const fresh = await fetchFn()
    state.lists[screen] = fresh
    state.loading = false
    void saveCachedList(cacheKey, fresh)
  } catch (e) {
    if (state.loading) state.lists[screen] = [] // no cache — show empty
    state.loading = false
  } finally {
    stopSpinner()
    // The fetched list may differ from what's on screen — there's no
    // partial-list-update API, so refresh via a full rebuild rather than
    // the header-only renderUpdate.
    if (state.screen === screen) void renderFull(screen)
  }
}

// ---------------------------------------------------------------------------
// Mark Task Done — confirm dialog + toast, shared by every Tasks list screen
// (Today/Overdue/Inbox and the generic Tasks views routed through
// makeListScreen()). All of them key their owning list by `returnTo`.
// ---------------------------------------------------------------------------

let markDoneToastTimeout: ReturnType<typeof setTimeout> | null = null

function openMarkDoneConfirm(taskId: string, taskName: string, returnTo: Screen): void {
  state.pendingMarkDone = { taskId, taskName, returnTo }
  state.errorMessage = ''
  navigate('mark-done-confirm')
}

function dismissMarkDoneConfirm(): void {
  const returnTo = state.pendingMarkDone?.returnTo ?? 'tasks-menu'
  state.pendingMarkDone = null
  navigate(returnTo)
}

async function confirmMarkDone(): Promise<void> {
  const pending = state.pendingMarkDone
  if (!pending) return
  const { taskId, taskName, returnTo } = pending

  try {
    await markTaskDone(taskId)

    // Remove the task from whichever list actually owns it — Today and
    // Overdue are both filtered views over the same state.todayTasks array.
    if (returnTo === 'today' || returnTo === 'overdue') {
      state.todayTasks = state.todayTasks.filter((t) => t.id !== taskId)
      void saveCachedTasks(CACHE_KEY_TODAY, state.todayTasks)
    } else if (returnTo === 'inbox') {
      state.inboxTasks = state.inboxTasks.filter((t) => t.id !== taskId)
      void saveCachedTasks(CACHE_KEY_INBOX, state.inboxTasks)
    } else {
      const list = (state.lists[returnTo] ?? []).filter((item) => item.id !== taskId)
      state.lists[returnTo] = list
      void saveCachedList(cacheKeyForScreen(returnTo), list)
    }

    state.pendingMarkDone = null
    state.markDoneToast = { taskName, returnTo, untilMs: Date.now() + 1500 }
    navigate('mark-done-toast')

    if (markDoneToastTimeout !== null) clearTimeout(markDoneToastTimeout)
    markDoneToastTimeout = setTimeout(() => {
      markDoneToastTimeout = null
      state.markDoneToast = null
      navigate(returnTo)
    }, 1500)
  } catch (e) {
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error'
    void renderUpdate('mark-done-confirm')
  }
}

function dismissToastAndReturn(): void {
  if (markDoneToastTimeout !== null) {
    clearTimeout(markDoneToastTimeout)
    markDoneToastTimeout = null
  }
  const returnTo = state.markDoneToast?.returnTo ?? 'tasks-menu'
  state.markDoneToast = null
  navigate(returnTo)
}

// ---------------------------------------------------------------------------
// Add Task (Voice) — start/stop recording, transcribe, create the task
// ---------------------------------------------------------------------------

let startingRecognizer = false

// Invalidates stale onFinal/onStop callbacks from a session the user has
// already cancelled — without this, an in-flight Vosk transcription that
// finishes after the user backs out (e.g. double-tap to tasks-menu while
// 'recording'/'processing') would still mutate state in the background.
let recordingSession = 0

async function startRecording(): Promise<void> {
  const b = getBridge()
  if (!b) return

  if (state.recording === 'idle' || state.recording === 'done' || state.recording === 'error') {
    // state.recording doesn't flip to 'recording' until after the await
    // below resolves, so a second tap landing in that window would
    // otherwise re-enter this branch and double-issue audioControl/startListening.
    if (startingRecognizer) return
    startingRecognizer = true
    // Ensure the Vosk recognizer is ready before starting
    const ready = await stt.ensureRecognizer(VOSK_MODEL_URL)
    startingRecognizer = false
    if (!ready) {
      state.recording = 'error'
      state.errorMessage = 'Voice model loading. Please try again in a moment.'
      void renderUpdate('add-task')
      return
    }

    const mySession = ++recordingSession

    // Start recording
    state.recording = 'recording'
    state.createdTaskName = ''
    state.errorMessage = ''
    void renderUpdate('add-task')

    await b.audioControl(true, AudioInputSource.Glasses)

    stt.startListening(
      // onFinal: Vosk returned its transcription (called async, after mic closed)
      async (text) => {
        if (mySession !== recordingSession) return // stale — user already left/restarted
        if (!text || text.trim().length === 0) {
          state.recording = 'error'
          state.errorMessage = 'Couldn\'t hear anything. Tap to try again.'
          void renderUpdate('add-task')
          return
        }
        state.pendingTranscript = text.trim()
        state.recording = 'confirm'
        void renderUpdate('add-task')
      },
      // onStop: VAD detected silence OR user tapped to stop early.
      // Called synchronously — close the mic and show "processing".
      () => {
        if (mySession !== recordingSession) return
        void b.audioControl(false)
        state.recording = 'processing'
        void renderUpdate('add-task')
      },
    )
    return
  }

  if (state.recording === 'recording') {
    // User tapped while recording — manual stop (same path as VAD auto-stop)
    stt.stopListening()
  }
}

let confirmingAddTask = false

async function confirmAddTask(): Promise<void> {
  if (confirmingAddTask) return
  const transcript = state.pendingTranscript
  if (!transcript) return
  confirmingAddTask = true
  try {
    const result = await createTask(transcript)
    state.createdTaskName = result.name
    state.pendingTranscript = ''
    state.recording = 'done'
  } catch (e) {
    state.pendingTranscript = ''
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error'
    state.recording = 'error'
  } finally {
    confirmingAddTask = false
  }
  void renderUpdate('add-task')
}

function discardAddTask(): void {
  state.pendingTranscript = ''
  state.recording = 'idle'
  void renderUpdate('add-task')
}

function cancelRecordingAndGoBack(): void {
  if (stt.isListening()) {
    stt.stopListening() // fires onStop synchronously under the CURRENT session — must run first
  }
  recordingSession++ // invalidate — only affects the later async onFinal
  navigate('tasks-menu')
}

// ---------------------------------------------------------------------------
// Public context — side-effect surface handed to screen action() handlers
// ---------------------------------------------------------------------------

export function createGlassCtx(): GlassCtx {
  return {
    navigate,
    shutdown,
    stopSpinner,
    enterOverdue: () => void enterOverdue(),
    enterToday: () => void enterToday(),
    enterInbox: () => void enterInbox(),
    enterView: (screen) => void enterView(screen),
    startRecording: () => void startRecording(),
    cancelRecordingAndGoBack,
    confirmAddTask,
    discardAddTask,
    openMarkDoneConfirm,
    confirmMarkDone,
    dismissMarkDoneConfirm,
    dismissToastAndReturn,
  }
}
