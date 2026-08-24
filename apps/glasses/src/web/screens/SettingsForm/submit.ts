/**
 * What happens when Settings' Save is tapped, in the order it has to happen.
 *
 * Split out of SettingsForm.tsx (like ./dbSelection.ts and ./voiceSection.ts)
 * because the ordering here is the whole point and there is no component-test
 * harness in this repo to pin it from the outside — see vitest.config.ts's
 * `src/__tests__/**` include.
 *
 * The rule this file enforces: **the configuration takes effect synchronously,
 * with nothing awaited first.** It used to be committed last, after the voice
 * backend had been applied and warmed up — in on-device mode that meant
 * awaiting a 41 MB IndexedDB read and vosk's model load before boot.ts's
 * pending settings promise ever resolved. Nothing on screen changed while
 * that ran, so backing out mid-wait threw the whole configuration away.
 *
 * The durable copies (storage, voice config, the voice backend itself) are
 * all fire-and-forget from here: saveStoredConfig and saveVoiceConfig already
 * swallow their own failures internally (see web/services/config.ts and
 * voice-config.ts), and refreshVoiceStatus owns its whole failure surface —
 * awaiting any of them would observe nothing a caller could act on.
 */

import type { TenantConfig } from '@notion-ub/contracts';
import type { VoiceConfig } from '../../../voice-config';
import type { DbPickerState } from '../../services/config';
import type { DbSelection } from './dbSelection';

export interface CommitInput {
  /** Already trimmed by the caller. */
  token: string;
  selection: DbSelection;
  picker: DbPickerState;
  voiceCfg: VoiceConfig;
}

/**
 * Injected rather than imported so the ordering can be tested without a DOM,
 * a storage bridge, or a real voice backend.
 */
export interface CommitDeps {
  setTenantConfig: (cfg: TenantConfig) => void;
  settingsSaved: () => void;
  saveStoredConfig: (cfg: TenantConfig) => Promise<void>;
  saveDbPickerState: (state: DbPickerState) => Promise<void>;
  saveVoiceConfig: (cfg: VoiceConfig) => Promise<void>;
  refreshVoiceStatus: (cfg: VoiceConfig) => Promise<void>;
}

/**
 * Commit the tenant config synchronously, then let every durable write and the voice backend
 * catch up in the background.
 *
 * `setTenantConfig` must run before `settingsSaved`: the latter resolves boot.ts's `reconfigure`,
 * whose callers immediately clear the list caches and redraw the menu by reading
 * `getTenantConfig()` — see boot.ts's settings-button handler and config-health.ts's `runCheck`.
 */
export function commitSettings(input: CommitInput, deps: CommitDeps): void {
  const cfg: TenantConfig = { token: input.token, ...input.selection };

  deps.setTenantConfig(cfg);
  deps.settingsSaved();

  void deps.saveStoredConfig(cfg);
  void deps.saveDbPickerState(input.picker);
  void deps.saveVoiceConfig(input.voiceCfg);
  void deps.refreshVoiceStatus(input.voiceCfg);
}
