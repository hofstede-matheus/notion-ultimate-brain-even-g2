import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { TenantConfig } from '@notion-ub/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetBridgeQueue } from '../../glasses/bridge-queue';
import { BOOT_SPLASH_MIN_MS, BRIDGE_WAIT_TIMEOUT_MS } from '../../glasses/constants';
import { state } from '../../state';
import {
  onSettingsClick,
  promptForConfig,
  setStatus,
  showRetry,
} from '../../web/providers/uiController';
import { makeMockBridge } from './fakes';

const mocks = vi.hoisted(() => ({
  bridge: null as ReturnType<typeof makeMockBridge> | null,
  loadStoredConfig: vi.fn(),
}));

vi.mock('@evenrealities/even_hub_sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evenrealities/even_hub_sdk')>();
  return {
    ...actual,
    waitForEvenAppBridge: vi.fn(() => mocks.bridge),
  };
});

vi.mock('../../web/providers/uiController', () => ({
  disableConnect: vi.fn(),
  hideConnect: vi.fn(),
  onConnectClick: vi.fn(),
  onSettingsClick: vi.fn(),
  promptForConfig: vi.fn(),
  setDeviceConnected: vi.fn(),
  setStatus: vi.fn(),
  showRetry: vi.fn(),
}));

vi.mock('../../web/services/config', () => ({
  loadStoredConfig: mocks.loadStoredConfig,
}));

vi.mock('../../logging/persist', () => ({
  loadPreviousSession: vi.fn().mockResolvedValue(undefined),
  startPersisting: vi.fn(),
}));

// Stubbed rather than exercised: resolving the speech backend reads IndexedDB,
// which the node test environment has no business providing. What matters here
// is that boot kicks it off without waiting on it — see the test below.
const mockRefreshVoiceStatus = vi.fn().mockResolvedValue(undefined);
vi.mock('../../voice-runtime', () => ({
  refreshVoiceStatus: mockRefreshVoiceStatus,
}));

const mockFetchDatabases = vi.fn();
vi.mock('../../web/services/databases', () => ({
  fetchDatabases: mockFetchDatabases,
  InvalidTokenError: class InvalidTokenError extends Error {},
}));

const { boot } = await import('../../boot');

const tenantConfig = (suffix: string): TenantConfig => ({
  token: `token-${suffix}`,
  tasksDb: `tasks-${suffix}`,
  notesDb: `notes-${suffix}`,
  projectsDb: `projects-${suffix}`,
  tagsDb: `tags-${suffix}`,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetBridgeQueue();
  state.startupRendered = false;
  state.lists = {};
  state.listPages = {};
});

describe('boot', () => {
  it('never calls /api/databases during boot — config-health only runs lazily on failure', async () => {
    vi.useFakeTimers();
    const bridge = makeMockBridge();
    mocks.bridge = bridge;
    mocks.loadStoredConfig.mockResolvedValue(tenantConfig('stored'));

    await boot();
    await vi.advanceTimersByTimeAsync(BOOT_SPLASH_MIN_MS);

    expect(state.screen).toBe('menu');
    expect(mockFetchDatabases).not.toHaveBeenCalled();
  });

  it('resolves the speech backend after the menu is up, not before', async () => {
    vi.useFakeTimers();
    const bridge = makeMockBridge();
    mocks.bridge = bridge;
    mocks.loadStoredConfig.mockResolvedValue(tenantConfig('stored'));

    await boot();
    await vi.advanceTimersByTimeAsync(BOOT_SPLASH_MIN_MS);

    // Voice setup is off the critical path: the glasses are usable whether or
    // not a speech backend is configured, so it must never gate the menu.
    expect(state.screen).toBe('menu');
    expect(mockRefreshVoiceStatus).toHaveBeenCalledTimes(1);
  });

  it('still reaches the menu when voice setup fails', async () => {
    vi.useFakeTimers();
    const bridge = makeMockBridge();
    mocks.bridge = bridge;
    mocks.loadStoredConfig.mockResolvedValue(tenantConfig('stored'));
    mockRefreshVoiceStatus.mockRejectedValueOnce(new Error('indexedDB unavailable'));

    await boot();
    await vi.advanceTimersByTimeAsync(BOOT_SPLASH_MIN_MS);

    expect(state.screen).toBe('menu');
    expect(setStatus).toHaveBeenCalledWith('Connected! Use your glasses.');
  });

  it('creates the startup containers before stored config resolves', async () => {
    vi.useFakeTimers();
    const bridge = makeMockBridge();
    mocks.bridge = bridge;
    mocks.loadStoredConfig.mockReturnValue(new Promise<null>(() => {}));

    await boot();
    await vi.advanceTimersByTimeAsync(0);

    expect(bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1);
    expect(mocks.loadStoredConfig).toHaveBeenCalledTimes(1);
    const startup = bridge.createStartUpPageContainer.mock.calls[0]?.[0] as {
      textObject: Array<{ containerID: number; containerName: string }>;
      listObject: Array<{ containerID: number; containerName: string }>;
    };
    expect(startup.textObject[0]).toMatchObject({ containerID: 1, containerName: 'ub-header' });
    expect(startup.listObject[0]).toMatchObject({ containerID: 2, containerName: 'ub-list' });
  });

  it('shows a retryable failure, with no startup draw attempted, when Even Hub never provides a bridge', async () => {
    vi.useFakeTimers();
    vi.mocked(waitForEvenAppBridge).mockReturnValueOnce(new Promise(() => {}));
    mocks.loadStoredConfig.mockReturnValue(new Promise<null>(() => {}));

    await boot();
    await vi.advanceTimersByTimeAsync(BRIDGE_WAIT_TIMEOUT_MS);

    expect(setStatus).toHaveBeenCalledWith('Connection failed. Tap to retry.');
    expect(showRetry).toHaveBeenCalledTimes(1);
    expect(state.startupRendered).toBe(false);
  });

  it('clears cached lists and redraws the menu when settings are saved later', async () => {
    vi.useFakeTimers();
    const bridge = makeMockBridge();
    mocks.bridge = bridge;
    mocks.loadStoredConfig.mockResolvedValue(tenantConfig('stored'));

    await boot();
    await vi.advanceTimersByTimeAsync(BOOT_SPLASH_MIN_MS);

    expect(state.startupRendered).toBe(true);
    expect(state.screen).toBe('menu');

    // Simulate stale data left over from browsing before settings changed.
    state.lists = { menu: [] };
    state.listPages = { menu: 3 };
    state.listStatus = { 'projects-all': 'stale' };
    state.configSuspect = true;
    bridge.rebuildPageContainer.mockClear();
    // reconfigure() no longer reads the resolved value for the config itself — the settings
    // form now commits (setTenantConfig) before resolving promptForConfig — so this only needs
    // to signal "saved" for reconfigure()'s boolean return.
    vi.mocked(promptForConfig).mockResolvedValueOnce(true);

    const settingsHandler = vi.mocked(onSettingsClick).mock.calls[0]?.[0];
    expect(settingsHandler).toBeDefined();
    settingsHandler?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(state.lists).toEqual({});
    expect(state.listPages).toEqual({});
    expect(state.listStatus).toEqual({});
    expect(state.configSuspect).toBe(false);
    expect(state.screen).toBe('menu');
    expect(bridge.rebuildPageContainer).toHaveBeenCalled();
  });
});
