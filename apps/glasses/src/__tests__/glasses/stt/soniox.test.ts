/**
 * Tests for the cloud STT provider (src/stt/soniox.ts).
 *
 * The protocol is: JSON config on open, binary audio frames, then
 * {"type":"finalize"} + an empty frame to close out, with the server answering
 * `finished: true`. Only `is_final` tokens count — non-final ones are
 * provisional and may be revised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SONIOX_MODEL } from '../../../glasses/constants';
import { createSonioxProvider } from '../../../stt/soniox';

interface SentFrame {
  kind: 'text' | 'binary';
  data: string | ArrayBuffer;
}

/** Minimal stand-in for the browser WebSocket, driven by the tests. */
class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static last: FakeWebSocket | null = null;

  readyState = 0;
  binaryType = '';
  sent: SentFrame[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.last = this;
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push({ kind: typeof data === 'string' ? 'text' : 'binary', data });
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // ── test drivers ──
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  get textFrames(): string[] {
    return this.sent.filter((f) => f.kind === 'text').map((f) => f.data as string);
  }

  get binaryFrames(): ArrayBuffer[] {
    return this.sent.filter((f) => f.kind === 'binary').map((f) => f.data as ArrayBuffer);
  }
}

beforeEach(() => {
  FakeWebSocket.last = null;
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Connect a provider and return it alongside its socket. */
async function connected(
  apiKey = 'soniox-test-key',
  options?: { languageHints?: string[]; languageHintsStrict?: boolean },
) {
  const provider = createSonioxProvider(apiKey, options);
  const ready = provider.ensureReady();
  const ws = FakeWebSocket.last;
  if (!ws) throw new Error('no socket was created');
  ws.open();
  expect(await ready).toBe(true);
  return { provider, ws };
}

/** One frame of S16LE audio, loud enough to register as speech. */
function loudFrame(samples = 160): Uint8Array {
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i++) view.setInt16(i * 2, 8000, true);
  return bytes;
}

describe('soniox provider — connection', () => {
  it('sends the config message on open, before any audio', async () => {
    const { ws } = await connected();

    expect(ws.url).toBe('wss://stt-rt.soniox.com/transcribe-websocket');
    const config = JSON.parse(ws.textFrames[0] ?? '{}');
    expect(config).toMatchObject({
      api_key: 'soniox-test-key',
      model: SONIOX_MODEL,
      audio_format: 'pcm_s16le',
      sample_rate: 16000,
      num_channels: 1,
    });
    // Endpoint detection stays off — the local VAD owns end-of-speech.
    expect(config.enable_endpoint_detection).toBeUndefined();
    expect(config.language_hints).toBeUndefined();
    expect(config.language_hints_strict).toBeUndefined();
  });

  it('sends language hints and strict when configured', async () => {
    const { ws } = await connected('soniox-test-key', {
      languageHints: ['en', 'nl'],
      languageHintsStrict: true,
    });
    const config = JSON.parse(ws.textFrames[0] ?? '{}');
    expect(config.language_hints).toEqual(['en', 'nl']);
    expect(config.language_hints_strict).toBe(true);
  });

  it('omits strict when hints are not restricted', async () => {
    const { ws } = await connected('soniox-test-key', { languageHints: ['en'] });
    const config = JSON.parse(ws.textFrames[0] ?? '{}');
    expect(config.language_hints).toEqual(['en']);
    expect(config.language_hints_strict).toBeUndefined();
  });

  it('uses the current real-time model, not the retired v4 alias', async () => {
    const { ws } = await connected();
    const config = JSON.parse(ws.textFrames[0] ?? '{}');
    expect(config.model).toBe('stt-rt-v5');
  });

  it('connects before the mic opens, so no audio is dropped at the start', async () => {
    // ensureReady resolving means the socket is already OPEN and configured;
    // the first frame the caller sends afterwards therefore reaches the wire.
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());
    provider.feedAudio(loudFrame());
    provider.stopListening(); // flushes whatever is buffered

    expect(ws.binaryFrames.length).toBeGreaterThan(0);
  });

  it('opens a fresh socket per recording, since end-of-audio is terminal', async () => {
    // The server closes after `finished`, and an empty frame ends the stream
    // for good. Reusing the socket made the second recording stream audio into
    // a spent session and transcribe nothing.
    const { provider, ws: first } = await connected();
    provider.startListening(vi.fn(), vi.fn());
    provider.feedAudio(loudFrame());
    provider.stopListening();

    const ready = provider.ensureReady();
    const second = FakeWebSocket.last;
    expect(second).not.toBe(first);
    second?.open();
    expect(await ready).toBe(true);
  });

  it('reuses a socket that has not carried audio yet', async () => {
    // Connecting twice without recording in between shouldn't churn sockets.
    const { provider, ws } = await connected();
    expect(await provider.ensureReady()).toBe(true);
    expect(FakeWebSocket.last).toBe(ws);
  });

  it('resolves false when the socket never opens', async () => {
    vi.useFakeTimers();
    try {
      const provider = createSonioxProvider('key');
      const ready = provider.ensureReady();
      await vi.advanceTimersByTimeAsync(8000); // SONIOX_CONNECT_TIMEOUT_MS
      expect(await ready).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('soniox provider — audio', () => {
  /** Concatenation of every binary frame the socket received. */
  function allBytes(ws: FakeWebSocket): number[] {
    return ws.binaryFrames.flatMap((b) => Array.from(new Uint8Array(b)));
  }

  it('forwards raw S16LE bytes without converting them', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    const frame = loudFrame(4);
    provider.feedAudio(frame);
    provider.stopListening();

    // The trailing empty frame is the end-of-audio marker, not audio.
    expect(allBytes(ws)).toEqual(Array.from(frame));
  });

  it('accepts number[] frames from the JSON bridge', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    provider.feedAudio([0x40, 0x1f, 0x40, 0x1f]);
    provider.stopListening();

    expect(allBytes(ws)).toEqual([0x40, 0x1f, 0x40, 0x1f]);
  });

  it('batches 10 ms frames instead of one send each', async () => {
    // The glasses emit 320-byte frames every 10 ms. Sending each one straight
    // through is 100 WebSocket writes a second, well outside the pacing Soniox
    // documents, and got the stream dropped with a 408.
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    for (let i = 0; i < 10; i++) provider.feedAudio(loudFrame(160)); // 10 × 320 B

    expect(ws.binaryFrames).toHaveLength(1);
    expect(ws.binaryFrames[0]?.byteLength).toBe(3200); // 100 ms
  });

  it('still measures every frame for the VAD while batching the wire traffic', async () => {
    // Batching must not delay silence detection: onStop comes from the VAD,
    // which has to see each frame as it arrives.
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    provider.feedAudio(loudFrame(160)); // below the batch threshold
    expect(ws.binaryFrames).toHaveLength(0);
    expect(provider.isListening()).toBe(true);
  });

  it('flushes buffered audio before finalizing, so no tail is lost', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    provider.feedAudio(loudFrame(160)); // 320 B, well under the 3200 B batch
    provider.stopListening();

    const audio = ws.binaryFrames.filter((b) => b.byteLength > 0);
    expect(audio).toHaveLength(1);
    expect(audio[0]?.byteLength).toBe(320);
  });

  it('drops audio when no session is active', async () => {
    const { provider, ws } = await connected();
    provider.feedAudio(loudFrame());
    expect(ws.binaryFrames).toHaveLength(0);
  });
});

describe('soniox provider — transcripts', () => {
  it('keeps final tokens and discards provisional ones', async () => {
    const { provider, ws } = await connected();
    const onFinal = vi.fn();
    provider.startListening(onFinal, vi.fn());

    ws.receive({ tokens: [{ text: 'buy ', is_final: true }] });
    ws.receive({ tokens: [{ text: 'milkshake', is_final: false }] });
    ws.receive({ tokens: [{ text: 'milk', is_final: true }] });
    ws.receive({ tokens: [], finished: true });

    expect(onFinal).toHaveBeenCalledWith('buy milk');
  });

  it('filters bracketed control markers out of the transcript', async () => {
    const { provider, ws } = await connected();
    const onFinal = vi.fn();
    provider.startListening(onFinal, vi.fn());

    ws.receive({
      tokens: [
        { text: 'buy milk', is_final: true },
        { text: '<end>', is_final: true },
      ],
    });
    ws.receive({ tokens: [], finished: true });

    expect(onFinal).toHaveBeenCalledWith('buy milk');
  });

  it('ends capture before delivering, so onStop precedes onFinal', async () => {
    const { provider, ws } = await connected();
    const calls: string[] = [];
    provider.startListening(
      (t) => calls.push(`final:${t}`),
      () => calls.push('stop'),
    );

    ws.receive({ tokens: [{ text: 'buy milk', is_final: true }] });
    ws.receive({ tokens: [], finished: true });

    expect(calls).toEqual(['stop', 'final:buy milk']);
  });

  it('sends finalize plus an empty frame on manual stop', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());
    provider.stopListening();

    expect(JSON.parse(ws.textFrames[1] ?? '{}')).toEqual({ type: 'finalize' });
    const empty = ws.binaryFrames.at(-1);
    expect(empty?.byteLength).toBe(0);
  });

  it('terminates with an empty text frame as well as an empty binary one', async () => {
    // The docs describe the terminator as "an empty WebSocket frame (binary or
    // text)" in one place and the empty string in another. A zero-length binary
    // frame is the kind of thing a WebSocket stack quietly drops, and losing
    // the terminator means `finished` never arrives and the stream dies on a
    // 408 — so send both.
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());
    provider.stopListening();

    expect(ws.textFrames).toContain('');
    expect(ws.binaryFrames.some((b) => b.byteLength === 0)).toBe(true);
  });
});

describe('soniox provider — failures', () => {
  it('delivers an empty transcript when the key is rejected', async () => {
    const { provider, ws } = await connected();
    const onFinal = vi.fn();
    provider.startListening(onFinal, vi.fn());

    ws.receive({ error_code: 401, error_message: 'invalid api key' });

    expect(onFinal).toHaveBeenCalledWith('');
    expect(provider.isListening()).toBe(false);
  });

  it('does not strand the session when the socket closes mid-recording', async () => {
    const { provider, ws } = await connected();
    const onFinal = vi.fn();
    provider.startListening(onFinal, vi.fn());

    ws.onclose?.();

    expect(onFinal).toHaveBeenCalledWith('');
  });

  it('keeps the transcript when the server closes instead of sending finished', async () => {
    const { provider, ws } = await connected();
    const onFinal = vi.fn();
    provider.startListening(onFinal, vi.fn());

    ws.receive({ tokens: [{ text: 'buy milk', is_final: true }] });
    provider.stopListening();
    ws.onclose?.();

    // Waiting out the safety timeout with a finished transcript in hand would
    // read as a hang and then throw the words away.
    expect(onFinal).toHaveBeenCalledWith('buy milk');
  });

  it('keeps what was transcribed when the server never says finished', async () => {
    vi.useFakeTimers();
    try {
      const provider = createSonioxProvider('key');
      const ready = provider.ensureReady();
      const ws = FakeWebSocket.last;
      ws?.open();
      await ready;

      const onFinal = vi.fn();
      provider.startListening(onFinal, vi.fn());
      ws?.receive({ tokens: [{ text: 'buy milk', is_final: true }] });
      provider.stopListening();

      // No `finished` ever arrives — the failure mode that turned working
      // recognition into "couldn't hear anything".
      await vi.advanceTimersByTimeAsync(6000);
      expect(onFinal).toHaveBeenCalledWith('buy milk');
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows longer than the on-device backend for a cloud round trip', async () => {
    vi.useFakeTimers();
    try {
      const provider = createSonioxProvider('key');
      const ready = provider.ensureReady();
      FakeWebSocket.last?.open();
      await ready;

      const onFinal = vi.fn();
      provider.startListening(onFinal, vi.fn());
      provider.stopListening();

      // 3 s is the local recogniser's budget; finalising over mobile data is
      // not comparable, and cutting it off there is what produced a spurious
      // "couldn't hear anything".
      await vi.advanceTimersByTimeAsync(3500);
      expect(onFinal).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(7000);
      expect(onFinal).toHaveBeenCalledWith('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops listening and closes the socket on dispose', async () => {
    const { provider, ws } = await connected();
    const onStop = vi.fn();
    provider.startListening(vi.fn(), onStop);

    provider.dispose();

    expect(provider.isListening()).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
  });
});
