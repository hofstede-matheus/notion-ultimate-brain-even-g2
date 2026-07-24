import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { TenantConfig } from '@notion-ub/contracts';
import {
  disableConnect,
  hideConnect,
  onConnectClick,
  onSettingsClick,
  promptForConfig,
  SettingsCancelledError,
  setStatus,
  showRetry,
} from '@web/providers/uiController';
import { loadStoredConfig, saveStoredConfig } from '@web/services/config';
import { VOSK_MODEL_URL } from './glasses/constants';
import { startGlasses } from './glasses/events';
import { loadPreviousSession, startPersisting } from './logging/persist';
import { trace } from './logging/trace';
import { setBridge } from './state';
import { preloadVoskModel } from './stt';
import { getDevEnvConfig, getTenantConfig, setTenantConfig } from './tenant-config';

// ---------------------------------------------------------------------------
// App bootstrap — connect the Even Hub bridge, ensure a Notion tenant config
// is set (prompting on first run), start the glasses runtime, warm the
// voice model in the background
// ---------------------------------------------------------------------------

/**
 * Prompts for config (pre-filled with `prefill`), persists it, and applies it.
 * When `prefill` is present the form is cancellable (a back button appears);
 * backing out keeps the existing config untouched.
 */
async function reconfigure(prefill?: TenantConfig | null): Promise<void> {
  try {
    const cfg = await promptForConfig(prefill, prefill != null);
    await saveStoredConfig(cfg);
    setTenantConfig(cfg);
    trace.info('BOOT', 'tenant config saved');
  } catch (err) {
    if (err instanceof SettingsCancelledError) {
      trace.info('BOOT', 'settings cancelled, keeping existing config');
      return;
    }
    throw err;
  }
}

export async function boot(): Promise<void> {
  trace.info('BOOT', 'session start', {
    app: __APP_VERSION__,
    apiBase: import.meta.env.VITE_API_BASE || '(same-origin)',
    ua: navigator.userAgent,
  });
  // Fire-and-forget: previous-session lines get prepended once loaded, but
  // nothing else in boot() should wait on the storage bridge for this.
  void loadPreviousSession().finally(startPersisting);

  async function connect(): Promise<void> {
    trace.info('BOOT', 'connect start');
    setStatus('Waiting for Even Hub bridge...');
    disableConnect();

    try {
      const bridge = await waitForEvenAppBridge();
      setBridge(bridge);
      trace.info('BOOT', 'bridge acquired');

      let cfg = await loadStoredConfig();
      let cfgSource: 'stored' | 'env' | 'prompted' = 'stored';
      if (!cfg) {
        cfg = getDevEnvConfig();
        cfgSource = 'env';
      }
      if (!cfg) {
        setStatus('Enter your Notion settings to continue.');
        cfgSource = 'prompted';
        await reconfigure();
      } else {
        setTenantConfig(cfg);
      }
      trace.info('BOOT', `config source = ${cfgSource}`);

      // Wire event listener + render the initial menu screen
      await startGlasses();
      trace.info('BOOT', 'glasses started');

      setStatus('Connected! Use your glasses.');
      hideConnect();

      // Warm the Vosk model in the background — off the critical path, same as EvenChess.
      // By the time the user navigates to Add Task the model will be ready.
      trace.info('BOOT', 'vosk preload started');
      preloadVoskModel(VOSK_MODEL_URL);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      trace.error('BOOT', `connect failed: ${msg}`);
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
