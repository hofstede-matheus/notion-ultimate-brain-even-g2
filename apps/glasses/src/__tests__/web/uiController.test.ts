import { describe, expect, it } from 'vitest';
import {
  getState,
  promptForConfig,
  resolveSettings,
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

    resolveSettings(config);
    await expect(first).resolves.toEqual(config);
    await expect(second).resolves.toEqual(config);
  });
});
