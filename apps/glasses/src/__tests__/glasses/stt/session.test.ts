/**
 * The recording session shared by both speech backends (src/stt/session.ts).
 *
 * This machinery used to live inside the Vosk-only stt.ts and was only ever
 * covered indirectly. It decides when the mic closes, so it is worth pinning
 * directly now that two providers depend on identical behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createListenSession, meanAbsAmplitudePcm16, pcm16ToFloat32 } from '../../../stt/session';

/** S16LE frame where every sample has the given amplitude. */
function frame(amplitude: number, samples = 160): Uint8Array {
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i++) view.setInt16(i * 2, amplitude, true);
  return bytes;
}

const SPEECH = frame(8000); // well above the 0.012 threshold
const SILENCE = frame(0);

describe('audio conversion', () => {
  it('decodes little-endian signed 16-bit samples to [-1, 1)', () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0]); // 16384, -16384
    expect(Array.from(pcm16ToFloat32(bytes))).toEqual([0.5, -0.5]);
  });

  it('accepts number[] frames from the JSON bridge', () => {
    expect(Array.from(pcm16ToFloat32([0x00, 0x40]))).toEqual([0.5]);
  });

  it('measures amplitude off the raw bytes without converting', () => {
    // Same measure the Float32 path would produce, so both providers agree.
    expect(meanAbsAmplitudePcm16(frame(16384, 4))).toBeCloseTo(0.5, 5);
    expect(meanAbsAmplitudePcm16(SILENCE)).toBe(0);
    expect(meanAbsAmplitudePcm16(new Uint8Array(0))).toBe(0);
  });
});

describe('session lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('auto-stops after silence follows speech', () => {
    const flush = vi.fn();
    const session = createListenSession(flush);
    const onStop = vi.fn();
    session.start(vi.fn(), onStop);

    session.observe(SPEECH);
    vi.advanceTimersByTime(600); // past MIN_LISTEN_MS, still speaking

    session.observe(SILENCE);
    vi.advanceTimersByTime(1400); // past SILENCE_MS of quiet

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(session.isListening()).toBe(false);
  });

  it('does not stop on silence alone when nothing was ever said', () => {
    const session = createListenSession(vi.fn());
    const onStop = vi.fn();
    session.start(vi.fn(), onStop);

    session.observe(SILENCE);
    vi.advanceTimersByTime(5000);

    expect(onStop).not.toHaveBeenCalled();
    expect(session.isListening()).toBe(true);
  });

  it('stops at the hard cap even while speech continues', () => {
    const session = createListenSession(vi.fn());
    const onStop = vi.fn();
    session.start(vi.fn(), onStop);

    for (let elapsed = 0; elapsed < 15000; elapsed += 500) {
      session.observe(SPEECH);
      vi.advanceTimersByTime(500);
    }

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(session.isListening()).toBe(false);
  });

  it('will not auto-stop before the minimum listen window', () => {
    const session = createListenSession(vi.fn());
    const onStop = vi.fn();
    session.start(vi.fn(), onStop);

    // Speech then immediate quiet, all inside MIN_LISTEN_MS.
    session.observe(SPEECH);
    vi.advanceTimersByTime(400);

    expect(onStop).not.toHaveBeenCalled();
  });

  it('delivers an empty transcript if the backend never answers the flush', () => {
    const session = createListenSession(vi.fn());
    const onFinal = vi.fn();
    session.start(onFinal, vi.fn());

    session.stop();
    expect(onFinal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000); // RESULT_TIMEOUT_MS
    expect(onFinal).toHaveBeenCalledWith('');
  });

  it('does not let a previous result timer destroy the next recording', () => {
    const session = createListenSession(vi.fn());
    const first = vi.fn();
    const second = vi.fn();

    session.start(first, vi.fn());
    session.stop(); // arms the safety net; no deliver()

    session.start(second, vi.fn());
    vi.advanceTimersByTime(3000); // past RESULT_TIMEOUT_MS

    expect(first).not.toHaveBeenCalled();
    session.deliver('buy milk');
    expect(second).toHaveBeenCalledWith('buy milk');
  });

  it('ignores frames once the session has ended', () => {
    const session = createListenSession(vi.fn());
    session.start(vi.fn(), vi.fn());
    session.stop();

    session.observe(SPEECH);
    expect(session.isListening()).toBe(false);
  });

  it('abort ends capture without delivering a transcript', () => {
    const session = createListenSession(vi.fn());
    const onFinal = vi.fn();
    const onStop = vi.fn();
    session.start(onFinal, onStop);

    session.abort();
    vi.advanceTimersByTime(20000);

    expect(session.isListening()).toBe(false);
    expect(onFinal).not.toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
