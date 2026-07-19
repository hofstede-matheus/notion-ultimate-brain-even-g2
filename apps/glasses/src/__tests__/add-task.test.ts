/**
 * Tests 21–24: Add Task / Voice recording
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onEvenHubEvent } from '../glasses/runtime';
import { setBridge, state } from '../state';
import { clickEvent, doubleTapEvent, flushPromises, makeMockBridge, resetState } from './helpers';

vi.mock('../api', () => ({
  fetchTodayTasks: vi.fn().mockResolvedValue([]),
  fetchInboxTasks: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: '1', name: 'Buy milk' }),
  markTaskDone: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
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
}));

vi.mock('../cache', () => ({
  loadCachedList: vi.fn().mockResolvedValue(null),
  saveCachedList: vi.fn().mockResolvedValue(undefined),
  cacheKeyForScreen: (screen: string) => `notionultimatebrain:${screen}`,
}));

vi.mock('../stt', () => ({
  isListening: vi.fn().mockReturnValue(false),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  ensureRecognizer: vi.fn().mockResolvedValue(true),
  feedAudio: vi.fn(),
  preloadVoskModel: vi.fn(),
}));

import { createTask } from '../api';
import * as stt from '../stt';

/**
 * Invoke the captured Vosk onFinal callback, failing loudly if the recorder
 * flow never registered one (rather than papering over it with a non-null
 * assertion).
 */
function invokeFinal(
  fn: ((text: string) => Promise<void>) | undefined,
  text: string,
): Promise<void> {
  if (!fn) throw new Error('onFinal callback was not captured');
  return fn(text);
}

let mockBridge: ReturnType<typeof makeMockBridge>;

beforeEach(() => {
  mockBridge = makeMockBridge();
  setBridge(mockBridge as unknown as EvenAppBridge);
  resetState();
  state.screen = 'add-task';
  state.recording = 'idle';
  vi.mocked(stt.isListening).mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test 21 — tap starts recording
// ---------------------------------------------------------------------------

describe('tapping the add-task screen', () => {
  it('starts a recording session and activates the microphone', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true);

    onEvenHubEvent(clickEvent());
    await flushPromises();

    expect(state.recording).toBe('recording');
    // AudioInputSource.Glasses = 'glasses'
    expect(mockBridge.audioControl).toHaveBeenCalledWith(true, 'glasses');
  });

  it('ignores a second tap that lands before the recognizer resolves', async () => {
    let resolveReady: (ready: boolean) => void = () => {};
    vi.mocked(stt.ensureRecognizer).mockReturnValue(
      new Promise((resolve) => {
        resolveReady = resolve;
      }),
    );

    // Both taps fire synchronously, before ensureRecognizer's promise settles —
    // state.recording is still 'idle' for both.
    onEvenHubEvent(clickEvent());
    onEvenHubEvent(clickEvent());

    resolveReady(true);
    await flushPromises();

    expect(stt.ensureRecognizer).toHaveBeenCalledTimes(1);
    expect(mockBridge.audioControl).toHaveBeenCalledTimes(1);
    expect(state.recording).toBe('recording');
  });
});

// ---------------------------------------------------------------------------
// Test 22 — tap while recording stops early
// ---------------------------------------------------------------------------

describe('tapping while a recording is already active', () => {
  it('triggers a manual stop', () => {
    state.recording = 'recording';
    vi.mocked(stt.isListening).mockReturnValue(true);

    onEvenHubEvent(clickEvent());

    expect(stt.stopListening).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 23 — blank / silent transcription
// ---------------------------------------------------------------------------

describe('blank transcription from the voice model', () => {
  it('produces an error prompt and never creates a task', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true);

    // Capture the onFinal callback that events.ts registers with startListening
    let capturedOnFinal: ((text: string) => Promise<void>) | undefined;
    vi.mocked(stt.startListening).mockImplementation((onFinal) => {
      capturedOnFinal = onFinal as (text: string) => Promise<void>;
    });

    onEvenHubEvent(clickEvent());
    await flushPromises(); // let recording start and startListening be called

    expect(capturedOnFinal).toBeDefined();

    // Simulate Vosk returning an empty transcription
    await invokeFinal(capturedOnFinal, '');

    expect(state.recording).toBe('error');
    expect(createTask).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 25 — non-blank transcription goes to a confirm step, not auto-create
// ---------------------------------------------------------------------------

describe('non-blank transcription from the voice model', () => {
  it('shows a confirm prompt instead of creating the task immediately', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true);

    let capturedOnFinal: ((text: string) => Promise<void>) | undefined;
    vi.mocked(stt.startListening).mockImplementation((onFinal) => {
      capturedOnFinal = onFinal as (text: string) => Promise<void>;
    });

    onEvenHubEvent(clickEvent());
    await flushPromises();

    await invokeFinal(capturedOnFinal, 'Buy milk');

    expect(state.recording).toBe('confirm');
    expect(state.pendingTranscript).toBe('Buy milk');
    expect(createTask).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 26 — confirming the transcript creates the task
// ---------------------------------------------------------------------------

describe('tapping to confirm a pending transcript', () => {
  it('creates the task, shows done, and clears the pending transcript', async () => {
    state.recording = 'confirm';
    state.pendingTranscript = 'Buy milk';

    onEvenHubEvent(clickEvent());
    await flushPromises();

    expect(createTask).toHaveBeenCalledWith('Buy milk');
    expect(state.recording).toBe('done');
    expect(state.createdTaskName).toBe('Buy milk');
    expect(state.pendingTranscript).toBe('');
  });

  it('surfaces creation errors and clears the pending transcript', async () => {
    vi.mocked(createTask).mockRejectedValueOnce(new Error('Network error'));
    state.recording = 'confirm';
    state.pendingTranscript = 'Buy milk';

    onEvenHubEvent(clickEvent());
    await flushPromises();

    expect(state.recording).toBe('error');
    expect(state.errorMessage).toBe('Network error');
    expect(state.pendingTranscript).toBe('');
  });

  it('only creates one task on a rapid double confirm tap', async () => {
    let resolveCreate: (result: { id: string; name: string }) => void = () => {};
    vi.mocked(createTask).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    state.recording = 'confirm';
    state.pendingTranscript = 'Buy milk';

    // Both taps fire synchronously, before createTask's promise settles —
    // state.recording is still 'confirm' for both.
    onEvenHubEvent(clickEvent());
    onEvenHubEvent(clickEvent());

    resolveCreate({ id: '1', name: 'Buy milk' });
    await flushPromises();

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(state.recording).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Test 27 — double-tapping a pending transcript discards it
// ---------------------------------------------------------------------------

describe('double-tapping a pending transcript', () => {
  it('discards the transcript and returns to idle, not the tasks menu', () => {
    state.recording = 'confirm';
    state.pendingTranscript = 'Buy milk';

    onEvenHubEvent(doubleTapEvent());

    expect(state.recording).toBe('idle');
    expect(state.pendingTranscript).toBe('');
    expect(state.screen).toBe('add-task');
    expect(createTask).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 28 — a stale transcription result after cancelling must not resurrect
// the confirm screen once the user has already left Add Task
// ---------------------------------------------------------------------------

describe('a transcription that resolves after the user already cancelled', () => {
  it('does not flip state back to confirm once the recording session is stale', async () => {
    vi.mocked(stt.ensureRecognizer).mockResolvedValue(true);
    vi.mocked(stt.isListening).mockReturnValue(true);

    let capturedOnFinal: ((text: string) => Promise<void>) | undefined;
    vi.mocked(stt.startListening).mockImplementation((onFinal) => {
      capturedOnFinal = onFinal as (text: string) => Promise<void>;
    });

    onEvenHubEvent(clickEvent());
    await flushPromises();
    expect(capturedOnFinal).toBeDefined();

    // User double-taps out to the Tasks menu while still 'recording' —
    // this invalidates the in-flight session.
    onEvenHubEvent(doubleTapEvent());
    expect(state.screen).toBe('tasks-menu');

    // The stale Vosk result arrives after the user has already left.
    await invokeFinal(capturedOnFinal, 'Buy milk');

    expect(state.recording).not.toBe('confirm');
    expect(state.pendingTranscript).toBe('');
    expect(state.screen).toBe('tasks-menu');
    expect(createTask).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 24 — double-tap stops mic before going back
// ---------------------------------------------------------------------------

describe('double-tapping the add-task screen while recording', () => {
  it('stops the microphone before returning to the menu', () => {
    state.recording = 'recording';
    vi.mocked(stt.isListening).mockReturnValue(true);

    onEvenHubEvent(doubleTapEvent());

    expect(stt.stopListening).toHaveBeenCalled();
    // showMenu fires after stopListening; screen will be menu once its promise settles
  });
});
