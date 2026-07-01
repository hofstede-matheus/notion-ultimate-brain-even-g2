/**
 * Offline speech-to-text via vosk-browser (Kaldi WASM).
 *
 * Pattern mirrors EvenChess's voice/recognizer.ts + voice/controller.ts:
 *   - createModel(url) loads and caches the model from a .tar.gz in public/vosk/
 *   - KaldiRecognizer streams Float32 PCM frames in real-time
 *   - Amplitude-based VAD auto-stops after SILENCE_MS of quiet
 *   - No grammar = open-domain recognition (any words)
 *   - No API key, no network, no backend — fully offline
 *
 * Audio format from glasses: S16LE, 16 kHz, mono → convert to Float32 before feeding.
 */

import { createModel } from 'vosk-browser'

// ---------------------------------------------------------------------------
// Timing constants (matches EvenChess controller.ts conventions)
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 16000
const SPEECH_AMPLITUDE = 0.012   // mean abs amplitude threshold to count as "speech"
const SILENCE_MS = 1200          // silence after speech triggers auto-stop
const MIN_LISTEN_MS = 500        // don't auto-stop before this many ms
const MAX_LISTEN_MS = 15000      // hard cap regardless of VAD
const ENDPOINT_POLL_MS = 150     // how often VAD is evaluated
const RESULT_TIMEOUT_MS = 3000   // safety timeout if Vosk never fires the result event

// ---------------------------------------------------------------------------
// Module-level singletons (reused across recording sessions)
// ---------------------------------------------------------------------------

let modelPromise: Promise<any> | null = null
let rec: any = null  // KaldiRecognizer instance

// Mutable per-session callbacks (updated by startListening each session)
let sessionOnFinal: ((text: string) => void) | null = null
let sessionOnStop: (() => void) | null = null

// VAD / session state
let listening = false
let heardSpeech = false
let lastVoiceAt = 0
let startedAt = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let maxTimer: ReturnType<typeof setTimeout> | null = null
let resultTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// Audio conversion helpers (from EvenChess voice/pcm.ts)
// ---------------------------------------------------------------------------

/**
 * Convert raw bytes from the glasses (S16LE) to Float32 [-1, 1].
 * The SDK types audioPcm as Uint8Array, but JSON bridging can deliver number[].
 */
function pcm16ToFloat32(pcm: Uint8Array | number[]): Float32Array {
  const bytes =
    pcm instanceof Uint8Array
      ? pcm
      : Uint8Array.from(pcm, (n) => n & 0xff)

  const samples = Math.floor(bytes.byteLength / 2)
  const out = new Float32Array(samples)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = 0; i < samples; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768
  }
  return out
}

/** Mean absolute amplitude (0–1) — naive speech/silence detector. */
function meanAbsAmplitude(f32: Float32Array): number {
  if (f32.length === 0) return 0
  let sum = 0
  for (let i = 0; i < f32.length; i++) sum += Math.abs(f32[i]!)
  return sum / f32.length
}

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

function clearSessionTimers(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null }
}

function clearResultTimer(): void {
  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null }
}

// ---------------------------------------------------------------------------
// Internal: end the listening session and request final result from Vosk
// ---------------------------------------------------------------------------

function finalize(): void {
  if (!listening) return
  listening = false
  clearSessionTimers()

  // Notify the caller synchronously — close mic, update UI to "processing"
  sessionOnStop?.()
  sessionOnStop = null

  // Ask Vosk to flush; the 'result' event fires asynchronously via the Worker
  rec?.retrieveFinalResult()

  // Safety net: if Vosk never fires the result event, show an error
  const savedOnFinal = sessionOnFinal
  resultTimer = setTimeout(() => {
    resultTimer = null
    sessionOnFinal = null
    savedOnFinal?.('')   // empty = no speech detected
  }, RESULT_TIMEOUT_MS)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Begin loading the Vosk model in the background. Safe to call multiple times.
 * Call once at app startup so the model is warm by the time the user wants to record.
 *
 * @param modelUrl  URL of the .tar.gz model file (e.g. '/vosk/model.tar.gz')
 */
export function preloadVoskModel(modelUrl: string): void {
  if (modelPromise) return
  console.log('[stt] preloading model:', modelUrl)
  modelPromise = createModel(modelUrl).catch((err: unknown) => {
    console.error('[stt] model preload failed:', err)
    modelPromise = null   // allow a retry later
    return null
  })
}

/**
 * Ensure the Kaldi recognizer is created and ready.
 * Must be called (and awaited) before startListening().
 *
 * Returns true if ready, false if the model hasn't loaded yet or failed.
 *
 * @param modelUrl  Same URL passed to preloadVoskModel — used if preload wasn't called.
 */
export async function ensureRecognizer(modelUrl: string): Promise<boolean> {
  if (rec) return true  // already initialized

  if (!modelPromise) {
    modelPromise = createModel(modelUrl)
  }

  try {
    const model = await modelPromise
    if (!model) return false

    // No grammar → open-domain (any words). Pass undefined to skip constraint.
    rec = new model.KaldiRecognizer(SAMPLE_RATE)

    // Wire the result event once — calls through to the current session's callback
    rec.on('result', (msg: any) => {
      const text = ((msg?.result?.text ?? '') as string).trim()
      console.log('[stt] final result:', JSON.stringify(text))

      clearResultTimer()                // real result arrived — cancel safety timeout
      const cb = sessionOnFinal
      sessionOnFinal = null
      cb?.(text)
    })

    rec.on('partialresult', (msg: any) => {
      const partial = ((msg?.result?.partial ?? '') as string).trim()
      if (partial) console.log('[stt] partial:', partial)
    })

    console.log('[stt] recognizer ready')
    return true
  } catch (err) {
    console.error('[stt] recognizer init failed:', err)
    return false
  }
}

/**
 * Start a listening session. Call after ensureRecognizer() returns true.
 *
 * @param onFinal  Called with the transcribed text once the session ends.
 *                 Empty string means Vosk heard nothing (show an error to the user).
 * @param onStop   Called synchronously when the session ends (VAD or manual stop).
 *                 Use this to close the glasses mic and update recording state to 'processing'.
 */
export function startListening(
  onFinal: (text: string) => void,
  onStop?: () => void,
): void {
  if (listening || !rec) return

  sessionOnFinal = onFinal
  sessionOnStop = onStop ?? null
  listening = true
  heardSpeech = false
  startedAt = Date.now()
  lastVoiceAt = startedAt

  // VAD poll: auto-stop after SILENCE_MS of quiet following detected speech
  pollTimer = setInterval(() => {
    if (!listening) return
    const now = Date.now()
    if (
      now - startedAt > MIN_LISTEN_MS &&
      heardSpeech &&
      now - lastVoiceAt > SILENCE_MS
    ) {
      console.log('[stt] VAD: silence detected → finalizing')
      finalize()
    }
  }, ENDPOINT_POLL_MS)

  // Hard cap
  maxTimer = setTimeout(() => {
    console.log('[stt] max duration reached → finalizing')
    finalize()
  }, MAX_LISTEN_MS)
}

/**
 * Feed a raw PCM frame from the glasses audioEvent.
 * No-op unless a session is active.
 *
 * @param pcm  Raw bytes from audioEvent.audioPcm (S16LE, 16 kHz, mono)
 */
export function feedAudio(pcm: Uint8Array | number[]): void {
  if (!listening || !rec) return
  const f32 = pcm16ToFloat32(pcm)
  if (meanAbsAmplitude(f32) >= SPEECH_AMPLITUDE) {
    heardSpeech = true
    lastVoiceAt = Date.now()
  }
  rec.acceptWaveformFloat(f32, SAMPLE_RATE)
}

/**
 * Manually end the session (user tapped to stop early).
 * Same code path as VAD auto-stop → calls finalize().
 */
export function stopListening(): void {
  finalize()
}

/** Whether a recording session is currently active. */
export function isListening(): boolean {
  return listening
}
