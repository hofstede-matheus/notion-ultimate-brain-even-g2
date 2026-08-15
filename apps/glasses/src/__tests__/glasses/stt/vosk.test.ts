/**
 * Tests for the on-device STT provider (src/stt/vosk.ts).
 *
 * Focus: the ordering between onStop (mic off → "processing") and onFinal
 * (transcript → "confirm"). vosk-browser's worker can emit a `result` event
 * autonomously when Kaldi detects an utterance endpoint — BEFORE our VAD /
 * manual stop runs. If that result doesn't end the capture first, a later
 * stop() flips the UI back to "processing" with no transcript left to move it
 * off, leaving Add Task stuck. See `deliver()` in stt/session.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SttProvider } from '../../../stt/types';
import type { VoskResultMessage } from '../../../stt/vosk';

// Shared handles into the fake recognizer. vi.hoisted keeps them accessible
// from the (hoisted) vi.mock factory without a temporal-dead-zone error.
const h = vi.hoisted(() => ({
  resultListener: null as ((msg: VoskResultMessage) => void) | null,
  retrieveFinalResultCalls: 0,
  createModelShouldReject: false,
}));

vi.mock('vosk-browser', () => ({
  createModel: async () => {
    if (h.createModelShouldReject) throw new Error('network down');
    return {
      KaldiRecognizer: class {
        on(event: string, listener: (msg: VoskResultMessage) => void): void {
          if (event === 'result') h.resultListener = listener;
        }
        acceptWaveformFloat(): void {}
        retrieveFinalResult(): void {
          h.retrieveFinalResultCalls++;
        }
        remove(): void {}
      },
    };
  },
}));

beforeEach(() => {
  h.resultListener = null;
  h.retrieveFinalResultCalls = 0;
  h.createModelShouldReject = false;
});

/** A provider with its model already loaded and its result listener wired. */
async function readyProvider(): Promise<SttProvider> {
  const { createVoskProvider } = await import('../../../stt/vosk');
  const provider = createVoskProvider('blob:fake-model');
  expect(await provider.ensureReady()).toBe(true);
  expect(h.resultListener).not.toBeNull();
  return provider;
}

/** Simulate the Vosk worker emitting a `result` event with the given text. */
function fireResult(text: string): void {
  if (!h.resultListener) throw new Error('result listener was not registered');
  h.resultListener({ event: 'result', result: { text } });
}

describe('vosk provider — autonomous result (the stuck-on-processing bug)', () => {
  it('ends capture (onStop) BEFORE delivering onFinal, and never re-stops', async () => {
    const provider = await readyProvider();
    const calls: string[] = [];
    const onFinal = vi.fn((t: string) => calls.push(`final:${t}`));
    const onStop = vi.fn(() => calls.push('stop'));

    provider.startListening(onFinal, onStop);
    expect(provider.isListening()).toBe(true);

    // Vosk endpoints on its own while the mic is still open.
    fireResult('buy milk');

    // onStop must run before onFinal so the UI ends on 'confirm', not 'processing'.
    expect(calls).toEqual(['stop', 'final:buy milk']);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(provider.isListening()).toBe(false);

    // A later VAD/manual stop must NOT fire onStop again (that was the bug:
    // a second onStop flipping 'confirm' back to a stuck 'processing').
    provider.stopListening();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(h.retrieveFinalResultCalls).toBe(0); // autonomous result is authoritative
  });
});

describe('vosk provider — normal stop path', () => {
  it('manual stop fires onStop, then the forced final result delivers onFinal', async () => {
    const provider = await readyProvider();
    const calls: string[] = [];
    const onFinal = vi.fn((t: string) => calls.push(`final:${t}`));
    const onStop = vi.fn(() => calls.push('stop'));

    provider.startListening(onFinal, onStop);
    provider.stopListening(); // endCapture (onStop) → retrieveFinalResult

    expect(calls).toEqual(['stop']);
    expect(h.retrieveFinalResultCalls).toBe(1);
    expect(provider.isListening()).toBe(false);

    // Worker responds to the forced flush.
    fireResult('buy milk');
    expect(calls).toEqual(['stop', 'final:buy milk']);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
  });
});

describe('vosk provider — result-timeout safety net', () => {
  it('delivers an empty transcript if Vosk never responds to the flush', async () => {
    const provider = await readyProvider();
    vi.useFakeTimers();
    try {
      const onFinal = vi.fn();
      const onStop = vi.fn();

      provider.startListening(onFinal, onStop);
      provider.stopListening(); // arms the RESULT_TIMEOUT_MS safety net
      expect(onFinal).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000); // RESULT_TIMEOUT_MS
      expect(onFinal).toHaveBeenCalledWith('');
      expect(onFinal).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('vosk provider — dispose', () => {
  it('ends capture on dispose while listening', async () => {
    const provider = await readyProvider();
    const onStop = vi.fn();
    provider.startListening(vi.fn(), onStop);

    provider.dispose();

    expect(provider.isListening()).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe('vosk provider — model failures', () => {
  it('reports not-ready when the model cannot be loaded', async () => {
    h.createModelShouldReject = true;
    const { createVoskProvider } = await import('../../../stt/vosk');
    const provider = createVoskProvider('blob:fake-model');

    expect(await provider.ensureReady()).toBe(false);
    // A failed load must not leave a half-built session behind.
    expect(provider.isListening()).toBe(false);
  });

  it('retries the load on the next attempt rather than caching the failure', async () => {
    h.createModelShouldReject = true;
    const { createVoskProvider } = await import('../../../stt/vosk');
    const provider = createVoskProvider('blob:fake-model');
    expect(await provider.ensureReady()).toBe(false);

    h.createModelShouldReject = false;
    expect(await provider.ensureReady()).toBe(true);
  });

  it('ignores startListening until the model is ready', async () => {
    h.createModelShouldReject = true;
    const { createVoskProvider } = await import('../../../stt/vosk');
    const provider = createVoskProvider('blob:fake-model');
    await provider.ensureReady();

    provider.startListening(vi.fn(), vi.fn());
    expect(provider.isListening()).toBe(false);
  });
});
