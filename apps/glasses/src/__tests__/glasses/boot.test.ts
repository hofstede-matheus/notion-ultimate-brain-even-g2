import { afterEach, describe, expect, it, vi } from 'vitest';
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
  SettingsCancelledError: class SettingsCancelledError extends Error {},
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
  saveStoredConfig: vi.fn(),
}));

vi.mock('../../logging/persist', () => ({
  loadPreviousSession: vi.fn().mockResolvedValue(undefined),
  startPersisting: vi.fn(),
}));

vi.mock('../../stt', () => ({
  preloadVoskModel: vi.fn(),
}));

const { boot } = await import('../../boot');

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('boot', () => {
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
});
