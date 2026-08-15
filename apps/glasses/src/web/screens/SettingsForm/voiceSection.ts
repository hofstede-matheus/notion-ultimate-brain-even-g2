/**
 * Pure logic behind the Settings voice section.
 *
 * Split out from the .tsx for the same reason dbSelection.ts is: vitest runs
 * with `environment: 'node'` and only collects `src/__tests__/**\/*.test.ts`,
 * so anything that has to be tested cannot live in a component file.
 */

import type { VoiceConfig, VoiceMode } from '../../../voice-config';

/** State of the on-device model panel. */
export type ModelState = 'checking' | 'absent' | 'downloading' | 'ready' | 'failed';

export const VOICE_MODES: { value: VoiceMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'on-device', label: 'On-device' },
  { value: 'cloud', label: 'Cloud (Soniox)' },
];

/**
 * Percentage for the progress bar, or null when the server gave no usable
 * Content-Length and the bar should read as indeterminate.
 */
export function downloadPercent(received: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(100, Math.round((received / total) * 100));
}

/** "24 MB / 41 MB", or just "24 MB" when the total is unknown. */
export function formatProgress(received: number, total: number): string {
  const mb = (bytes: number) => `${(bytes / 1e6).toFixed(0)} MB`;
  return total > 0 ? `${mb(received)} / ${mb(total)}` : mb(received);
}

/**
 * Soniox keys have no documented prefix, so this only rejects what is
 * obviously not a key — enough to keep an empty or pasted-wrong field from
 * being saved, without guessing at a format that could change.
 */
export function isPlausibleApiKey(key: string): boolean {
  return key.trim().length >= 20;
}

/** Build the config to write when the settings form is saved. */
export function voiceConfigFromDraft(mode: VoiceMode, apiKey: string): VoiceConfig {
  const cfg: VoiceConfig = { mode };
  if (isPlausibleApiKey(apiKey)) cfg.sonioxApiKey = apiKey.trim();
  return cfg;
}

/** Whether the section's current selection is complete enough to record with. */
export function isVoiceReady(
  mode: VoiceMode,
  modelState: ModelState,
  apiKey: string | undefined,
): boolean {
  if (mode === 'off') return false;
  if (mode === 'cloud') return isPlausibleApiKey(apiKey ?? '');
  return modelState === 'ready';
}
