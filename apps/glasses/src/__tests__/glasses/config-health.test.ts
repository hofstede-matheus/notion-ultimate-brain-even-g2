import type { TenantConfig } from '@notion-ub/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api';
import { state } from '../../state';
import { getTenantConfig, setTenantConfig } from '../../tenant-config';

const { mockFetchDatabases, mockSetStatus, mockReconfigure, mockShowGlassesScreen } = vi.hoisted(
  () => ({
    mockFetchDatabases: vi.fn(),
    mockSetStatus: vi.fn(),
    mockReconfigure: vi.fn(),
    mockShowGlassesScreen: vi.fn(),
  }),
);

vi.mock('../../web/services/databases', () => ({
  fetchDatabases: mockFetchDatabases,
  InvalidTokenError: class InvalidTokenError extends Error {},
}));
vi.mock('../../web/providers/uiController', () => ({ setStatus: mockSetStatus }));
vi.mock('../../boot', () => ({ reconfigure: mockReconfigure }));
vi.mock('../../glasses/events', () => ({ showGlassesScreen: mockShowGlassesScreen }));

// config-health.ts only reaches these dynamically (inside runCheck, on an actual failure) —
// a plain static import here is fine, it never touches boot.ts/glasses/events at import time.
import { _resetSessionForTests, checkTenantConfig, reportApiFailure } from '../../config-health';

const CFG: TenantConfig = {
  token: 'ntn_test',
  tasksDb: 'tasks-id',
  notesDb: 'notes-id',
  projectsDb: 'projects-id',
  tagsDb: 'tags-id',
};

const REAL_PROJECTS_DB = {
  id: 'projects-id',
  name: 'Projects',
  properties: {
    Name: 'title',
    Archived: 'checkbox',
    Status: 'status',
    Meta: 'formula',
    'Latest Activity': 'formula',
    'Target Deadline': 'date',
  },
};

const DECOY_PROJECTS_DB = {
  id: 'projects-id',
  name: 'Projects',
  properties: { 'Project name': 'title', Status: 'status' },
};

beforeEach(() => {
  setTenantConfig(CFG);
  state.configSuspect = false;
  state.lists = { menu: [] };
  state.listStatus = { 'projects-all': 'failed' };
  state.startupRendered = false;
  _resetSessionForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('checkTenantConfig', () => {
  it('is empty when every stored database still fits its role', async () => {
    mockFetchDatabases.mockResolvedValue([REAL_PROJECTS_DB]);
    expect(await checkTenantConfig()).toEqual([]);
  });

  it('flags a slot whose stored database no longer fits', async () => {
    mockFetchDatabases.mockResolvedValue([DECOY_PROJECTS_DB]);
    expect(await checkTenantConfig()).toEqual(['projectsDb']);
  });

  it("ignores a database that has vanished entirely — not this function's signal to raise", async () => {
    mockFetchDatabases.mockResolvedValue([]);
    expect(await checkTenantConfig()).toEqual([]);
  });
});

describe('reportApiFailure', () => {
  it('does nothing for a plain network/server error', async () => {
    reportApiFailure(new Error('offline'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetchDatabases).not.toHaveBeenCalled();
  });

  it('does nothing for a 500 ApiError — not config-shaped', async () => {
    reportApiFailure(new ApiError('boom', 500, 'unhandled_error'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetchDatabases).not.toHaveBeenCalled();
  });

  it('checks the config on a 400 validation_error and opens no settings when everything fits', async () => {
    mockFetchDatabases.mockResolvedValue([REAL_PROJECTS_DB]);

    reportApiFailure(new ApiError('bad sort property', 400, 'validation_error'));
    await vi.waitFor(() => expect(mockFetchDatabases).toHaveBeenCalledTimes(1));

    expect(mockReconfigure).not.toHaveBeenCalled();
    expect(state.configSuspect).toBe(false);
  });

  it('flags configSuspect and reopens settings on a 404 object_not_found with a bad slot', async () => {
    state.startupRendered = true;
    mockFetchDatabases.mockResolvedValue([DECOY_PROJECTS_DB]);
    mockReconfigure.mockResolvedValue(true);

    reportApiFailure(new ApiError('not found', 404, 'object_not_found'));
    await vi.waitFor(() => expect(mockReconfigure).toHaveBeenCalledWith(getTenantConfig()));
    await vi.waitFor(() => expect(mockShowGlassesScreen).toHaveBeenCalled());

    expect(state.configSuspect).toBe(false); // cleared after a successful reconfigure
    expect(state.lists).toEqual({});
    expect(state.listStatus).toEqual({});
  });

  it('leaves configSuspect set when the user cancels the settings prompt', async () => {
    mockFetchDatabases.mockResolvedValue([DECOY_PROJECTS_DB]);
    mockReconfigure.mockResolvedValue(false);

    reportApiFailure(new ApiError('not found', 404, 'object_not_found'));
    await vi.waitFor(() => expect(mockReconfigure).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));

    expect(state.configSuspect).toBe(true);
    expect(mockShowGlassesScreen).not.toHaveBeenCalled();
  });

  it('checks at most once per session', async () => {
    mockFetchDatabases.mockResolvedValue([REAL_PROJECTS_DB]);

    reportApiFailure(new ApiError('bad sort property', 400, 'validation_error'));
    await vi.waitFor(() => expect(mockFetchDatabases).toHaveBeenCalledTimes(1));

    reportApiFailure(new ApiError('bad sort property', 400, 'validation_error'));
    await new Promise((r) => setTimeout(r, 0));

    expect(mockFetchDatabases).toHaveBeenCalledTimes(1);
  });
});
