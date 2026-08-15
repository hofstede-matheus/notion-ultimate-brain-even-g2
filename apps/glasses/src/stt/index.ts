/**
 * Speech-to-text façade: owns whichever backend the user picked and exposes
 * the small surface glasses/modules/tasks/voice.ts and glasses/events use.
 *
 * Audio format from the glasses: S16LE, 16 kHz, mono. The on-device provider
 * converts to Float32 for Kaldi; the cloud provider forwards the bytes as-is.
 */

import { trace } from '../logging/trace';
import type { VoiceConfig, VoiceStatus } from '../voice-config';
import { clearVoskScratch, hasModel, openModelUrl } from '../voice-model';
import { createSonioxProvider } from './soniox';
import type { SttProvider } from './types';
import { createVoskProvider } from './vosk';

export type { SttProvider } from './types';

let provider: SttProvider | null = null;
/** Object URL backing the on-device model, revoked when the provider is replaced. */
let modelObjectUrl: string | null = null;

function clearProvider(): void {
  provider?.dispose();
  provider = null;
  if (modelObjectUrl) {
    URL.revokeObjectURL(modelObjectUrl);
    modelObjectUrl = null;
  }
}

/**
 * Wire up the backend `cfg` selects and report where that leaves voice input.
 *
 * Returns 'preparing' for on-device: the model still has to be read and
 * extracted, which callers kick off with warmUp() rather than blocking here.
 * Cloud mode returns 'ready' as soon as a key exists — the socket is opened at
 * recording time, since an idle connection held from launch buys nothing.
 */
export async function applyVoiceConfig(cfg: VoiceConfig): Promise<VoiceStatus> {
  clearProvider();

  if (cfg.mode === 'off') return 'off';

  if (cfg.mode === 'cloud') {
    if (!cfg.sonioxApiKey) return 'needs-key';
    provider = createSonioxProvider(cfg.sonioxApiKey);
    return 'ready';
  }

  if (!(await hasModel())) return 'needs-download';

  // vosk-browser keys its own cache off the model URL, and ours is a fresh
  // blob: URL every session — see voice-model.ts for why the scratch has to go.
  await clearVoskScratch();
  const url = await openModelUrl();
  if (!url) return 'needs-download';

  modelObjectUrl = url;
  provider = createVoskProvider(url);
  return 'preparing';
}

/**
 * Finish preparing the active backend. Only meaningful after applyVoiceConfig
 * returned 'preparing'; resolves false if the model can't be loaded, in which
 * case re-downloading is the recovery the UI offers.
 */
export async function warmUp(): Promise<boolean> {
  if (!provider) return false;
  return provider.ensureReady();
}

export async function ensureReady(): Promise<boolean> {
  if (!provider) {
    trace.warn('VOICE', 'ensureReady with no provider configured');
    return false;
  }
  return provider.ensureReady();
}

export function startListening(onFinal: (text: string) => void, onStop?: () => void): void {
  provider?.startListening(onFinal, onStop);
}

export function feedAudio(pcm: Uint8Array | number[]): void {
  provider?.feedAudio(pcm);
}

export function stopListening(): void {
  provider?.stopListening();
}

export function isListening(): boolean {
  return provider?.isListening() ?? false;
}

/** Tear down the active backend — used when the user switches modes. */
export function dispose(): void {
  clearProvider();
}
