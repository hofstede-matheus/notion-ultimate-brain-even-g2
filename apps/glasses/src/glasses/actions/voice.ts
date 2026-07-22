import { AudioInputSource } from '@evenrealities/even_hub_sdk';
import { createTask } from '../../api';
import { getBridge, state } from '../../state';
import * as stt from '../../stt';
import { VOSK_MODEL_URL } from '../constants';
import { renderUpdate } from '../render';
import { navigate } from './navigation';

// ---------------------------------------------------------------------------
// Add Task (Voice) — start/stop recording, transcribe, create the task
// ---------------------------------------------------------------------------

let startingRecognizer = false;

// Invalidates stale onFinal/onStop callbacks from a session the user has
// already cancelled — without this, an in-flight Vosk transcription that
// finishes after the user backs out (e.g. double-tap to tasks-menu while
// 'recording'/'processing') would still mutate state in the background.
let recordingSession = 0;

export async function startRecording(): Promise<void> {
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

export async function confirmAddTask(): Promise<void> {
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

export function discardAddTask(): void {
  state.pendingTranscript = '';
  state.recording = 'idle';
  void renderUpdate('add-task');
}

export function cancelRecordingAndGoBack(): void {
  if (stt.isListening()) {
    stt.stopListening(); // fires onStop synchronously under the CURRENT session — must run first
  }
  recordingSession++; // invalidate — only affects the later async onFinal
  navigate('tasks-menu');
}
