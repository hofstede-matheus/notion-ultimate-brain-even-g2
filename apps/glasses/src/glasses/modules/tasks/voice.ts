import { AudioInputSource } from '@evenrealities/even_hub_sdk';
import { createTask } from '../../../api';
import { trace } from '../../../logging/trace';
import { getBridge, state } from '../../../state';
import * as stt from '../../../stt';
import { renderUpdate } from '../../render';
import { navigate, startSpinner, stopSpinner } from '../_shared/navigation';

// ---------------------------------------------------------------------------
// Add Task (Voice) — start/stop recording, transcribe, create the task
// ---------------------------------------------------------------------------

let startingRecognizer = false;

// Invalidates stale onFinal/onStop callbacks from a session the user has
// already cancelled — without this, an in-flight Vosk transcription that
// finishes after the user backs out (e.g. double-tap to tasks-menu while
// 'recording'/'processing') would still mutate state in the background.
let recordingSession = 0;

const SONIOX_INVALID_KEY_MSG = 'Soniox rejected the API key. Check Settings.';
const VOICE_UNAVAILABLE_MSG = 'Voice input unavailable. Check Settings, then try again.';
const NOTHING_HEARD_MSG = "Couldn't hear anything. Tap to try again.";

function backendUnavailableMessage(): string {
  return stt.takeFailure() === 'invalid-key' ? SONIOX_INVALID_KEY_MSG : VOICE_UNAVAILABLE_MSG;
}

function emptyTranscriptMessage(): string {
  return stt.takeFailure() === 'invalid-key' ? SONIOX_INVALID_KEY_MSG : NOTHING_HEARD_MSG;
}

export async function startRecording(): Promise<void> {
  const b = getBridge();
  if (!b) return;

  if (state.recording === 'idle' || state.recording === 'done' || state.recording === 'error') {
    // No backend configured at all — the screen already explains what to fix on
    // the phone, so there is nothing to start here.
    if (state.voice !== 'ready') return;
    // state.recording doesn't flip to 'recording' until after the await
    // below resolves, so a second tap landing in that window would
    // otherwise re-enter this branch and double-issue audioControl/startListening.
    if (startingRecognizer) return;
    startingRecognizer = true;
    // Load the model / open the cloud socket before turning the mic on.
    const ready = await stt.ensureReady();
    startingRecognizer = false;
    if (!ready) {
      trace.warn('VOICE', 'speech backend not ready');
      state.recording = 'error';
      state.errorMessage = backendUnavailableMessage();
      void renderUpdate('add-task');
      return;
    }

    const mySession = ++recordingSession;

    // Start recording
    trace.info('VOICE', 'recording start');
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
          trace.warn('VOICE', 'no speech detected');
          state.recording = 'error';
          state.errorMessage = emptyTranscriptMessage();
          void renderUpdate('add-task');
          return;
        }
        trace.info('VOICE', 'transcript received', { len: text.trim().length });
        state.pendingTranscript = text.trim();
        state.recording = 'confirm';
        void renderUpdate('add-task');
      },
      // onStop: VAD detected silence OR user tapped to stop early.
      // Called synchronously — close the mic and show "processing".
      () => {
        trace.info('VOICE', 'recording stop');
        void b.audioControl(false);
        if (mySession !== recordingSession) return;
        state.recording = 'processing';
        void renderUpdate('add-task');
      },
    );

    // The backend can drop out between ensureReady() and here — a Soniox key
    // that connects but is then rejected is the realistic case. Without this
    // the mic would sit open on a "RECORDING" screen that nothing is listening
    // to, and no transcript would ever arrive to move it off.
    if (!stt.isListening()) {
      trace.warn('VOICE', 'backend dropped out before the session started');
      await b.audioControl(false);
      state.recording = 'error';
      state.errorMessage = backendUnavailableMessage();
      void renderUpdate('add-task');
    }
    return;
  }

  if (state.recording === 'recording') {
    // User tapped while recording — manual stop (same path as VAD auto-stop)
    trace.info('VOICE', 'manual stop');
    stt.stopListening();
  }
}

export async function confirmAddTask(): Promise<void> {
  const transcript = state.pendingTranscript;
  if (!transcript) return;
  trace.info('VOICE', 'confirming task creation');
  state.recording = 'confirming';
  void renderUpdate('add-task');
  const spinner = startSpinner(() => void renderUpdate('add-task'));
  try {
    const result = await createTask(transcript);
    trace.info('VOICE', 'task created', { id: result.id, name: result.name });
    state.createdTaskName = result.name;
    state.pendingTranscript = '';
    state.recording = 'done';
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    trace.error('VOICE', `task creation failed: ${msg}`);
    state.pendingTranscript = '';
    state.errorMessage = msg;
    state.recording = 'error';
  } finally {
    stopSpinner(spinner);
  }
  void renderUpdate('add-task');
}

export function discardAddTask(): void {
  trace.info('VOICE', 'transcript discarded');
  state.pendingTranscript = '';
  state.recording = 'idle';
  void renderUpdate('add-task');
}

/**
 * Called when the speech backend is replaced from Settings while Add Task may
 * still be mid-capture. Drops recording/processing back to idle without
 * touching a captured transcript (confirm and later states are left alone).
 */
export function abandonInFlightRecording(): void {
  if (state.recording !== 'recording' && state.recording !== 'processing') return;
  trace.info('VOICE', 'in-flight recording abandoned — backend replaced');
  recordingSession++;
  state.recording = 'idle';
  if (state.screen === 'add-task') void renderUpdate('add-task');
}

export function cancelRecordingAndGoBack(): void {
  const b = getBridge();
  if (stt.isListening()) {
    stt.stopListening(); // fires onStop synchronously under the CURRENT session — must run first
  }
  if (b) void b.audioControl(false);
  recordingSession++; // invalidate — only affects the later async onFinal
  navigate('tasks-menu');
}
