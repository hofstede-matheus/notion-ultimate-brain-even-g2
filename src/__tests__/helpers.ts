import { vi } from 'vitest'
import { state } from '../state'

// ---------------------------------------------------------------------------
// Mock bridge factory
// ---------------------------------------------------------------------------

export function makeMockBridge() {
  return {
    createStartUpPageContainer: vi.fn().mockResolvedValue(0),
    rebuildPageContainer: vi.fn().mockResolvedValue(true),
    textContainerUpgrade: vi.fn().mockResolvedValue(true),
    shutDownPageContainer: vi.fn().mockResolvedValue(true),
    audioControl: vi.fn().mockResolvedValue(true),
    setLocalStorage: vi.fn().mockResolvedValue(true),
    getLocalStorage: vi.fn().mockResolvedValue(''),
  }
}

// ---------------------------------------------------------------------------
// State reset
// ---------------------------------------------------------------------------

export function resetState() {
  state.screen = 'menu'
  state.startupRendered = true   // skip createStartUpPageContainer path
  state.menuSelectedIndex = 0
  state.todayTasks = []
  state.inboxTasks = []
  state.todaySelectedIndex = 0
  state.inboxSelectedIndex = 0
  state.recording = 'idle'
  state.createdTaskName = ''
  state.loading = false
  state.spinnerFrame = ''
  state.errorMessage = ''
}

// ---------------------------------------------------------------------------
// Promise flushing
// Drains the microtask queue several levels deep so that chained .then()
// callbacks (from mocked resolved promises) all complete before we assert.
// ---------------------------------------------------------------------------

export async function flushPromises(depth = 5) {
  for (let i = 0; i < depth; i++) {
    await Promise.resolve()
  }
}

// ---------------------------------------------------------------------------
// Minimal EvenHubEvent constructors
// ---------------------------------------------------------------------------

export function clickEvent() {
  // eventType 0 (CLICK_EVENT) is omitted by protobuf → undefined on textEvent
  return { textEvent: {} }
}

export function scrollUpEvent() {
  return { textEvent: { eventType: 1 } }   // SCROLL_TOP_EVENT
}

export function scrollDownEvent() {
  return { textEvent: { eventType: 2 } }   // SCROLL_BOTTOM_EVENT
}

export function doubleTapEvent() {
  return { textEvent: { eventType: 3 } }   // DOUBLE_CLICK_EVENT
}
