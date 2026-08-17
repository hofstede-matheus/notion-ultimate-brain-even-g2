/**
 * Cloud speech recognition via Soniox's real-time WebSocket API.
 *
 * Unlike the on-device provider, audio leaves the phone — that is stated
 * plainly at the point of choosing this mode in Settings, and in the privacy
 * page. The API key is the user's own; it is stored on the device and sent
 * only to Soniox, inside the encrypted socket.
 *
 * ## Why not @soniox/speech-to-text-web
 *
 * The official library consumes a MediaStream. Our audio arrives as raw PCM
 * frames from the glasses bridge, so using it would mean rebuilding a
 * MediaStream through an AudioContext/AudioWorklet just to have the library
 * take it apart again. Talking to the socket directly is ~150 lines and no new
 * dependency — and the glasses already produce exactly the format Soniox
 * wants (S16LE, 16 kHz, mono), so frames are forwarded without conversion.
 *
 * ## Two deliberate differences from the reference implementation in
 * even-g2-context/examples/even-toolkit/stt/providers/soniox.ts
 *
 * 1. The socket is opened during ensureReady(), before the mic is turned on.
 *    The reference drops frames while readyState !== OPEN, which clips the
 *    first word or two, since audio starts flowing the instant audioControl
 *    is enabled.
 * 2. Final tokens are accumulated here. The reference leaves that to its React
 *    hook; our caller expects one finished transcript.
 *
 * Endpoint detection is left off: the shared session's local VAD decides when
 * speech ends, so both providers stop at the same moment and the mic closes
 * without waiting for a round trip.
 */

import { SONIOX_CONNECT_TIMEOUT_MS, SONIOX_MODEL, SONIOX_WS_URL } from '../glasses/constants';
import { trace } from '../logging/trace';
import { createListenSession, SAMPLE_RATE, toBytes } from './session';
import type { SttFailure, SttProvider } from './types';

interface SonioxToken {
  text: string;
  is_final?: boolean;
}

interface SonioxMessage {
  tokens?: SonioxToken[];
  finished?: boolean;
  error_code?: number;
  error_message?: string;
}

/**
 * Soniox emits bracketed control markers (e.g. `<end>`) alongside real tokens.
 * They are not in the published API reference, so this is defensive rather
 * than contractual — carried over from the reference implementation.
 */
const CONTROL_TOKEN = /<[^>]+>/;

/**
 * How much audio to accumulate before putting it on the wire.
 *
 * The glasses deliver 10 ms frames (320 bytes at 16 kHz S16LE mono), which
 * would be 100 WebSocket sends per second. Soniox's own examples stream ~120 ms
 * per send and their docs warn that bursty or badly paced input can get the
 * stream dropped — 408 `request_timeout` covers exactly that. Batching to
 * ~100 ms brings us in line with their pacing at ~10 sends/s.
 *
 * The VAD still sees every frame; only the wire traffic is batched.
 */
const SEND_CHUNK_BYTES = (SAMPLE_RATE / 1000) * 2 * 100; // 100 ms

/**
 * A cloud round trip after `finalize` is far slower than Kaldi flushing
 * locally, so the shared 3 s safety net is too tight here. It is only a
 * backstop now: whatever was already transcribed is delivered when it fires,
 * rather than being discarded as "nothing heard".
 */
const CLOUD_RESULT_TIMEOUT_MS = 5000;

export interface SonioxOptions {
  languageHints?: string[];
  languageHintsStrict?: boolean;
}

/**
 * The opening message of every stream. `sample_rate` and `num_channels` are
 * required because the format is raw PCM. `language_hints` is omitted when
 * empty so the model auto-detects across its 60+ languages;
 * `enable_endpoint_detection` stays off because the local VAD decides when
 * speech ends.
 */
function configMessage(apiKey: string, options?: SonioxOptions): string {
  const hints = options?.languageHints?.filter(Boolean) ?? [];
  return JSON.stringify({
    api_key: apiKey,
    model: SONIOX_MODEL,
    audio_format: 'pcm_s16le',
    sample_rate: SAMPLE_RATE,
    num_channels: 1,
    ...(hints.length > 0
      ? {
          language_hints: hints,
          ...(options?.languageHintsStrict ? { language_hints_strict: true } : {}),
        }
      : {}),
  });
}

export type SonioxKeyCheck = 'valid' | 'invalid' | 'unreachable';

/** Classify a Soniox error frame — shared by the provider and testSonioxKey. */
function sonioxFailureFromError(
  data: Pick<SonioxMessage, 'error_code' | 'error_message'>,
): SttFailure | null {
  if (!data.error_code && !data.error_message) return null;
  if (data.error_code === 401) return 'invalid-key';
  return 'unavailable';
}

/**
 * Check an API key by running a complete miniature session: connect, send the
 * config, stream a moment of silence, then end the stream.
 *
 * Deliberately exercises the whole round trip rather than just the handshake.
 * A wrong key comes back as `401` within a fraction of a second; a key that is
 * accepted proves the config, the audio path and the end-of-stream signal all
 * work, which is precisely the sequence that is easy to get subtly wrong and
 * impossible to diagnose from the glasses.
 */
export function testSonioxKey(apiKey: string, timeoutMs = 8000): Promise<SonioxKeyCheck> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    let settled = false;

    const finish = (result: SonioxKeyCheck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Already gone.
      }
      trace.info('VOICE', `soniox key check: ${result}`);
      resolve(result);
    };

    const timer = setTimeout(() => finish('unreachable'), timeoutMs);

    try {
      socket = new WebSocket(SONIOX_WS_URL);
    } catch {
      clearTimeout(timer);
      resolve('unreachable');
      return;
    }
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      socket.send(configMessage(apiKey));
      // A tenth of a second of silence, then the terminator.
      socket.send(new Uint8Array((SAMPLE_RATE / 1000) * 2 * 100).buffer);
      socket.send(JSON.stringify({ type: 'finalize' }));
      socket.send(new ArrayBuffer(0));
      socket.send('');
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let data: SonioxMessage;
      try {
        data = JSON.parse(event.data) as SonioxMessage;
      } catch {
        return;
      }
      const failure = sonioxFailureFromError(data);
      if (failure === 'invalid-key') return finish('invalid');
      if (failure) return finish('unreachable');
      if (data.finished) return finish('valid');
    };

    socket.onerror = () => finish('unreachable');
    socket.onclose = () => finish('unreachable');
  });
}

export function createSonioxProvider(apiKey: string, options?: SonioxOptions): SttProvider {
  let ws: WebSocket | null = null;
  let finalText = '';
  /** Suppresses handlers while we tear a socket down on purpose. */
  let closing = false;
  /**
   * Audio already committed to this stream. A stream that has carried a
   * recording cannot carry another: end-of-audio is terminal and the server
   * closes after `finished`, so the next recording needs a fresh socket.
   */
  let streamUsed = false;
  /** Pending audio below SEND_CHUNK_BYTES, flushed on the next frame or at stop. */
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let sentBytes = 0;
  /** Token messages seen this session — distinguishes "silent server" from "silent user". */
  let tokenMessages = 0;
  /** Set when Soniox rejects the key or the stream errors; taken once by the caller. */
  let failure: SttFailure | null = null;

  /** Concatenate and send whatever is buffered. Returns false if the send failed. */
  function flushPending(): boolean {
    if (pendingBytes === 0) return true;
    const chunk = new Uint8Array(pendingBytes);
    let offset = 0;
    for (const part of pending) {
      chunk.set(part, offset);
      offset += part.byteLength;
    }
    pending = [];
    pendingBytes = 0;
    return sendBinary(chunk.buffer);
  }

  /**
   * Every write goes through here. A throwing send used to be invisible: the
   * VAD reads the frame before the send, so recording looked healthy right up
   * until Soniox timed out having received nothing.
   */
  function sendBinary(payload: ArrayBuffer): boolean {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(payload);
      sentBytes += payload.byteLength;
      streamUsed = true;
      return true;
    } catch (e) {
      trace.error('VOICE', `soniox audio send failed: ${describe(e)}`);
      return false;
    }
  }

  const session = createListenSession(
    () => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      flushPending();
      trace.info('VOICE', 'soniox finalize', {
        sentBytes,
        // Non-zero means the socket accepted our writes but hasn't put them on
        // the wire — the one way `sentBytes` can look healthy while Soniox
        // receives nothing.
        buffered: ws.bufferedAmount,
        tokens: tokenMessages,
      });
      try {
        // Force pending tokens to finalize, then signal end of audio. The docs
        // describe the terminator as "an empty WebSocket frame (binary or
        // text)", and elsewhere as the empty string — send both, because a
        // zero-length *binary* frame is exactly the kind of thing a WebSocket
        // stack drops instead of transmitting, and losing the terminator means
        // `finished` never comes and the stream dies on a 408 instead.
        ws.send(JSON.stringify({ type: 'finalize' }));
        ws.send(new ArrayBuffer(0));
        ws.send('');
        streamUsed = true;
      } catch (e) {
        trace.error('VOICE', `soniox finalize failed: ${describe(e)}`);
      }
    },
    {
      resultTimeoutMs: CLOUD_RESULT_TIMEOUT_MS,
      // Never discard a transcript just because the server didn't say it was
      // finished — that turned working recognition into "couldn't hear anything".
      onTimeout: () => {
        const text = finalText.trim();
        trace.warn('VOICE', 'soniox never signalled finished', {
          tokens: tokenMessages,
          len: text.length,
        });
        teardown();
        return text;
      },
    },
  );

  function teardown(): void {
    const socket = ws;
    ws = null;
    // The flag tracks the socket being dropped, so it goes with it.
    streamUsed = false;
    pending = [];
    pendingBytes = 0;
    if (!socket) return;
    closing = true;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Already closing or closed.
    }
    closing = false;
  }

  function handleMessage(raw: string): void {
    let data: SonioxMessage;
    try {
      data = JSON.parse(raw) as SonioxMessage;
    } catch {
      return; // Non-JSON frame; nothing we can act on.
    }

    const err = sonioxFailureFromError(data);
    if (err) {
      trace.error('VOICE', `soniox error ${data.error_code ?? '?'}`);
      failure = err;
      session.deliver('');
      teardown();
      return;
    }

    if (data.tokens?.length) tokenMessages++;
    for (const token of data.tokens ?? []) {
      if (!token.text || CONTROL_TOKEN.test(token.text.trim())) continue;
      // Non-final tokens are provisional and may be revised, so only final
      // ones are kept; the caller shows a transcript once, not as it forms.
      if (token.is_final) finalText += token.text;
    }

    if (data.finished) {
      const text = finalText.trim();
      trace.info('VOICE', 'soniox transcript received', { len: text.length });
      session.deliver(text);
      teardown();
    }
  }

  return {
    ensureReady() {
      // Only reuse a socket that has never carried audio. Once a recording has
      // run, end-of-audio has been sent and the stream is spent — reusing it is
      // what made the second recording silently transcribe nothing.
      if (ws?.readyState === WebSocket.OPEN && !streamUsed) return Promise.resolve(true);
      teardown();
      failure = null;

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        };

        const timer = setTimeout(() => {
          trace.warn('VOICE', 'soniox connect timed out');
          teardown();
          settle(false);
        }, SONIOX_CONNECT_TIMEOUT_MS);

        let socket: WebSocket;
        try {
          socket = new WebSocket(SONIOX_WS_URL);
        } catch (e) {
          trace.error('VOICE', `soniox connect failed: ${describe(e)}`);
          settle(false);
          return;
        }
        ws = socket;
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
          socket.send(configMessage(apiKey, options));
          trace.info('VOICE', 'soniox connected');
          settle(true);
        };

        socket.onmessage = (event) => {
          if (closing) return;
          if (typeof event.data === 'string') handleMessage(event.data);
        };

        socket.onerror = () => {
          if (closing) return;
          trace.error('VOICE', 'soniox socket error');
          session.deliver('');
          settle(false);
        };

        socket.onclose = () => {
          if (closing) return;
          ws = null;
          // Deliver whatever was finalised before the close. The server closes
          // right after `finished`, but it can also drop the stream on its own
          // — either way, waiting out the safety timeout with a transcript
          // already in hand would just look like a hang.
          session.deliver(finalText.trim());
        };
      });
    },

    startListening(onFinal, onStop) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      finalText = '';
      pending = [];
      pendingBytes = 0;
      sentBytes = 0;
      tokenMessages = 0;
      session.start(onFinal, onStop);
    },

    feedAudio(pcm) {
      if (!session.isListening()) return;
      const bytes = toBytes(pcm);
      // The VAD sees every 10 ms frame — batching below is only about how the
      // audio reaches the wire, not how quickly we notice silence.
      session.observe(bytes);
      if (ws?.readyState !== WebSocket.OPEN) return;

      // Already S16LE/16 kHz/mono — exactly what the config message declared,
      // so the bytes go on unchanged. `slice` detaches from the bridge's buffer,
      // which is reused for the next frame.
      pending.push(bytes.slice());
      pendingBytes += bytes.byteLength;
      if (pendingBytes >= SEND_CHUNK_BYTES) flushPending();
    },

    stopListening() {
      session.stop();
    },

    isListening() {
      return session.isListening();
    },

    takeFailure() {
      const f = failure;
      failure = null;
      return f;
    },

    dispose() {
      session.abort();
      teardown();
      finalText = '';
    },
  };
}

function describe(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
