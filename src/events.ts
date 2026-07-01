import {
  OsEventTypeList,
  AudioInputSource,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { state, getBridge } from './state'
import {
  MENU_ITEMS,
  showMenu,
  updateMenuContent,
  showToday,
  showInbox,
  showAddTask,
  updateTodayContent,
  updateInboxContent,
  updateAddTaskContent,
  getTodayFlatTasks,
  getInboxFlatTasks,
} from './renderer'
import { fetchTodayTasks, fetchInboxTasks, createTask } from './api'
import { loadCachedTasks, saveCachedTasks, CACHE_KEY_TODAY, CACHE_KEY_INBOX } from './cache'
import * as stt from './stt'

const VOSK_MODEL_URL = '/vosk/model.tar.gz'

// ---------------------------------------------------------------------------
// Event type normalisation (SDK quirk: CLICK_EVENT=0 → undefined)
// ---------------------------------------------------------------------------

function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType

  if (typeof raw === 'number') return raw as OsEventTypeList

  // If an event object exists but type is undefined, it's a click (0 → undefined)
  if (event.listEvent || event.textEvent || event.sysEvent) {
    return OsEventTypeList.CLICK_EVENT
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Spinner — animates while a background fetch is in flight
// ---------------------------------------------------------------------------

const SPINNER_FRAMES = ['|', '/', '-', '\\']
let spinnerInterval: ReturnType<typeof setInterval> | null = null

function startSpinner(onTick: () => void): void {
  stopSpinner() // clear any previous interval first
  let i = 0
  state.spinnerFrame = SPINNER_FRAMES[0]
  spinnerInterval = setInterval(() => {
    i = (i + 1) % SPINNER_FRAMES.length
    state.spinnerFrame = SPINNER_FRAMES[i]
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
// Scroll throttle (300ms cooldown)
// ---------------------------------------------------------------------------

let lastScrollAt = 0
const SCROLL_COOLDOWN = 300

function isScrollThrottled(): boolean {
  const now = Date.now()
  if (now - lastScrollAt < SCROLL_COOLDOWN) return true
  lastScrollAt = now
  return false
}

// ---------------------------------------------------------------------------
// Screen-specific handlers
// ---------------------------------------------------------------------------

async function handleMenuEvent(
  _event: EvenHubEvent,
  eventType: OsEventTypeList,
): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    // Root page: MUST call shutDownPageContainer(1)
    const b = getBridge()
    if (b) void b.shutDownPageContainer(1)
    return
  }

  // Scroll up → move cursor to previous item
  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (state.menuSelectedIndex > 0) {
      state.menuSelectedIndex--
      void updateMenuContent()
    }
    return
  }

  // Scroll down → move cursor to next item
  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    if (state.menuSelectedIndex < MENU_ITEMS.length - 1) {
      state.menuSelectedIndex++
      void updateMenuContent()
    }
    return
  }

  if (eventType === OsEventTypeList.CLICK_EVENT) {
    const idx = state.menuSelectedIndex

    if (idx === 0) {
      // ── Today's Tasks ──────────────────────────────────────────────────────
      // 0. Reset cursor on screen entry
      state.todaySelectedIndex = 0

      // 1. Show cached data immediately (or a "Fetching…" placeholder if cold)
      const cached = await loadCachedTasks(CACHE_KEY_TODAY)
      if (cached !== null) {
        state.todayTasks = cached
        state.loading = false
      } else {
        state.loading = true
      }
      void showToday()

      // 2. Spin while the fresh data loads in the background
      startSpinner(() => {
        if (state.screen === 'today') void updateTodayContent()
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
        // Clamp cursor in case task list shrunk during refresh
        state.todaySelectedIndex = Math.min(
          state.todaySelectedIndex,
          Math.max(0, getTodayFlatTasks().length - 1),
        )
        if (state.screen === 'today') void updateTodayContent()
      }
    } else if (idx === 1) {
      // ── Inbox ───────────────────────────────────────────────────────────────
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
      void showInbox()

      // 2. Spin while the fresh data loads in the background
      startSpinner(() => {
        if (state.screen === 'inbox') void updateInboxContent()
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
        // Clamp cursor in case task list shrunk during refresh
        state.inboxSelectedIndex = Math.min(
          state.inboxSelectedIndex,
          Math.max(0, getInboxFlatTasks().length - 1),
        )
        if (state.screen === 'inbox') void updateInboxContent()
      }
    } else if (idx === 2) {
      // Add Task (Voice)
      void showAddTask()
    }
  }
}

async function handleAddTaskEvent(eventType: OsEventTypeList): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    // Stop any active recording before going back
    if (stt.isListening()) {
      stt.stopListening()
    }
    void showMenu()
    return
  }

  if (eventType !== OsEventTypeList.CLICK_EVENT) return

  const b = getBridge()
  if (!b) return

  if (state.recording === 'idle' || state.recording === 'done' || state.recording === 'error') {
    // Ensure the Vosk recognizer is ready before starting
    const ready = await stt.ensureRecognizer(VOSK_MODEL_URL)
    if (!ready) {
      state.recording = 'error'
      state.errorMessage = 'Voice model loading. Please try again in a moment.'
      void updateAddTaskContent()
      return
    }

    // Start recording
    state.recording = 'recording'
    state.createdTaskName = ''
    state.errorMessage = ''
    void updateAddTaskContent()

    await b.audioControl(true, AudioInputSource.Glasses)

    stt.startListening(
      // onFinal: Vosk returned its transcription (called async, after mic closed)
      async (text) => {
        if (!text || text.trim().length === 0) {
          state.recording = 'error'
          state.errorMessage = 'Couldn\'t hear anything. Tap to try again.'
          void updateAddTaskContent()
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
        void updateAddTaskContent()
      },
      // onStop: VAD detected silence OR user tapped to stop early.
      // Called synchronously — close the mic and show "processing".
      () => {
        void b.audioControl(false)
        state.recording = 'processing'
        void updateAddTaskContent()
      },
    )
    return
  }

  if (state.recording === 'recording') {
    // User tapped while recording — manual stop (same path as VAD auto-stop)
    stt.stopListening()
    return
  }
}

async function handleTodayEvent(eventType: OsEventTypeList): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    stopSpinner()
    state.todaySelectedIndex = 0
    await showMenu()
    return
  }

  // CLICK_EVENT: no task detail screen exists yet — intentionally no-op

  if (
    eventType !== OsEventTypeList.SCROLL_TOP_EVENT &&
    eventType !== OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    return
  }

  if (isScrollThrottled()) return

  const tasks = getTodayFlatTasks()
  if (tasks.length === 0) return

  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (state.todaySelectedIndex > 0) {
      state.todaySelectedIndex--
      await updateTodayContent()
    }
    return
  }

  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    if (state.todaySelectedIndex < tasks.length - 1) {
      state.todaySelectedIndex++
      await updateTodayContent()
    }
  }
}

async function handleInboxEvent(eventType: OsEventTypeList): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    stopSpinner()
    state.inboxSelectedIndex = 0
    await showMenu()
    return
  }

  // CLICK_EVENT: no task detail screen exists yet — intentionally no-op

  if (
    eventType !== OsEventTypeList.SCROLL_TOP_EVENT &&
    eventType !== OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    return
  }

  if (isScrollThrottled()) return

  const tasks = getInboxFlatTasks()
  if (tasks.length === 0) return

  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    if (state.inboxSelectedIndex > 0) {
      state.inboxSelectedIndex--
      await updateInboxContent()
    }
    return
  }

  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    if (state.inboxSelectedIndex < tasks.length - 1) {
      state.inboxSelectedIndex++
      await updateInboxContent()
    }
  }
}

// ---------------------------------------------------------------------------
// Main event dispatcher
// ---------------------------------------------------------------------------

export function onEvenHubEvent(event: EvenHubEvent): void {
  // Route PCM audio frames to Vosk while a session is active.
  // Mirror of EvenChess app.ts: bypass all other handling for audio events.
  if (event.audioEvent && event.audioEvent.audioPcm != null && stt.isListening()) {
    stt.feedAudio(event.audioEvent.audioPcm)
    return
  }

  const eventType = resolveEventType(event)
  if (eventType === undefined) return

  // Throttle scroll events
  if (
    eventType === OsEventTypeList.SCROLL_TOP_EVENT ||
    eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    if (isScrollThrottled()) return
  }

  switch (state.screen) {
    case 'menu':
      void handleMenuEvent(event, eventType)
      break

    case 'today':
      void handleTodayEvent(eventType)
      break

    case 'inbox':
      void handleInboxEvent(eventType)
      break

    case 'add-task':
      void handleAddTaskEvent(eventType)
      break
  }
}