/**
 * Tests for the offline STT session lifecycle (src/stt.ts).
 *
 * Focus: the ordering between onStop (mic off → "processing") and onFinal
 * (transcript → "confirm"). vosk-browser's worker can emit a `result` event
 * autonomously when Kaldi detects an utterance endpoint — BEFORE our VAD /
 * manual stop runs. If that result doesn't end the capture first, a later
 * finalize() flips the UI back to "processing" with no transcript left to move
 * it off, leaving Add Task stuck. See the fix in stt.ts's `on('result')`.
 */
import { describe, expect, it, vi } from 'vitest';
import type { VoskResultMessage } from '../../stt';

// Shared handles into the fake recognizer. vi.hoisted keeps them accessible
// from the (hoisted) vi.mock factory without a temporal-dead-zone error.
const h = vi.hoisted(() => ({
  resultListener: null as ((msg: VoskResultMessage) => void) | null,
  retrieveFinalResultCalls: 0,
}));

vi.mock('vosk-browser', () => ({
  createModel: async () => ({
    KaldiRecognizer: class {
      on(event: string, listener: (msg: VoskResultMessage) => void): void {
        if (event === 'result') h.resultListener = listener;
      }
      acceptWaveformFloat(): void {}
      retrieveFinalResult(): void {
        h.retrieveFinalResultCalls++;
      }
    },
  }),
}));

// stt.ts holds module-level singletons (rec, listening, session callbacks), so
// each test re-imports a fresh copy for a clean session.
async function freshStt() {
  vi.resetModules();
  h.resultListener = null;
  h.retrieveFinalResultCalls = 0;
  const stt = await import('../../stt');
  const ready = await stt.ensureRecognizer('/fake/model.tar.gz');
  expect(ready).toBe(true);
  expect(h.resultListener).not.toBeNull();
  return stt;
}

/** Simulate the Vosk worker emitting a `result` event with the given text. */
function fireResult(text: string): void {
  if (!h.resultListener) throw new Error('result listener was not registered');
  h.resultListener({ event: 'result', result: { text } });
}

describe('stt session — autonomous Vosk result (the stuck-on-processing bug)', () => {
  it('ends capture (onStop) BEFORE delivering onFinal, and never re-stops', async () => {
    const stt = await freshStt();
    const calls: string[] = [];
    const onFinal = vi.fn((t: string) => calls.push(`final:${t}`));
    const onStop = vi.fn(() => calls.push('stop'));

    stt.startListening(onFinal, onStop);
    expect(stt.isListening()).toBe(true);

    // Vosk endpoints on its own while the mic is still open.
    fireResult('buy milk');

    // onStop must run before onFinal so the UI ends on 'confirm', not 'processing'.
    expect(calls).toEqual(['stop', 'final:buy milk']);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(stt.isListening()).toBe(false);

    // A later VAD/manual stop must NOT fire onStop again (that was the bug:
    // a second onStop flipping 'confirm' back to a stuck 'processing').
    stt.stopListening();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(h.retrieveFinalResultCalls).toBe(0); // autonomous result is authoritative
  });
});

describe('stt session — normal stop path (unchanged)', () => {
  it('manual stop fires onStop, then the forced final result delivers onFinal', async () => {
    const stt = await freshStt();
    const calls: string[] = [];
    const onFinal = vi.fn((t: string) => calls.push(`final:${t}`));
    const onStop = vi.fn(() => calls.push('stop'));

    stt.startListening(onFinal, onStop);
    stt.stopListening(); // finalize → endCapture (onStop) → retrieveFinalResult

    expect(calls).toEqual(['stop']);
    expect(h.retrieveFinalResultCalls).toBe(1);
    expect(stt.isListening()).toBe(false);

    // Worker responds to the forced flush.
    fireResult('buy milk');
    expect(calls).toEqual(['stop', 'final:buy milk']);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
  });
});

describe('stt session — result-timeout safety net', () => {
  it('delivers an empty transcript if Vosk never responds to the flush', async () => {
    const stt = await freshStt();
    vi.useFakeTimers();
    try {
      const onFinal = vi.fn();
      const onStop = vi.fn();

      stt.startListening(onFinal, onStop);
      stt.stopListening(); // arms the RESULT_TIMEOUT_MS safety net
      expect(onFinal).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000); // RESULT_TIMEOUT_MS
      expect(onFinal).toHaveBeenCalledWith('');
      expect(onFinal).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
