import { AudioInputSource } from '@evenrealities/even_hub_sdk'
import { state, getBridge } from '../state'
import type { Screen, ListItem } from '../state'
import {
  fetchTodayTasks,
  fetchInboxTasks,
  createTask,
  markTaskDone,
  fetchTaskMetadata,
  deleteTask,
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
  fetchTasksForProject,
  fetchNotesForProject,
} from '../api'
import { loadCachedList, saveCachedList, cacheKeyForScreen } from '../cache'
import * as stt from '../stt'
import { renderFull, renderUpdate } from './render'
import { VOSK_MODEL_URL, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from './constants'
import type { GlassCtx } from './types'

// ---------------------------------------------------------------------------
// Generic list views — every Tasks/Notes/Projects/Tags screen, including
// Today/Overdue/Inbox. One fetcher per data key; the generic enterView()
// cache-then-fetch pipeline (below) is shared by all of them.
// ---------------------------------------------------------------------------

const VIEW_FETCHERS: Partial<Record<Screen, () => Promise<ListItem[]>>> = {
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
  'project-tasks': () => fetchTasksForProject(state.selectedProject!.id),
  'project-notes': () => fetchNotesForProject(state.selectedProject!.id),
}

/**
 * Screens whose fetched data lives under a different state.lists/cache key.
 * Overdue is a filtered view over the same array Today fetches
 * (/api/tasks/today returns everything due today-or-before) — see
 * getOverdueFlatTasks/getTodayFlatTasks in screens/shared.ts.
 */
const DATA_KEY_OVERRIDES: Partial<Record<Screen, Screen>> = {
  overdue: 'today',
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
// List-view entry — cache-then-fresh-fetch with a spinner while in flight.
// Covers every Tasks/Notes/Projects/Tags screen, including Today/Overdue/
// Inbox (Overdue reads/writes the 'today' data key via DATA_KEY_OVERRIDES).
// ---------------------------------------------------------------------------

/**
 * Cache key for a generic list-view screen, scoped by selected project for
 * project-tasks/project-notes so switching projects doesn't flash the
 * previous project's cached list.
 */
function cacheKeyForListView(screen: Screen): string {
  if (screen === 'project-tasks' || screen === 'project-notes') {
    return `${cacheKeyForScreen(screen)}:${state.selectedProject?.id ?? 'none'}`
  }
  return cacheKeyForScreen(screen)
}

/**
 * Generic cache-then-fetch entry point for every list-view screen — looks up
 * the underlying data key's fetcher in VIEW_FETCHERS (Overdue resolves to
 * Today's 'today' key via DATA_KEY_OVERRIDES), caches under a key derived
 * from that data key, and lands on `screen`. A no-op (stays on the current
 * screen) if the data key has no registered fetcher.
 */
async function enterView(screen: Screen): Promise<void> {
  const dataKey = DATA_KEY_OVERRIDES[screen] ?? screen
  const fetchFn = VIEW_FETCHERS[dataKey]
  if (!fetchFn) return

  // 0. Reset this screen's own cursor on entry (Today/Overdue each keep
  // their own cursor even though they share fetched data).
  state.selectedIndex[screen] = 0

  // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
  const cacheKey = cacheKeyForListView(dataKey)
  const cached = await loadCachedList<ListItem>(cacheKey)
  if (cached !== null) {
    state.lists[dataKey] = cached
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
    state.lists[dataKey] = fresh
    state.loading = false
    void saveCachedList(cacheKey, fresh)
  } catch (e) {
    if (state.loading) state.lists[dataKey] = [] // no cache — show empty
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
// (all routed through makeListScreen()). All of them key their owning list
// by `returnTo`.
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

/**
 * Removes a task from whichever list actually owns it — Today and Overdue
 * are both filtered views over the same 'today' data key (see
 * DATA_KEY_OVERRIDES). Shared by confirmMarkDone and confirmDelete, which
 * both key the owning list by `returnTo`.
 */
function removeTaskFromOwningList(taskId: string, returnTo: Screen): void {
  const dataKey = DATA_KEY_OVERRIDES[returnTo] ?? returnTo
  const list = (state.lists[dataKey] ?? []).filter((item) => item.id !== taskId)
  state.lists[dataKey] = list
  void saveCachedList(cacheKeyForListView(dataKey), list)
}

async function confirmMarkDone(): Promise<void> {
  const pending = state.pendingMarkDone
  if (!pending) return
  const { taskId, taskName, returnTo } = pending

  try {
    await markTaskDone(taskId)

    removeTaskFromOwningList(taskId, returnTo)

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
// Task action menu — reached by tapping a task in any Tasks list screen.
// Offers Load metadata / Mark as done / Delete task.
// ---------------------------------------------------------------------------

function openTaskActions(taskId: string, taskName: string, returnTo: Screen): void {
  state.selectedTask = { taskId, taskName, returnTo }
  navigate('task-actions')
}

async function enterTaskMetadata(): Promise<void> {
  const selected = state.selectedTask
  if (!selected) return

  state.taskMetadata = { loading: true, project: null, due: null, error: '' }
  navigate('task-metadata')

  startSpinner(() => void renderUpdate('task-metadata'))

  try {
    const { project, due } = await fetchTaskMetadata(selected.taskId)
    state.taskMetadata = { loading: false, project, due, error: '' }
  } catch (e) {
    state.taskMetadata = {
      loading: false,
      project: null,
      due: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    }
  } finally {
    stopSpinner()
    if (state.screen === 'task-metadata') void renderFull('task-metadata')
  }
}

// ---------------------------------------------------------------------------
// Delete Task — confirm dialog + toast, direct parallel of Mark Task Done.
// ---------------------------------------------------------------------------

let deleteToastTimeout: ReturnType<typeof setTimeout> | null = null

function openDeleteConfirm(): void {
  const selected = state.selectedTask
  if (!selected) return
  state.pendingDelete = { ...selected }
  state.errorMessage = ''
  navigate('delete-confirm')
}

function dismissDeleteConfirm(): void {
  const returnTo = state.pendingDelete?.returnTo ?? 'tasks-menu'
  state.pendingDelete = null
  navigate(returnTo)
}

async function confirmDelete(): Promise<void> {
  const pending = state.pendingDelete
  if (!pending) return
  const { taskId, taskName, returnTo } = pending

  try {
    await deleteTask(taskId)

    removeTaskFromOwningList(taskId, returnTo)

    state.pendingDelete = null
    state.deleteToast = { taskName, returnTo, untilMs: Date.now() + 1500 }
    navigate('delete-toast')

    if (deleteToastTimeout !== null) clearTimeout(deleteToastTimeout)
    deleteToastTimeout = setTimeout(() => {
      deleteToastTimeout = null
      state.deleteToast = null
      navigate(returnTo)
    }, 1500)
  } catch (e) {
    state.errorMessage = e instanceof Error ? e.message : 'Unknown error'
    void renderUpdate('delete-confirm')
  }
}

function dismissDeleteToastAndReturn(): void {
  if (deleteToastTimeout !== null) {
    clearTimeout(deleteToastTimeout)
    deleteToastTimeout = null
  }
  const returnTo = state.deleteToast?.returnTo ?? 'tasks-menu'
  state.deleteToast = null
  navigate(returnTo)
}

// ---------------------------------------------------------------------------
// Project drill-down — reached by tapping a project in any Projects list
// screen. Stashes the project and opens the Tasks/Notes menu.
// ---------------------------------------------------------------------------

function openProjectDetail(projectId: string, projectName: string, returnTo: Screen): void {
  state.selectedProject = { id: projectId, name: projectName, returnTo }
  navigate('project-detail')
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
    enterView: (screen) => void enterView(screen),
    startRecording: () => void startRecording(),
    cancelRecordingAndGoBack,
    confirmAddTask,
    discardAddTask,
    openMarkDoneConfirm,
    confirmMarkDone,
    dismissMarkDoneConfirm,
    dismissToastAndReturn,
    openTaskActions,
    enterTaskMetadata: () => void enterTaskMetadata(),
    openDeleteConfirm,
    dismissDeleteConfirm,
    confirmDelete,
    dismissDeleteToastAndReturn,
    openProjectDetail,
  }
}
