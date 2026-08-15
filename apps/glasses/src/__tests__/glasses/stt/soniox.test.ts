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
async function connected(apiKey = 'soniox-test-key') {
  const provider = createSonioxProvider(apiKey);
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

    expect(ws.binaryFrames).toHaveLength(1);
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
  it('forwards raw S16LE bytes without converting them', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    const frame = loudFrame(4);
    provider.feedAudio(frame);

    const sent = new Uint8Array(ws.binaryFrames[0] as ArrayBuffer);
    expect(Array.from(sent)).toEqual(Array.from(frame));
  });

  it('accepts number[] frames from the JSON bridge', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    provider.feedAudio([0x40, 0x1f, 0x40, 0x1f]);

    expect(new Uint8Array(ws.binaryFrames[0] as ArrayBuffer)).toEqual(
      new Uint8Array([0x40, 0x1f, 0x40, 0x1f]),
    );
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

  it('stops listening and closes the socket on dispose', async () => {
    const { provider, ws } = await connected();
    provider.startListening(vi.fn(), vi.fn());

    provider.dispose();

    expect(provider.isListening()).toBe(false);
    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
  });
});
