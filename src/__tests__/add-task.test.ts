/**
 * Tests 21–24: Add Task / Voice recording
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state, setBridge } from '../state'
import { onEvenHubEvent } from '../glasses/runtime'
import { makeMockBridge, resetState, flushPromises, clickEvent, doubleTapEvent } from './helpers'

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Buy milk' }),
}))

vi.mock('../cache', () => ({
  loadCachedTasks: vi.fn().mockResolvedValue(null),
  saveCachedTasks: vi.fn().mockResolvedValue(undefined),
  CACHE_KEY_TODAY: 'notionultimatebrain:today',
  CACHE_KEY_INBOX: 'notionultimatebrain:inbox',
}))

vi.mock('../stt', () => ({
  isListening: vi.fn().mockReturnValue(false),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  ensureRecognizer: vi.fn().mockResolvedValue(true),
  feedAudio: vi.fn(),
  preloadVoskModel: vi.fn(),
}))

import * as stt from '../stt'
import { createTask } from '../api'

let mockBridge: ReturnType<typeof makeMockBridge>

beforeEach(() => {
  mockBridge = makeMockBridge()
  setBridge(mockBridge as any)
  resetState()
  state.screen = 'add-task'
  state.recording = 'idle'
  vi.mocked(stt.isListening).mockReturnValue(false)
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Test 21 — tap starts recording
// ---------------------------------------------------------------------------

describe('tapping the add-task screen', () => {
  it('starts a recording session and activates the microphone', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true)

    onEvenHubEvent(clickEvent())
    await flushPromises()

    expect(state.recording).toBe('recording')
    // AudioInputSource.Glasses = 'glasses'
    expect(mockBridge.audioControl).toHaveBeenCalledWith(true, 'glasses')
  })
})

// ---------------------------------------------------------------------------
// Test 22 — tap while recording stops early
// ---------------------------------------------------------------------------

describe('tapping while a recording is already active', () => {
  it('triggers a manual stop', () => {
    state.recording = 'recording'
    vi.mocked(stt.isListening).mockReturnValue(true)

    onEvenHubEvent(clickEvent())

    expect(stt.stopListening).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 23 — blank / silent transcription
// ---------------------------------------------------------------------------

describe('blank transcription from the voice model', () => {
  it('produces an error prompt and never creates a task', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true)

    // Capture the onFinal callback that events.ts registers with startListening
    let capturedOnFinal: ((text: string) => Promise<void>) | undefined
    vi.mocked(stt.startListening).mockImplementation((onFinal) => {
      capturedOnFinal = onFinal as (text: string) => Promise<void>
    })

    onEvenHubEvent(clickEvent())
    await flushPromises() // let recording start and startListening be called

    expect(capturedOnFinal).toBeDefined()

    // Simulate Vosk returning an empty transcription
    await capturedOnFinal!('')

    expect(state.recording).toBe('error')
    expect(createTask).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 24 — double-tap stops mic before going back
// ---------------------------------------------------------------------------

describe('double-tapping the add-task screen while recording', () => {
  it('stops the microphone before returning to the menu', () => {
    state.recording = 'recording'
    vi.mocked(stt.isListening).mockReturnValue(true)

    onEvenHubEvent(doubleTapEvent())

    expect(stt.stopListening).toHaveBeenCalled()
    // showMenu fires after stopListening; screen will be menu once its promise settles
  })
})
