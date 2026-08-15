/**
 * On-device speech recognition via vosk-browser (Kaldi WASM).
 *
 * No grammar = open-domain recognition (any words). No API key, no network,
 * no backend — the audio never leaves the phone.
 *
 * The model itself is no longer bundled: ../voice-model.ts downloads it and
 * hands this provider a blob: URL for the archive.
 */

import { createModel, type KaldiRecognizer, type Model } from 'vosk-browser';
import { trace } from '../logging/trace';
import { createListenSession, pcm16ToFloat32, SAMPLE_RATE, toBytes } from './session';
import type { SttProvider } from './types';

/**
 * The narrow slice of vosk-browser's `result` worker event that this code (and
 * its tests) read. The real event (ServerMessageResult) carries more, but
 * vosk-browser doesn't re-export its type from the package root, so tests use
 * this to build a faithful-enough fake — note the `event` discriminant, which
 * the recognizer handler switches on.
 */
export interface VoskResultMessage {
  event: 'result';
  result: { text: string };
}

export function createVoskProvider(modelUrl: string): SttProvider {
  let modelPromise: Promise<Model | null> | null = null;
  let rec: KaldiRecognizer | null = null;

  const session = createListenSession(() => {
    // Ask Vosk to flush; the 'result' event fires asynchronously via the Worker.
    rec?.retrieveFinalResult();
  });

  function loadModel(): Promise<Model | null> {
    if (modelPromise) return modelPromise;
    trace.info('VOICE', 'vosk model load start');
    modelPromise = createModel(modelUrl)
      .then((model) => {
        trace.info('VOICE', 'vosk model ready');
        return model;
      })
      .catch((e) => {
        modelPromise = null; // allow a retry later
        trace.warn('VOICE', `vosk model failed to load: ${describe(e)}`);
        return null;
      });
    return modelPromise;
  }

  return {
    async ensureReady() {
      if (rec) return true;
      try {
        const model = await loadModel();
        if (!model) return false;

        // No grammar -> open-domain (any words).
        rec = new model.KaldiRecognizer(SAMPLE_RATE);

        // msg is contextually typed as vosk-browser's RecognizerMessage union.
        rec.on('result', (msg) => {
          const text = (msg.event === 'result' ? msg.result.text : '').trim();
          session.deliver(text);
        });

        return true;
      } catch (e) {
        trace.error('VOICE', `vosk recognizer init failed: ${describe(e)}`);
        return false;
      }
    },

    startListening(onFinal, onStop) {
      if (!rec) return;
      session.start(onFinal, onStop);
    },

    feedAudio(pcm) {
      if (!session.isListening() || !rec) return;
      const bytes = toBytes(pcm);
      session.observe(bytes);
      rec.acceptWaveformFloat(pcm16ToFloat32(bytes), SAMPLE_RATE);
    },

    stopListening() {
      session.stop();
    },

    isListening() {
      return session.isListening();
    },

    dispose() {
      session.abort();
      try {
        rec?.remove();
      } catch {
        // The worker may already be gone; nothing useful to do.
      }
      rec = null;
      modelPromise = null;
    },
  };
}

function describe(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
