import { describe, expect, it } from 'vitest';
import {
  cancelSettings,
  getState,
  promptForConfig,
  settingsSaved,
} from '../../web/providers/uiController';

const config = {
  token: 'token',
  tasksDb: 'tasks',
  notesDb: 'notes',
  projectsDb: 'projects',
  tagsDb: 'tags',
};

describe('promptForConfig', () => {
  it('returns the in-flight promise when settings is opened again', async () => {
    const first = promptForConfig();
    const second = promptForConfig(config, true);

    expect(second).toBe(first);
    expect(getState()).toMatchObject({
      settingsOpen: true,
      settingsPrefill: config,
      settingsCancellable: true,
    });

    settingsSaved();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it('resolves false when the user backs out instead of saving', async () => {
    const pending = promptForConfig(config, true);

    cancelSettings();

    expect(getState().settingsOpen).toBe(false);
    await expect(pending).resolves.toBe(false);
  });

  it('is safe to prompt again after a previous prompt was saved', async () => {
    const first = promptForConfig(config, true);
    settingsSaved();
    await first;

    const second = promptForConfig(config, true);
    cancelSettings();

    expect(getState().settingsOpen).toBe(false);
    await expect(second).resolves.toBe(false);
  });
});
