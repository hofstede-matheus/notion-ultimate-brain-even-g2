import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { TenantConfig } from '@notion-ub/contracts';
import {
  disableConnect,
  hideConnect,
  onConnectClick,
  onSettingsClick,
  promptForConfig,
  setStatus,
  showRetry,
} from '@web/providers/uiController';
import { loadStoredConfig, saveStoredConfig } from '@web/services/config';
import { VOSK_MODEL_URL } from './glasses/constants';
import { startGlasses } from './glasses/runtime';
import { setBridge } from './state';
import { preloadVoskModel } from './stt';
import { getDevEnvConfig, getTenantConfig, setTenantConfig } from './tenant-config';

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, ensure a Notion tenant config
// is set (prompting on first run), start the glasses runtime, warm the
// voice model in the background
// ---------------------------------------------------------------------------

/** Prompts for config (pre-filled with `prefill`), persists it, and applies it. */
async function reconfigure(prefill?: TenantConfig | null): Promise<void> {
  const cfg = await promptForConfig(prefill);
  await saveStoredConfig(cfg);
  setTenantConfig(cfg);
}

export async function boot(): Promise<void> {
  async function connect(): Promise<void> {
    setStatus('Waiting for Even Hub bridge...');
    disableConnect();

    try {
      const bridge = await waitForEvenAppBridge();
      setBridge(bridge);

      let cfg = await loadStoredConfig();
      if (!cfg) cfg = getDevEnvConfig();
      if (!cfg) {
        setStatus('Enter your Notion settings to continue.');
        await reconfigure();
      } else {
        setTenantConfig(cfg);
      }

      // Wire event listener + render the initial menu screen
      await startGlasses();

      setStatus('Connected! Use your glasses.');
      hideConnect();

      // Warm the Vosk model in the background — off the critical path, same as EvenChess.
      // By the time the user navigates to Add Task the model will be ready.
      preloadVoskModel(VOSK_MODEL_URL);
    } catch {
      setStatus('Connection failed. Tap to retry.');
      showRetry();
    }
  }

  // Auto-connect on load
  void connect();

  // Manual retry button
  onConnectClick(() => void connect());

  // Settings button — always available, independent of connection state
  onSettingsClick(() => void reconfigure(getTenantConfig()));
}
