/**
 * Which speech backend voice task entry uses, and its credentials.
 *
 * Stored under its own key rather than inside TenantConfig on purpose: that
 * object is base64'd into the X-Notion-Config header of every request to our
 * server (see tenant-config.ts's getTenantHeader), so putting a Soniox key
 * there would ship it to our Lambda on every list fetch. This never leaves
 * the device.
 *
 * The two modes are exclusive, not a fallback chain. One recognises speech
 * with no network at all; the other sends audio to a third party. Falling back
 * between them automatically would leave the user unable to tell which
 * happened for any given recording.
 */

import { registerSecret } from './logging/redact';
import { trace } from './logging/trace';
import { getBridge } from './state';

const VOICE_KEY = 'notionultimatebrain:voice';

export type VoiceMode = 'off' | 'on-device' | 'cloud';

/**
 * Whether voice task entry can run right now, and if not, what is missing.
 *
 * One union rather than a pile of booleans: it drives both the gate in
 * glasses/modules/tasks/voice.ts and the explanatory copy on the Add Task
 * screen, which have to agree.
 */
export type VoiceStatus =
  | 'unknown' // boot hasn't resolved the config yet
  | 'off' // no backend chosen
  | 'needs-download' // on-device mode, model not downloaded
  | 'needs-key' // cloud mode, no API key
  | 'preparing' // on-device model loading into memory
  | 'ready';

export interface VoiceConfig {
  mode: VoiceMode;
  /** Only meaningful for mode 'cloud'. The user's own key, never ours. */
  sonioxApiKey?: string;
}

/**
 * Voice is opt-in for a fresh install: 'off' until the user picks a backend,
 * since both choices now cost something (a 41 MB download, or an API key).
 * boot.ts upgrades this to 'on-device' for installs that predate the setting —
 * see resolveInitialVoiceConfig.
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = { mode: 'off' };

function isVoiceMode(value: unknown): value is VoiceMode {
  return value === 'off' || value === 'on-device' || value === 'cloud';
}

export async function loadVoiceConfig(): Promise<VoiceConfig> {
  const b = getBridge();
  try {
    const raw = b ? await b.getLocalStorage(VOICE_KEY) : window.localStorage.getItem(VOICE_KEY);
    if (!raw) return DEFAULT_VOICE_CONFIG;
    const parsed = JSON.parse(raw) as Partial<VoiceConfig>;
    if (!isVoiceMode(parsed.mode)) return DEFAULT_VOICE_CONFIG;
    const cfg: VoiceConfig = { mode: parsed.mode };
    if (parsed.sonioxApiKey) {
      cfg.sonioxApiKey = parsed.sonioxApiKey;
      registerSecret(parsed.sonioxApiKey);
    }
    return cfg;
  } catch {
    return DEFAULT_VOICE_CONFIG;
  }
}

export async function saveVoiceConfig(cfg: VoiceConfig): Promise<void> {
  if (cfg.sonioxApiKey) registerSecret(cfg.sonioxApiKey);
  const raw = JSON.stringify(cfg);
  const b = getBridge();
  try {
    if (b) await b.setLocalStorage(VOICE_KEY, raw);
    else window.localStorage.setItem(VOICE_KEY, raw);
    trace.info('VOICE', `config saved (mode=${cfg.mode})`);
  } catch {
    // Best-effort, same as web/services/config.ts.
  }
}
