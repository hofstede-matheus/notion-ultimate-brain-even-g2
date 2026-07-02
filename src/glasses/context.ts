import { AudioInputSource } from '@evenrealities/even_hub_sdk'
import { state, getBridge } from '../state'
import type { Screen } from '../state'
import { fetchTodayTasks, fetchInboxTasks, createTask } from '../api'
import { loadCachedTasks, saveCachedTasks, CACHE_KEY_TODAY, CACHE_KEY_INBOX } from '../cache'
import * as stt from '../stt'
import { renderFull, renderUpdate, showOverdue, showToday, showInbox } from './render'

const VOSK_MODEL_URL = '/vosk/model.tar.gz'

// ---------------------------------------------------------------------------
// Spinner — animates while a background fetch is in flight
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ['|', '/', '-', '\\']
let spinnerInterval: ReturnType<typeof setInterval> | null = null

function startSpinner(onTick: () => void): void {
  stopSpinner() // clear any previous interval first
  let i = 0
  state.spinnerFrame = SPINNER_FRAMES[0]!
  spinnerInterval = setInterval(() => {
    i = (i + 1) % SPINNER_FRAMES.length
    state.spinnerFrame = SPINNER_FRAMES[i]!
    onTick()
  }, 250)
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
  console.log(`[debug] navigate: ${state.screen} -> ${screen}`)
  if (screen === 'add-task') {
    state.recording = 'idle'
    state.createdTaskName = ''
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
    console.error('[notion-ultimate-brain] fetch today failed', e)
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
    console.error('[notion-ultimate-brain] fetch inbox failed', e)
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

// ---------------------------------------------------------------------------
// Add Task (Voice) — start/stop recording, transcribe, create the task
// ---------------------------------------------------------------------------

async function startRecording(): Promise<void> {
  const b = getBridge()
  if (!b) return

  if (state.recording === 'idle' || state.recording === 'done' || state.recording === 'error') {
    // Ensure the Vosk recognizer is ready before starting
    const ready = await stt.ensureRecognizer(VOSK_MODEL_URL)
    if (!ready) {
      state.recording = 'error'
      state.errorMessage = 'Voice model loading. Please try again in a moment.'
      void renderUpdate('add-task')
      return
    }

    // Start recording
    state.recording = 'recording'
    state.createdTaskName = ''
    state.errorMessage = ''
    void renderUpdate('add-task')

    await b.audioControl(true, AudioInputSource.Glasses)

    stt.startListening(
      // onFinal: Vosk returned its transcription (called async, after mic closed)
      async (text) => {
        if (!text || text.trim().length === 0) {
          state.recording = 'error'
          state.errorMessage = 'Couldn\'t hear anything. Tap to try again.'
          void renderUpdate('add-task')
          return
        }
        try {
          const result = await createTask(text.trim())
          state.createdTaskName = result.name
          state.recording = 'done'
        } catch (e) {
          console.error('[notion-ultimate-brain] createTask failed', e)
          state.recording = 'error'
          state.errorMessage = e instanceof Error ? e.message : 'Unknown error'
        }
        void renderUpdate('add-task')
      },
      // onStop: VAD detected silence OR user tapped to stop early.
      // Called synchronously — close the mic and show "processing".
      () => {
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

function cancelRecordingAndGoBack(): void {
  if (stt.isListening()) {
    stt.stopListening()
  }
  navigate('tasks-menu')
}

// ---------------------------------------------------------------------------
// Public context — side-effect surface handed to screen action() handlers
// ---------------------------------------------------------------------------

export interface GlassCtx {
  navigate(screen: Screen): void
  shutdown(): void
  stopSpinner(): void
  enterOverdue(): void
  enterToday(): void
  enterInbox(): void
  startRecording(): void
  cancelRecordingAndGoBack(): void
}

export function createGlassCtx(): GlassCtx {
  return {
    navigate,
    shutdown,
    stopSpinner,
    enterOverdue: () => void enterOverdue(),
    enterToday: () => void enterToday(),
    enterInbox: () => void enterInbox(),
    startRecording: () => void startRecording(),
    cancelRecordingAndGoBack,
  }
}
