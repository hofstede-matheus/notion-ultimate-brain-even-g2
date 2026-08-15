/**
 * Bridges the stored voice config to the running app: picks the speech
 * backend and records the result in `state.voice`, which the glasses screens
 * read.
 *
 * Its own module rather than part of boot.ts because the Settings screen calls
 * it too — after a download finishes, a key is saved, or the mode changes, the
 * new backend has to take effect without restarting the app. Putting it in
 * boot.ts would mean web/ importing boot.ts, which already imports web/.
 */

import { trace } from './logging/trace';
import { state } from './state';
import { applyVoiceConfig, warmUp } from './stt';
import { loadVoiceConfig, type VoiceConfig } from './voice-config';

/**
 * Apply `cfg` (or whatever is stored) and update `state.voice`.
 *
 * Never touches the network: the on-device check is a local IndexedDB lookup,
 * and cloud mode defers its socket until a recording starts. boot.test.ts pins
 * that boot makes no blocking network call — keep it that way.
 */
export async function refreshVoiceStatus(cfg?: VoiceConfig): Promise<void> {
  try {
    const config = cfg ?? (await loadVoiceConfig());
    const status = await applyVoiceConfig(config);
    state.voice = status;
    trace.info('VOICE', `mode=${config.mode} status=${status}`);

    if (status === 'preparing') {
      // Warm the model in the background so it is loaded by the time the user
      // reaches Add Task. Failure means the stored archive is unusable, and
      // re-downloading is the only recovery the UI can offer.
      const ok = await warmUp();
      state.voice = ok ? 'ready' : 'needs-download';
      if (!ok) trace.warn('VOICE', 'stored model failed to load — offering re-download');
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    trace.error('VOICE', `voice setup failed: ${msg}`);
    state.voice = 'off';
  }
}
