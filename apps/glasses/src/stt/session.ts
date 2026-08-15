/**
 * The recording session shared by every speech backend: amplitude VAD,
 * auto-stop timers, and the safety net for a backend that never answers.
 *
 * Extracted from the original Vosk-only stt.ts unchanged — same thresholds,
 * same ordering — so both providers behave identically from the user's side.
 * Only the "produce a transcript" step differs between them, which is what the
 * `flush` callback covers.
 */

/** Sample rate of the glasses microphone stream. */
export const SAMPLE_RATE = 16000;

const SPEECH_AMPLITUDE = 0.012; // mean abs amplitude threshold to count as "speech"
const SILENCE_MS = 1200; // silence after speech triggers auto-stop
const MIN_LISTEN_MS = 500; // don't auto-stop before this many ms
const MAX_LISTEN_MS = 15000; // hard cap regardless of VAD
const ENDPOINT_POLL_MS = 150; // how often VAD is evaluated
const RESULT_TIMEOUT_MS = 3000; // safety timeout if the backend never delivers

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a frame to bytes. The SDK types audioPcm as Uint8Array, but JSON
 * bridging can deliver number[].
 */
export function toBytes(pcm: Uint8Array | number[]): Uint8Array {
  return pcm instanceof Uint8Array ? pcm : Uint8Array.from(pcm, (n) => n & 0xff);
}

/** Convert raw bytes from the glasses (S16LE) to Float32 [-1, 1]. */
export function pcm16ToFloat32(pcm: Uint8Array | number[]): Float32Array {
  const bytes = toBytes(pcm);
  const samples = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(samples);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < samples; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

/** Mean absolute amplitude (0–1) — naive speech/silence detector. */
export function meanAbsAmplitude(f32: Float32Array): number {
  if (f32.length === 0) return 0;
  let sum = 0;
  for (const sample of f32) sum += Math.abs(sample);
  return sum / f32.length;
}

/**
 * Same measure straight off the S16LE bytes, without allocating a Float32Array.
 * The cloud provider streams the raw bytes on, so converting purely to measure
 * loudness would be waste on every frame.
 */
export function meanAbsAmplitudePcm16(bytes: Uint8Array): number {
  const samples = Math.floor(bytes.byteLength / 2);
  if (samples === 0) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += Math.abs(view.getInt16(i * 2, true)) / 32768;
  }
  return sum / samples;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface ListenSession {
  start(onFinal: (text: string) => void, onStop?: () => void): void;
  /** Update the VAD with one frame. No-op unless a session is active. */
  observe(bytes: Uint8Array): void;
  /** End capture and ask the backend to flush (VAD, manual stop, or cap). */
  stop(): void;
  /**
   * Hand over the transcript. Ends capture first if the backend produced a
   * result on its own before our VAD fired, so `onStop` always precedes
   * `onFinal`.
   */
  deliver(text: string): void;
  isListening(): boolean;
  /** Drop the session without delivering — used when the backend dies. */
  abort(): void;
}

export function createListenSession(flush: () => void): ListenSession {
  let listening = false;
  let heardSpeech = false;
  let lastVoiceAt = 0;
  let startedAt = 0;
  let onFinal: ((text: string) => void) | null = null;
  let onStop: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let resultTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSessionTimers(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
  }

  function clearResultTimer(): void {
    if (resultTimer) {
      clearTimeout(resultTimer);
      resultTimer = null;
    }
  }

  /**
   * Stop capturing and notify the caller to close the mic + show "processing".
   * Idempotent via the `listening` guard, so it runs at most once per session
   * regardless of what ends it.
   */
  function endCapture(): void {
    if (!listening) return;
    listening = false;
    clearSessionTimers();
    onStop?.();
    onStop = null;
  }

  return {
    start(final, stop) {
      if (listening) return;
      onFinal = final;
      onStop = stop ?? null;
      listening = true;
      heardSpeech = false;
      startedAt = Date.now();
      lastVoiceAt = startedAt;

      pollTimer = setInterval(() => {
        if (!listening) return;
        const now = Date.now();
        if (now - startedAt > MIN_LISTEN_MS && heardSpeech && now - lastVoiceAt > SILENCE_MS) {
          this.stop();
        }
      }, ENDPOINT_POLL_MS);

      maxTimer = setTimeout(() => this.stop(), MAX_LISTEN_MS);
    },

    observe(bytes) {
      if (!listening) return;
      if (meanAbsAmplitudePcm16(bytes) >= SPEECH_AMPLITUDE) {
        heardSpeech = true;
        lastVoiceAt = Date.now();
      }
    },

    stop() {
      if (!listening) return;
      endCapture();
      flush();

      // If the backend never answers, deliver an empty transcript so the UI
      // doesn't sit on "processing" forever.
      const saved = onFinal;
      resultTimer = setTimeout(() => {
        resultTimer = null;
        onFinal = null;
        saved?.('');
      }, RESULT_TIMEOUT_MS);
    },

    deliver(text) {
      // Reaching here while still listening means the backend detected the end
      // of speech before our VAD did. End capture first so onStop (mic off ->
      // "processing") runs before the transcript lands; otherwise a later
      // stop() would flip the UI back to "processing" with nothing left to
      // move it off. endCapture is idempotent, so the normal path skips this.
      if (listening) endCapture();
      clearResultTimer();
      const cb = onFinal;
      onFinal = null;
      cb?.(text);
    },

    isListening() {
      return listening;
    },

    abort() {
      listening = false;
      clearSessionTimers();
      clearResultTimer();
      onFinal = null;
      onStop = null;
    },
  };
}
