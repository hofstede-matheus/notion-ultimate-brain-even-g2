/**
 * The order Settings' Save does its work in (web/screens/SettingsForm/submit.ts).
 *
 * The regression this pins: `commitSettings` used to await the voice backend before resolving
 * the pending settings promise. In on-device mode that awaited a 41 MB IndexedDB read and vosk's
 * model load, so a blocked or slow model left the save unresolved — and backing out of the
 * apparently-dead form discarded it entirely. Now the config is committed synchronously: there
 * is no `await` between calling `commitSettings` and the configuration taking effect, so there
 * is nothing left for a slow or wedged voice backend to hold hostage.
 */

import type { TenantConfig } from '@notion-ub/contracts';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_SELECTION } from '../../web/screens/SettingsForm/dbSelection';
import { type CommitDeps, commitSettings } from '../../web/screens/SettingsForm/submit';

const INPUT = {
  token: 'ntn_token',
  selection: {
    ...EMPTY_SELECTION,
    tasksDb: 'tasks-id',
    notesDb: 'notes-id',
    projectsDb: 'projects-id',
    tagsDb: 'tags-id',
  },
  picker: { overrides: { notesDb: 'notes-id' }, showAll: true },
  voiceCfg: { mode: 'on-device' as const },
};

const EXPECTED_CONFIG: TenantConfig = {
  token: 'ntn_token',
  tasksDb: 'tasks-id',
  notesDb: 'notes-id',
  projectsDb: 'projects-id',
  tagsDb: 'tags-id',
};

/** A promise that never settles — what a blocked IndexedDB read looks like on device. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function deps(overrides: Partial<CommitDeps> = {}): CommitDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    setTenantConfig: vi.fn(() => {
      calls.push('setTenantConfig');
    }),
    settingsSaved: vi.fn(() => {
      calls.push('settingsSaved');
    }),
    saveStoredConfig: vi.fn(async () => {
      calls.push('saveStoredConfig');
    }),
    saveDbPickerState: vi.fn(async () => {
      calls.push('saveDbPickerState');
    }),
    saveVoiceConfig: vi.fn(async () => {
      calls.push('saveVoiceConfig');
    }),
    refreshVoiceStatus: vi.fn(async () => {
      calls.push('refreshVoiceStatus');
    }),
    ...overrides,
  };
}

describe('commitSettings', () => {
  it('commits the configuration with no await, even when every durable write hangs forever', () => {
    // The regression test: this must not be `async` and there must be no `await` before this
    // line, or a hung refreshVoiceStatus/saveStoredConfig would silently swallow the assertion
    // along with the save.
    const d = deps({
      saveStoredConfig: vi.fn(() => never<void>()),
      saveDbPickerState: vi.fn(() => never<void>()),
      saveVoiceConfig: vi.fn(() => never<void>()),
      refreshVoiceStatus: vi.fn(() => never<void>()),
    });

    commitSettings(INPUT, d);

    expect(d.setTenantConfig).toHaveBeenCalledWith(EXPECTED_CONFIG);
    expect(d.settingsSaved).toHaveBeenCalled();
  });

  it('applies the config before telling uiController the save is done', () => {
    // settingsSaved() resolves boot.ts's reconfigure, whose callers immediately re-read
    // getTenantConfig() to clear caches and redraw — setTenantConfig must have already run.
    const d = deps();

    commitSettings(INPUT, d);

    expect(d.calls.indexOf('setTenantConfig')).toBeLessThan(d.calls.indexOf('settingsSaved'));
  });

  it('starts every durable write and the voice refresh with the right arguments', () => {
    const d = deps();

    commitSettings(INPUT, d);

    expect(d.saveStoredConfig).toHaveBeenCalledWith(EXPECTED_CONFIG);
    expect(d.saveDbPickerState).toHaveBeenCalledWith(INPUT.picker);
    expect(d.saveVoiceConfig).toHaveBeenCalledWith(INPUT.voiceCfg);
    expect(d.refreshVoiceStatus).toHaveBeenCalledWith(INPUT.voiceCfg);
  });
});
