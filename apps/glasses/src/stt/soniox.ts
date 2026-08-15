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
import type { SttProvider } from './types';

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

export function createSonioxProvider(apiKey: string): SttProvider {
  let ws: WebSocket | null = null;
  let finalText = '';
  /** Suppresses handlers while we tear a socket down on purpose. */
  let closing = false;

  const session = createListenSession(() => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    // Force pending tokens to finalize, then signal end-of-audio. The server
    // answers with `finished: true`.
    ws.send(JSON.stringify({ type: 'finalize' }));
    ws.send(new ArrayBuffer(0));
  });

  function teardown(): void {
    const socket = ws;
    ws = null;
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

    if (data.error_code || data.error_message) {
      // 401 is the one the user can actually fix, so it gets its own wording
      // upstream — see glasses/modules/tasks/voice.ts.
      trace.error('VOICE', `soniox error ${data.error_code ?? '?'}`);
      session.deliver('');
      teardown();
      return;
    }

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
      if (ws?.readyState === WebSocket.OPEN) return Promise.resolve(true);
      teardown();

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
          // sample_rate and num_channels are required for raw PCM formats.
          socket.send(
            JSON.stringify({
              api_key: apiKey,
              model: SONIOX_MODEL,
              audio_format: 'pcm_s16le',
              sample_rate: SAMPLE_RATE,
              num_channels: 1,
            }),
          );
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
          // A close mid-session would otherwise strand the UI on "processing"
          // until the session's own timeout.
          if (session.isListening()) session.deliver('');
        };
      });
    },

    startListening(onFinal, onStop) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      finalText = '';
      session.start(onFinal, onStop);
    },

    feedAudio(pcm) {
      if (!session.isListening()) return;
      const bytes = toBytes(pcm);
      session.observe(bytes);
      if (ws?.readyState !== WebSocket.OPEN) return;
      // Already S16LE/16 kHz/mono — exactly what the config message declared.
      ws.send(bytes.slice().buffer);
    },

    stopListening() {
      session.stop();
    },

    isListening() {
      return session.isListening();
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
