/**
 * The narrow contract every speech backend implements.
 *
 * Deliberately smaller than the STTProvider interface in even-g2-context's
 * toolkit — no batch mode, diarization, or partial-result plumbing, because
 * glasses/modules/tasks/voice.ts consumes exactly one transcript per recording
 * and nothing else.
 */
export interface SttProvider {
  /**
   * Load the model / open the connection. Resolves false when the backend
   * can't be made ready (model missing, key rejected, network down) — the
   * caller shows an error rather than starting the mic.
   */
  ensureReady(): Promise<boolean>;

  /**
   * Begin a recording session.
   *
   * `onFinal` receives the transcript; an empty string means nothing was
   * heard. `onStop` fires synchronously the moment capture ends (silence
   * detected, manual stop, or hard cap) so the caller can close the mic and
   * move the UI to "processing" before the transcript arrives.
   */
  startListening(onFinal: (text: string) => void, onStop?: () => void): void;

  /** Feed one raw PCM frame from the glasses (S16LE, 16 kHz, mono). */
  feedAudio(pcm: Uint8Array | number[]): void;

  /** End the session early; delivers through `onFinal` as usual. */
  stopListening(): void;

  isListening(): boolean;

  /** Release resources — called when the user switches backends. */
  dispose(): void;
}
